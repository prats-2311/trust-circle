import { isUuid } from "@/domain/ids";
import type { PaymentService } from "@/payments/paymentService";
import type { WebhookRepo } from "./webhookRepo";

const PAYOUT_PREFIX = "PAYMENT.PAYOUTS-ITEM.";
const FAILED = ["RETURNED", "FAILED", "BLOCKED", "CANCELED", "REFUNDED"];
const AUDIT_ONLY = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.REFUNDED",
  "CUSTOMER.DISPUTE.CREATED",
]);

export class WebhookFailedError extends Error {
  constructor(readonly attempts: number, readonly errorName: string) {
    super("Webhook handling failed.");
    this.name = "WebhookFailedError";
  }
}

export type WebhookEvent = { id: string; event_type: string; resource: unknown };

const asRecord = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});

function payoutOutcomeFor(type: string): "failed" | "unclaimed" | "succeeded" | null {
  if (!type.startsWith(PAYOUT_PREFIX)) return null;
  const kind = type.slice(PAYOUT_PREFIX.length);
  if (FAILED.includes(kind)) return "failed";
  if (kind === "UNCLAIMED") return "unclaimed";
  if (kind === "SUCCEEDED") return "succeeded";
  return null;
}

export function createWebhookService(deps: {
  repo: WebhookRepo;
  payments: Pick<PaymentService, "payoutOutcome">;
  audit: (a: { paymentId: string | null; action: string; detail: Record<string, string> }) => Promise<void>;
  paymentExists: (paymentId: string) => Promise<boolean>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  /** Returns the result to record, or null when the event is of no interest. */
  async function apply(event: WebhookEvent): Promise<"applied" | "ignored" | "deferred"> {
    const resource = asRecord(event.resource);
    const outcome = payoutOutcomeFor(event.event_type);
    if (outcome) {
      const senderItemId = asRecord(resource.payout_item).sender_item_id;
      if (typeof senderItemId !== "string" || !isUuid(senderItemId)) return "ignored";
      return deps.payments.payoutOutcome({ paymentId: senderItemId, outcome, eventId: event.id, eventType: event.event_type });
    }
    if (AUDIT_ONLY.has(event.event_type)) {
      const candidate = [resource.custom_id, resource.invoice_id].find((v): v is string => typeof v === "string" && isUuid(v));
      if (!candidate || !(await deps.paymentExists(candidate))) return "ignored";
      const resourceId = typeof resource.id === "string" ? resource.id : "";
      await deps.audit({
        paymentId: candidate, action: `webhook_${event.event_type.toLowerCase()}`, detail: { eventId: event.id, resourceId },
      });
      return "applied";
    }
    return "ignored";
  }

  return {
    /**
     * A processed event id is a duplicate and does nothing. An event that threw or was deferred stays
     * unprocessed, so PayPal's retry takes it again. Errors are recorded and rethrown as WebhookFailedError.
     */
    async handle(event: WebhookEvent): Promise<{ result: "processed" | "duplicate" | "ignored" | "deferred"; attempts: number }> {
      const claimed = await deps.repo.claim(event.id, event.event_type, now());
      if (!claimed) return { result: "duplicate", attempts: 0 };
      const { attempts } = claimed;
      let result: "applied" | "ignored" | "deferred";
      try {
        result = await apply(event);
      } catch (e) {
        const errorName = e instanceof Error ? e.name : "unknown";
        await deps.repo.markFailed(event.id, now(), errorName).catch(() => undefined);
        throw new WebhookFailedError(attempts, errorName);
      }
      if (result === "deferred") {
        await deps.repo.markFailed(event.id, now(), "Deferred");
        return { result: "deferred", attempts };
      }
      await deps.repo.markProcessed(event.id, now(), result);
      return { result: result === "applied" ? "processed" : "ignored", attempts };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
