import { createHash, timingSafeEqual } from "node:crypto";
import { getContainer } from "@/server/container";
import { resetDemo } from "@/server/demoReset";
import { errorResponse } from "@/server/http";
import type { PaymentState } from "@/domain/types";

// Money may still be moving or authorised in these states, so the reset must not wipe the rows.
// blocked and expired are included: their PayPal authorisation is only voided once they reach voided.
const IN_FLIGHT = ["approved", "authorised", "released", "captured", "payout_failed", "blocked", "expired"] as PaymentState[];

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Wipes the shared demo back to its clean story. Guarded by an explicit opt-in flag and the bearer token.
export async function POST(req: Request) {
  try {
    const { env, db, service, repo } = getContainer();
    if (env.DEMO_DAILY_RESET !== "1") return Response.json({ error: "not found" }, { status: 404 });
    if (!env.CRON_SECRET) return Response.json({ error: "unauthorised" }, { status: 401 });
    const given = digest(req.headers.get("authorization") ?? "");
    const expected = digest(`Bearer ${env.CRON_SECRET}`);
    if (!timingSafeEqual(given, expected)) return Response.json({ error: "unauthorised" }, { status: 401 });
    // Settle what can be settled first, then void every held authorisation. A void that is still finishing
    // leaves the payment blocked, which the in-flight check below catches.
    await service.expireStale();
    for (const p of await repo.listByStates(["held"])) {
      try {
        await service.systemVoidHeld(p.id);
      } catch {
        // Someone else moved it, or the void is pending; the in-flight check decides.
      }
    }
    if ((await repo.listByStates(IN_FLIGHT)).length > 0) return Response.json({ ok: true, skipped: "in-flight" });
    await resetDemo(db);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
