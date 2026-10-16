import type { PaymentState, Requester, RiskLevel, ScamType } from "@/domain/types";

export interface PaymentRecord {
  id: string;
  senderId: string;
  payee: string;
  amountCents: number;
  note: string | null;
  senderAnswer: string | null;
  state: PaymentState;
  riskLevel: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  impersonatedRequester: Requester | null;
  paypalOrderId: string | null;
  authorizationId: string | null;
  captureId: string | null;
  payoutBatchId: string | null;
  refundId: string | null;
  authorisedAt: Date | null;
  coolingOffUntil: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEntry {
  paymentId: string;
  actorId: string | null;
  action: string;
  fromState: PaymentState | null;
  toState: PaymentState | null;
  detail: Record<string, unknown>;
}

export interface TransitionAudit {
  actorId: string | null;
  action: string;
  detail?: Record<string, unknown>;
}

export class ConcurrentUpdateError extends Error {
  constructor(readonly paymentId: string, readonly expected: PaymentState) {
    super(`Payment ${paymentId} is no longer in state ${expected}`);
    this.name = "ConcurrentUpdateError";
  }
}

export type NewPayment = Omit<PaymentRecord, "version" | "createdAt" | "updatedAt">;
export type TransitionPatch = Partial<Omit<PaymentRecord, "id" | "senderId" | "version" | "createdAt" | "updatedAt">> & { state: PaymentState };

export interface PaymentRepo {
  insert(p: NewPayment): Promise<PaymentRecord>;
  get(id: string): Promise<PaymentRecord | null>;
  transition(
    id: string,
    expected: PaymentState,
    patch: TransitionPatch,
    expectedVersion?: number,
    audit?: TransitionAudit,
  ): Promise<PaymentRecord>;
  listBySender(senderId: string): Promise<PaymentRecord[]>;
  listHeldForContact(contactId: string): Promise<PaymentRecord[]>;
  listByStates(states: PaymentState[]): Promise<PaymentRecord[]>;
  senderContextFacts(
    senderId: string,
    now: Date,
  ): Promise<{ previousPayees: string[]; recentAmountsCents: number[]; paymentsInLastHour: number }>;
  isContactFor(contactId: string, senderId: string): Promise<boolean>;
  userExists(id: string): Promise<boolean>;
  audit(e: AuditEntry): Promise<void>;
  auditFor(paymentId: string): Promise<AuditEntry[]>;
}
