import { cookies } from "next/headers";

import { clearSessionCookie, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  await clearSessionCookie();
  return json({ ok: true });
});
