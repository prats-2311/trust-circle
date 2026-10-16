import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { trustLinks, users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzlePaymentRepo } from "./drizzlePaymentRepo";
import { ConcurrentUpdateError, type NewPayment } from "./paymentRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let senderId: string;
let contactId: string;

const base = (over: Partial<NewPayment> = {}): NewPayment => ({
  id: randomUUID(), senderId, payee: "grandson@example.com", amountCents: 80000, note: null, senderAnswer: null,
  state: "created", riskLevel: "high", scamType: "impersonation_family", reasons: ["r"], impersonatedRequester: null,
  paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null,
  authorisedAt: null, coolingOffUntil: null, ...over,
});

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [s] = await handle.db.insert(users).values({ email: "margaret@example.com", displayName: "Margaret" }).returning();
  const [c] = await handle.db.insert(users).values({ email: "sarah@example.com", displayName: "Sarah" }).returning();
  senderId = s!.id;
  contactId = c!.id;
  await handle.db.insert(trustLinks).values({ senderId, contactId, relationship: "daughter" });
});
afterAll(async () => handle?.close());

describe("drizzle payment repo", () => {
  it("round-trips the impersonated requester", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base({ impersonatedRequester: { kind: "person", name: "grandson" } }));
    expect((await repo.get(p.id))!.impersonatedRequester).toEqual({ kind: "person", name: "grandson" });
  });

  it("rejects a trust link from a user to themselves", async () => {
    await expect(handle.db.insert(trustLinks).values({ senderId, contactId: senderId, relationship: "self" })).rejects.toThrow();
  });

  it("reports whether a user exists, tolerating non-uuid ids", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    expect(await repo.userExists(senderId)).toBe(true);
    expect(await repo.userExists(randomUUID())).toBe(false);
    expect(await repo.userExists("not-a-uuid")).toBe(false);
  });

  it("inserts and reads a payment", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base());
    expect((await repo.get(p.id))?.payee).toBe("grandson@example.com");
  });

  it("transitions only from the expected state", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base({ state: "held" }));
    const results = await Promise.allSettled([
      repo.transition(p.id, "held", { state: "released" }),
      repo.transition(p.id, "held", { state: "blocked" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConcurrentUpdateError);
  });

  it("lets exactly one of two same-version approvals win", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base({ state: "held" }));
    const results = await Promise.allSettled([
      repo.transition(p.id, "held", { state: "held" }, p.version),
      repo.transition(p.id, "held", { state: "held" }, p.version),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(ConcurrentUpdateError);
    expect((await repo.get(p.id))?.version).toBe(1);
  });

  it("rejects a transition based on a stale version", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base({ state: "held" }));
    expect(p.version).toBe(0);
    const claimed = await repo.transition(p.id, "held", { state: "held" }, 0);
    expect(claimed.version).toBe(1);
    await expect(repo.transition(p.id, "held", { state: "blocked" }, 0)).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it("lists held payments for a trusted contact only", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    await repo.insert(base({ state: "held" }));
    expect(await repo.listHeldForContact(contactId)).toHaveLength(1);
    expect(await repo.listHeldForContact(senderId)).toHaveLength(0);
    expect(await repo.isContactFor(contactId, senderId)).toBe(true);
    expect(await repo.isContactFor(senderId, contactId)).toBe(false);
  });

  it("derives sender context from paid-out history", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    await repo.insert(base({ state: "paid_out", payee: "sarah@example.com", amountCents: 2000 }));
    await repo.insert(base({ state: "voided", payee: "scam@example.com", amountCents: 90000 }));
    const facts = await repo.senderContextFacts(senderId, new Date());
    expect(facts.previousPayees).toEqual(["sarah@example.com"]);
    expect(facts.recentAmountsCents).toEqual([2000]);
    expect(facts.paymentsInLastHour).toBe(2);
  });

  it("records and reads audit entries", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base());
    await repo.audit({ paymentId: p.id, actorId: senderId, action: "APPROVE", fromState: "created", toState: "approved", detail: {} });
    expect(await repo.auditFor(p.id)).toEqual([
      { paymentId: p.id, actorId: senderId, action: "APPROVE", fromState: "created", toState: "approved", detail: {} },
    ]);
  });

  it("writes the transition and its audit row together", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base());
    await repo.transition(p.id, "created", { state: "approved" }, p.version, { actorId: senderId, action: "APPROVE" });
    expect((await repo.get(p.id))!.state).toBe("approved");
    expect(await repo.auditFor(p.id)).toEqual([
      { paymentId: p.id, actorId: senderId, action: "APPROVE", fromState: "created", toState: "approved", detail: {} },
    ]);
  });

  it("rolls back the state change when the audit write fails", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base());
    // actor_id is a uuid column, so this audit insert fails inside the transaction.
    await expect(
      repo.transition(p.id, "created", { state: "approved" }, p.version, { actorId: "not-a-uuid", action: "APPROVE" }),
    ).rejects.toThrow();
    expect((await repo.get(p.id))!.state).toBe("created");
    expect(await repo.auditFor(p.id)).toEqual([]);
  });

  it("returns null for a non-uuid payment id", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    expect(await repo.get("not-a-uuid")).toBeNull();
  });

  it("round-trips reasons as a JSON array", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const p = await repo.insert(base({ reasons: ["First reason.", "Second, with \"quotes\"."] }));
    expect((await repo.get(p.id))!.reasons).toEqual(["First reason.", "Second, with \"quotes\"."]);
  });

  it("lists the circle's payments newest first and finds blocked ones", async () => {
    const repo = createDrizzlePaymentRepo(handle.db);
    const older = await repo.insert(base({ state: "held" }));
    const newer = await repo.insert(base({ state: "held" }));
    await repo.transition(newer.id, "held", { state: "blocked" }, undefined, { actorId: contactId, action: "BLOCK" });
    const listed = await repo.listForCircle(contactId, 10);
    expect(listed.map((p) => p.id)).toEqual([newer.id, older.id]);
    expect(await repo.listForCircle(senderId, 10)).toEqual([]);
    expect(await repo.blockedPaymentIds([older.id, newer.id])).toEqual([newer.id]);
    expect(await repo.blockedPaymentIds([])).toEqual([]);
  });
});
