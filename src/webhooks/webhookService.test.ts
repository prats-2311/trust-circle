import { describe, expect, it, vi } from "vitest";
import { createWebhookService, WebhookFailedError } from "./webhookService";
import type { WebhookRepo } from "./webhookRepo";

const PID = "00000000-0000-4000-8000-000000000001";
const at = new Date("2026-10-16T10:00:00Z");

function setup(over: { claim?: boolean; attempts?: number; payoutOutcome?: "applied" | "ignored" | "deferred"; exists?: boolean } = {}) {
  const repo: WebhookRepo = {
    claim: vi.fn().mockResolvedValue(over.claim === false ? null : { attempts: over.attempts ?? 1 }),
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
    expect((await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).result).toBe("duplicate");
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
    expect((await t.service.handle(payoutEvent(type))).result).toBe("processed");
    expect(t.payments.payoutOutcome).toHaveBeenCalledWith({ paymentId: PID, outcome, eventId: "WH-1", eventType: type });
    expect(t.repo.claim).toHaveBeenCalledWith("WH-1", type, at);
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-1", at, "applied");
  });

  it("is ignored when the payment is not in a state that takes the outcome", async () => {
    const t = setup({ payoutOutcome: "ignored" });
    expect((await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).result).toBe("ignored");
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-1", at, "ignored");
  });

  it("ignores a payout item whose sender_item_id is not a uuid", async () => {
    const t = setup();
    expect((await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED", "not-a-uuid"))).result).toBe("ignored");
    expect((await t.service.handle({ id: "WH-2", event_type: "PAYMENT.PAYOUTS-ITEM.RETURNED", resource: {} })).result).toBe("ignored");
    expect(t.payments.payoutOutcome).not.toHaveBeenCalled();
  });

  it("ignores an unknown event type", async () => {
    const t = setup();
    expect((await t.service.handle({ id: "WH-3", event_type: "BILLING.PLAN.CREATED", resource: {} })).result).toBe("ignored");
    expect(t.repo.markProcessed).toHaveBeenCalledWith("WH-3", at, "ignored");
    expect(t.audit).not.toHaveBeenCalled();
  });

  it("audits a capture event against the payment found by custom_id", async () => {
    const t = setup();
    const out = await t.service.handle({ id: "WH-4", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1", custom_id: PID } });
    expect(out.result).toBe("processed");
    expect(t.audit).toHaveBeenCalledWith({
      paymentId: PID, action: "webhook_payment.capture.completed", detail: { eventId: "WH-4", resourceId: "CAP1" },
    });
  });

  it("ignores a capture event whose payment cannot be found", async () => {
    const t = setup({ exists: false });
    const out = await t.service.handle({ id: "WH-5", event_type: "CUSTOMER.DISPUTE.CREATED", resource: { id: "PP-D-1", custom_id: PID } });
    expect(out.result).toBe("ignored");
    expect(t.audit).not.toHaveBeenCalled();
  });

  it("records an error, leaves the event unprocessed and throws with the attempt count", async () => {
    const t = setup({ attempts: 3 });
    t.payments.payoutOutcome.mockRejectedValue(new TypeError("db down"));
    const err = await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WebhookFailedError);
    expect(err).toMatchObject({ attempts: 3, errorName: "TypeError" });
    expect(t.repo.markFailed).toHaveBeenCalledWith("WH-1", at, "TypeError");
    expect(t.repo.markProcessed).not.toHaveBeenCalled();
  });

  it("keeps a handler's error message out of the thrown error", async () => {
    const t = setup();
    t.payments.payoutOutcome.mockRejectedValue(new Error("payout to someone@example.com failed"));
    const err = (await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED")).catch((e: unknown) => e)) as WebhookFailedError;
    expect(err).toBeInstanceOf(WebhookFailedError);
    expect(JSON.stringify({ message: err.message, name: err.name, errorName: err.errorName, stack: err.stack, cause: err.cause })).not.toContain("someone@example.com");
    expect(JSON.stringify((t.repo.markFailed as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("someone@example.com");
  });

  it("treats a deferred outcome as not processed", async () => {
    const t = setup({ payoutOutcome: "deferred", attempts: 2 });
    expect(await t.service.handle(payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED"))).toEqual({ result: "deferred", attempts: 2 });
    expect(t.repo.markFailed).toHaveBeenCalledWith("WH-1", at, "Deferred");
    expect(t.repo.markProcessed).not.toHaveBeenCalled();
  });

  it("reprocesses an event whose first delivery failed, then reports a duplicate once processed", async () => {
    const processed = new Set<string>();
    const attempts = new Map<string, number>();
    const repo: WebhookRepo = {
      claim: vi.fn(async (id: string) => (processed.has(id) ? null : { attempts: attempts.set(id, (attempts.get(id) ?? 0) + 1).get(id)! })),
      markProcessed: vi.fn(async (id: string) => void processed.add(id)),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const payoutOutcome = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValue("applied");
    const service = createWebhookService({ repo, payments: { payoutOutcome }, audit: vi.fn(), paymentExists: vi.fn(), now: () => at });
    const ev = payoutEvent("PAYMENT.PAYOUTS-ITEM.RETURNED");
    await expect(service.handle(ev)).rejects.toBeInstanceOf(WebhookFailedError);
    expect(await service.handle(ev)).toEqual({ result: "processed", attempts: 2 });
    expect((await service.handle(ev)).result).toBe("duplicate");
    expect(payoutOutcome).toHaveBeenCalledTimes(2);
  });
});
