import { getDb, now, tx } from "@/lib/db";
import { badRequest, handler, json, readJson, requireString } from "@/lib/http";
import { findUserById, requireUser } from "@/lib/auth";
import { rebuildQueue } from "@/lib/matching";
import { loadProfile } from "@/lib/profiles";

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
  const birthdateValue = new Date(`${birthdate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthdate) ||
    Number.isNaN(birthdateValue.getTime()) ||
    birthdateValue.toISOString().slice(0, 10) !== birthdate
  ) {
    throw badRequest("Enter your date of birth as YYYY-MM-DD");
  }
  const today = new Date();
  const latestAdultBirthdate = new Date(
    Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  const earliestAllowedBirthdate = new Date(
    Date.UTC(today.getUTCFullYear() - 91, today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  if (birthdate > latestAdultBirthdate) {
    throw badRequest("Connect Me is 18+. You must be at least 18 to join.");
  }
  if (birthdate < earliestAllowedBirthdate) throw badRequest("Please check your date of birth");

  const gender = String(body.gender ?? "");
  if (!GENDERS.includes(gender as (typeof GENDERS)[number])) throw badRequest("Pick who you are");

  const seeking = String(body.seeking ?? "");
  if (!SEEKING.includes(seeking as (typeof SEEKING)[number])) throw badRequest("Pick who you'd like to meet");

  const cityId = requireString(body, "cityId", { min: 2, max: 120 });
  const lat = typeof body.lat === "number" ? body.lat : Number.NaN;
  const lng = typeof body.lng === "number" ? body.lng : Number.NaN;
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    throw badRequest("Choose a valid location");
  }

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
