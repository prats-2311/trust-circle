import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotAllowedError } from "@/payments/paymentService";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const SARAH = "22222222-2222-4222-8222-222222222222";
const MARGARET = "11111111-1111-4111-8111-111111111111";
const ROBERT = "33333333-3333-4333-8333-333333333333";
const REPORT = { findings: [], toolCalls: [], usedPayPal: false, summary: "ok" };

const review = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ env: { SESSION_SECRET: SECRET }, aftercare: { review } }) }));
import { POST } from "./route";

let clock = Date.parse("2026-10-16T00:00:00Z");
beforeEach(() => {
  clock += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  review.mockReset().mockResolvedValue(REPORT);
});

const call = (body: unknown, userId?: string) =>
  POST(new Request("http://x/api/circle/aftercare", {
    method: "POST",
    headers: { "content-type": "application/json", ...(userId ? { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } : {}) },
    body: JSON.stringify(body),
  }));

describe("POST /api/circle/aftercare", () => {
  it("answers 401 when signed out", async () => {
    expect((await call({ senderId: MARGARET })).status).toBe(401);
    expect(review).not.toHaveBeenCalled();
  });

  it("answers 400 for a bad sender id", async () => {
    expect((await call({ senderId: "nope" }, SARAH)).status).toBe(400);
  });

  it("answers 403 when the caller is not in the sender's circle", async () => {
    review.mockRejectedValue(new NotAllowedError("Not in this circle"));
    const res = await call({ senderId: MARGARET }, ROBERT);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not in this circle" });
  });

  it("answers 200 with the report", async () => {
    const res = await call({ senderId: MARGARET }, SARAH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(REPORT);
    expect(review).toHaveBeenCalledWith({ contactId: SARAH, senderId: MARGARET });
  });

  it("answers 429 for a second run within 60 seconds, then allows one after", async () => {
    expect((await call({ senderId: MARGARET }, SARAH)).status).toBe(200);
    vi.setSystemTime(clock + 30_000);
    const res = await call({ senderId: MARGARET }, SARAH);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Please wait a minute before running another review." });
    expect(review).toHaveBeenCalledTimes(1);
    vi.setSystemTime(clock + 61_000);
    expect((await call({ senderId: MARGARET }, SARAH)).status).toBe(200);
  });

  it("does not count a refused attempt against the limit", async () => {
    review.mockRejectedValueOnce(new NotAllowedError("Not in this circle"));
    expect((await call({ senderId: MARGARET }, SARAH)).status).toBe(403);
    expect((await call({ senderId: MARGARET }, SARAH)).status).toBe(200);
  });
});
