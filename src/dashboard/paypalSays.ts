import type { PaymentRepo } from "@/payments/paymentRepo";
import type { PayPalGateway } from "@/payments/paypalGateway";
import { dashboardStatus, type DashboardStatus } from "./dashboardService";

export type PayPalSays = { label: string; matches: boolean | null };

const NOT_CHECKED: PayPalSays = { label: "Not checked", matches: null };

const LABELS: Record<string, string> = {
  VOIDED: "Voided",
  CREATED: "On hold",
  PENDING: "On hold",
  CAPTURED: "Captured",
  COMPLETED: "Captured",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Refunded",
  EXPIRED: "Expired",
};

const ON_HOLD = ["CREATED", "PENDING"];
const ENDED = ["VOIDED", "EXPIRED"];
const REFUNDS = ["REFUNDED", "PARTIALLY_REFUNDED", "COMPLETED"];

// PayPal words that agree with each of our statuses. null means any known word agrees.
const AGREES: Record<DashboardStatus, string[] | null> = {
  on_hold: ON_HOLD,
  in_progress: [...ON_HOLD, "CAPTURED", "COMPLETED"],
  stopped: ENDED,
  hold_ended: ENDED,
  sent: ["COMPLETED"],
  refunded: REFUNDS,
  returning: REFUNDS,
  not_approved: null,
};

function titleCase(word: string): string {
  return word
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function paypalSaysFor(status: DashboardStatus, paypalStatus: string | null): PayPalSays {
  if (!paypalStatus) return NOT_CHECKED;
  const word = paypalStatus.toUpperCase();
  const known = LABELS[word];
  if (!known) return { label: titleCase(word), matches: null };
  const agrees = AGREES[status];
  if (agrees === null || agrees.includes(word)) return { label: known, matches: true };
  return { label: "Doesn't match", matches: false };
}

export function createPayPalSaysService(deps: {
  gateway: Pick<PayPalGateway, "getAuthorizationStatus" | "getCaptureStatus">;
  payments: Pick<PaymentRepo, "listForCircle" | "blockedPaymentIds">;
  now?: () => Date;
  ttlMs?: number;
  maxReads?: number;
  concurrency?: number;
}) {
  const { gateway, payments } = deps;
  const now = deps.now ?? (() => new Date());
  const ttlMs = deps.ttlMs ?? 600_000;
  const maxReads = deps.maxReads ?? 20;
  const concurrency = deps.concurrency ?? 4;
  // PayPal's word per payment, remembered with the id it was read by (an authorisation
  // becomes a capture later, and that must be read afresh).
  const cache = new Map<string, { at: number; readKey: string; status: string | null }>();

  async function forCircle(contactId: string): Promise<Record<string, PayPalSays>> {
    // Fetch extra rows so payments PayPal never saw don't use up the read budget.
    const rows = await payments.listForCircle(contactId, maxReads * 5);
    const eligible = rows.filter((p) => p.captureId || p.authorizationId).slice(0, maxReads);
    const blocked = new Set(await payments.blockedPaymentIds(eligible.map((p) => p.id)));
    const out: Record<string, PayPalSays> = {};

    let next = 0;
    async function worker() {
      while (next < eligible.length) {
        const p = eligible[next++];
        if (!p) break;
        const ours = dashboardStatus(p.state, blocked.has(p.id));
        const readKey = p.captureId ? `capture:${p.captureId}` : `authorization:${p.authorizationId}`;
        const hit = cache.get(p.id);
        if (hit && hit.readKey === readKey && now().getTime() - hit.at < ttlMs) {
          out[p.id] = paypalSaysFor(ours, hit.status);
          continue;
        }
        try {
          const { status } = p.captureId
            ? await gateway.getCaptureStatus({ captureId: p.captureId })
            : await gateway.getAuthorizationStatus({ authorizationId: p.authorizationId! });
          cache.set(p.id, { at: now().getTime(), readKey, status });
          out[p.id] = paypalSaysFor(ours, status);
        } catch (e) {
          // Class name and HTTP status only: never ids, payees or bodies.
          const status = (e as { status?: unknown }).status;
          console.warn("paypalSays read failed", {
            errorName: e instanceof Error ? e.name : "UnknownError",
            status: typeof status === "number" ? status : undefined,
          });
          out[p.id] = NOT_CHECKED;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, eligible.length) }, worker));
    return out;
  }

  return { forCircle };
}

export type PayPalSaysService = ReturnType<typeof createPayPalSaysService>;
