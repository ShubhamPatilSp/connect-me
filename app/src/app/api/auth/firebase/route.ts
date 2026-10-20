import { badRequest, handler, json, readJson, requireString } from "@/lib/http";
import {
  createSession,
  findOrCreateUserByEmail,
  findOrCreateUserByPhone,
  isSecureRequest,
  setSessionCookie,
} from "@/lib/auth";
import { verifyFirebaseIdToken } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchange a Firebase ID token for a Connect Me session.
 *
 * Works for both identities: phone accounts (native Android SDK) and email
 * accounts (Firebase email/password). The token is verified against Google's
 * public certificates, then the same opaque session cookie is issued — nothing
 * downstream can tell the two apart.
 */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const idToken = requireString(body, "idToken", { min: 20, max: 8192 });

  let identity;
  try {
    identity = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    throw badRequest(message, "firebase_invalid_token");
  }

  const { userId, isNewUser } =
    identity.email && !identity.phone
      ? findOrCreateUserByEmail(identity.email)
      : findOrCreateUserByPhone(identity.phone as string);

  const token = createSession(userId);
  await setSessionCookie(token, isSecureRequest(req));

  const { getDb } = await import("@/lib/db");
  const row = getDb().prepare("SELECT onboarding_complete FROM users WHERE id = ?").get(userId) as
    | { onboarding_complete: number }
    | undefined;

  return json({
    ok: true,
    userId,
    isNewUser,
    onboardingComplete: Boolean(row?.onboarding_complete),
  });
});
