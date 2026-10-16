import { describe, expect, it } from "vitest";
import { createMemoryPaymentRepo } from "./memoryPaymentRepo";
import { ConcurrentUpdateError, type NewPayment } from "./paymentRepo";

const base = (over: Partial<NewPayment> = {}): NewPayment => ({
  id: "p1", senderId: "s1", payee: "grandson@example.com", amountCents: 80000, note: null, senderAnswer: null,
  state: "held", riskLevel: "high", scamType: "impersonation_family", reasons: ["r"],
  paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null,
  authorisedAt: null, coolingOffUntil: null, ...over,
});

describe("memory payment repo", () => {
  it("rejects a self trust link", () => {
    expect(() => createMemoryPaymentRepo({ trustLinks: [{ senderId: "u1", contactId: "u1" }] })).toThrow();
  });

  it("reports whether a user exists", async () => {
    const repo = createMemoryPaymentRepo({ users: ["u1"] });
    expect(await repo.userExists("u1")).toBe(true);
    expect(await repo.userExists("nope")).toBe(false);
  });

  it("lets exactly one of two concurrent transitions win", async () => {
    const repo = createMemoryPaymentRepo();
    const p = await repo.insert(base());
    const results = await Promise.allSettled([
      repo.transition(p.id, "held", { state: "released" }),
      repo.transition(p.id, "held", { state: "blocked" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConcurrentUpdateError);
  });

  it("lets exactly one of two same-state transitions win when both pass the read version", async () => {
    const repo = createMemoryPaymentRepo();
    const p = await repo.insert(base());
    const results = await Promise.allSettled([
      repo.transition(p.id, "held", { state: "held" }, p.version),
      repo.transition(p.id, "held", { state: "held" }, p.version),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ConcurrentUpdateError);
  });

  it("rejects a stale version and increments version on success", async () => {
    const repo = createMemoryPaymentRepo();
    const p = await repo.insert(base());
    expect((await repo.transition(p.id, "held", { state: "held" }, 0)).version).toBe(1);
    await expect(repo.transition(p.id, "held", { state: "blocked" }, 0)).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it("rejects a transition on a missing payment", async () => {
    const repo = createMemoryPaymentRepo();
    await expect(repo.transition("nope", "held", { state: "blocked" })).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it("scopes held lists to trusted contacts and derives context from paid-out history", async () => {
    const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: "s1", contactId: "c1" }] });
    await repo.insert(base());
    await repo.insert(base({ id: "p2", state: "paid_out", payee: "sarah@example.com", amountCents: 2000 }));
    expect(await repo.listHeldForContact("c1")).toHaveLength(1);
    expect(await repo.listHeldForContact("s1")).toHaveLength(0);
    expect(await repo.isContactFor("c1", "s1")).toBe(true);
    expect(await repo.isContactFor("s1", "c1")).toBe(false);
    const f = await repo.senderContextFacts("s1", new Date());
    expect(f).toEqual({ previousPayees: ["sarah@example.com"], recentAmountsCents: [2000], paymentsInLastHour: 2 });
  });

  it("records the audit entry passed to transition", async () => {
    const repo = createMemoryPaymentRepo();
    const p = await repo.insert(base({ state: "created" }));
    await repo.transition(p.id, "created", { state: "approved" }, p.version, { actorId: null, action: "APPROVE" });
    expect(await repo.auditFor(p.id)).toEqual([
      { paymentId: p.id, actorId: null, action: "APPROVE", fromState: "created", toState: "approved", detail: {} },
    ]);
  });
});
