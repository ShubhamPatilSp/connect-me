import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe.
 *
 * Used by the Android shell to verify an address before handing the WebView
 * over to it, and by deployment health checks. Deliberately cheap: one
 * `SELECT 1`, no session, no rate limit.
 */
export async function GET(): Promise<Response> {
  let database = "ok";
  try {
    getDb().prepare("SELECT 1 AS ok").get();
  } catch {
    database = "error";
  }

  const healthy = database === "ok";
  return Response.json(
    {
      ok: healthy,
      service: "connexa",
      region: "Khandesh",
      database,
      time: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
