import { describe, expect, it, vi } from "vitest";
import { ConcurrentUpdateError } from "./paymentRepo";
import { createMemoryPaymentRepo } from "./memoryPaymentRepo";
import { NotAllowedError, PaymentInputError, createPaymentService } from "./paymentService";
import { PayPalError, type PayPalGateway } from "./paypalGateway";

const SENDER = "00000000-0000-4000-8000-000000000001";
const CONTACT = "00000000-0000-4000-8000-000000000002";
const STRANGER = "00000000-0000-4000-8000-000000000003";

function fakeGateway(over: Partial<PayPalGateway> = {}): PayPalGateway {
  return {
    createAuthorizeOrder: vi.fn().mockResolvedValue({ orderId: "ORDER1" }),
    authorizeOrder: vi.fn().mockResolvedValue({ authorizationId: "AUTH1" }),
    captureAuthorization: vi.fn().mockResolvedValue({ captureId: "CAP1" }),
    voidAuthorization: vi.fn().mockResolvedValue(undefined),
    sendPayout: vi.fn().mockResolvedValue({ payoutBatchId: "BATCH1" }),
    refundCapture: vi.fn().mockResolvedValue({ refundId: "REF1" }),
    ...over,
  };
}
const judgeSaying = (level: "low" | "medium" | "high") =>
  vi.fn().mockResolvedValue({ ok: true, judgement: { level, scamType: level === "low" ? "none" : "impersonation_family", reasons: ["r"], impersonatedRequester: null } });

function setup(opts: { level?: "low" | "medium" | "high"; gateway?: Partial<PayPalGateway>; start?: Date } = {}) {
  let clock = opts.start ?? new Date("2026-11-01T10:00:00Z");
  let n = 0;
  const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: SENDER, contactId: CONTACT }] });
  const gateway = fakeGateway(opts.gateway);
  const service = createPaymentService({
    repo, gateway, judge: judgeSaying(opts.level ?? "low"),
    now: () => clock,
    newId: () => `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`,
  });
  return { repo, gateway, service, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}
const send = { senderId: SENDER, payee: "Grandson@Example.com", amountCents: 80000, senderAnswer: "my grandson" };

describe("start", () => {
  it.each([
    [{ amountCents: 0 }, "amountCents"],
    [{ amountCents: -100 }, "amountCents"],
    [{ amountCents: 10.5 }, "amountCents"],
    [{ amountCents: 1_000_001 }, "amountCents"],
    [{ amountCents: Number.NaN }, "amountCents"],
    [{ payee: "" }, "payee"],
    [{ payee: "not an email or phone" }, "payee"],
    [{ note: "x".repeat(501) }, "note"],
  ])("rejects %o before touching PayPal", async (over, field) => {
    const { service, gateway } = setup();
    const err = await service.start({ ...send, ...over } as typeof send).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentInputError);
    expect(err.field).toBe(field);
    expect(gateway.createAuthorizeOrder).not.toHaveBeenCalled();
  });

  it("assesses risk, stores the payment and creates a PayPal order", async () => {
    const { service, gateway } = setup({ level: "high" });
    const { payment, decision } = await service.start(send);
    expect(decision.level).toBe("high");
    expect(payment.state).toBe("created");
    expect(payment.payee).toBe("grandson@example.com");
    expect(payment.paypalOrderId).toBe("ORDER1");
    expect(gateway.createAuthorizeOrder).toHaveBeenCalledWith({ paymentId: payment.id, amountCents: 80000 });
  });
});

describe("completeApproval", () => {
  it("captures and pays out a low-risk payment", async () => {
    const { service, gateway, repo } = setup({ level: "low" });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    const done = await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    expect(done.state).toBe("paid_out");
    expect(done.captureId).toBe("CAP1");
    expect(gateway.sendPayout).toHaveBeenCalledWith({ paymentId: payment.id, receiver: "grandson@example.com", amountCents: 1000 });
    expect((await repo.auditFor(payment.id)).map((a) => a.action)).toEqual(["APPROVE", "AUTHORISE", "RELEASE", "CAPTURE", "PAY_OUT"]);
  });

  it("holds a high-risk payment with a 24-hour cooling-off", async () => {
    const { service, gateway } = setup({ level: "high" });
    const { payment } = await service.start(send);
    const held = await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    expect(held.state).toBe("held");
    expect(held.coolingOffUntil?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect(gateway.captureAuthorization).not.toHaveBeenCalled();
  });

  it("refuses approval completion by anyone but the sender", async () => {
    const { service } = setup();
    const { payment } = await service.start(send);
    await expect(service.completeApproval({ paymentId: payment.id, senderId: STRANGER })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("refunds when the payout fails", async () => {
    const { service, gateway } = setup({
      level: "low",
      gateway: { sendPayout: vi.fn().mockRejectedValue(new PayPalError("payout", 422, "RECEIVER_UNREGISTERED", "d")) },
    });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    const done = await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    expect(done.state).toBe("refunded");
    expect(gateway.refundCapture).toHaveBeenCalledWith({ paymentId: payment.id, captureId: "CAP1" });
  });

  it("leaves the state unchanged when capture fails", async () => {
    const { service, repo } = setup({
      level: "low",
      gateway: { captureAuthorization: vi.fn().mockRejectedValue(new PayPalError("capture", 500, undefined, "d")) },
    });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    await expect(service.completeApproval({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(PayPalError);
    expect((await repo.get(payment.id))?.state).toBe("authorised");
  });
});

describe("contactDecision", () => {
  async function held(level: "high" = "high") {
    const ctx = setup({ level });
    const { payment } = await ctx.service.start(send);
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    return { ...ctx, id: payment.id };
  }

  it("approve captures and pays out", async () => {
    const { service, id } = await held();
    expect((await service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "approve" })).state).toBe("paid_out");
  });

  it("block voids", async () => {
    const { service, gateway, id } = await held();
    expect((await service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "block" })).state).toBe("voided");
    expect(gateway.voidAuthorization).toHaveBeenCalledWith({ paymentId: id, authorizationId: "AUTH1" });
  });

  it("refuses someone outside the circle", async () => {
    const { service, gateway, id } = await held();
    await expect(service.contactDecision({ paymentId: id, contactId: STRANGER, decision: "approve" })).rejects.toBeInstanceOf(NotAllowedError);
    expect(gateway.captureAuthorization).not.toHaveBeenCalled();
  });

  it("allows exactly one of two simultaneous decisions", async () => {
    const { service, gateway, id } = await held();
    const results = await Promise.allSettled([
      service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "approve" }),
      service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "block" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const moved = (gateway.captureAuthorization as ReturnType<typeof vi.fn>).mock.calls.length + (gateway.voidAuthorization as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(moved).toBe(1);
  });

  it("keeps a blocked payment for retry when void fails", async () => {
    const ctx = setup({ level: "high", gateway: { voidAuthorization: vi.fn().mockRejectedValueOnce(new PayPalError("void", 500, undefined, "d")).mockResolvedValue(undefined) } });
    const { payment } = await ctx.service.start(send);
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    await expect(ctx.service.contactDecision({ paymentId: payment.id, contactId: CONTACT, decision: "block" })).rejects.toBeInstanceOf(PayPalError);
    expect((await ctx.repo.get(payment.id))?.state).toBe("blocked");
    const out = await ctx.service.expireStale();
    expect(out.voidRetried).toEqual([payment.id]);
    expect((await ctx.repo.get(payment.id))?.state).toBe("voided");
  });
});

describe("senderRelease and expiry", () => {
  async function held() {
    const ctx = setup({ level: "high" });
    const { payment } = await ctx.service.start(send);
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    return { ...ctx, id: payment.id };
  }

  it("refuses release before cooling-off ends", async () => {
    const { service, advance, id } = await held();
    advance(23 * 3_600_000);
    await expect(service.senderRelease({ paymentId: id, senderId: SENDER })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("allows release after cooling-off", async () => {
    const { service, advance, id } = await held();
    advance(24 * 3_600_000);
    expect((await service.senderRelease({ paymentId: id, senderId: SENDER })).state).toBe("paid_out");
  });

  it("refuses release by anyone else", async () => {
    const { service, advance, id } = await held();
    advance(25 * 3_600_000);
    await expect(service.senderRelease({ paymentId: id, senderId: CONTACT })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it("voids held payments 72 hours after authorisation", async () => {
    const { service, advance, id, repo } = await held();
    advance(71 * 3_600_000);
    expect((await service.expireStale()).expired).toEqual([]);
    advance(1 * 3_600_000);
    expect((await service.expireStale()).expired).toEqual([id]);
    expect((await repo.get(id))?.state).toBe("voided");
  });
});

it("surfaces ConcurrentUpdateError for a decision on an already-decided payment", async () => {
  const ctx = setup({ level: "high" });
  const { payment } = await ctx.service.start(send);
  await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
  await ctx.service.contactDecision({ paymentId: payment.id, contactId: CONTACT, decision: "block" });
  await expect(ctx.service.contactDecision({ paymentId: payment.id, contactId: CONTACT, decision: "approve" })).rejects.toBeInstanceOf(ConcurrentUpdateError);
});

describe("payout failure handling", () => {
  const uncertain = () => new PayPalError("payout", 503, undefined, "d", true);

  it("retries once after an uncertain payout error and never refunds", async () => {
    const sendPayout = vi.fn().mockRejectedValueOnce(uncertain()).mockResolvedValue({ payoutBatchId: "BATCH1" });
    const { service, gateway } = setup({ level: "low", gateway: { sendPayout } });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    const done = await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    expect(done.state).toBe("paid_out");
    expect(sendPayout).toHaveBeenCalledTimes(2);
    expect(sendPayout.mock.calls[1]).toEqual(sendPayout.mock.calls[0]);
    expect(gateway.refundCapture).not.toHaveBeenCalled();
  });

  it("leaves the payment captured, without refunding, when the payout stays uncertain", async () => {
    const sendPayout = vi.fn().mockRejectedValue(uncertain());
    const { service, gateway, repo } = setup({ level: "low", gateway: { sendPayout } });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    await expect(service.completeApproval({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(PayPalError);
    expect(sendPayout).toHaveBeenCalledTimes(2);
    expect((await repo.get(payment.id))?.state).toBe("captured");
    expect(gateway.refundCapture).not.toHaveBeenCalled();
  });

  it("stays payout_failed and rethrows when the refund throws", async () => {
    const { service, repo } = setup({
      level: "low",
      gateway: {
        sendPayout: vi.fn().mockRejectedValue(new PayPalError("payout", 422, "X", "d")),
        refundCapture: vi.fn().mockRejectedValue(new PayPalError("refund", 500, undefined, "d", true)),
      },
    });
    const { payment } = await service.start({ ...send, amountCents: 1000 });
    await expect(service.completeApproval({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(PayPalError);
    expect((await repo.get(payment.id))?.state).toBe("payout_failed");
  });
});

describe("expireStale self-healing", () => {
  it("retries the payout of a captured payment", async () => {
    const sendPayout = vi.fn().mockRejectedValue(new PayPalError("payout", 503, undefined, "d", true));
    const ctx = setup({ level: "low", gateway: { sendPayout } });
    const { payment } = await ctx.service.start({ ...send, amountCents: 1000 });
    await expect(ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(PayPalError);
    sendPayout.mockResolvedValue({ payoutBatchId: "BATCH2" });
    const out = await ctx.service.expireStale();
    expect(out.payoutRetried).toEqual([payment.id]);
    const row = await ctx.repo.get(payment.id);
    expect(row?.state).toBe("paid_out");
    expect(row?.payoutBatchId).toBe("BATCH2");
    expect(ctx.gateway.refundCapture).not.toHaveBeenCalled();
  });

  it("retries the refund of a payout_failed payment", async () => {
    const refundCapture = vi.fn().mockRejectedValueOnce(new PayPalError("refund", 500, undefined, "d", true)).mockResolvedValue({ refundId: "REF2" });
    const ctx = setup({
      level: "low",
      gateway: { sendPayout: vi.fn().mockRejectedValue(new PayPalError("payout", 422, "X", "d")), refundCapture },
    });
    const { payment } = await ctx.service.start({ ...send, amountCents: 1000 });
    await expect(ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(PayPalError);
    const out = await ctx.service.expireStale();
    expect(out.refundRetried).toEqual([payment.id]);
    expect((await ctx.repo.get(payment.id))?.state).toBe("refunded");
  });

  it("keeps sweeping when one row's void throws", async () => {
    const voidAuthorization = vi.fn().mockRejectedValueOnce(new PayPalError("void", 500, undefined, "d", true)).mockResolvedValue(undefined);
    const ctx = setup({ level: "high", gateway: { voidAuthorization } });
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { payment } = await ctx.service.start(send);
      await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
      ids.push(payment.id);
    }
    ctx.advance(72 * 3_600_000);
    const out = await ctx.service.expireStale();
    expect(out.expired).toHaveLength(1);
    expect(out.voidRetried).toHaveLength(1);
    expect(out.voidRetried[0]).not.toBe(out.expired[0]);
    expect(voidAuthorization).toHaveBeenCalledTimes(3);
    for (const id of ids) expect((await ctx.repo.get(id))?.state).toBe("voided");
  });
});

it("approve racing block: exactly one wins, the loser gets ConcurrentUpdateError", async () => {
  const ctx = setup({ level: "high" });
  const { payment } = await ctx.service.start(send);
  await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
  const results = await Promise.allSettled([
    ctx.service.contactDecision({ paymentId: payment.id, contactId: CONTACT, decision: "approve" }),
    ctx.service.contactDecision({ paymentId: payment.id, contactId: CONTACT, decision: "block" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  expect(loser.reason).toBeInstanceOf(ConcurrentUpdateError);
  const cap = (ctx.gateway.captureAuthorization as ReturnType<typeof vi.fn>).mock.calls.length;
  const vd = (ctx.gateway.voidAuthorization as ReturnType<typeof vi.fn>).mock.calls.length;
  expect(cap + vd).toBe(1);
});
