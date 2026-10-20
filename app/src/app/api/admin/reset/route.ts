import crypto from "node:crypto";

import { getDb } from "@/lib/db";
import { forbidden, handler, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Children first so foreign keys stay satisfied throughout. */
const TABLES = [
  "messages",
  "matches",
  "swipes",
  "photos",
  "user_interests",
  "prompts",
  "blocks",
  "reports",
  "otps",
  "sessions",
  "candidate_queue",
  "users",
] as const;

/**
 * Wipe every account and everything attached to it.
 *
 * Disabled unless CONNEXA_ADMIN_TOKEN is set, and the caller must present it.
 * Useful for clearing test data without a redeploy — and on hosts with an
 * ephemeral disk, a redeploy is the only other way to get a clean slate.
 */
export const POST = handler(async (req: Request) => {
  const expected = process.env.CONNEXA_ADMIN_TOKEN;
  if (!expected) throw forbidden("Admin reset is disabled");

  const provided = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw forbidden("Invalid admin token");
  }

  const db = getDb();
  const deleted: Record<string, number> = {};
  for (const table of TABLES) {
    const result = db.prepare(`DELETE FROM ${table}`).run();
    deleted[table] = Number(result.changes);
  }

  return json({ ok: true, deleted });
});
