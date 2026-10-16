import type { AlertService } from "@/alerts/alertService";
import type { CircleRepo } from "@/circle/circleRepo";
import type { PaymentServiceEvent } from "@/payments/paymentService";
import type { RegistryHooks } from "@/registry/hooks";
import type { VerificationService } from "@/verification/verificationService";

async function safely(step: string, paymentId: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (e) {
    console.warn("payment event step failed", { step, paymentId, error: e instanceof Error ? e.name : "unknown" });
  }
}

export function createPaymentEventHandler(deps: {
  circle: CircleRepo;
  alerts: Pick<AlertService, "notify">;
  verification: Pick<VerificationService, "startForHeld">;
  registry?: RegistryHooks;
}) {
  return async (e: PaymentServiceEvent): Promise<void> => {
    const p = e.payment;
    if (e.type === "blocked_by_contact") {
      if (deps.registry) await safely("registry", p.id, () => deps.registry!.onContactBlock(p, e.actorId));
      return;
    }
    // Asking the real person matters most, so it starts before the circle is told.
    if (e.type === "held") await safely("verification", p.id, () => deps.verification.startForHeld(p));
    const sender = await deps.circle.getUser(p.senderId);
    const payload = { senderName: sender?.displayName ?? "Someone in your circle", amountCents: p.amountCents, payee: p.payee };
    const kind = e.type === "held" ? "payment_held" : "medium_payment_sent";
    const contacts = await deps.circle.contactsOf(p.senderId);
    await Promise.allSettled(
      contacts.map((c) => safely("alert", p.id, () => deps.alerts.notify({ recipientId: c.contactId, kind, paymentId: p.id, payload }))),
    );
  };
}
