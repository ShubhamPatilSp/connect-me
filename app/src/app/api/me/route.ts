import { getDb } from "@/lib/db";
import { badRequest, handler, json, readJson, optionalString } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profiles";
import { likesRemaining, likesUsedToday, rebuildQueue } from "@/lib/matching";
import { CITY_IDS } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const profile = loadProfile(user.id, { lat: Number(user.lat), lng: Number(user.lng) });
  const db = getDb();
  const matchCount = db
    .prepare(
      "SELECT COUNT(*) AS n FROM matches WHERE (user_a = ? OR user_b = ?) AND unmatched_at IS NULL",
    )
    .get(user.id, user.id) as { n: number };

  return json({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      cityId: user.city_id,
      onboardingComplete: Boolean(user.onboarding_complete),
      isPremium: Boolean(user.is_premium),
      photoVerified: Boolean(user.photo_verified),
      intent: user.intent,
    },
    profile,
    prefs: {
      ageMin: user.pref_age_min,
      ageMax: user.pref_age_max,
      distanceKm: user.pref_distance_km,
      verifiedOnly: Boolean(user.pref_verified_only),
    },
    stats: {
      likesRemaining: likesRemaining(user),
      likesUsed: likesUsedToday(user.id),
      matches: Number(matchCount.n),
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const db = getDb();

  const sets: string[] = [];
  const values: Array<string | number | null> = [];

  const bio = optionalString(body, "bio", 500);
  if (bio !== undefined) {
    sets.push("bio = ?");
    values.push(bio);
  }

  const job = optionalString(body, "job", 60);
  if (job !== undefined) {
    sets.push("job = ?");
    values.push(job || null);
  }

  const name = optionalString(body, "name", 40);
  if (name !== undefined && name.length >= 2) {
    sets.push("name = ?");
    values.push(name);
  }

  if (body.heightCm !== undefined && body.heightCm !== null) {
    const h = Number(body.heightCm);
    if (!Number.isFinite(h) || h < 120 || h > 220) {
      throw badRequest("Height must be between 120 and 220 cm");
    }
    sets.push("height_cm = ?");
    values.push(Math.round(h));
  }

  if (body.cityId !== undefined) {
    const cityId = String(body.cityId);
    if (!CITY_IDS.includes(cityId)) throw badRequest("That city isn't in Khandesh");
    sets.push("city_id = ?");
    values.push(cityId);
  }

  if (body.prefAgeMin !== undefined || body.prefAgeMax !== undefined) {
    const min = Number(body.prefAgeMin ?? 21);
    const max = Number(body.prefAgeMax ?? 40);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 18 || max > 80 || min > max) {
      throw badRequest("Invalid age range");
    }
    sets.push("pref_age_min = ?", "pref_age_max = ?");
    values.push(Math.round(min), Math.round(max));
  }

  if (body.prefDistanceKm !== undefined) {
    const d = Number(body.prefDistanceKm);
    if (!Number.isFinite(d) || d < 1 || d > 200) throw badRequest("Invalid distance");
    sets.push("pref_distance_km = ?");
    values.push(Math.round(d));
  }

  if (body.prefVerifiedOnly !== undefined) {
    sets.push("pref_verified_only = ?");
    values.push(body.prefVerifiedOnly ? 1 : 0);
  }

  if (sets.length > 0) {
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values, user.id);
  }

  if (Array.isArray(body.interests)) {
    const tags = body.interests
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 30)
      .slice(0, 12);
    db.prepare("DELETE FROM user_interests WHERE user_id = ?").run(user.id);
    const insert = db.prepare("INSERT OR IGNORE INTO user_interests (user_id, tag) VALUES (?, ?)");
    for (const tag of tags) insert.run(user.id, tag);
  }

  if (Array.isArray(body.photos)) {
    const urls = body.photos
      .filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 900_000)
      .slice(0, 6);
    if (urls.length > 0) {
      db.prepare("DELETE FROM photos WHERE user_id = ?").run(user.id);
      const insert = db.prepare(
        "INSERT INTO photos (user_id, url, position, moderation) VALUES (?, ?, ?, 'approved')",
      );
      urls.forEach((url, index) => insert.run(user.id, url, index));
    }
  }

  // Preferences changed → the materialised queue is no longer valid.
  rebuildQueue(user, db);

  const profile = loadProfile(user.id, { lat: Number(user.lat), lng: Number(user.lng) });
  return json({ ok: true, profile });
});
