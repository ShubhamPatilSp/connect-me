import { getDb, now, tx } from "@/lib/db";
import { badRequest, handler, json, readJson, requireString } from "@/lib/http";
import { findUserById, requireUser } from "@/lib/auth";
import { CITY_BY_ID, CITY_IDS, isInKhandesh } from "@/lib/geo";
import { rebuildQueue } from "@/lib/matching";
import { ageFromBirthdate, loadProfile } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENDERS = ["woman", "man", "nonbinary"] as const;
const SEEKING = ["women", "men", "everyone"] as const;
const INTENTS = ["longterm", "marriage", "casual", "friends"] as const;

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);

  const name = requireString(body, "name", { min: 2, max: 40 });
  const birthdate = requireString(body, "birthdate", { min: 10, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || Number.isNaN(Date.parse(birthdate))) {
    throw badRequest("Enter your date of birth as YYYY-MM-DD");
  }
  const age = ageFromBirthdate(birthdate);
  if (age < 18) throw badRequest("Connect Me is 18+. You must be at least 18 to join.");
  if (age > 90) throw badRequest("Please check your date of birth");

  const gender = String(body.gender ?? "");
  if (!GENDERS.includes(gender as (typeof GENDERS)[number])) throw badRequest("Pick who you are");

  const seeking = String(body.seeking ?? "");
  if (!SEEKING.includes(seeking as (typeof SEEKING)[number])) throw badRequest("Pick who you'd like to meet");

  const cityId = String(body.cityId ?? "");
  if (!CITY_IDS.includes(cityId)) throw badRequest("Connect Me is only available inside Khandesh");

  const intent = body.intent === undefined ? null : String(body.intent);
  if (intent !== null && !INTENTS.includes(intent as (typeof INTENTS)[number])) {
    throw badRequest("Pick what you're here for");
  }

  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 500) : "";
  const job = typeof body.job === "string" ? body.job.trim().slice(0, 60) : null;
  const heightCm = Number(body.heightCm ?? 0);

  const rawInterests = Array.isArray(body.interests) ? body.interests : [];
  const interests = Array.from(
    new Set(
      rawInterests
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ).slice(0, 12);
  if (interests.length < 3) throw badRequest("Pick at least 3 interests");

  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  const photos = rawPhotos
    .filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 900_000)
    .slice(0, 6);
  if (photos.length < 1) throw badRequest("Add at least one photo");

  const city = CITY_BY_ID.get(cityId)!;
  let lat = Number(body.lat);
  let lng = Number(body.lng);
  if (!isInKhandesh(lat, lng)) {
    // No GPS permission, or the device is outside the region — fall back to the
    // centroid of the city they selected rather than rejecting the signup.
    lat = city.lat;
    lng = city.lng;
  }

  const promptsInput = Array.isArray(body.prompts) ? body.prompts : [];
  const prompts = promptsInput
    .filter(
      (p): p is { question: string; answer: string } =>
        Boolean(p) && typeof p === "object" && typeof (p as { question?: unknown }).question === "string",
    )
    .map((p) => ({
      question: String(p.question).slice(0, 120),
      answer: String(p.answer ?? "").trim().slice(0, 200),
    }))
    .filter((p) => p.answer.length > 0)
    .slice(0, 3);

  tx((db) => {
    db.prepare(
      `UPDATE users SET name = ?, birthdate = ?, gender = ?, seeking = ?, city_id = ?,
              lat = ?, lng = ?, bio = ?, job = ?, height_cm = ?, intent = ?,
              onboarding_complete = 1, last_active_at = ?
        WHERE id = ?`,
    ).run(
      name,
      birthdate,
      gender,
      seeking,
      cityId,
      lat,
      lng,
      bio,
      job || null,
      Number.isFinite(heightCm) && heightCm >= 120 && heightCm <= 220 ? Math.round(heightCm) : null,
      intent,
      now(),
      user.id,
    );

    db.prepare("DELETE FROM photos WHERE user_id = ?").run(user.id);
    const insertPhoto = db.prepare(
      "INSERT INTO photos (user_id, url, position, moderation) VALUES (?, ?, ?, 'approved')",
    );
    photos.forEach((url, index) => insertPhoto.run(user.id, url, index));

    db.prepare("DELETE FROM user_interests WHERE user_id = ?").run(user.id);
    const insertInterest = db.prepare(
      "INSERT OR IGNORE INTO user_interests (user_id, tag) VALUES (?, ?)",
    );
    for (const tag of interests) insertInterest.run(user.id, tag);

    db.prepare("DELETE FROM prompts WHERE user_id = ?").run(user.id);
    const insertPrompt = db.prepare(
      "INSERT INTO prompts (user_id, question, answer, position) VALUES (?, ?, ?, ?)",
    );
    prompts.forEach((p, index) => insertPrompt.run(user.id, p.question, p.answer, index));
  });

  const refreshed = findUserById(user.id);
  if (refreshed) rebuildQueue(refreshed, getDb());

  const profile = loadProfile(user.id, { lat, lng });
  return json({ ok: true, profile });
});
