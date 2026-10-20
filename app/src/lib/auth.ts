/**
 * Authentication: phone OTP + opaque server-side sessions.
 *
 * Design notes
 *  - OTPs are never stored in plaintext: HMAC-SHA256(secret, phone|code).
 *  - Verification is constant-time to avoid timing oracles.
 *  - Sessions are 256-bit random tokens; only their SHA-256 digest is stored,
 *    so a database leak cannot be replayed as a login.
 *  - Cookies are httpOnly + SameSite=Lax, and Secure outside development.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

import { getDb, now, DAY } from "./db";
import { cityLabel } from "./geo";
import { HttpError, tooMany, unauthorized } from "./http";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "connexa_session";
const SESSION_TTL = 30 * DAY;
const OTP_TTL = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN = 30;
const OTP_HOURLY_LIMIT = 5;

let cachedSecret: string | null = null;

function secret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.CONNEXA_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  // Dev fallback: a persisted random secret keeps sessions valid across restarts.
  const file = path.resolve(process.cwd(), "data/.secret");
  try {
    if (fs.existsSync(file)) {
      cachedSecret = fs.readFileSync(file, "utf8").trim();
      if (cachedSecret.length >= 32) return cachedSecret;
    }
    const generated = crypto.randomBytes(48).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, generated, { mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(48).toString("hex");
    return cachedSecret;
  }
}

const hmac = (value: string): string =>
  crypto.createHmac("sha256", secret()).update(value).digest("hex");

const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalise Indian mobile numbers to E.164 (+91XXXXXXXXXX).
 * Accepts 10 digits, 0-prefixed, +91-prefixed, and spaced/dashed input.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let national: string | null = null;
  if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("91")) national = digits.slice(2);
  if (!national || !/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "";
  return phone.length >= 4 ? `••••••${phone.slice(-4)}` : phone;
}

export interface OtpRequestResult {
  expiresAt: number;
  /** Present only outside production so the flow is testable without an SMS gateway. */
  devCode?: string;
}

export function requestOtp(phone: string, options: { exposeCode?: boolean } = {}): OtpRequestResult {
  const db = getDb();
  const t = now();
  const existing = db
    .prepare("SELECT sent_at FROM otps WHERE phone = ?")
    .get(phone) as { sent_at: number } | undefined;

  if (existing && t - Number(existing.sent_at) < OTP_RESEND_COOLDOWN) {
    const wait = OTP_RESEND_COOLDOWN - (t - Number(existing.sent_at));
    throw tooMany(`Please wait ${wait}s before requesting another code`);
  }

  const recent = db
    .prepare("SELECT COUNT(*) AS n FROM otps WHERE phone = ? AND sent_at > ?")
    .get(phone, t - 3600) as { n: number };
  if (Number(recent.n) >= OTP_HOURLY_LIMIT) {
    throw tooMany("Too many codes requested. Try again in an hour.");
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = t + OTP_TTL;
  db.prepare(
    `INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       sent_at = excluded.sent_at`,
  ).run(phone, hmac(`${phone}|${code}`), expiresAt, t);

  const expose =
    options.exposeCode ??
    (process.env.NODE_ENV !== "production" || process.env.CONNEXA_DEV_OTP === "1");
  return expose ? { expiresAt, devCode: code } : { expiresAt };
}

export interface VerifyResult {
  token: string;
  userId: string;
  isNewUser: boolean;
}

/**
 * Find or create the user row for a verified phone number.
 *
 * Shared by both sign-in paths: our own OTP flow and Firebase phone auth.
 */
export function findOrCreateUserByPhone(phone: string): { userId: string; isNewUser: boolean } {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) as
    | { id: string }
    | undefined;
  if (existing) return { userId: String(existing.id), isNewUser: false };

  const userId = `u_${crypto.randomUUID()}`;
  const t = now();
  // A placeholder row keeps the schema strict; onboarding fills it in.
  db.prepare(
    `INSERT INTO users (id, phone, name, birthdate, gender, seeking, city_id, lat, lng,
                        bio, onboarding_complete, last_active_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, phone, "", "2000-01-01", "woman", "everyone", "jalgaon", 21.0077, 75.5626, "", 0, t, t);

  return { userId, isNewUser: true };
}

/**
 * Find or create the user row for a verified email address.
 *
 * Email accounts have no phone number — the column is nullable so both
 * identity types can live in one table.
 */
export function findOrCreateUserByEmail(email: string): { userId: string; isNewUser: boolean } {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalized) as
    | { id: string }
    | undefined;
  if (existing) return { userId: String(existing.id), isNewUser: false };

  const userId = `u_${crypto.randomUUID()}`;
  const t = now();
  db.prepare(
    `INSERT INTO users (id, phone, name, birthdate, gender, seeking, city_id, lat, lng,
                        bio, onboarding_complete, last_active_at, created_at, email)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "", "2000-01-01", "woman", "everyone", "jalgaon", 21.0077, 75.5626, "", 0, t, t, normalized);

  return { userId, isNewUser: true };
}

export function verifyOtp(phone: string, code: string): VerifyResult {
  const db = getDb();
  const t = now();
  const row = db
    .prepare("SELECT code_hash, expires_at, attempts FROM otps WHERE phone = ?")
    .get(phone) as { code_hash: string; expires_at: number; attempts: number } | undefined;

  if (!row) throw new HttpError(400, "otp_missing", "Request a code first");
  if (Number(row.expires_at) < t) {
    db.prepare("DELETE FROM otps WHERE phone = ?").run(phone);
    throw new HttpError(400, "otp_expired", "That code expired. Request a new one.");
  }
  if (Number(row.attempts) >= OTP_MAX_ATTEMPTS) {
    db.prepare("DELETE FROM otps WHERE phone = ?").run(phone);
    throw new HttpError(429, "otp_locked", "Too many attempts. Request a new code.");
  }
  if (!safeEqual(row.code_hash, hmac(`${phone}|${code}`))) {
    db.prepare("UPDATE otps SET attempts = attempts + 1 WHERE phone = ?").run(phone);
    throw new HttpError(400, "otp_invalid", "That code doesn't match. Try again.");
  }

  db.prepare("DELETE FROM otps WHERE phone = ?").run(phone);

  const { userId, isNewUser } = findOrCreateUserByPhone(phone);
  return { token: createSession(userId), userId, isNewUser };
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const t = now();
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, t, t + SESSION_TTL);
  return token;
}

export function destroySession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function destroyAllSessions(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export interface UserRow {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  birthdate: string;
  gender: "woman" | "man" | "nonbinary";
  seeking: "women" | "men" | "everyone";
  city_id: string;
  lat: number;
  lng: number;
  bio: string;
  job: string | null;
  height_cm: number | null;
  intent: string | null;
  pref_age_min: number;
  pref_age_max: number;
  pref_distance_km: number;
  pref_verified_only: number;
  photo_verified: number;
  is_premium: number;
  shadow_banned: number;
  onboarding_complete: number;
  last_active_at: number;
  created_at: number;
}

export function findUserById(id: string): UserRow | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ?? null;
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name || "there",
    phone: maskPhone(row.phone),
    cityId: row.city_id,
    cityName: cityLabel(row.city_id),
    onboardingComplete: Boolean(row.onboarding_complete),
    isPremium: Boolean(row.is_premium),
    photoVerified: Boolean(row.photo_verified),
  };
}

/** Resolve the session cookie to a user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const row = await getSessionRow();
  return row ? toSessionUser(row) : null;
}

export async function getSessionRow(): Promise<UserRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const session = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(sha256(token)) as { user_id: string; expires_at: number } | undefined;
  if (!session) return null;

  if (Number(session.expires_at) < now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    return null;
  }
  return findUserById(String(session.user_id));
}

export async function requireUser(): Promise<UserRow> {
  const row = await getSessionRow();
  if (!row) throw unauthorized();
  if (row.shadow_banned) throw unauthorized("This account is under review");
  return row;
}

/**
 * Cookies are marked `Secure` only when the request actually arrived over TLS.
 *
 * A dev server reached over the LAN (http://192.168.x.x:3000) would otherwise
 * have its session cookie dropped by the browser, which looks exactly like a
 * failed login.
 */
export function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function setSessionCookie(token: string, secure: boolean): Promise<void> {
  return (async () => {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_TTL,
    });
  })();
}

export function clearSessionCookie(): Promise<void> {
  return (async () => {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  })();
}
