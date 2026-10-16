import type { PaymentRecord } from "@/payments/paymentRepo";
import { identifierForPayee, type RegistryService } from "./registryService";

export function createRegistryHooks(registry: Pick<RegistryService, "record">) {
  const recordPayee = (payment: PaymentRecord, reporterId: string, source: "contact_block" | "real_person_denied") =>
    registry.record({ reporterId, identifiers: [identifierForPayee(payment.payee)], scamType: payment.scamType, source }).then(() => undefined);
  return {
    onContactBlock: (payment: PaymentRecord, contactId: string) => recordPayee(payment, contactId, "contact_block"),
    onImpersonationConfirmed: (payment: PaymentRecord, responderId: string) => recordPayee(payment, responderId, "real_person_denied"),
  };
}

export type RegistryHooks = ReturnType<typeof createRegistryHooks>;
