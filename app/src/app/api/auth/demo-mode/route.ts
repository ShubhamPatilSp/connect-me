import { demoFeaturesEnabled } from "@/lib/env";
import { handler, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler((req: Request) =>
  json({ enabled: demoFeaturesEnabled(req) }),
);
