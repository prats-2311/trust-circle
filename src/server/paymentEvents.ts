import type { AlertService } from "@/alerts/alertService";
import type { CircleRepo } from "@/circle/circleRepo";
import type { PaymentServiceEvent } from "@/payments/paymentService";
import type { VerificationService } from "@/verification/verificationService";

async function safely(step: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (e) {
    console.warn("payment event step failed", { step, error: e instanceof Error ? e.name : "unknown" });
  }
}

export function createPaymentEventHandler(deps: {
  circle: CircleRepo;
  alerts: Pick<AlertService, "notify">;
  verification: Pick<VerificationService, "startForHeld">;
}) {
  return async (e: PaymentServiceEvent): Promise<void> => {
    const p = e.payment;
    // Asking the real person matters most, so it starts before the circle is told.
    if (e.type === "held") await safely("verification", () => deps.verification.startForHeld(p));
    const sender = await deps.circle.getUser(p.senderId);
    const payload = { senderName: sender?.displayName ?? "Someone in your circle", amountCents: p.amountCents, payee: p.payee };
    const kind = e.type === "held" ? "payment_held" : "medium_payment_sent";
    for (const c of await deps.circle.contactsOf(p.senderId)) {
      await safely("alert", () => deps.alerts.notify({ recipientId: c.contactId, kind, paymentId: p.id, payload }));
    }
  };
}
