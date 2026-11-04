import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const SARAH = "22222222-2222-4222-8222-222222222222";
const SAYS = { "pay-1": { label: "Voided", matches: true }, "pay-2": { label: "Not checked", matches: null } };

const forCircle = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ env: { SESSION_SECRET: SECRET }, paypalSays: { forCircle } }) }));
import { GET } from "./route";

beforeEach(() => {
  forCircle.mockReset().mockResolvedValue(SAYS);
});

const call = (userId?: string) =>
  GET(new Request("http://x/api/circle/dashboard/paypal", {
    headers: userId ? { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } : {},
  }));

describe("GET /api/circle/dashboard/paypal", () => {
  it("answers 401 when signed out", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in." });
    expect(forCircle).not.toHaveBeenCalled();
  });

  it("answers 200 with the service result for the caller", async () => {
    const res = await call(SARAH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ says: SAYS });
    expect(forCircle).toHaveBeenCalledWith(SARAH);
  });

  it("answers with an error response when the service throws", async () => {
    forCircle.mockRejectedValue(new Error("boom"));
    expect((await call(SARAH)).status).toBeGreaterThanOrEqual(400);
  });
});
