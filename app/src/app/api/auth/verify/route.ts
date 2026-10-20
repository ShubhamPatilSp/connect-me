import { badRequest, handler, json, readJson, requireString } from "@/lib/http";
import { findUserById, isSecureRequest, normalizePhone, setSessionCookie, verifyOtp } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const raw = requireString(body, "phone", { min: 6, max: 20 });
  const code = requireString(body, "code", { min: 4, max: 8 });

  const phone = normalizePhone(raw);
  if (!phone) throw badRequest("Enter a valid 10-digit Indian mobile number", "invalid_phone");

  const result = verifyOtp(phone, code);
  await setSessionCookie(result.token, isSecureRequest(req));

  const user = findUserById(result.userId);
  return json({
    ok: true,
    userId: result.userId,
    isNewUser: result.isNewUser,
    onboardingComplete: Boolean(user?.onboarding_complete),
  });
});
