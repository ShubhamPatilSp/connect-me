import { createSession, findUserById, isSecureRequest, setSessionCookie } from "@/lib/auth";
import { forbidden, handler, json } from "@/lib/http";
import { demoFeaturesEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-tap demo session.
 *
 * Enabled for localhost and development, and for any host when
 * CONNEXA_DEMO_LOGIN=1 is set explicitly. Disabled on a public domain by
 * default (set CONNEXA_DEMO_LOGIN=0 to force it off everywhere).
 */
export const POST = handler(async (req: Request) => {
  if (!demoFeaturesEnabled(req)) throw forbidden("Demo login is disabled");

  const user = findUserById("u_demo");
  if (!user) throw forbidden("Demo account not seeded");

  const token = createSession(user.id);
  await setSessionCookie(token, isSecureRequest(req));

  return json({ ok: true, userId: user.id, onboardingComplete: Boolean(user.onboarding_complete) });
});
