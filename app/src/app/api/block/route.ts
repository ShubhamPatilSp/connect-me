import { getDb, now } from "@/lib/db";
import { badRequest, handler, json, readJson, requireString } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Block or unblock a user. Blocking is symmetric in effect, one-directional in storage. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const targetId = requireString(body, "targetId", { min: 1, max: 64 });
  if (targetId === user.id) throw badRequest("You can't block yourself");

  const db = getDb();
  const block = body.block !== false;

  if (block) {
    db.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)").run(
      user.id,
      targetId,
      now(),
    );
    // A blocked pair can never resurface in discovery.
    db.prepare("DELETE FROM candidate_queue WHERE user_id = ? AND candidate_id = ?").run(user.id, targetId);
    db.prepare("DELETE FROM candidate_queue WHERE user_id = ? AND candidate_id = ?").run(targetId, user.id);
  } else {
    db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").run(user.id, targetId);
  }

  return json({ ok: true, blocked: block });
});
