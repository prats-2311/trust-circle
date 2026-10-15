import { describe, expect, it, vi } from "vitest";
import { ConcurrentUpdateError } from "./paymentRepo";
import { createMemoryPaymentRepo } from "./memoryPaymentRepo";
import { NotAllowedError, PaymentInputError, STALE_MS, createPaymentService } from "./paymentService";
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
  return { repo, gateway, service, now: () => clock, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
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
    expect((await repo.get(payment.id))?.state).toBe("released");
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

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((r) => (open = r));
  return { promise, open };
}

describe("RELEASE is the claim (capture in flight)", () => {
  async function heldWithGatedCapture() {
    // Real-time start so the in-flight released row is not stale to the sweep.
    const g = gate();
    const captureAuthorization = vi.fn().mockImplementation(async () => {
      await g.promise;
      return { captureId: "CAP1" };
    });
    const ctx = setup({ level: "high", start: new Date(), gateway: { captureAuthorization } });
    const { payment } = await ctx.service.start(send);
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    return { ...ctx, g, id: payment.id, captureAuthorization };
  }

  it("a block arriving while approve's capture is pending is refused and nothing is voided", async () => {
    const { service, gateway, g, id, captureAuthorization } = await heldWithGatedCapture();
    const approve = service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "approve" });
    await vi.waitFor(() => expect(captureAuthorization).toHaveBeenCalled());
    await expect(service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "block" })).rejects.toBeInstanceOf(ConcurrentUpdateError);
    expect(gateway.voidAuthorization).not.toHaveBeenCalled();
    g.open();
    expect((await approve).state).toBe("paid_out");
  });

  it("a block arriving while senderRelease's capture is pending is refused", async () => {
    const { service, gateway, g, id, captureAuthorization, advance } = await heldWithGatedCapture();
    advance(24 * 3_600_000);
    const release = service.senderRelease({ paymentId: id, senderId: SENDER });
    await vi.waitFor(() => expect(captureAuthorization).toHaveBeenCalled());
    await expect(service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "block" })).rejects.toBeInstanceOf(ConcurrentUpdateError);
    expect(gateway.voidAuthorization).not.toHaveBeenCalled();
    g.open();
    expect((await release).state).toBe("paid_out");
  });

  it("expireStale at 72h does not void a payment whose capture is pending", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
      const { service, gateway, g, id, captureAuthorization, advance } = await heldWithGatedCapture();
      const tick = (ms: number) => { advance(ms); vi.setSystemTime(new Date(Date.now() + ms)); };
      tick(71 * 3_600_000 + 59 * 60_000);
      const approve = service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "approve" });
      await vi.waitFor(() => expect(captureAuthorization).toHaveBeenCalled());
      tick(60_000);
      expect((await service.expireStale()).expired).toEqual([]);
      expect(gateway.voidAuthorization).not.toHaveBeenCalled();
      g.open();
      expect((await approve).state).toBe("paid_out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses approve and release once the 72-hour hold has ended, but still allows block", async () => {
    const { service, advance, id } = await heldWithGatedCapture();
    advance(72 * 3_600_000);
    await expect(service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "approve" })).rejects.toThrow("This payment's hold has ended.");
    await expect(service.senderRelease({ paymentId: id, senderId: SENDER })).rejects.toThrow("This payment's hold has ended.");
    expect((await service.contactDecision({ paymentId: id, contactId: CONTACT, decision: "block" })).state).toBe("voided");
  });
});

describe("when compensation is allowed", () => {
  const uncertain = () => new PayPalError("payout", 503, undefined, "d", true);
  async function run(sendPayout: PayPalGateway["sendPayout"]) {
    const ctx = setup({ level: "low", gateway: { sendPayout } });
    const { payment } = await ctx.service.start({ ...send, amountCents: 1000 });
    const result = await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER }).catch((e) => e);
    return { ...ctx, id: payment.id, result, state: (await ctx.repo.get(payment.id))?.state };
  }

  it("uncertain then a token failure leaves it captured with no refund", async () => {
    const r = await run(vi.fn().mockRejectedValueOnce(uncertain()).mockRejectedValue(new PayPalError("t", 0, undefined, undefined)));
    expect(r.state).toBe("captured");
    expect(r.gateway.refundCapture).not.toHaveBeenCalled();
  });
  it("uncertain then 422 leaves it captured with no refund", async () => {
    const r = await run(vi.fn().mockRejectedValueOnce(uncertain()).mockRejectedValue(new PayPalError("p", 422, "X", "d")));
    expect(r.state).toBe("captured");
    expect(r.gateway.refundCapture).not.toHaveBeenCalled();
  });
  it("a first-attempt 422 refunds", async () => {
    const r = await run(vi.fn().mockRejectedValue(new PayPalError("p", 422, "X", "d")));
    expect(r.state).toBe("refunded");
  });
  it.each([401, 408, 429, 0, 500])("a first-attempt status %i leaves it captured with no refund", async (status) => {
    const r = await run(vi.fn().mockRejectedValue(new PayPalError("p", status, undefined, "d")));
    expect(r.state).toBe("captured");
    expect(r.gateway.refundCapture).not.toHaveBeenCalled();
  });
  it("a non-PayPal error leaves it captured with no refund", async () => {
    const r = await run(vi.fn().mockRejectedValue(new Error("boom")));
    expect(r.state).toBe("captured");
    expect(r.gateway.refundCapture).not.toHaveBeenCalled();
  });
  it("the sweep never compensates a captured payment and records the failed retry", async () => {
    const sendPayout = vi.fn().mockRejectedValueOnce(uncertain()).mockRejectedValueOnce(uncertain()).mockRejectedValue(new PayPalError("p", 422, "X", "d"));
    const r = await run(sendPayout);
    const out = await r.service.expireStale();
    expect(out.payoutRetried).toEqual([]);
    expect((await r.repo.get(r.id))?.state).toBe("captured");
    expect(r.gateway.refundCapture).not.toHaveBeenCalled();
    expect((await r.repo.auditFor(r.id)).map((a) => a.action)).toContain("payout_retry_failed");
  });
});

describe("stranded payments self-heal", () => {
  const fresh = () => setup({ level: "high", start: new Date() });

  async function strandAt(state: "approved" | "authorised" | "released") {
    const ctx = fresh();
    const { payment } = await ctx.service.start(send);
    const row = await ctx.repo.get(payment.id);
    const base = { authorizationId: "AUTH1", authorisedAt: new Date(ctx.now().getTime()) };
    if (state === "approved") await ctx.repo.transition(payment.id, "created", { state: "approved" }, row!.version);
    else if (state === "authorised") {
      const a = await ctx.repo.transition(payment.id, "created", { state: "approved" }, row!.version);
      await ctx.repo.transition(payment.id, "approved", { state: "authorised", ...base }, a.version);
    } else {
      const a = await ctx.repo.transition(payment.id, "created", { state: "approved" }, row!.version);
      const b = await ctx.repo.transition(payment.id, "approved", { state: "authorised", ...base }, a.version);
      const c = await ctx.repo.transition(payment.id, "authorised", { state: "held", ...base }, b.version);
      await ctx.repo.transition(payment.id, "held", { state: "released" }, c.version);
    }
    return { ...ctx, id: payment.id };
  }

  it("recovers an approved payment into held", async () => {
    const ctx = await strandAt("approved");
    ctx.advance(STALE_MS + 1);
    const out = await ctx.service.expireStale();
    expect(out.recovered).toEqual([ctx.id]);
    const row = await ctx.repo.get(ctx.id);
    expect(row?.state).toBe("held");
    expect(row?.authorizationId).toBe("AUTH1");
    expect(row!.coolingOffUntil!.getTime() - row!.authorisedAt!.getTime()).toBe(24 * 3_600_000);
  });

  it("recovers an authorised payment into held", async () => {
    const ctx = await strandAt("authorised");
    ctx.advance(STALE_MS + 1);
    expect((await ctx.service.expireStale()).recovered).toEqual([ctx.id]);
    expect((await ctx.repo.get(ctx.id))?.state).toBe("held");
  });

  it("replays capture and pays out a stale released payment", async () => {
    const ctx = await strandAt("released");
    ctx.advance(STALE_MS + 1);
    const out = await ctx.service.expireStale();
    expect(out.captureRetried).toEqual([ctx.id]);
    expect((await ctx.repo.get(ctx.id))?.state).toBe("paid_out");
  });

  it("does not touch fresh released, approved or authorised rows", async () => {
    for (const st of ["released", "approved", "authorised"] as const) {
      const ctx = await strandAt(st);
      ctx.advance(STALE_MS - 1000);
      const out = await ctx.service.expireStale();
      expect(out.captureRetried).toEqual([]);
      expect(out.recovered).toEqual([]);
      expect((await ctx.repo.get(ctx.id))?.state).toBe(st);
    }
  });
});

describe("sweep leaves in-flight captured and payout_failed rows alone", () => {
  it("skips a fresh captured row and retries a stale one", async () => {
    const sendPayout = vi.fn().mockRejectedValue(new PayPalError("p", 503, undefined, "d", true));
    const ctx = setup({ level: "low", start: new Date(), gateway: { sendPayout } });
    const { payment } = await ctx.service.start({ ...send, amountCents: 1000 });
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER }).catch(() => undefined);
    sendPayout.mockClear();
    sendPayout.mockResolvedValue({ payoutBatchId: "B2" });
    expect((await ctx.service.expireStale()).payoutRetried).toEqual([]);
    expect(sendPayout).not.toHaveBeenCalled();
    ctx.advance(STALE_MS + 1);
    expect((await ctx.service.expireStale()).payoutRetried).toEqual([payment.id]);
  });

  it("skips a fresh payout_failed row", async () => {
    const refundCapture = vi.fn().mockRejectedValue(new PayPalError("r", 500, undefined, "d", true));
    const ctx = setup({
      level: "low", start: new Date(),
      gateway: { sendPayout: vi.fn().mockRejectedValue(new PayPalError("p", 422, "X", "d")), refundCapture },
    });
    const { payment } = await ctx.service.start({ ...send, amountCents: 1000 });
    await ctx.service.completeApproval({ paymentId: payment.id, senderId: SENDER }).catch(() => undefined);
    refundCapture.mockClear();
    expect((await ctx.service.expireStale()).refundRetried).toEqual([]);
    expect(refundCapture).not.toHaveBeenCalled();
  });
});
