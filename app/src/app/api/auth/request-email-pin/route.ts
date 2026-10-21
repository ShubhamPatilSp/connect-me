import { requestEmailDemoOtp } from "@/lib/auth";
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
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw badRequest("Enter a valid email address", "invalid_email");
  }

  const result = await requestEmailDemoOtp(email);
  return json({ ok: true, expiresAt: result.expiresAt, devCode: result.devCode });
});
