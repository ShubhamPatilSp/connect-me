import { getDb } from "@/lib/db";
import { handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { loadProfiles } from "@/lib/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const user = await requireUser();
    const { userId } = await ctx.params;
    const db = getDb();

    const profile = loadProfiles(
      [userId],
      { lat: Number(user.lat), lng: Number(user.lng) },
      db,
    ).get(userId);
    if (!profile) throw notFound("That profile doesn't exist");

    const [a, b] = [user.id, userId].sort();
    const match = db
      .prepare("SELECT id, unmatched_at FROM matches WHERE user_a = ? AND user_b = ?")
      .get(a, b) as { id: string; unmatched_at: number | null } | undefined;

    const likedMe = Boolean(
      db
        .prepare("SELECT 1 AS x FROM swipes WHERE swiper_id = ? AND target_id = ? AND action IN ('like','super')")
        .get(userId, user.id),
    );
    const iLiked = Boolean(
      db
        .prepare("SELECT 1 AS x FROM swipes WHERE swiper_id = ? AND target_id = ? AND action IN ('like','super')")
        .get(user.id, userId),
    );
    const blocked = Boolean(
      db
        .prepare(
          "SELECT 1 AS x FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
        )
        .get(user.id, userId, userId, user.id),
    );

    return json({
      profile,
      relationship: {
        matched: Boolean(match && !match.unmatched_at),
        matchId: match?.id ?? null,
        likedMe,
        iLiked,
        blocked,
      },
    });
  },
);
