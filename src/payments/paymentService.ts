import { randomUUID } from "node:crypto";
import type { PaymentJudge } from "@/ai/groqJudge";
import { nextState } from "@/domain/paymentStateMachine";
import type { PaymentEventType } from "@/domain/types";
import { assessPayment } from "@/risk/assess";
import type { RiskDecision } from "@/risk/decide";
import { normalisePayee, type SenderContext } from "@/risk/signals";
import { ConcurrentUpdateError, type PaymentRecord, type PaymentRepo, type TransitionPatch } from "./paymentRepo";
import { PayPalError, type PayPalGateway } from "./paypalGateway";

export const COOLING_OFF_MS = 24 * 3_600_000;
export const AUTO_VOID_MS = 72 * 3_600_000;
const MAX_AMOUNT_CENTS = 1_000_000;
const MAX_TEXT = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{7,15}$/;

export class PaymentInputError extends Error {
  constructor(readonly field: "payee" | "amountCents" | "note" | "senderAnswer", message: string) {
    super(message);
    this.name = "PaymentInputError";
  }
}

export class NotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAllowedError";
  }
}

type ExtraContext = Pick<SenderContext, "flaggedPayees" | "registry" | "circleLimitCents">;

export function createPaymentService(deps: {
  repo: PaymentRepo;
  gateway: PayPalGateway;
  judge: PaymentJudge;
  now?: () => Date;
  newId?: () => string;
  extraContext?: (senderId: string) => Promise<ExtraContext>;
}) {
  const { repo, gateway, judge } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;
  const extra = deps.extraContext ?? (async () => ({ flaggedPayees: [], registry: { confirmed: [], unconfirmed: [] } }));

  async function step(
    p: PaymentRecord,
    event: PaymentEventType,
    actorId: string | null,
    patch: Omit<TransitionPatch, "state"> = {},
  ): Promise<PaymentRecord> {
    const to = nextState(p.state, event);
    const updated = await repo.transition(p.id, p.state, { ...patch, state: to }, p.version);
    await repo.audit({ paymentId: p.id, actorId, action: event, fromState: p.state, toState: to, detail: {} });
    return updated;
  }

  async function mustGet(id: string): Promise<PaymentRecord> {
    const p = await repo.get(id);
    if (!p) throw new NotAllowedError("Payment not found");
    return p;
  }

  const isUncertain = (e: unknown) => e instanceof PayPalError && e.uncertain;

  async function refundPayment(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    if (!p.captureId) throw new Error(`Payment ${p.id} has no capture to refund`);
    const { refundId } = await gateway.refundCapture({ paymentId: p.id, captureId: p.captureId });
    return step(p, "REFUND", actorId, { refundId });
  }

  /**
   * Pays the recipient. An uncertain error is retried once with the same request id and never
   * compensated (a refund after a payout that really happened would pay twice). Only a definite
   * failure moves to payout_failed and refunds.
   */
  async function payOut(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    const args = { paymentId: p.id, receiver: p.payee, amountCents: p.amountCents };
    let payoutBatchId: string;
    try {
      try {
        ({ payoutBatchId } = await gateway.sendPayout(args));
      } catch (e) {
        if (!isUncertain(e)) throw e;
        ({ payoutBatchId } = await gateway.sendPayout(args));
      }
    } catch (e) {
      if (isUncertain(e)) throw e;
      const failed = await step(p, "PAYOUT_FAIL", actorId);
      return refundPayment(failed, actorId);
    }
    return step(p, "PAY_OUT", actorId, { payoutBatchId });
  }

  async function settle(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    if (!p.authorizationId) throw new Error(`Payment ${p.id} has no authorization`);
    const { captureId } = await gateway.captureAuthorization({ paymentId: p.id, authorizationId: p.authorizationId });
    let cur = await step(p, "RELEASE", actorId);
    cur = await step(cur, "CAPTURE", actorId, { captureId });
    return payOut(cur, actorId);
  }

  async function voidHeld(p: PaymentRecord, event: "BLOCK" | "EXPIRE", actorId: string | null): Promise<PaymentRecord> {
    const stopped = await step(p, event, actorId);
    await gateway.voidAuthorization({ paymentId: stopped.id, authorizationId: stopped.authorizationId! });
    return step(stopped, "VOID", actorId);
  }

  function validate(a: { payee: string; amountCents: number; note?: string; senderAnswer?: string }) {
    const payee = normalisePayee(a.payee ?? "");
    if (!EMAIL.test(payee) && !PHONE.test(payee)) {
      throw new PaymentInputError("payee", "Please enter the person's email address or phone number.");
    }
    if (!Number.isInteger(a.amountCents) || a.amountCents < 1 || a.amountCents > MAX_AMOUNT_CENTS) {
      throw new PaymentInputError("amountCents", "Please enter an amount between $0.01 and $10,000.");
    }
    if (a.note && a.note.length > MAX_TEXT) throw new PaymentInputError("note", "The note is too long.");
    if (a.senderAnswer && a.senderAnswer.length > MAX_TEXT) throw new PaymentInputError("senderAnswer", "The answer is too long.");
    return payee;
  }

  return {
    async start(a: { senderId: string; payee: string; amountCents: number; note?: string; senderAnswer?: string }) {
      const payee = validate(a);
      const facts = await repo.senderContextFacts(a.senderId, now());
      const decision: RiskDecision = await assessPayment(
        { payee, amountCents: a.amountCents, note: a.note, senderAnswer: a.senderAnswer },
        { ...facts, ...(await extra(a.senderId)) },
        judge,
      );
      const id = newId();
      let payment = await repo.insert({
        id, senderId: a.senderId, payee, amountCents: a.amountCents,
        note: a.note ?? null, senderAnswer: a.senderAnswer ?? null, state: "created",
        riskLevel: decision.level, scamType: decision.scamType, reasons: decision.reasons,
        paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null,
        authorisedAt: null, coolingOffUntil: null,
      });
      const { orderId } = await gateway.createAuthorizeOrder({ paymentId: id, amountCents: a.amountCents });
      payment = await repo.transition(id, "created", { state: "created", paypalOrderId: orderId });
      return { payment, decision };
    },

    async completeApproval(a: { paymentId: string; senderId: string }) {
      let p = await mustGet(a.paymentId);
      if (p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can complete this payment.");
      p = await step(p, "APPROVE", a.senderId);
      const { authorizationId } = await gateway.authorizeOrder({ paymentId: p.id, orderId: p.paypalOrderId! });
      const authorisedAt = now();
      p = await step(p, "AUTHORISE", a.senderId, { authorizationId, authorisedAt });
      if (p.riskLevel === "high") {
        return step(p, "HOLD", null, { coolingOffUntil: new Date(authorisedAt.getTime() + COOLING_OFF_MS) });
      }
      return settle(p, a.senderId);
    },

    async contactDecision(a: { paymentId: string; contactId: string; decision: "approve" | "block" }) {
      const p = await mustGet(a.paymentId);
      if (!(await repo.isContactFor(a.contactId, p.senderId))) {
        throw new NotAllowedError("Only someone in the sender's circle can decide.");
      }
      if (p.state !== "held") throw new ConcurrentUpdateError(p.id, "held");
      if (a.decision === "approve") {
        // Claim the row first so a racing block or release fails before any money moves.
        const claimed = await repo.transition(p.id, "held", { state: "held" }, p.version);
        return settle(claimed, a.contactId);
      }
      return voidHeld(p, "BLOCK", a.contactId);
    },

    async senderRelease(a: { paymentId: string; senderId: string }) {
      const p = await mustGet(a.paymentId);
      if (p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can release this payment.");
      if (p.state !== "held" || !p.coolingOffUntil || now() < p.coolingOffUntil) {
        throw new NotAllowedError("This payment can't be released yet.");
      }
      const claimed = await repo.transition(p.id, "held", { state: "held" }, p.version);
      return settle(claimed, a.senderId);
    },

    async expireStale() {
      const expired: string[] = [];
      const voidRetried: string[] = [];
      const payoutRetried: string[] = [];
      const refundRetried: string[] = [];

      // One failing row never aborts the sweep; a ConcurrentUpdateError means someone else acted.
      async function each(rows: PaymentRecord[], work: (p: PaymentRecord) => Promise<void>) {
        for (const p of rows) {
          try {
            await work(p);
          } catch {
            // Left in its current state; the next sweep retries it.
          }
        }
      }

      await each(await repo.listByStates(["held"]), async (p) => {
        if (p.authorisedAt && now().getTime() - p.authorisedAt.getTime() >= AUTO_VOID_MS) {
          await voidHeld(p, "EXPIRE", null);
          expired.push(p.id);
        }
      });
      await each(await repo.listByStates(["blocked", "expired"]), async (p) => {
        await gateway.voidAuthorization({ paymentId: p.id, authorizationId: p.authorizationId! });
        await step(p, "VOID", null);
        voidRetried.push(p.id);
      });
      await each(await repo.listByStates(["captured"]), async (p) => {
        await payOut(p, null);
        payoutRetried.push(p.id);
      });
      await each(await repo.listByStates(["payout_failed"]), async (p) => {
        await refundPayment(p, null);
        refundRetried.push(p.id);
      });
      return { expired, voidRetried, payoutRetried, refundRetried };
    },
  };
}
