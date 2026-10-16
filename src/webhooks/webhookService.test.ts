import { describe, expect, it, vi } from "vitest";
import { createWebhookService } from "./webhookService";
import type { WebhookRepo } from "./webhookRepo";

const PID = "00000000-0000-4000-8000-000000000001";
const at = new Date("2026-10-16T10:00:00Z");

function setup(over: { claim?: boolean; payoutOutcome?: "applied" | "ignored"; exists?: boolean } = {}) {
  const repo: WebhookRepo = {
    claim: vi.fn().mockResolvedValue(over.claim ?? true),
    markProcessed: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const payments = { payoutOutcome: vi.fn().mockResolvedValue(over.payoutOutcome ?? "applied") };
  const audit = vi.fn().mockResolvedValue(undefined);
  const exists = vi.fn().mockResolvedValue(over.exists ?? true);
  const service = createWebhookService({ repo, payments, audit, paymentExists: exists, now: () => at });
  return { repo, payments, audit, exists, service };
}
const payoutEvent = (type: string, sender: unknown = PID) => ({
  id: "WH-1", event_type: type, resource: { payout_item: { sender_item_id: sender } },
});

describe("webhook service", () => {
  it("returns duplicate and does no work for an event id it has seen", async () => {
    const t = setup({ claim: false });
    expect(await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).toBe("duplicate");
    expect(t.payments.payoutOutcome).not.toHaveBeenCalled();
    expect(t.audit).not.toHaveBeenCalled();
    expect(t.repo.markProcessed).not.toHaveBeenCalled();
  });

  it.each([
    ["PAYMENT.PAYOUTS-ITEM.RETURNED", "failed"],
    ["PAYMENT.PAYOUTS-ITEM.FAILED", "failed"],
    ["PAYMENT.PAYOUTS-ITEM.BLOCKED", "failed"],
    ["PAYMENT.PAYOUTS-ITEM.CANCELED", "failed"],
    ["PAYMENT.PAYOUTS-ITEM.REFUNDED", "failed"],
    ["PAYMENT.PAYOUTS-ITEM.UNCLAIMED", "unclaimed"],
    ["PAYMENT.PAYOUTS-ITEM.SUCCEEDED", "succeeded"],
  ])("maps %s to the %s outcome", async (type, outcome) => {
    const t = setup();
    expect(await t.service.handle(payoutEvent(type))).toBe("processed");
    expect(t.payments.payoutOutcome).toHaveBeenCalledWith({ paymentId: PID, outcome, eventId: "WH-1", eventType: type });
    expect(t.repo.claim).toHaveBeenCalledWith("WH-1", type, at);
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-1", at, "applied");
  });

  it("is ignored when the payment is not in a state that takes the outcome", async () => {
    const t = setup({ payoutOutcome: "ignored" });
    expect(await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).toBe("ignored");
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-1", at, "ignored");
  });

  it("ignores a payout item whose sender_item_id is not a uuid", async () => {
    const t = setup();
    expect(await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED", "not-a-uuid"))).toBe("ignored");
    expect(await t.service.handle({ id: "WH-2", event_type: "PAYMENT.PAYOUTS-ITEM.RETURNED", resource: {} })).toBe("ignored");
    expect(t.payments.payoutOutcome).not.toHaveBeenCalled();
  });

  it("ignores an unknown event type", async () => {
    const t = setup();
    expect(await t.service.handle({ id: "WH-3", event_type: "BILLING.PLAN.CREATED", resource: {} })).toBe("ignored");
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-3", at, "ignored");
    expect(t.audit).not.toHaveBeenCalled();
  });

  it("audits a capture event against the payment found by custom_id", async () => {
    const t = setup();
    const out = await t.service.handle({ id: "WH-4", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1", custom_id: PID } });
    expect(out).toBe("processed");
    expect(t.audit).toHaveBeenCalledWith({
      paymentId: PID, action: "webhook_payment.capture.completed", detail: { eventId: "WH-4", resourceId: "CAP1" },
    });
  });

  it("ignores a capture event whose payment cannot be found", async () => {
    const t = setup({ exists: false });
    const out = await t.service.handle({ id: "WH-5", event_type: "CUSTOMER.DISPUTE.CREATED", resource: { id: "PP-D-1", custom_id: PID } });
    expect(out).toBe("ignored");
    expect(t.audit).not.toHaveBeenCalled();
  });

  it("lets an error propagate after the claim so the route can mark it failed", async () => {
    const t = setup();
    t.payments.payoutOutcome.mockRejectedValue(new Error("db down"));
    await expect(t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).rejects.toThrow("db down");
    expect(t.repo.markProcessed).not.toHaveBeenCalled();
  });
});
