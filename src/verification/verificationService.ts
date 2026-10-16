import type { AlertPayload } from "@/alerts/alertRepo";
import type { AlertService } from "@/alerts/alertService";
import type { CircleRepo } from "@/circle/circleRepo";
import type { PaymentState } from "@/domain/types";
import type { PaymentRecord, PaymentRepo } from "@/payments/paymentRepo";
import { NotAllowedError, PaymentPendingError, type PaymentService } from "@/payments/paymentService";
import { matchRequester } from "./matchRequester";
import { officialRouteFor } from "./officialRoutes";
import { hashSafeWord, validateSafeWord, verifySafeWord } from "./safeWord";
import type { VerificationRepo, VerificationStatus } from "./verificationRepo";

export const REAL_PERSON_WAIT_MS = 10 * 60_000;

export class VerificationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationInputError";
  }
}

export class VerificationClosedError extends Error {
  constructor() {
    super("This has already been answered.");
    this.name = "VerificationClosedError";
  }
}

export type ChallengeMethod = "safe_word" | "memory_question";

export const CHALLENGE_GUIDANCE: Record<ChallengeMethod, string[]> = {
  safe_word: [
    "Ask the caller for your family's safe word. Don't say it first or give any hints.",
    "Type exactly what they said.",
  ],
  memory_question: [
    "Ask something only the real person would know, like a family nickname or where you spent a holiday. Don't give hints.",
    "A real family member answers straight away. Any excuse counts as a no.",
  ],
};

export type VerificationStage =
  | { stage: "none" }
  | { stage: "waiting_for_person"; contactName: string; askedAt: Date; challengeOpensAt: Date }
  | { stage: "official_routes"; organisation: string; steps: string[] }
  | { stage: "challenge"; method: ChallengeMethod; requesterName: string; guidance: string[] }
  | { stage: "challenge_passed" }
  | { stage: "resolved"; outcome: "confirmed" | "denied" | "failed" };

export type ChallengeRequest =
  | { paymentId: string; senderId: string; method: "safe_word"; said: string }
  | { paymentId: string; senderId: string; method: "memory_question"; outcome: "answered" | "excuse" };

export function createVerificationService(deps: {
  verifications: VerificationRepo;
  payments: Pick<PaymentRepo, "get">;
  paymentOps: Pick<PaymentService, "settleHeld" | "blockHeld">;
  circle: CircleRepo;
  alerts: Pick<AlertService, "notify">;
  onImpersonationConfirmed?: (payment: PaymentRecord) => Promise<void>;
  now?: () => Date;
}) {
  const { verifications, payments, paymentOps, circle, alerts } = deps;
  const now = deps.now ?? (() => new Date());

  async function payloadFor(p: PaymentRecord, requesterName?: string): Promise<AlertPayload> {
    const sender = await circle.getUser(p.senderId);
    return {
      senderName: sender?.displayName ?? "Someone in your circle",
      amountCents: p.amountCents,
      payee: p.payee,
      ...(requesterName ? { requesterName } : {}),
    };
  }

  /** Runs a held-payment operation. The follow-up still happens if PayPal is finishing the step in the background. */
  async function thenFinish(op: () => Promise<PaymentRecord>, finish: () => Promise<void>): Promise<PaymentRecord> {
    try {
      const done = await op();
      await finish();
      return done;
    } catch (e) {
      if (e instanceof PaymentPendingError) await finish();
      throw e;
    }
  }

  async function stage(a: { paymentId: string; viewerId: string }): Promise<VerificationStage> {
    const p = await payments.get(a.paymentId);
    if (!p) throw new NotAllowedError("Payment not found");
    if (p.senderId !== a.viewerId && !(await circle.contactsOf(p.senderId)).some((c) => c.contactId === a.viewerId)) {
      throw new NotAllowedError("Payment not found");
    }
    const vs = await verifications.listForPayment(p.id);
    if (p.state !== "held") {
      const decided = [...vs].reverse().find((v) => v.status === "confirmed" || v.status === "denied" || v.status === "failed");
      return decided ? { stage: "resolved", outcome: decided.status as "confirmed" | "denied" | "failed" } : { stage: "none" };
    }
    const official = vs.find((v) => v.method === "official_routes");
    if (official) return { stage: "official_routes", ...officialRouteFor(official.requesterName) };
    if (vs.some((v) => (v.method === "safe_word" || v.method === "memory_question") && v.status === "passed")) {
      return { stage: "challenge_passed" };
    }
    const asked = vs.find((v) => v.method === "real_person" && v.status === "pending");
    if (asked && now().getTime() - asked.createdAt.getTime() < REAL_PERSON_WAIT_MS) {
      const contact = asked.targetContactId ? await circle.getUser(asked.targetContactId) : null;
      return {
        stage: "waiting_for_person",
        contactName: contact?.displayName ?? asked.requesterName,
        askedAt: asked.createdAt,
        challengeOpensAt: new Date(asked.createdAt.getTime() + REAL_PERSON_WAIT_MS),
      };
    }
    if (p.impersonatedRequester?.kind !== "person") return { stage: "none" };
    const sender = await circle.getUser(p.senderId);
    const method: ChallengeMethod = sender?.safeWordHash ? "safe_word" : "memory_question";
    return { stage: "challenge", method, requesterName: p.impersonatedRequester.name, guidance: CHALLENGE_GUIDANCE[method] };
  }

  return {
    async startForHeld(payment: PaymentRecord): Promise<void> {
      const requester = payment.impersonatedRequester;
      if (!requester) return;
      // The live path and a sweep recovery can both report the same hold.
      if ((await verifications.listForPayment(payment.id)).length > 0) return;
      const base = { paymentId: payment.id, status: "pending" as const, requesterName: requester.name, createdAt: now(), resolvedAt: null };
      if (requester.kind === "organisation") {
        await verifications.insert({ ...base, method: "official_routes", targetContactId: null });
        return;
      }
      const match = matchRequester(requester.name, await circle.contactsOf(payment.senderId));
      // Not in the circle: the sender is coached through a challenge instead (see stage()).
      if (!match) return;
      const v = await verifications.insert({ ...base, method: "real_person", targetContactId: match.contactId });
      await alerts.notify({
        recipientId: match.contactId,
        kind: "verify_request",
        paymentId: payment.id,
        verificationId: v.id,
        payload: await payloadFor(payment),
      });
    },

    async respond(a: { verificationId: string; responderId: string; answer: "me" | "not_me" }): Promise<{ status: "confirmed" | "denied"; paymentState: PaymentState }> {
      const v = await verifications.get(a.verificationId);
      if (!v || v.method !== "real_person" || v.targetContactId !== a.responderId) throw new NotAllowedError("This request isn't for you.");
      if (v.status !== "pending") throw new VerificationClosedError();
      const payment = await payments.get(v.paymentId);
      if (!payment) throw new NotAllowedError("This request isn't for you.");
      const realName = (await circle.getUser(a.responderId))?.displayName ?? v.requesterName;

      if (a.answer === "not_me") {
        const done = await thenFinish(
          () => paymentOps.blockHeld({ paymentId: payment.id, actorId: a.responderId }),
          async () => {
            await verifications.resolve(v.id, "denied", now());
            await alerts.notify({ recipientId: payment.senderId, kind: "payment_stopped", paymentId: payment.id, payload: await payloadFor(payment, realName) });
            try {
              await deps.onImpersonationConfirmed?.(payment);
            } catch (e) {
              console.warn("impersonation report failed", { paymentId: payment.id, error: e instanceof Error ? e.name : "unknown" });
            }
          },
        );
        return { status: "denied", paymentState: done.state };
      }
      const done = await thenFinish(
        () => paymentOps.settleHeld({ paymentId: payment.id, actorId: a.responderId }),
        async () => {
          await verifications.resolve(v.id, "confirmed", now());
          await alerts.notify({ recipientId: payment.senderId, kind: "payment_confirmed", paymentId: payment.id, payload: await payloadFor(payment, realName) });
        },
      );
      return { status: "confirmed", paymentState: done.state };
    },

    stage,

    async challenge(a: ChallengeRequest): Promise<{ outcome: "passed" | "failed" }> {
      const p = await payments.get(a.paymentId);
      if (!p || p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can do this check.");
      const current = await stage({ paymentId: p.id, viewerId: a.senderId });
      if (current.stage !== "challenge" || current.method !== a.method) throw new NotAllowedError("This check isn't available right now.");
      let passed: boolean;
      if (a.method === "safe_word") {
        if (!a.said.trim()) throw new VerificationInputError("Please type what the caller said.");
        const hash = (await circle.getUser(a.senderId))?.safeWordHash;
        passed = hash ? await verifySafeWord(a.said, hash) : false;
      } else {
        passed = a.outcome === "answered";
      }
      const at = now();
      await verifications.insert({
        paymentId: p.id, method: a.method, status: passed ? "passed" : "failed", targetContactId: null,
        requesterName: current.requesterName, createdAt: at, resolvedAt: at,
      });
      // One-way: a wrong answer or an excuse stops the payment; a right answer never releases it.
      if (!passed) {
        try {
          await paymentOps.blockHeld({ paymentId: p.id, actorId: a.senderId });
        } catch (e) {
          if (!(e instanceof PaymentPendingError)) throw e;
        }
      }
      return { outcome: passed ? "passed" : "failed" };
    },

    async viewForTarget(a: { verificationId: string; viewerId: string }): Promise<{
      id: string; status: VerificationStatus; senderName: string; amountCents: number; payee: string; askedAt: Date; paymentOnHold: boolean;
    }> {
      const v = await verifications.get(a.verificationId);
      if (!v || v.targetContactId !== a.viewerId) throw new NotAllowedError("This request isn't for you.");
      const p = await payments.get(v.paymentId);
      if (!p) throw new NotAllowedError("This request isn't for you.");
      const { senderName } = await payloadFor(p);
      return { id: v.id, status: v.status, senderName, amountCents: p.amountCents, payee: p.payee, askedAt: v.createdAt, paymentOnHold: p.state === "held" };
    },

    async setSafeWord(a: { userId: string; safeWord: string }): Promise<void> {
      const problem = validateSafeWord(a.safeWord);
      if (problem) throw new VerificationInputError(problem);
      await circle.setSafeWordHash(a.userId, await hashSafeWord(a.safeWord));
    },
  };
}

export type VerificationService = ReturnType<typeof createVerificationService>;
