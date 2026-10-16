import { createHash, timingSafeEqual } from "node:crypto";
import { getContainer } from "@/server/container";
import { resetDemo } from "@/server/demoReset";
import { errorResponse } from "@/server/http";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Wipes the shared demo back to its clean story. Guarded by an explicit opt-in flag and the bearer token.
export async function POST(req: Request) {
  try {
    const { env, db } = getContainer();
    if (env.DEMO_DAILY_RESET !== "1") return Response.json({ error: "not found" }, { status: 404 });
    if (!env.CRON_SECRET) return Response.json({ error: "unauthorised" }, { status: 401 });
    const given = digest(req.headers.get("authorization") ?? "");
    const expected = digest(`Bearer ${env.CRON_SECRET}`);
    if (!timingSafeEqual(given, expected)) return Response.json({ error: "unauthorised" }, { status: 401 });
    await resetDemo(db);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
