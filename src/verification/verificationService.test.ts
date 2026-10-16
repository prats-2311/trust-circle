import { describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import type { Requester } from "@/domain/types";
import { createMemoryPaymentRepo } from "@/payments/memoryPaymentRepo";
import { ConcurrentUpdateError } from "@/payments/paymentRepo";
import { createPaymentService, NotAllowedError, PaymentPendingError } from "@/payments/paymentService";
import type { PayPalGateway } from "@/payments/paypalGateway";
import { createMemoryVerificationRepo } from "./verificationRepo";
import {
  createVerificationService,
  REAL_PERSON_WAIT_MS,
  VerificationClosedError,
  VerificationInputError,
  type VerificationService,
} from "./verificationService";

const MARGARET = "00000000-0000-4000-8000-000000000001";
const SARAH = "00000000-0000-4000-8000-000000000002";
const DANIEL = "00000000-0000-4000-8000-000000000003";
const STRANGER = "00000000-0000-4000-8000-000000000004";
const PAYEE = "dhill.urgent@outlook.example";

function fakeGateway(): PayPalGateway {
  return {
    createAuthorizeOrder: vi.fn().mockResolvedValue({ orderId: "ORDER1" }),
    authorizeOrder: vi.fn().mockResolvedValue({ authorizationId: "AUTH1" }),
    captureAuthorization: vi.fn().mockResolvedValue({ captureId: "CAP1" }),
    voidAuthorization: vi.fn().mockResolvedValue(undefined),
    sendPayout: vi.fn().mockResolvedValue({ payoutBatchId: "BATCH1" }),
    refundCapture: vi.fn().mockResolvedValue({ refundId: "REF1" }),
    verifyWebhookSignature: vi.fn().mockResolvedValue(true),
  };
}

function setup(opts: { requester?: Requester | null } = {}) {
  let clock = new Date();
  const now = () => clock;
  const circle = createMemoryCircleRepo({
    users: [
      { id: MARGARET, email: "m@example.com", displayName: "Margaret", safeWordHash: null },
      { id: SARAH, email: "s@example.com", displayName: "Sarah", safeWordHash: null },
      { id: DANIEL, email: "d@example.com", displayName: "Daniel", safeWordHash: null },
    ],
    links: [
      { senderId: MARGARET, contactId: SARAH, relationship: "daughter" },
      { senderId: MARGARET, contactId: DANIEL, relationship: "grandson" },
    ],
  });
  const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: MARGARET, contactId: SARAH }, { senderId: MARGARET, contactId: DANIEL }] });
  const gateway = fakeGateway();
  const requester = opts.requester === undefined ? { kind: "person" as const, name: "grandson" } : opts.requester;
  const judge = vi.fn().mockResolvedValue({
    ok: true,
    judgement: { level: "high", scamType: "impersonation_family", reasons: ["r"], impersonatedRequester: requester },
  });
  const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
  const onImpersonationConfirmed = vi.fn().mockResolvedValue(undefined);
  const verifications = createMemoryVerificationRepo();
  const late: { verification?: VerificationService } = {};
  const started: Awaited<ReturnType<VerificationService["startForHeld"]>>[] = [];
  const payments = createPaymentService({
    repo, gateway, judge, now,
    onEvent: async (e) => {
      if (e.type === "held") started.push(await late.verification!.startForHeld(e.payment));
    },
  });
  const verification = (late.verification = createVerificationService({ verifications, payments: repo, paymentOps: payments, circle, alerts, onImpersonationConfirmed, now }));
  async function held() {
    const { payment } = await payments.start({ senderId: MARGARET, payee: PAYEE, amountCents: 80000, senderAnswer: "My grandson needs bail" });
    return payments.completeApproval({ paymentId: payment.id, senderId: MARGARET });
  }
  return {
    circle, repo, gateway, alerts, started, verifications, payments, verification, onImpersonationConfirmed, held,
    advance: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
}

describe("verify the real person", () => {
  it("asks the matching circle member and tells the sender who was asked", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    expect(v).toMatchObject({ method: "real_person", status: "pending", targetContactId: DANIEL, requesterName: "grandson" });
    expect(s.alerts.notify).toHaveBeenCalledWith({
      recipientId: DANIEL,
      kind: "verify_request",
      paymentId: p.id,
      verificationId: v!.id,
      payload: { senderName: "Margaret", amountCents: 80000, payee: PAYEE },
    });
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toMatchObject({ stage: "waiting_for_person", contactName: "Daniel" });
  });

  it("stops the payment when the real person says it wasn't them", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    expect(await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" })).toEqual({
      status: "denied",
      paymentState: "voided",
    });
    expect(s.gateway.voidAuthorization).toHaveBeenCalledTimes(1);
    expect(s.gateway.captureAuthorization).not.toHaveBeenCalled();
    expect(s.alerts.notify).toHaveBeenCalledWith({
      recipientId: MARGARET,
      kind: "payment_stopped",
      paymentId: p.id,
      payload: { senderName: "Margaret", amountCents: 80000, payee: PAYEE, requesterName: "Daniel" },
    });
    expect(s.onImpersonationConfirmed).toHaveBeenCalledWith(expect.objectContaining({ id: p.id }), DANIEL);
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toEqual({ stage: "resolved", outcome: "denied", contactName: "Daniel" });
  });

  it("tells the rest of the circle, not Daniel, when he says it wasn't him", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" });
    const updates = s.alerts.notify.mock.calls.map((c) => c[0]).filter((a) => a.kind === "payment_update");
    expect(updates).toEqual([
      {
        recipientId: SARAH, kind: "payment_update", paymentId: p.id,
        payload: { senderName: "Margaret", amountCents: 80000, payee: PAYEE, reason: "denied", actorName: "Daniel" },
      },
    ]);
  });

  it("keeps the denial when telling the circle fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    s.alerts.notify.mockImplementation(async (a: { kind: string }) => {
      if (a.kind === "payment_update") throw new Error("db");
    });
    expect(await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" })).toEqual({ status: "denied", paymentState: "voided" });
    expect((await s.verifications.get(v!.id))!.status).toBe("denied");
  });

  it("still tells the circle and reports the impersonation when the alert to the sender fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    s.alerts.notify.mockImplementation(async (a: { kind: string }) => {
      if (a.kind === "payment_stopped") throw new Error("db");
    });
    expect(await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" })).toEqual({ status: "denied", paymentState: "voided" });
    expect(s.alerts.notify.mock.calls.map((c) => c[0].kind)).toContain("payment_update");
    expect(s.onImpersonationConfirmed).toHaveBeenCalledWith(expect.objectContaining({ id: p.id }), DANIEL);
  });

  it("returns the asked contact from startForHeld, and null for a repeat report", async () => {
    const s = setup();
    const p = await s.held();
    expect(s.started).toEqual([{ targetContactId: DANIEL }]);
    expect(await s.verification.startForHeld(p)).toBeNull();
  });

  it("returns null from startForHeld for an organisation and for someone outside the circle", async () => {
    const org = setup({ requester: { kind: "organisation", name: "PayPal" } });
    await org.held();
    expect(org.started).toEqual([null]);
    const stranger = setup({ requester: { kind: "person", name: "Gareth" } });
    await stranger.held();
    expect(stranger.started).toEqual([null]);
  });

  it("releases the payment when the real person confirms", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    expect(await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "me" })).toEqual({
      status: "confirmed",
      paymentState: "paid_out",
    });
    expect(s.alerts.notify).toHaveBeenLastCalledWith(expect.objectContaining({ recipientId: MARGARET, kind: "payment_confirmed" }));
  });

  it("still answers a settled payment when the follow-up fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const yes = setup();
    const p1 = await yes.held();
    const [v1] = await yes.verifications.listForPayment(p1.id);
    yes.alerts.notify.mockRejectedValue(new Error("mail down"));
    expect(await yes.verification.respond({ verificationId: v1!.id, responderId: DANIEL, answer: "me" })).toEqual({
      status: "confirmed",
      paymentState: "paid_out",
    });
    const no = setup();
    const p2 = await no.held();
    const [v2] = await no.verifications.listForPayment(p2.id);
    no.alerts.notify.mockRejectedValue(new Error("mail down"));
    expect(await no.verification.respond({ verificationId: v2!.id, responderId: DANIEL, answer: "not_me" })).toEqual({
      status: "denied",
      paymentState: "voided",
    });
  });

  it("rethrows the pending error when the follow-up also fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    const pending = new PaymentPendingError(p.id);
    const svc = createVerificationService({
      verifications: s.verifications, payments: s.repo, circle: s.circle,
      paymentOps: { settleHeld: vi.fn(), blockHeld: vi.fn().mockRejectedValue(pending) },
      alerts: { notify: vi.fn().mockRejectedValue(new Error("mail down")) },
    });
    await expect(svc.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" })).rejects.toBe(pending);
  });

  it("refuses anyone but the asked person, and a second answer", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    for (const responderId of [SARAH, MARGARET, STRANGER]) {
      await expect(s.verification.respond({ verificationId: v!.id, responderId, answer: "not_me" })).rejects.toBeInstanceOf(NotAllowedError);
    }
    expect(s.gateway.voidAuthorization).not.toHaveBeenCalled();
    await s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "not_me" });
    await expect(s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "me" })).rejects.toBeInstanceOf(
      VerificationClosedError,
    );
    expect(s.gateway.captureAuthorization).not.toHaveBeenCalled();
  });

  it("lets only one of a racing contact decision and real-person answer move money", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    await s.payments.contactDecision({ paymentId: p.id, contactId: SARAH, decision: "block" });
    await expect(s.verification.respond({ verificationId: v!.id, responderId: DANIEL, answer: "me" })).rejects.toBeInstanceOf(
      ConcurrentUpdateError,
    );
    expect(s.gateway.captureAuthorization).not.toHaveBeenCalled();
    expect(s.gateway.voidAuthorization).toHaveBeenCalledTimes(1);
  });

  it("shows the target the request and hides it from everyone else", async () => {
    const s = setup();
    const p = await s.held();
    const [v] = await s.verifications.listForPayment(p.id);
    expect(await s.verification.viewForTarget({ verificationId: v!.id, viewerId: DANIEL })).toMatchObject({
      status: "pending", senderName: "Margaret", amountCents: 80000, payee: PAYEE, paymentOnHold: true,
    });
    await expect(s.verification.viewForTarget({ verificationId: v!.id, viewerId: SARAH })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(s.verification.viewForTarget({ verificationId: "nope", viewerId: DANIEL })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("starts only once for the same hold", async () => {
    const s = setup();
    const p = await s.held();
    await s.verification.startForHeld(p);
    expect(await s.verifications.listForPayment(p.id)).toHaveLength(1);
    expect(s.alerts.notify).toHaveBeenCalledTimes(1);
  });
});

describe("organisations and people outside the circle", () => {
  it("tells the sender to disconnect first when the caller was connected to their device", async () => {
    const s = setup({ requester: { kind: "organisation", name: "bank fraud team", remoteAccess: true } });
    const p = await s.held();
    const stage = await s.verification.stage({ paymentId: p.id, viewerId: MARGARET });
    expect(stage).toMatchObject({ stage: "official_routes", organisation: "bank fraud team" });
    expect(stage.stage === "official_routes" && stage.steps[0]).toContain("switch off");
  });
  it("shows official routes for an organisation and offers no challenge", async () => {
    const s = setup({ requester: { kind: "organisation", name: "PayPal support" } });
    const p = await s.held();
    const stage = await s.verification.stage({ paymentId: p.id, viewerId: MARGARET });
    expect(stage).toMatchObject({ stage: "official_routes", organisation: "PayPal support" });
    expect(s.alerts.notify).not.toHaveBeenCalled();
    await expect(
      s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "answered" }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("offers the memory question straight away for someone outside the circle", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    const p = await s.held();
    expect(await s.verifications.listForPayment(p.id)).toEqual([]);
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toMatchObject({
      stage: "challenge", method: "memory_question", requesterName: "nephew",
    });
  });

  it("offers no challenge when no requester was named", async () => {
    const s = setup({ requester: null });
    const p = await s.held();
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toEqual({ stage: "none" });
  });

  it("hides the stage from people outside the sender's circle", async () => {
    const s = setup();
    const p = await s.held();
    await expect(s.verification.stage({ paymentId: p.id, viewerId: STRANGER })).rejects.toBeInstanceOf(NotAllowedError);
    expect(await s.verification.stage({ paymentId: p.id, viewerId: SARAH })).toMatchObject({ stage: "waiting_for_person" });
  });
});

describe("the challenge", () => {
  it("opens after ten minutes without an answer", async () => {
    const s = setup();
    const p = await s.held();
    await expect(
      s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "answered" }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    s.advance(REAL_PERSON_WAIT_MS);
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toMatchObject({ stage: "challenge", method: "memory_question" });
  });

  it("tells every circle member when the check fails", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    const p = await s.held();
    await s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "excuse" });
    const base = { kind: "payment_update", paymentId: p.id, payload: { senderName: "Margaret", amountCents: 80000, payee: PAYEE, reason: "check_failed" } };
    expect(s.alerts.notify.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining([{ ...base, recipientId: SARAH }, { ...base, recipientId: DANIEL }]),
    );
  });

  it("blocks the payment on an excuse", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    const p = await s.held();
    expect(await s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "excuse" })).toEqual({
      outcome: "failed",
    });
    expect((await s.repo.get(p.id))!.state).toBe("voided");
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toEqual({ stage: "resolved", outcome: "failed" });
  });

  it("never releases on a right answer, and cannot be retried", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    const p = await s.held();
    expect(await s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "answered" })).toEqual({
      outcome: "passed",
    });
    expect((await s.repo.get(p.id))!.state).toBe("held");
    expect(s.gateway.captureAuthorization).not.toHaveBeenCalled();
    expect(await s.verification.stage({ paymentId: p.id, viewerId: MARGARET })).toEqual({ stage: "challenge_passed" });
    await expect(
      s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "excuse" }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("uses the safe word when one is set: wrong blocks, right keeps it held", async () => {
    const wrong = setup({ requester: { kind: "person", name: "nephew" } });
    await wrong.verification.setSafeWord({ userId: MARGARET, safeWord: "Blue Heron" });
    const p1 = await wrong.held();
    expect(await wrong.verification.stage({ paymentId: p1.id, viewerId: MARGARET })).toMatchObject({ stage: "challenge", method: "safe_word" });
    expect(await wrong.verification.challenge({ paymentId: p1.id, senderId: MARGARET, method: "safe_word", said: "blue bird" })).toEqual({
      outcome: "failed",
    });
    expect((await wrong.repo.get(p1.id))!.state).toBe("voided");

    const right = setup({ requester: { kind: "person", name: "nephew" } });
    await right.verification.setSafeWord({ userId: MARGARET, safeWord: "Blue Heron" });
    const p2 = await right.held();
    expect(await right.verification.challenge({ paymentId: p2.id, senderId: MARGARET, method: "safe_word", said: " blue heron" })).toEqual({
      outcome: "passed",
    });
    expect((await right.repo.get(p2.id))!.state).toBe("held");
  });

  it("keeps a failed challenge final even if the block did not go through", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    const p = await s.held();
    const real = s.payments.blockHeld;
    const blockHeld = vi.fn().mockRejectedValueOnce(new Error("db")).mockImplementation(real);
    const svc = createVerificationService({
      verifications: s.verifications, payments: s.repo, circle: s.circle,
      paymentOps: { settleHeld: s.payments.settleHeld, blockHeld }, alerts: s.alerts,
    });
    await expect(svc.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "excuse" })).rejects.toThrow("db");
    expect((await s.repo.get(p.id))!.state).toBe("held");
    expect(await svc.stage({ paymentId: p.id, viewerId: MARGARET })).toEqual({ stage: "resolved", outcome: "failed" });
    expect(await svc.challenge({ paymentId: p.id, senderId: MARGARET, method: "memory_question", outcome: "answered" })).toEqual({ outcome: "failed" });
    expect(blockHeld).toHaveBeenCalledTimes(2);
    expect((await s.repo.get(p.id))!.state).toBe("voided");
    expect((await s.verifications.listForPayment(p.id)).some((v) => v.status === "passed")).toBe(false);
  });

  it("rejects an empty safe-word answer and challenges from anyone but the sender", async () => {
    const s = setup({ requester: { kind: "person", name: "nephew" } });
    await s.verification.setSafeWord({ userId: MARGARET, safeWord: "heron" });
    const p = await s.held();
    await expect(s.verification.challenge({ paymentId: p.id, senderId: MARGARET, method: "safe_word", said: "  " })).rejects.toBeInstanceOf(
      VerificationInputError,
    );
    await expect(s.verification.challenge({ paymentId: p.id, senderId: SARAH, method: "safe_word", said: "heron" })).rejects.toBeInstanceOf(
      NotAllowedError,
    );
    expect((await s.repo.get(p.id))!.state).toBe("held");
  });

  it("validates a new safe word", async () => {
    const s = setup();
    await expect(s.verification.setSafeWord({ userId: MARGARET, safeWord: "ab" })).rejects.toBeInstanceOf(VerificationInputError);
    await s.verification.setSafeWord({ userId: MARGARET, safeWord: "heron" });
    expect((await s.circle.getUser(MARGARET))!.safeWordHash).toMatch(/^scrypt\$/);
  });
});
