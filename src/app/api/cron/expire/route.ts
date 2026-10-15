import { createHash, timingSafeEqual } from "node:crypto";
import { getContainer } from "@/server/container";
import { errorResponse } from "@/server/http";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function POST(req: Request) {
  try {
    const { env, service } = getContainer();
    if (!env.CRON_SECRET) return Response.json({ error: "unauthorised" }, { status: 401 });
    const given = digest(req.headers.get("authorization") ?? "");
    const expected = digest(`Bearer ${env.CRON_SECRET}`);
    if (!timingSafeEqual(given, expected)) return Response.json({ error: "unauthorised" }, { status: 401 });
    return Response.json(await service.expireStale());
  } catch (e) {
    return errorResponse(e);
  }
}
