import { getDb, now } from "@/lib/db";
import { forbidden, handler, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { demoFeaturesEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo-only subscription switch.
 *
 * In production this endpoint does not exist: entitlements are written by the
 * App Store / Play receipt webhook (RevenueCat) after server-side verification.
 * Here it exists so the paywall, Likes You and unlimited-swipes paths can be
 * exercised end to end.
 */
export const POST = handler(async (req: Request) => {
  if (!demoFeaturesEnabled(req)) throw forbidden("Upgrades are handled by the app stores");

  const user = await requireUser();
  const body = await readJson(req);
  const enable = body.enable !== false;

  getDb()
    .prepare("UPDATE users SET is_premium = ?, last_active_at = ? WHERE id = ?")
    .run(enable ? 1 : 0, now(), user.id);

  return json({ ok: true, isPremium: enable });
});
