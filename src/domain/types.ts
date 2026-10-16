export type RiskLevel = "low" | "medium" | "high";

const ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return ORDER[a] >= ORDER[b] ? a : b;
}

export const SCAM_TYPES = [
  "impersonation_family",
  "impersonation_organisation",
  "invoice",
  "investment",
  "romance",
  "tech_support",
  "shopping",
  "prize_or_lottery",
  "other",
  "none",
  "unknown",
] as const;
export type ScamType = (typeof SCAM_TYPES)[number];

export type PaymentState =
  | "created"
  | "approved"
  | "authorised"
  | "held"
  | "released"
  | "captured"
  | "paid_out"
  | "blocked"
  | "expired"
  | "voided"
  | "payout_failed"
  | "refunded";

export type PaymentEventType =
  | "APPROVE"
  | "AUTHORISE"
  | "HOLD"
  | "RELEASE"
  | "CAPTURE"
  | "PAY_OUT"
  | "BLOCK"
  | "EXPIRE"
  | "VOID"
  | "PAYOUT_FAIL"
  | "REFUND";

export type Preset = "family" | "business" | "solo";

export type IdentifierType = "email" | "phone" | "url";
export interface Identifier {
  type: IdentifierType;
  value: string;
}

export interface Requester {
  kind: "person" | "organisation";
  name: string;
}
