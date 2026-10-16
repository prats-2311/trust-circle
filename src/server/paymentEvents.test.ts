import { describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import type { PaymentRecord } from "@/payments/paymentRepo";
import { createPaymentEventHandler } from "./paymentEvents";

const MARGARET = "00000000-0000-4000-8000-000000000001";
const circle = createMemoryCircleRepo({
  users: [
    { id: MARGARET, email: "m@example.com", displayName: "Margaret", safeWordHash: null },
    { id: "s", email: "s@example.com", displayName: "Sarah", safeWordHash: null },
    { id: "d", email: "d@example.com", displayName: "Daniel", safeWordHash: null },
  ],
  links: [
    { senderId: MARGARET, contactId: "s", relationship: "daughter" },
    { senderId: MARGARET, contactId: "d", relationship: "grandson" },
  ],
});
const payment = { id: "p1", senderId: MARGARET, amountCents: 80000, payee: "x@example.com" } as PaymentRecord;
const payload = { senderName: "Margaret", amountCents: 80000, payee: "x@example.com" };

describe("payment event handler", () => {
  it("starts verification first, then tells every circle member about a hold", async () => {
    const order: string[] = [];
    const verification = { startForHeld: vi.fn(async () => { order.push("verify"); return null; }) };
    const alerts = { notify: vi.fn(async (a: { recipientId: string }) => void order.push(`alert:${a.recipientId}`)) };
    await createPaymentEventHandler({ circle, alerts, verification })({ type: "held", payment });
    expect(order[0]).toBe("verify");
    expect(new Set(order.slice(1))).toEqual(new Set(["alert:s", "alert:d"]));
    expect(alerts.notify).toHaveBeenCalledWith({ recipientId: "s", kind: "payment_held", paymentId: "p1", payload });
  });
  it("tells the circle about a medium payment without verification", async () => {
    const verification = { startForHeld: vi.fn() };
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    await createPaymentEventHandler({ circle, alerts, verification })({ type: "medium_sent", payment });
    expect(verification.startForHeld).not.toHaveBeenCalled();
    expect(alerts.notify.mock.calls.map((c) => c[0].kind)).toEqual(["medium_payment_sent", "medium_payment_sent"]);
  });
  it("keeps alerting when verification or one alert fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const verification = { startForHeld: vi.fn().mockRejectedValue(new Error("db")) };
    const alerts = { notify: vi.fn().mockRejectedValueOnce(new Error("db")).mockResolvedValue(undefined) };
    await createPaymentEventHandler({ circle, alerts, verification })({ type: "held", payment });
    expect(alerts.notify).toHaveBeenCalledTimes(2);
  });
  it("notifies contacts concurrently and logs the payment id on failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const verification = { startForHeld: vi.fn().mockResolvedValue(undefined) };
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const started: string[] = [];
    const alerts = {
      notify: vi.fn(async (a: { recipientId: string }) => {
        started.push(a.recipientId);
        if (a.recipientId === "s") throw new Error("db");
        await gate;
      }),
    };
    const done = createPaymentEventHandler({ circle, alerts, verification })({ type: "held", payment });
    await vi.waitFor(() => expect(started.sort()).toEqual(["d", "s"]));
    release();
    await done;
    expect(warn).toHaveBeenCalledWith("payment event step failed", { step: "alert", paymentId: "p1", error: "Error" });
  });
  it("does not send payment_held to the contact who got the verify request", async () => {
    const verification = { startForHeld: vi.fn().mockResolvedValue({ targetContactId: "d" }) };
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    await createPaymentEventHandler({ circle, alerts, verification })({ type: "held", payment });
    expect(alerts.notify.mock.calls.map((c) => [c[0].recipientId, c[0].kind])).toEqual([["s", "payment_held"]]);
  });
  it("tells every contact when the sender cancels", async () => {
    const verification = { startForHeld: vi.fn() };
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    await createPaymentEventHandler({ circle, alerts, verification })({ type: "cancelled_by_sender", payment });
    expect(verification.startForHeld).not.toHaveBeenCalled();
    expect(alerts.notify).toHaveBeenCalledTimes(2);
    expect(alerts.notify).toHaveBeenCalledWith({ recipientId: "s", kind: "payment_update", paymentId: "p1", payload: { ...payload, reason: "cancelled" } });
    expect(alerts.notify).toHaveBeenCalledWith({ recipientId: "d", kind: "payment_update", paymentId: "p1", payload: { ...payload, reason: "cancelled" } });
  });
  it("tells the sender, and only the sender, when a contact blocks; the registry still hears", async () => {
    const verification = { startForHeld: vi.fn() };
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    const registry = { onContactBlock: vi.fn().mockResolvedValue(undefined), onImpersonationConfirmed: vi.fn() };
    await createPaymentEventHandler({ circle, alerts, verification, registry })({ type: "blocked_by_contact", payment, actorId: "s" });
    expect(registry.onContactBlock).toHaveBeenCalledWith(payment, "s");
    expect(alerts.notify).toHaveBeenCalledTimes(1);
    expect(alerts.notify).toHaveBeenCalledWith({
      recipientId: MARGARET, kind: "payment_update", paymentId: "p1", payload: { ...payload, reason: "stopped_by_circle", actorName: "Sarah" },
    });
    expect(verification.startForHeld).not.toHaveBeenCalled();
  });
  it("still runs the registry hook when the sender alert fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const alerts = { notify: vi.fn().mockRejectedValue(new Error("db")) };
    const registry = { onContactBlock: vi.fn().mockResolvedValue(undefined), onImpersonationConfirmed: vi.fn() };
    await createPaymentEventHandler({ circle, alerts, verification: { startForHeld: vi.fn() }, registry })({ type: "blocked_by_contact", payment, actorId: "s" });
    expect(registry.onContactBlock).toHaveBeenCalled();
  });
});
