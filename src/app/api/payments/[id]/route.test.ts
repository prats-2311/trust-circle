import { describe, expect, it, vi } from "vitest";

const get = vi.fn();
const auditFor = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ repo: { get, auditFor }, env: { SESSION_SECRET: "s" } }) }));
const userId = vi.fn();
vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), currentUserId: () => userId() }));
import { GET } from "./route";

const rec = (over = {}) => ({
  id: "p1", senderId: "u1", payee: "a@b.example", amountCents: 80000, note: null, senderAnswer: "secret", state: "voided", riskLevel: "high",
  scamType: "x", reasons: [], coolingOffUntil: null, authorisedAt: null, createdAt: new Date(), updatedAt: new Date(), ...over,
});
const call = () => GET(new Request("http://x/api/payments/p1"), { params: Promise.resolve({ id: "p1" }) });

describe("GET /api/payments/:id", () => {
  it("answers 401 when signed out", async () => {
    userId.mockReturnValue(null);
    expect((await call()).status).toBe(401);
  });
  it("returns the sender view with the outcome to the sender", async () => {
    userId.mockReturnValue("u1");
    get.mockResolvedValue(rec());
    auditFor.mockResolvedValue([{ action: "BLOCK", actorId: "u1" }]);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: "p1", state: "voided", outcome: "sender" });
    expect(body).not.toHaveProperty("senderAnswer");
    expect(body.paypalVoided).toBe(false);
  });
  it("says when PayPal itself confirmed the void", async () => {
    userId.mockReturnValue("u1");
    get.mockResolvedValue(rec());
    auditFor.mockResolvedValue([{ action: "BLOCK", actorId: "u1", detail: {} }, { action: "VOID", actorId: "u1", detail: { paypalStatus: "VOIDED" } }]);
    expect((await (await call()).json()).paypalVoided).toBe(true);
  });
  it("answers 403 'Payment not found' to anyone else, with no payment data", async () => {
    userId.mockReturnValue("u2");
    get.mockResolvedValue(rec());
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Payment not found" });
  });
  it("answers 403 when the payment does not exist", async () => {
    userId.mockReturnValue("u1");
    get.mockResolvedValue(null);
    expect((await call()).status).toBe(403);
  });
});
