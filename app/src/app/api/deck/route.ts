import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getDeck, likesRemaining } from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));

  const cards = getDeck(user, limit);
  return json({ cards, likesRemaining: likesRemaining(user) });
});
