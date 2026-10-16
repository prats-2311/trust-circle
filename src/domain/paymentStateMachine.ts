import type { PaymentEventType, PaymentState } from "./types";

const TRANSITIONS: Record<PaymentState, Partial<Record<PaymentEventType, PaymentState>>> = {
  created: { APPROVE: "approved" },
  approved: { AUTHORISE: "authorised" },
  authorised: { RELEASE: "released", HOLD: "held" },
  held: { RELEASE: "released", BLOCK: "blocked", EXPIRE: "expired" },
  released: { CAPTURE: "captured" },
  captured: { PAY_OUT: "paid_out", PAYOUT_FAIL: "payout_failed" },
  blocked: { VOID: "voided" },
  expired: { VOID: "voided" },
  payout_failed: { REFUND: "refunded" },
  paid_out: { PAYOUT_FAIL: "payout_failed" },
  voided: {},
  refunded: {},
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: PaymentState,
    readonly event: PaymentEventType,
  ) {
    super(`Cannot apply ${event} to a payment in state ${from}`);
    this.name = "InvalidTransitionError";
  }
}

export function nextState(state: PaymentState, event: PaymentEventType): PaymentState {
  const to = TRANSITIONS[state][event];
  if (!to) throw new InvalidTransitionError(state, event);
  return to;
}

export function isTerminal(state: PaymentState): boolean {
  return Object.keys(TRANSITIONS[state]).length === 0;
}
