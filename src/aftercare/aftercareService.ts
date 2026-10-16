import type { CircleRepo } from "@/circle/circleRepo";
import { matchKeys } from "@/domain/matchKeys";
import type { PaymentRepo } from "@/payments/paymentRepo";
import { NotAllowedError } from "@/payments/paymentService";
import type { AftercareInput, AftercareReport } from "./aftercareAgent";

const WINDOW_MS = 30 * 86_400_000;

export function createAftercareService(deps: {
  payments: Pick<PaymentRepo, "listBySender" | "isContactFor">;
  circle: Pick<CircleRepo, "getUser" | "sendersOf">;
  /** Match keys of every account the shared scam list has confirmed. */
  registryConfirmed: () => Promise<Set<string>>;
  agent: (input: AftercareInput) => Promise<AftercareReport>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return {
    async review(a: { contactId: string; senderId: string }): Promise<AftercareReport> {
      if (!(await deps.payments.isContactFor(a.contactId, a.senderId))) throw new NotAllowedError("Not in this circle");
      const since = now().getTime() - WINDOW_MS;
      const [all, confirmed, sender] = await Promise.all([deps.payments.listBySender(a.senderId), deps.registryConfirmed(), deps.circle.getUser(a.senderId)]);
      const payments = all
        .filter((p) => p.createdAt.getTime() >= since)
        .map((p) => ({
          id: p.id,
          payee: p.payee,
          amountCents: p.amountCents,
          state: p.state,
          createdAt: p.createdAt.toISOString(),
          confirmedScamPayee: matchKeys(p.payee).some((k) => confirmed.has(k)),
        }));
      return deps.agent({ senderName: sender?.displayName ?? "This person", payments });
    },
  };
}
