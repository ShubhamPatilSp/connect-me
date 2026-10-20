/**
 * Profile hydration.
 *
 * Loads users + photos + interests + prompts in a fixed number of queries
 * (never N+1) and shapes them for the client. Batched with an IN clause so a
 * 30-card deck costs four round trips, not ninety.
 */

import type { Database } from "./db";
import { getDb } from "./db";
import { CITY_BY_ID, distanceKm } from "./geo";
import type { Gender, Intent, Profile, Seeking } from "./types";

interface UserRowLite {
  id: string;
  name: string;
  birthdate: string;
  gender: Gender;
  seeking: Seeking;
  city_id: string;
  lat: number;
  lng: number;
  bio: string;
  job: string | null;
  height_cm: number | null;
  intent: string | null;
  photo_verified: number;
  is_premium: number;
  last_active_at: number;
}

export function ageFromBirthdate(birthdate: string): number {
  const dob = new Date(`${birthdate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return 25;
  const diff = Date.now() - dob.getTime();
  return Math.max(18, Math.floor(diff / (365.2425 * 86_400_000)));
}

const placeholders = (n: number): string => new Array(n).fill("?").join(",");

export function loadProfiles(
  ids: string[],
  viewer: { lat: number; lng: number } | null,
  db: Database = getDb(),
): Map<string, Profile> {
  const result = new Map<string, Profile>();
  if (ids.length === 0) return result;

  const unique = Array.from(new Set(ids)).slice(0, 500);

  const users = db
    .prepare(`SELECT * FROM users WHERE id IN (${placeholders(unique.length)})`)
    .all(...unique) as unknown as UserRowLite[];

  const photos = db
    .prepare(
      `SELECT user_id, url FROM photos
        WHERE user_id IN (${placeholders(unique.length)}) AND moderation = 'approved'
        ORDER BY position ASC`,
    )
    .all(...unique) as unknown as Array<{ user_id: string; url: string }>;

  const interests = db
    .prepare(
      `SELECT user_id, tag FROM user_interests
        WHERE user_id IN (${placeholders(unique.length)})`,
    )
    .all(...unique) as unknown as Array<{ user_id: string; tag: string }>;

  const prompts = db
    .prepare(
      `SELECT user_id, question, answer FROM prompts
        WHERE user_id IN (${placeholders(unique.length)})
        ORDER BY position ASC`,
    )
    .all(...unique) as unknown as Array<{ user_id: string; question: string; answer: string }>;

  const photosByUser = new Map<string, string[]>();
  for (const p of photos) {
    const list = photosByUser.get(p.user_id) ?? [];
    list.push(p.url);
    photosByUser.set(p.user_id, list);
  }

  const interestsByUser = new Map<string, string[]>();
  for (const i of interests) {
    const list = interestsByUser.get(i.user_id) ?? [];
    list.push(i.tag);
    interestsByUser.set(i.user_id, list);
  }

  const promptsByUser = new Map<string, Array<{ question: string; answer: string }>>();
  for (const p of prompts) {
    const list = promptsByUser.get(p.user_id) ?? [];
    list.push({ question: p.question, answer: p.answer });
    promptsByUser.set(p.user_id, list);
  }

  for (const row of users) {
    const city = CITY_BY_ID.get(row.city_id);
    result.set(row.id, {
      id: row.id,
      name: row.name,
      age: ageFromBirthdate(row.birthdate),
      gender: row.gender,
      seeking: row.seeking,
      cityId: row.city_id,
      cityName: city?.name ?? "Khandesh",
      district: city?.district ?? "Jalgaon",
      distanceKm: viewer ? distanceKm(viewer.lat, viewer.lng, row.lat, row.lng) : null,
      bio: row.bio,
      job: row.job,
      heightCm: row.height_cm,
      intent: (row.intent as Intent | null) ?? null,
      photoVerified: Boolean(row.photo_verified),
      isPremium: Boolean(row.is_premium),
      photos: photosByUser.get(row.id) ?? [],
      interests: interestsByUser.get(row.id) ?? [],
      prompts: promptsByUser.get(row.id) ?? [],
      lastActiveAt: row.last_active_at,
    });
  }

  return result;
}

export function loadProfile(
  id: string,
  viewer: { lat: number; lng: number } | null,
  db: Database = getDb(),
): Profile | null {
  return loadProfiles([id], viewer, db).get(id) ?? null;
}
