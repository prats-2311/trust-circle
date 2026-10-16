import type { AlertPayload } from "@/alerts/alertRepo";
import type { AlertService } from "@/alerts/alertService";
import type { CircleRepo } from "@/circle/circleRepo";
import type { PaymentRecord } from "@/payments/paymentRepo";
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

function payloadFor(p: PaymentRecord, senderName: string | undefined): AlertPayload {
  return { senderName: senderName ?? "Someone in your circle", amountCents: p.amountCents, payee: p.payee };
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
      // The registry hook runs first and independently: a failed alert must not skip it.
      if (deps.registry) await safely("registry", p.id, () => deps.registry!.onContactBlock(p, e.actorId));
      await safely("alert", p.id, async () => {
        const [sender, actor] = await Promise.all([deps.circle.getUser(p.senderId), deps.circle.getUser(e.actorId)]);
        await deps.alerts.notify({
          recipientId: p.senderId,
          kind: "payment_update",
          paymentId: p.id,
          payload: { ...payloadFor(p, sender?.displayName), reason: "stopped_by_circle", actorName: actor?.displayName ?? "Someone in your circle" },
        });
      });
      return;
    }
    // Asking the real person matters most, so it starts before the circle is told.
    let askedId: string | undefined;
    if (e.type === "held") {
      try {
        askedId = (await deps.verification.startForHeld(p))?.targetContactId;
      } catch (err) {
        console.warn("payment event step failed", { step: "verification", paymentId: p.id, error: err instanceof Error ? err.name : "unknown" });
      }
    }
    const sender = await deps.circle.getUser(p.senderId);
    const payload = payloadFor(p, sender?.displayName);
    // The contact who was asked already has a verify request, so they don't also get the hold alert.
    const contacts = (await deps.circle.contactsOf(p.senderId)).filter((c) => !(e.type === "held" && c.contactId === askedId));
    const send = (recipientId: string, kind: "payment_held" | "medium_payment_sent" | "payment_update", extra: Partial<AlertPayload> = {}) =>
      safely("alert", p.id, () => deps.alerts.notify({ recipientId, kind, paymentId: p.id, payload: { ...payload, ...extra } }));
    await Promise.allSettled(
      contacts.map((c) =>
        e.type === "cancelled_by_sender"
          ? send(c.contactId, "payment_update", { reason: "cancelled" })
          : send(c.contactId, e.type === "held" ? "payment_held" : "medium_payment_sent"),
      ),
    );
  };
}
