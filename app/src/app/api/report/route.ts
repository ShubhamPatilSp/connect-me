import { getDb, now } from "@/lib/db";
import { badRequest, handler, json, readJson, requireOneOf, requireString, optionalString } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_IDS = REPORT_REASONS.map((r) => r.id) as unknown as readonly string[];

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const targetId = requireString(body, "targetId", { min: 1, max: 64 });
  const reason = requireOneOf(body, "reason", REASON_IDS);
  const detail = optionalString(body, "detail", 500) ?? null;

  if (targetId === user.id) throw badRequest("You can't report yourself");

  const db = getDb();
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!target) throw badRequest("Unknown profile");

  db.prepare(
    "INSERT INTO reports (reporter_id, target_id, reason, detail, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
  ).run(user.id, targetId, reason, detail, now());

  // Repeat reports put the account in front of moderation automatically.
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM reports WHERE target_id = ? AND status = 'open'")
    .get(targetId) as { n: number };
  if (Number(count.n) >= 5) {
    db.prepare("UPDATE users SET shadow_banned = 1 WHERE id = ?").run(targetId);
  }

  return json({ ok: true });
});
