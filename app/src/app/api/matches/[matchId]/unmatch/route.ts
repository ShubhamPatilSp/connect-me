import { getDb, now } from "@/lib/db";
import { handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, ctx: { params: Promise<{ matchId: string }> }) => {
    const user = await requireUser();
    const { matchId } = await ctx.params;
    const db = getDb();

    const match = db
      .prepare("SELECT id, user_a, user_b, unmatched_at FROM matches WHERE id = ?")
      .get(matchId) as { id: string; user_a: string; user_b: string; unmatched_at: number | null } | undefined;

    if (!match || (match.user_a !== user.id && match.user_b !== user.id)) {
      throw notFound("That conversation doesn't exist");
    }
    if (match.unmatched_at) return json({ ok: true, alreadyUnmatched: true });

    db.prepare("UPDATE matches SET unmatched_at = ?, unmatched_by = ? WHERE id = ?").run(
      now(),
      user.id,
      matchId,
    );

    // Unmatching also removes the pair from each other's queues.
    const otherId = match.user_a === user.id ? match.user_b : match.user_a;
    db.prepare("DELETE FROM candidate_queue WHERE user_id = ? AND candidate_id = ?").run(user.id, otherId);
    db.prepare("DELETE FROM candidate_queue WHERE user_id = ? AND candidate_id = ?").run(otherId, user.id);

    return json({ ok: true });
  },
);
