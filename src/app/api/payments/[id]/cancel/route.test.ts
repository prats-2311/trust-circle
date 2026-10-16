import { describe, expect, it, vi } from "vitest";
import { ConcurrentUpdateError } from "@/payments/paymentRepo";
import { PaymentPendingError } from "@/payments/paymentService";

const senderCancel = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ service: { senderCancel }, env: { SESSION_SECRET: "s" } }) }));
const userId = vi.fn();
vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), currentUserId: () => userId() }));
import { POST } from "./route";

const call = () => POST(new Request("http://x/api/payments/p1/cancel", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });
const voided = { id: "p1", senderId: "u1", payee: "a@b.example", amountCents: 1, note: null, senderAnswer: "s", state: "voided", riskLevel: "high", scamType: "x", reasons: [], coolingOffUntil: null, authorisedAt: null, createdAt: new Date(), updatedAt: new Date() };

describe("POST /api/payments/:id/cancel", () => {
  it("answers 401 when signed out", async () => {
    userId.mockReturnValue(null);
    expect((await call()).status).toBe(401);
  });
  it("cancels as the signed-in sender and returns the sender view", async () => {
    userId.mockReturnValue("u1");
    senderCancel.mockResolvedValue(voided);
    const res = await call();
    expect(senderCancel).toHaveBeenCalledWith({ paymentId: "p1", senderId: "u1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("voided");
    expect(body).not.toHaveProperty("senderAnswer");
  });
  it("answers 409 when it was already dealt with", async () => {
    userId.mockReturnValue("u1");
    senderCancel.mockRejectedValue(new ConcurrentUpdateError("p1", "held"));
    expect((await call()).status).toBe(409);
  });
  it("answers 202 when finishing", async () => {
    userId.mockReturnValue("u1");
    senderCancel.mockRejectedValue(new PaymentPendingError("p1", new Error("x")));
    expect((await call()).status).toBe(202);
  });
});
