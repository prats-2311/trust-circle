import { randomUUID } from "node:crypto";
import type { PaymentJudge } from "@/ai/groqJudge";
import type { PromptGuard } from "@/ai/promptGuard";
import { nextState } from "@/domain/paymentStateMachine";
import type { PaymentEventType } from "@/domain/types";
import type { PatternMatcher } from "@/patterns/patternService";
import { assessPayment } from "@/risk/assess";
import type { RiskDecision } from "@/risk/decide";
import { normalisePayee, type SenderContext } from "@/risk/signals";
import { ConcurrentUpdateError, type PaymentRecord, type PaymentRepo, type TransitionPatch } from "./paymentRepo";
import { PayPalError, type PayPalGateway } from "./paypalGateway";

export const COOLING_OFF_MS = 24 * 3_600_000;
export const AUTO_VOID_MS = 72 * 3_600_000;
export const STALE_MS = 5 * 60_000;
const MAX_AMOUNT_CENTS = 1_000_000;
const MAX_TEXT = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?\d{7,15}$/;
const PHONE_SHAPE = /^\+?[\d\s().-]{7,20}$/;

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

/**
 * Thrown for any failure after a claim step (RELEASE, BLOCK, EXPIRE, APPROVE) has committed.
 * The payment is already moving, so callers must never tell the sender to retry.
 */
export class PaymentPendingError extends Error {
  constructor(readonly paymentId: string, cause?: unknown) {
    super("This payment is being finished.", { cause });
    this.name = "PaymentPendingError";
  }
}

export type PaymentServiceEvent = { type: "held"; payment: PaymentRecord } | { type: "medium_sent"; payment: PaymentRecord }
  | { type: "blocked_by_contact"; payment: PaymentRecord; actorId: string }
  | { type: "cancelled_by_sender"; payment: PaymentRecord };

type ExtraContext = Pick<SenderContext, "flaggedPayees" | "registry" | "circleLimitCents">;

export function createPaymentService(deps: {
  repo: PaymentRepo;
  gateway: PayPalGateway;
  judge: PaymentJudge;
  guard?: PromptGuard;
  patterns?: PatternMatcher;
  now?: () => Date;
  newId?: () => string;
  extraContext?: (senderId: string) => Promise<ExtraContext>;
  /** How long a new hold for this sender cools off. Read once, when the hold starts; never applied to an existing hold. */
  coolingOffMs?: (senderId: string) => Promise<number>;
  linkedMessage?: (senderId: string, payee: string) => Promise<string | undefined>;
  onEvent?: (e: PaymentServiceEvent) => Promise<void>;
}) {
  const { repo, gateway, judge } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? randomUUID;
  const coolingOffMs = deps.coolingOffMs ?? (async () => COOLING_OFF_MS);
  const extra = deps.extraContext ?? (async () => ({ flaggedPayees: [], registry: { confirmed: [], unconfirmed: [] } }));

  async function step(
    p: PaymentRecord,
    event: PaymentEventType,
    actorId: string | null,
    patch: Omit<TransitionPatch, "state"> = {},
    detail?: Record<string, unknown>,
  ): Promise<PaymentRecord> {
    const to = nextState(p.state, event);
    return repo.transition(p.id, p.state, { ...patch, state: to }, p.version, { actorId, action: event, ...(detail ? { detail } : {}) });
  }

  async function mustGet(id: string): Promise<PaymentRecord> {
    const p = await repo.get(id);
    if (!p) throw new NotAllowedError("Payment not found");
    return p;
  }

  /** Notifies listeners (alerts, verification). A failing listener never changes the payment outcome. */
  async function emit(e: PaymentServiceEvent): Promise<void> {
    if (!deps.onEvent) return;
    try {
      await deps.onEvent(e);
    } catch (err) {
      console.warn("payment event handler failed", { type: e.type, paymentId: e.payment.id, error: err instanceof Error ? err.name : "unknown" });
    }
  }

  async function hold(p: PaymentRecord, actorId: string | null, coolingOffUntil: Date): Promise<PaymentRecord> {
    const held = await step(p, "HOLD", actorId, { coolingOffUntil });
    await emit({ type: "held", payment: held });
    return held;
  }

  const isUncertain = (e: unknown) => e instanceof PayPalError && e.uncertain;

  async function refundPayment(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    if (!p.captureId) throw new Error(`Payment ${p.id} has no capture to refund`);
    const { refundId } = await gateway.refundCapture({ paymentId: p.id, captureId: p.captureId });
    return step(p, "REFUND", actorId, { refundId });
  }

  /** Runs work that follows a committed claim; any failure becomes a PaymentPendingError. */
  async function afterClaim<T>(paymentId: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (e) {
      throw e instanceof PaymentPendingError ? e : new PaymentPendingError(paymentId, e);
    }
  }

  /** A 4xx that PayPal answered definitively: no money moved, so compensating is safe. */
  function isDefinitePayoutRejection(e: unknown): boolean {
    return (
      e instanceof PayPalError && !e.uncertain && e.status >= 400 && e.status <= 499 && ![401, 408, 429].includes(e.status)
    );
  }

  /**
   * Live payout. Compensation (refund) happens only after a definite rejection on the first attempt.
   * Anything uncertain or ambiguous leaves the payment captured for the sweep, because a refund after
   * a payout that really happened would pay twice.
   */
  async function payOut(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    const args = { paymentId: p.id, receiver: p.payee, amountCents: p.amountCents };
    let payoutBatchId: string;
    try {
      ({ payoutBatchId } = await gateway.sendPayout(args));
    } catch (e) {
      if (isDefinitePayoutRejection(e)) {
        const failed = await step(p, "PAYOUT_FAIL", actorId);
        return refundPayment(failed, actorId);
      }
      if (!isUncertain(e)) throw e;
      ({ payoutBatchId } = await gateway.sendPayout(args));
    }
    return step(p, "PAY_OUT", actorId, { payoutBatchId });
  }

  /** Sweep payout: retry only. Never compensates. */
  async function retryPayout(p: PaymentRecord): Promise<PaymentRecord | null> {
    let payoutBatchId: string;
    try {
      ({ payoutBatchId } = await gateway.sendPayout({ paymentId: p.id, receiver: p.payee, amountCents: p.amountCents }));
    } catch (e) {
      await repo.audit({
        paymentId: p.id, actorId: null, action: "payout_retry_failed", fromState: p.state, toState: p.state,
        detail: e instanceof PayPalError ? { status: e.status } : {},
      });
      return null;
    }
    return step(p, "PAY_OUT", null, { payoutBatchId });
  }

  async function capture(released: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    if (!released.authorizationId) throw new Error(`Payment ${released.id} has no authorization`);
    const { captureId } = await gateway.captureAuthorization({ paymentId: released.id, authorizationId: released.authorizationId });
    return step(released, "CAPTURE", actorId, { captureId });
  }

  /** RELEASE is the claim: a real state change made before any money moves, so a racing block or expiry cannot also act. */
  async function settle(p: PaymentRecord, actorId: string | null): Promise<PaymentRecord> {
    if (!p.authorizationId) throw new Error(`Payment ${p.id} has no authorization`);
    const released = await step(p, "RELEASE", actorId);
    return afterClaim(p.id, async () => payOut(await capture(released, actorId), actorId));
  }

  function assertHoldOpen(p: PaymentRecord) {
    if (p.authorisedAt && now().getTime() - p.authorisedAt.getTime() >= AUTO_VOID_MS) {
      throw new NotAllowedError("This payment's hold has ended.");
    }
  }

  async function voidHeld(p: PaymentRecord, event: "BLOCK" | "EXPIRE", actorId: string | null): Promise<PaymentRecord> {
    const stopped = await step(p, event, actorId);
    return afterClaim(p.id, async () => {
      await gateway.voidAuthorization({ paymentId: stopped.id, authorizationId: stopped.authorizationId! });
      return step(stopped, "VOID", actorId);
    });
  }

  function validate(a: { payee: string; amountCents: number; note?: string; senderAnswer?: string }) {
    const raw = (a.payee ?? "").trim();
    const payee = normalisePayee(raw);
    const digits = raw.replace(/\D/g, "").length;
    const rawOk = EMAIL.test(raw) || (PHONE_SHAPE.test(raw) && digits >= 7 && digits <= 15);
    if (!rawOk || (!EMAIL.test(payee) && !PHONE.test(payee))) {
      throw new PaymentInputError("payee", "Please enter the person's email address or phone number.");
    }
    if (!Number.isInteger(a.amountCents) || a.amountCents < 1 || a.amountCents > MAX_AMOUNT_CENTS) {
      throw new PaymentInputError("amountCents", "Please enter an amount between $0.01 and $10,000.");
    }
    if (a.note && a.note.length > MAX_TEXT) throw new PaymentInputError("note", "The note is too long.");
    if (a.senderAnswer && a.senderAnswer.length > MAX_TEXT) throw new PaymentInputError("senderAnswer", "The answer is too long.");
    return payee;
  }

  async function settleHeld(a: { paymentId: string; actorId: string }): Promise<PaymentRecord> {
    const p = await mustGet(a.paymentId);
    if (p.state !== "held") throw new ConcurrentUpdateError(p.id, "held");
    assertHoldOpen(p);
    return settle(p, a.actorId);
  }

  async function blockHeld(a: { paymentId: string; actorId: string }): Promise<PaymentRecord> {
    const p = await mustGet(a.paymentId);
    if (p.state !== "held") throw new ConcurrentUpdateError(p.id, "held");
    return voidHeld(p, "BLOCK", a.actorId);
  }

  return {
    async start(a: { senderId: string; payee: string; amountCents: number; note?: string; senderAnswer?: string }) {
      const payee = validate(a);
      // A failed lookup only loses context for the AI; it must not stop the payment being assessed.
      const linkedMessage = deps.linkedMessage ? await deps.linkedMessage(a.senderId, payee).catch(() => undefined) : undefined;
      const facts = await repo.senderContextFacts(a.senderId, now());
      const decision: RiskDecision = await assessPayment(
        { payee, amountCents: a.amountCents, note: a.note, senderAnswer: a.senderAnswer, ...(linkedMessage ? { linkedMessage } : {}) },
        { ...facts, ...(await extra(a.senderId)) },
        judge,
        deps.guard,
        deps.patterns,
      );
      const id = newId();
      let payment = await repo.insert({
        id, senderId: a.senderId, payee, amountCents: a.amountCents,
        note: a.note ?? null, senderAnswer: a.senderAnswer ?? null, state: "created",
        riskLevel: decision.level, scamType: decision.scamType, reasons: decision.reasons,
        impersonatedRequester: decision.impersonatedRequester,
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
      return afterClaim(p.id, async () => {
        const { authorizationId } = await gateway.authorizeOrder({ paymentId: p.id, orderId: p.paypalOrderId! });
        const authorisedAt = now();
        p = await step(p, "AUTHORISE", a.senderId, { authorizationId, authorisedAt });
        if (p.riskLevel === "high") {
          return hold(p, null, new Date(authorisedAt.getTime() + (await coolingOffMs(p.senderId))));
        }
        const settled = await settle(p, a.senderId);
        if (settled.riskLevel === "medium") await emit({ type: "medium_sent", payment: settled });
        return settled;
      });
    },

    async contactDecision(a: { paymentId: string; contactId: string; decision: "approve" | "block" }) {
      const p = await mustGet(a.paymentId);
      if (!(await repo.isContactFor(a.contactId, p.senderId))) {
        throw new NotAllowedError("Only someone in the sender's circle can decide.");
      }
      if (a.decision === "approve") return settleHeld({ paymentId: p.id, actorId: a.contactId });
      try {
        const stopped = await blockHeld({ paymentId: p.id, actorId: a.contactId });
        await emit({ type: "blocked_by_contact", payment: stopped, actorId: a.contactId });
        return stopped;
      } catch (e) {
        // The block was claimed; only the void is still finishing. The decision still counts.
        if (e instanceof PaymentPendingError) await emit({ type: "blocked_by_contact", payment: p, actorId: a.contactId });
        throw e;
      }
    },

    /**
     * A PayPal payout item webhook reports what happened after the payout was sent. A failed, returned or
     * blocked payout moves paid_out to payout_failed (once: the state check and the transition are atomic),
     * and the sweep then refunds it. Unclaimed and succeeded only leave an audit row. Never moves money itself.
     */
    async payoutOutcome(a: {
      paymentId: string;
      outcome: "failed" | "unclaimed" | "succeeded";
      eventId: string;
      eventType?: string;
    }): Promise<"applied" | "ignored"> {
      const p = await repo.get(a.paymentId);
      if (!p || p.state !== "paid_out") return "ignored";
      if (a.outcome === "failed") {
        try {
          await step(p, "PAYOUT_FAIL", null, {}, { eventId: a.eventId, ...(a.eventType ? { eventType: a.eventType } : {}) });
        } catch (e) {
          // Another delivery or the sweep got there first: the outcome is already recorded.
          if (e instanceof ConcurrentUpdateError) return "ignored";
          throw e;
        }
        return "applied";
      }
      await repo.audit({
        paymentId: p.id, actorId: null, action: a.outcome === "succeeded" ? "payout_confirmed" : "payout_unclaimed",
        fromState: p.state, toState: p.state, detail: { eventId: a.eventId },
      });
      return "applied";
    },

    /** For callers that have already checked who may act (a trusted contact, the real person). */
    settleHeld,

    /** For callers that have already checked who may act. */
    blockHeld,

    async senderRelease(a: { paymentId: string; senderId: string }) {
      const p = await mustGet(a.paymentId);
      if (p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can release this payment.");
      if (p.state !== "held" || !p.coolingOffUntil || now() < p.coolingOffUntil) {
        throw new NotAllowedError("This payment can't be released yet.");
      }
      assertHoldOpen(p);
      return settle(p, a.senderId);
    },

    /** The sender stops their own held payment: it is blocked first (the claim), then PayPal's authorisation is voided. */
    async senderCancel(a: { paymentId: string; senderId: string }) {
      const p = await mustGet(a.paymentId);
      if (p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can cancel this payment.");
      try {
        const stopped = await blockHeld({ paymentId: p.id, actorId: a.senderId });
        await emit({ type: "cancelled_by_sender", payment: stopped });
        return stopped;
      } catch (e) {
        // The block was claimed; only the void is still finishing. The cancel still counts.
        if (e instanceof PaymentPendingError) await emit({ type: "cancelled_by_sender", payment: p });
        throw e;
      }
    },

    async expireStale() {
      const expired: string[] = [];
      const voidRetried: string[] = [];
      const payoutRetried: string[] = [];
      const refundRetried: string[] = [];
      const recovered: string[] = [];
      const captureRetried: string[] = [];
      const needsAttention: string[] = [];
      const staleBefore = now().getTime() - STALE_MS;
      const isStale = (p: PaymentRecord) => p.updatedAt.getTime() < staleBefore;

      // One failing row never aborts the sweep; a ConcurrentUpdateError means someone else acted.
      async function each(phase: string, rows: PaymentRecord[], work: (p: PaymentRecord) => Promise<void>) {
        for (const p of rows) {
          try {
            await work(p);
          } catch (thrown) {
            // Left in its current state; the next sweep retries it. Record why, without message bodies.
            const e = thrown instanceof PaymentPendingError ? thrown.cause : thrown;
            if (e instanceof ConcurrentUpdateError) continue;
            const errorName = e instanceof Error ? e.name : "unknown";
            const status = e instanceof PayPalError ? e.status : undefined;
            const detail = status === undefined ? { phase, errorName } : { phase, errorName, status };
            console.warn("sweep row failed", { paymentId: p.id, ...detail });
            try {
              await repo.audit({ paymentId: p.id, actorId: null, action: "sweep_failed", fromState: p.state, toState: p.state, detail });
            } catch {
              // The audit write must never abort the sweep.
            }
          }
        }
      }

      await each("held", await repo.listByStates(["held"]), async (p) => {
        if (p.authorisedAt && now().getTime() - p.authorisedAt.getTime() >= AUTO_VOID_MS) {
          await voidHeld(p, "EXPIRE", null);
          expired.push(p.id);
        }
      });
      await each("blocked", (await repo.listByStates(["blocked", "expired"])).filter(isStale), async (p) => {
        await gateway.voidAuthorization({ paymentId: p.id, authorizationId: p.authorizationId! });
        await step(p, "VOID", null);
        voidRetried.push(p.id);
      });
      await each("released", (await repo.listByStates(["released"])).filter(isStale), async (p) => {
        const captured = await capture(p, null);
        // Counted once the CAPTURE step succeeded, even if the payout then fails (row stays captured).
        captureRetried.push(p.id);
        // The first payout attempt after this capture, so the live rules (including refund) apply.
        await payOut(captured, null);
      });
      await each("captured", (await repo.listByStates(["captured"])).filter(isStale), async (p) => {
        if (await retryPayout(p)) {
          payoutRetried.push(p.id);
          return;
        }
        await repo.audit({ paymentId: p.id, actorId: null, action: "payout_needs_attention", fromState: p.state, toState: p.state, detail: {} });
        needsAttention.push(p.id);
      });
      await each("payout_failed", (await repo.listByStates(["payout_failed"])).filter(isStale), async (p) => {
        await refundPayment(p, null);
        refundRetried.push(p.id);
      });
      await each("approved", (await repo.listByStates(["approved"])).filter(isStale), async (p) => {
        if (!p.paypalOrderId) throw new Error(`Payment ${p.id} has no order`);
        const { authorizationId } = await gateway.authorizeOrder({ paymentId: p.id, orderId: p.paypalOrderId });
        const authorisedAt = now();
        const auth = await step(p, "AUTHORISE", null, { authorizationId, authorisedAt });
        await hold(auth, null, new Date(authorisedAt.getTime() + (await coolingOffMs(p.senderId))));
        recovered.push(p.id);
      });
      await each("authorised", (await repo.listByStates(["authorised"])).filter(isStale), async (p) => {
        const base = (p.authorisedAt ?? now()).getTime();
        await hold(p, null, new Date(base + (await coolingOffMs(p.senderId))));
        recovered.push(p.id);
      });
      return { expired, voidRetried, payoutRetried, refundRetried, recovered, captureRetried, needsAttention };
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
