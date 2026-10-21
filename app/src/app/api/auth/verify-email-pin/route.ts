import { findUserById, isSecureRequest, setSessionCookie, verifyEmailDemoOtp } from "@/lib/auth";
import { demoFeaturesEnabled } from "@/lib/env";
import { badRequest, forbidden, handler, json, readJson, requireString } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  if (!demoFeaturesEnabled(req)) {
    throw forbidden("Development PIN sign-in is disabled");
  }

  const body = await readJson(req);
  const email = requireString(body, "email", { min: 3, max: 254 }).toLowerCase();
  const code = requireString(body, "code", { min: 6, max: 6 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw badRequest("Enter a valid email address", "invalid_email");
  }
  if (!/^\d{6}$/.test(code)) {
    throw badRequest("Enter the 6-digit verification code", "invalid_otp");
  }

  const result = await verifyEmailDemoOtp(email, code);
  await setSessionCookie(result.token, isSecureRequest(req));
  const user = findUserById(result.userId);
  return json({
    ok: true,
    userId: result.userId,
    isNewUser: result.isNewUser,
    onboardingComplete: Boolean(user?.onboarding_complete),
  });
});
