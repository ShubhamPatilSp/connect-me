/**
 * Database layer.
 *
 * Uses Node's built-in `node:sqlite` (Node >= 22.5) so there is no native
 * compilation step and no third-party driver to audit. The schema is written
 * to be portable to Postgres with minimal edits: no SQLite-only types, no
 * triggers doing business logic, and every hot path covered by an index.
 *
 * Concurrency model:
 *  - WAL journal so readers never block the writer.
 *  - One writer at a time; every multi-statement mutation runs inside `tx()`.
 *  - `busy_timeout` absorbs short write contention instead of throwing.
 */

import fs from "node:fs";
import path from "node:path";

import { seedIfEmpty } from "./seed";

export type SqlValue = string | number | bigint | null | Uint8Array;

export interface Statement {
  run(...params: SqlValue[]): { changes: number; lastInsertRowid: number | bigint };
  // The driver returns untyped rows; call sites narrow them at the boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...params: SqlValue[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...params: SqlValue[]): any[];
}

export interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  phone               TEXT UNIQUE,
  name                TEXT NOT NULL,
  birthdate           TEXT NOT NULL,
  gender              TEXT NOT NULL CHECK (gender IN ('woman','man','nonbinary')),
  seeking             TEXT NOT NULL CHECK (seeking IN ('women','men','everyone')),
  city_id             TEXT NOT NULL,
  lat                 REAL NOT NULL,
  lng                 REAL NOT NULL,
  bio                 TEXT NOT NULL DEFAULT '',
  job                 TEXT,
  height_cm           INTEGER,
  intent              TEXT,
  pref_age_min        INTEGER NOT NULL DEFAULT 21,
  pref_age_max        INTEGER NOT NULL DEFAULT 40,
  pref_distance_km    INTEGER NOT NULL DEFAULT 100,
  pref_verified_only  INTEGER NOT NULL DEFAULT 0,
  photo_verified      INTEGER NOT NULL DEFAULT 0,
  is_premium          INTEGER NOT NULL DEFAULT 0,
  shadow_banned       INTEGER NOT NULL DEFAULT 0,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  last_active_at      INTEGER NOT NULL,
  created_at          INTEGER NOT NULL,
  email               TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_users_city    ON users(city_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_gender  ON users(gender, seeking);
CREATE INDEX IF NOT EXISTS idx_users_active  ON users(last_active_at DESC);

CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  moderation  TEXT NOT NULL DEFAULT 'approved'
);
CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id, position);

CREATE TABLE IF NOT EXISTS user_interests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_interests_tag ON user_interests(tag);

CREATE TABLE IF NOT EXISTS prompts (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id, position);

CREATE TABLE IF NOT EXISTS swipes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  swiper_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('pass','like','super')),
  created_at INTEGER NOT NULL,
  UNIQUE (swiper_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON swipes(target_id, action);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id, created_at DESC);

CREATE TABLE IF NOT EXISTS matches (
  id              TEXT PRIMARY KEY,
  user_a          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  last_message_at INTEGER,
  unmatched_at    INTEGER,
  unmatched_by    TEXT,
  UNIQUE (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS idx_matches_a ON matches(user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_b ON matches(user_b, last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, id);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id, status);

CREATE TABLE IF NOT EXISTS otps (
  phone        TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  sent_at      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS otp_request_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phone        TEXT NOT NULL,
  requested_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_request_log_phone_time
  ON otp_request_log(phone, requested_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS candidate_queue (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        REAL NOT NULL,
  rank         INTEGER NOT NULL,
  generated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_queue_user_rank ON candidate_queue(user_id, rank);

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const g = globalThis as unknown as {
  __connexaDb?: Database;
  __connexaSeeded?: boolean;
};

function openDatabase(): Database {
  const nodeSqlite = (
    process as unknown as {
      getBuiltinModule: (id: string) => { DatabaseSync: new (path: string) => Database };
    }
  ).getBuiltinModule("node:sqlite");

  const dbPath = process.env.CONNEXA_DB_PATH ?? "./data/connexa.db";
  const absolute = path.resolve(process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });

  const database = new nodeSqlite.DatabaseSync(absolute);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA temp_store = MEMORY;
  `);
  // Migrate first: SCHEMA creates an index on users(email), which cannot run
  // against a pre-email table.
  migrateUsersTable(database);
  database.exec(SCHEMA);
  database.prepare("DELETE FROM users WHERE id = ?").run("u_demo");
  return database;
}

/**
 * Pre-email builds used the phone number as the only identity and declared it
 * NOT NULL. SQLite cannot relax that in place, so the table is rebuilt once.
 * `email` is declared last precisely so the copy can be `SELECT *, NULL`.
 */
function migrateUsersTable(db: Database): void {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { name: string } | undefined;
  if (!exists) return;

  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === "email")) return;

  const ddl = /CREATE TABLE IF NOT EXISTS users \([\s\S]*?\n\);/.exec(SCHEMA)?.[0];
  if (!ddl) throw new Error("users DDL not found in schema");

  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(ddl.replace("CREATE TABLE IF NOT EXISTS users", "CREATE TABLE users_migrated"));
    db.exec("INSERT INTO users_migrated SELECT *, NULL FROM users");
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_migrated RENAME TO users");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_city   ON users(city_id);
    CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender, seeking);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(last_active_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
  `);
  console.log("[db] migrated users table for email identity");
}

export function getDb(): Database {
  if (!g.__connexaDb) {
    g.__connexaDb = openDatabase();
    // Production stays empty unless sample data is explicitly requested.
    const shouldSeed =
      process.env.CONNEXA_AUTOSEED === "1" ||
      (process.env.NODE_ENV !== "production" && process.env.CONNEXA_AUTOSEED !== "0");
    if (shouldSeed && !g.__connexaSeeded) {
      g.__connexaSeeded = true;
      try {
        seedIfEmpty(g.__connexaDb);
      } catch (err) {
        console.error("[db] seed failed", err);
      }
    }
  }
  return g.__connexaDb;
}

/** Run `fn` inside a write transaction, rolling back on any throw. */
export function tx<T>(fn: (db: Database) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* transaction already aborted */
    }
    throw err;
  }
}

export const now = (): number => Math.floor(Date.now() / 1000);
export const DAY = 86_400;

export function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}
