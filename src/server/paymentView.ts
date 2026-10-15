import type { PaymentRecord } from "@/payments/paymentRepo";

export function toSenderView(p: PaymentRecord) {
  return {
    id: p.id,
    payee: p.payee,
    amountCents: p.amountCents,
    note: p.note,
    state: p.state,
    riskLevel: p.riskLevel,
    scamType: p.scamType,
    reasons: p.reasons,
    coolingOffUntil: p.coolingOffUntil,
    authorisedAt: p.authorisedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function toContactView(p: PaymentRecord) {
  return { ...toSenderView(p), senderAnswer: p.senderAnswer };
}
