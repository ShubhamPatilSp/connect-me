/**
 * Matching engine.
 *
 * Two-phase design, because the naive approach (run a filtered geo-query on
 * every swipe) collapses the moment you have real traffic.
 *
 *   Phase 1 — offline: `rebuildQueue` scores every eligible candidate for a
 *   viewer and materialises a ranked queue of ~240 rows. Runs on demand when
 *   the queue is stale (6h) or empty, and is a pure background cost.
 *
 *   Phase 2 — online: `getDeck` reads the queue by rank, which is an index
 *   scan. A swipe costs one insert and one reciprocal lookup.
 *
 * Scoring is a weighted blend of seven signals (interest cosine with IDF
 * weighting, distance decay, activity recency, intent alignment, age
 * proximity, profile completeness, verification) followed by a diversity pass
 * that prevents one city from monopolising a deck and an epsilon-greedy
 * exploration slice so users are not trapped in a filter bubble.
 */

import crypto from "node:crypto";

import { DAY, getDb, now, startOfToday, tx, type Database } from "./db";
import { distanceKm } from "./geo";
import { publish } from "./bus";
import { HttpError } from "./http";
import { ageFromBirthdate, loadProfiles } from "./profiles";
import type { UserRow } from "./auth";
import type { DeckCard, SwipeAction } from "./types";

export const QUEUE_SIZE = 240;
export const QUEUE_TTL = 6 * 3600;
export const FREE_DAILY_LIKES = 25;
export const FREE_DAILY_SUPERS = 1;

const WEIGHTS = {
  interest: 0.32,
  distance: 0.22,
  activity: 0.13,
  intent: 0.1,
  age: 0.08,
  completeness: 0.08,
  verified: 0.07,
} as const;

interface CandidateRow {
  id: string;
  birthdate: string;
  gender: string;
  seeking: string;
  city_id: string;
  lat: number;
  lng: number;
  last_active_at: number;
  photo_verified: number;
  intent: string | null;
  bio_len: number;
  photo_count: number;
  prompt_count: number;
  interest_count: number;
}

interface Scored {
  id: string;
  score: number;
  cityId: string;
}

// ── IDF cache ──────────────────────────────────────────────────────────────

let idfCache: { fingerprint: string; idf: Map<string, number> } | null = null;

function interestIdf(db: Database): Map<string, number> {
  const stats = db
    .prepare("SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS rows FROM user_interests")
    .get() as { users: number; rows: number };
  const fingerprint = `${Number(stats.users)}:${Number(stats.rows)}`;
  if (idfCache && idfCache.fingerprint === fingerprint) return idfCache.idf;

  const rows = db
    .prepare("SELECT tag, COUNT(*) AS df FROM user_interests GROUP BY tag")
    .all() as Array<{ tag: string; df: number }>;
  const total = Math.max(1, Number(stats.users));
  const idf = new Map<string, number>();
  for (const row of rows) {
    // Rare interests carry more signal than "Music", which everyone has.
    idf.set(row.tag, Math.log(1 + total / (1 + Number(row.df))));
  }
  idfCache = { fingerprint, idf };
  return idf;
}

function loadInterestVectors(
  ids: string[],
  db: Database,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const chunkSize = 400;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const sql = `SELECT user_id, tag FROM user_interests WHERE user_id IN (${chunk
      .map(() => "?")
      .join(",")})`;
    const rows = db.prepare(sql).all(...chunk) as Array<{ user_id: string; tag: string }>;
    for (const row of rows) {
      const set = map.get(row.user_id) ?? new Set<string>();
      set.add(row.tag);
      map.set(row.user_id, set);
    }
  }
  return map;
}

// ── Scoring ────────────────────────────────────────────────────────────────

const intentFamily = (intent: string | null): "serious" | "casual" | "friends" | "unknown" => {
  if (intent === "longterm" || intent === "marriage") return "serious";
  if (intent === "casual") return "casual";
  if (intent === "friends") return "friends";
  return "unknown";
};

const INTENT_AFFINITY: Record<string, number> = {
  "serious:serious": 1,
  "casual:casual": 1,
  "friends:friends": 1,
  "serious:friends": 0.45,
  "casual:friends": 0.5,
  "serious:casual": 0.3,
};

function intentScore(a: string | null, b: string | null): number {
  const fa = intentFamily(a);
  const fb = intentFamily(b);
  if (fa === "unknown" || fb === "unknown") return 0.55;
  return INTENT_AFFINITY[`${fa}:${fb}`] ?? 0.5;
}

function completenessScore(c: CandidateRow): number {
  const photos = Math.min(1, Number(c.photo_count) / 3);
  const bio = Math.min(1, Number(c.bio_len) / 70);
  const prompts = Math.min(1, Number(c.prompt_count) / 1);
  const interests = Math.min(1, Number(c.interest_count) / 5);
  return photos * 0.4 + bio * 0.25 + prompts * 0.15 + interests * 0.2;
}

interface ViewerContext {
  id: string;
  gender: string;
  intent: string | null;
  age: number;
  lat: number;
  lng: number;
  interests: Set<string>;
  idfSum: number;
  prefDistance: number;
}

function buildViewerContext(viewer: UserRow, db: Database): ViewerContext {
  const idf = interestIdf(db);
  const tags = db
    .prepare("SELECT tag FROM user_interests WHERE user_id = ?")
    .all(viewer.id) as Array<{ tag: string }>;
  const interests = new Set(tags.map((t) => t.tag));
  let idfSum = 0;
  for (const tag of interests) idfSum += idf.get(tag) ?? 0.5;
  return {
    id: viewer.id,
    gender: viewer.gender,
    intent: viewer.intent,
    age: ageFromBirthdate(viewer.birthdate),
    lat: Number(viewer.lat),
    lng: Number(viewer.lng),
    interests,
    idfSum,
    prefDistance: viewer.pref_distance_km ?? 100,
  };
}

function cosine(a: ViewerContext, b: Set<string>, idf: Map<string, number>): number {
  if (a.interests.size === 0 || b.size === 0) return 0.35;
  let sharedIdf = 0;
  let bIdfSum = 0;
  for (const tag of b) bIdfSum += idf.get(tag) ?? 0.5;
  for (const tag of b) {
    if (a.interests.has(tag)) sharedIdf += idf.get(tag) ?? 0.5;
  }
  const denom = Math.sqrt(Math.max(1e-9, a.idfSum * bIdfSum));
  return Math.min(1, sharedIdf / denom);
}

function scoreCandidate(
  ctx: ViewerContext,
  c: CandidateRow,
  tags: Set<string>,
  idf: Map<string, number>,
  t: number,
): number | null {
  const d = distanceKm(ctx.lat, ctx.lng, Number(c.lat), Number(c.lng));
  // Hard distance gate: never surface someone outside the viewer's radius.
  if (d > ctx.prefDistance) return null;

  const age = ageFromBirthdate(c.birthdate);
  const interest = cosine(ctx, tags, idf);
  const distance = Math.exp(-d / 22);
  const hoursIdle = Math.max(0, (t - Number(c.last_active_at)) / 3600);
  const activity = Math.exp(-hoursIdle / 96);
  const intent = intentScore(ctx.intent, c.intent);
  const ageFit = 1 - Math.min(1, Math.abs(age - ctx.age) / 12);
  const completeness = completenessScore(c);
  const verified = Number(c.photo_verified) ? 1 : 0;

  const raw =
    interest * WEIGHTS.interest +
    distance * WEIGHTS.distance +
    activity * WEIGHTS.activity +
    intent * WEIGHTS.intent +
    ageFit * WEIGHTS.age +
    completeness * WEIGHTS.completeness +
    verified * WEIGHTS.verified;

  return Math.max(0, Math.min(1, raw));
}

// ── Candidate selection ────────────────────────────────────────────────────

function candidateRows(viewer: UserRow, db: Database, limit = 3000): CandidateRow[] {
  const genderClause =
    viewer.seeking === "women"
      ? "u.gender = 'woman'"
      : viewer.seeking === "men"
        ? "u.gender = 'man'"
        : "1 = 1";
  const seekingClause =
    "(u.seeking = 'everyone' OR (u.seeking = 'women' AND ? = 'woman') OR (u.seeking = 'men' AND ? = 'man'))";
  const verifiedClause = viewer.pref_verified_only ? "u.photo_verified = 1" : "1 = 1";
  const distance = viewer.pref_distance_km ?? 100;
  const lat = Number(viewer.lat);
  const lng = Number(viewer.lng);
  const latDelta = distance / 110.574;
  const minLat = Math.max(-90, lat - latDelta);
  const maxLat = Math.min(90, lat + latDelta);
  let geoClause = "u.lat BETWEEN ? AND ?";
  const geoParams: number[] = [minLat, maxLat];

  if (Math.abs(lat) + latDelta < 90) {
    const maxAbsLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
    const lngDelta = distance / (111.32 * Math.cos((maxAbsLat * Math.PI) / 180));
    if (lngDelta < 180) {
      if (lng - lngDelta < -180) {
        geoClause += " AND (u.lng >= ? OR u.lng <= ?)";
        geoParams.push(lng - lngDelta + 360, lng + lngDelta);
      } else if (lng + lngDelta > 180) {
        geoClause += " AND (u.lng >= ? OR u.lng <= ?)";
        geoParams.push(lng - lngDelta, lng + lngDelta - 360);
      } else {
        geoClause += " AND u.lng BETWEEN ? AND ?";
        geoParams.push(lng - lngDelta, lng + lngDelta);
      }
    }
  }

  const sql = `
    SELECT u.id, u.birthdate, u.gender, u.seeking, u.city_id, u.lat, u.lng,
           u.last_active_at, u.photo_verified, u.intent,
           length(u.bio) AS bio_len,
           (SELECT COUNT(*) FROM photos p WHERE p.user_id = u.id AND p.moderation = 'approved') AS photo_count,
           (SELECT COUNT(*) FROM prompts pr WHERE pr.user_id = u.id) AS prompt_count,
           (SELECT COUNT(*) FROM user_interests ui WHERE ui.user_id = u.id) AS interest_count
      FROM users u
     WHERE u.id <> ?
       AND u.onboarding_complete = 1
       AND u.shadow_banned = 0
       AND ${genderClause}
       AND ${seekingClause}
       AND ${verifiedClause}
       AND ${geoClause}
       AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = ? AND s.target_id = u.id)
       AND NOT EXISTS (
             SELECT 1 FROM blocks b
              WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                 OR (b.blocker_id = u.id AND b.blocked_id = ?))
     ORDER BY u.last_active_at DESC
     LIMIT ?
  `;

  return db
    .prepare(sql)
    .all(
      viewer.id,
      viewer.gender,
      viewer.gender,
      ...geoParams,
      viewer.id,
      viewer.id,
      viewer.id,
      limit,
    ) as CandidateRow[];
}

/** Materialise a ranked candidate queue for one viewer. Returns rows written. */
export function rebuildQueue(viewer: UserRow, db: Database = getDb()): number {
  const t = now();
  const idf = interestIdf(db);
  const ctx = buildViewerContext(viewer, db);
  const rows = candidateRows(viewer, db);
  if (rows.length === 0) {
    db.prepare("DELETE FROM candidate_queue WHERE user_id = ?").run(viewer.id);
    return 0;
  }

  const vectors = loadInterestVectors(
    rows.map((r) => r.id),
    db,
  );

  const scored: Scored[] = [];
  for (const row of rows) {
    const age = ageFromBirthdate(row.birthdate);
    if (age < (viewer.pref_age_min ?? 21) || age > (viewer.pref_age_max ?? 40)) continue;
    const score = scoreCandidate(ctx, row, vectors.get(row.id) ?? new Set(), idf, t);
    if (score === null) continue;
    scored.push({ id: row.id, score, cityId: row.city_id });
  }

  scored.sort((a, b) => b.score - a.score);

  // ── Diversity pass ──────────────────────────────────────────────────────
  const selected: Scored[] = [];
  const perCity = new Map<string, number>();
  const cityCap = Math.max(8, Math.ceil(QUEUE_SIZE * 0.18));
  const headSize = Math.floor(QUEUE_SIZE * 0.88);

  for (const item of scored) {
    if (selected.length >= headSize) break;
    const count = perCity.get(item.cityId) ?? 0;
    if (count >= cityCap) continue;
    perCity.set(item.cityId, count + 1);
    selected.push(item);
  }

  // Epsilon-greedy exploration: reserve ~12% of the deck for candidates ranked
  // outside the top slice, so a viewer keeps seeing fresh faces.
  const taken = new Set(selected.map((s) => s.id));
  const explorationPool = scored
    .slice(Math.floor(scored.length * 0.2), Math.floor(scored.length * 0.75))
    .filter((s) => !taken.has(s.id));
  const exploreTarget = Math.min(explorationPool.length, QUEUE_SIZE - selected.length);
  for (let i = 0; i < exploreTarget; i++) {
    const idx = Math.floor(Math.random() * explorationPool.length);
    const [pick] = explorationPool.splice(idx, 1);
    selected.push(pick);
  }

  // Backfill if the pool was thinner than expected.
  if (selected.length < QUEUE_SIZE) {
    for (const item of scored) {
      if (selected.length >= QUEUE_SIZE) break;
      if (!taken.has(item.id)) {
        taken.add(item.id);
        selected.push(item);
      }
    }
  }

  tx((database) => {
    database.prepare("DELETE FROM candidate_queue WHERE user_id = ?").run(viewer.id);
    const insert = database.prepare(
      "INSERT OR REPLACE INTO candidate_queue (user_id, candidate_id, score, rank, generated_at) VALUES (?, ?, ?, ?, ?)",
    );
    selected.slice(0, QUEUE_SIZE).forEach((item, index) => {
      insert.run(viewer.id, item.id, item.score, index, t);
    });
  });

  return Math.min(selected.length, QUEUE_SIZE);
}

export function ensureQueue(viewer: UserRow, db: Database = getDb()): void {
  const row = db
    .prepare("SELECT COUNT(*) AS n, MAX(generated_at) AS g FROM candidate_queue WHERE user_id = ?")
    .get(viewer.id) as { n: number; g: number | null };

  const stale = !row.g || now() - Number(row.g) > QUEUE_TTL;
  if (Number(row.n) === 0 || stale) rebuildQueue(viewer, db);
}

function explain(
  card: { interests: string[]; distanceKm: number | null; lastActiveAt: number; photoVerified: boolean; intent: string | null },
  viewerInterests: Set<string>,
  viewerIntent: string | null,
): string[] {
  const reasons: string[] = [];
  const shared = card.interests.filter((tag) => viewerInterests.has(tag));
  if (shared.length >= 2) reasons.push(`${shared.length} shared interests`);
  else if (shared.length === 1) reasons.push(`Both into ${shared[0]}`);

  if (card.distanceKm !== null) {
    reasons.push(card.distanceKm < 1 ? "In your city" : `${Math.round(card.distanceKm)} km away`);
  }
  if (now() - card.lastActiveAt < DAY) reasons.push("Active today");
  if (card.photoVerified) reasons.push("Photo verified");
  if (intentFamily(card.intent) === intentFamily(viewerIntent) && intentFamily(viewerIntent) !== "unknown") {
    reasons.push("Same intentions");
  }
  return reasons.slice(0, 3);
}

/** Read the next N cards from the materialised queue. */
export function getDeck(viewer: UserRow, limit = 12): DeckCard[] {
  const db = getDb();
  ensureQueue(viewer, db);

  const viewerInterests = new Set(
    (db.prepare("SELECT tag FROM user_interests WHERE user_id = ?").all(viewer.id) as Array<{ tag: string }>).map(
      (r) => r.tag,
    ),
  );

  const fetchQueue = (): Array<{ candidate_id: string; score: number }> =>
    db
      .prepare(
        `SELECT q.candidate_id, q.score
           FROM candidate_queue q
          WHERE q.user_id = ?
            AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = q.user_id AND s.target_id = q.candidate_id)
          ORDER BY q.rank ASC
          LIMIT ?`,
      )
      .all(viewer.id, limit) as Array<{ candidate_id: string; score: number }>;

  let queue = fetchQueue();
  if (queue.length < Math.min(4, limit)) {
    rebuildQueue(viewer, db);
    queue = fetchQueue();
  }
  if (queue.length === 0) return [];

  const ids = queue.map((q) => q.candidate_id);
  const profiles = loadProfiles(ids, { lat: Number(viewer.lat), lng: Number(viewer.lng) }, db);

  const likedMe = new Set(
    (
      db
        .prepare(
          `SELECT swiper_id FROM swipes
            WHERE target_id = ? AND action IN ('like','super')
              AND swiper_id IN (${ids.map(() => "?").join(",")})`,
        )
        .all(viewer.id, ...ids) as Array<{ swiper_id: string }>
    ).map((r) => r.swiper_id),
  );

  const cards: DeckCard[] = [];
  for (const item of queue) {
    const profile = profiles.get(item.candidate_id);
    if (!profile) continue;
    cards.push({
      ...profile,
      score: Number(item.score),
      reasons: explain(profile, viewerInterests, viewer.intent),
      likesYou: likedMe.has(profile.id),
    });
  }
  return cards;
}

// ── Swipes ─────────────────────────────────────────────────────────────────

export interface SwipeResult {
  matched: boolean;
  matchId?: string;
  other?: DeckCard;
  likesRemaining: number;
}

export function likesUsedToday(viewerId: string, db: Database = getDb()): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM swipes WHERE swiper_id = ? AND action IN ('like','super') AND created_at >= ?",
    )
    .get(viewerId, startOfToday()) as { n: number };
  return Number(row.n);
}

export function likesRemaining(viewer: UserRow): number {
  if (viewer.is_premium) return 999;
  return Math.max(0, FREE_DAILY_LIKES - likesUsedToday(viewer.id));
}

export function recordSwipe(viewer: UserRow, targetId: string, action: SwipeAction): SwipeResult {
  if (targetId === viewer.id) throw new HttpError(400, "self_swipe", "You can't swipe on yourself");

  const db = getDb();
  const target = db
    .prepare("SELECT id, name FROM users WHERE id = ? AND onboarding_complete = 1")
    .get(targetId) as { id: string; name: string } | undefined;
  if (!target) throw new HttpError(404, "not_found", "That profile is no longer available");

  const blocked = db
    .prepare(
      `SELECT 1 AS x FROM blocks
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    )
    .get(viewer.id, targetId, targetId, viewer.id);
  if (blocked) throw new HttpError(403, "blocked", "This profile isn't available");

  if (action !== "pass" && !viewer.is_premium) {
    const used = likesUsedToday(viewer.id, db);
    if (used >= FREE_DAILY_LIKES) {
      throw new HttpError(429, "like_limit", "You've used today's likes. Upgrade for unlimited.");
    }
    if (action === "super") {
      const supers = db
        .prepare(
          "SELECT COUNT(*) AS n FROM swipes WHERE swiper_id = ? AND action = 'super' AND created_at >= ?",
        )
        .get(viewer.id, startOfToday()) as { n: number };
      if (Number(supers.n) >= FREE_DAILY_SUPERS) {
        throw new HttpError(429, "super_limit", "You've used today's Super Like. It resets at midnight.");
      }
    }
  }

  return tx((database) => {
    const t = now();
    const inserted = database
      .prepare(
        "INSERT OR IGNORE INTO swipes (swiper_id, target_id, action, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(viewer.id, targetId, action, t);

    if (Number(inserted.changes) === 0) {
      throw new HttpError(409, "duplicate_swipe", "You've already swiped on this person");
    }

    database
      .prepare("DELETE FROM candidate_queue WHERE user_id = ? AND candidate_id = ?")
      .run(viewer.id, targetId);
    database.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(t, viewer.id);

    if (action === "pass") {
      return { matched: false, likesRemaining: likesRemaining(viewer) };
    }

    const reciprocal = database
      .prepare(
        "SELECT 1 AS x FROM swipes WHERE swiper_id = ? AND target_id = ? AND action IN ('like','super')",
      )
      .get(targetId, viewer.id);
    if (!reciprocal) {
      return { matched: false, likesRemaining: likesRemaining(viewer) };
    }

    const [a, b] = [viewer.id, targetId].sort();
    const existing = database
      .prepare("SELECT id FROM matches WHERE user_a = ? AND user_b = ?")
      .get(a, b) as { id: string } | undefined;

    let matchId: string;
    if (existing) {
      matchId = String(existing.id);
      database
        .prepare("UPDATE matches SET unmatched_at = NULL, unmatched_by = NULL WHERE id = ?")
        .run(matchId);
    } else {
      matchId = `m_${crypto.randomUUID()}`;
      database
        .prepare("INSERT INTO matches (id, user_a, user_b, created_at) VALUES (?, ?, ?, ?)")
        .run(matchId, a, b, t);
    }

    const profile = loadProfiles([targetId], null, database).get(targetId);
    const myPhoto = (
      database.prepare("SELECT url FROM photos WHERE user_id = ? ORDER BY position LIMIT 1").get(viewer.id) as
        | { url: string }
        | undefined
    )?.url;

    publish(targetId, {
      type: "match",
      matchId,
      userId: viewer.id,
      name: viewer.name,
      photo: myPhoto ?? null,
    });

    return {
      matched: true,
      matchId,
      other: profile
        ? { ...profile, score: 1, reasons: [], likesYou: true }
        : undefined,
      likesRemaining: likesRemaining(viewer),
    };
  });
}
