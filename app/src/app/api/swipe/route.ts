import { badRequest, handler, json, readJson, requireOneOf, requireString } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { recordSwipe } from "@/lib/matching";
import type { SwipeAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const targetId = requireString(body, "targetId", { min: 1, max: 64 });
  const action = requireOneOf(body, "action", ["pass", "like", "super"] as const);

  if (!targetId.startsWith("u_")) throw badRequest("Unknown profile");

  const result = recordSwipe(user, targetId, action as SwipeAction);
  return json(result);
});
