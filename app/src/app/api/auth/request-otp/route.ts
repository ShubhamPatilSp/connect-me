import { normalizePhone, requestOtp } from "@/lib/auth";
import { demoFeaturesEnabled } from "@/lib/env";
import { badRequest, handler, json, readJson, requireString } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const raw = requireString(body, "phone", { min: 6, max: 20 });
  const phone = normalizePhone(raw);
  if (!phone) throw badRequest("Enter a valid 10-digit Indian mobile number", "invalid_phone");

  // `devCode` is only surfaced when demo features are enabled (localhost /
  // development). In production it goes out over the SMS provider instead.
  const result = requestOtp(phone, { exposeCode: demoFeaturesEnabled(req) });

  return json({
    ok: true,
    phone,
    expiresAt: result.expiresAt,
    devCode: result.devCode ?? null,
  });
});
