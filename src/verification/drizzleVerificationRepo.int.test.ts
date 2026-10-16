import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { createDrizzlePaymentRepo } from "@/payments/drizzlePaymentRepo";
import { freshTestDb } from "@/test/db";
import { createDrizzleVerificationRepo } from "./drizzleVerificationRepo";
import type { NewVerification } from "./verificationRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let paymentId: string;
let danielId: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [m] = await handle.db.insert(users).values({ email: "m@example.com", displayName: "Margaret" }).returning();
  const [d] = await handle.db.insert(users).values({ email: "d@example.com", displayName: "Daniel" }).returning();
  danielId = d!.id;
  const p = await createDrizzlePaymentRepo(handle.db).insert({
    id: randomUUID(), senderId: m!.id, payee: "x@example.com", amountCents: 80000, note: null, senderAnswer: null,
    state: "held", riskLevel: "high", scamType: "impersonation_family", reasons: ["r"], impersonatedRequester: { kind: "person", name: "grandson" },
    paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null, authorisedAt: null, coolingOffUntil: null,
  });
  paymentId = p.id;
});
afterAll(async () => handle?.close());

const at = (s: string) => new Date(`2026-11-01T10:${s}:00Z`);
const v = (over: Partial<NewVerification> = {}): NewVerification => ({
  paymentId, method: "real_person", status: "pending", targetContactId: danielId, requesterName: "grandson",
  createdAt: at("00"), resolvedAt: null, ...over,
});

describe("drizzle verification repo", () => {
  it("inserts, reads and lists oldest first", async () => {
    const repo = createDrizzleVerificationRepo(handle.db);
    const second = await repo.insert(v({ method: "memory_question", status: "passed", targetContactId: null, createdAt: at("05"), resolvedAt: at("05") }));
    const first = await repo.insert(v());
    expect(await repo.get(first.id)).toEqual(first);
    expect((await repo.listForPayment(paymentId)).map((x) => x.id)).toEqual([first.id, second.id]);
  });
  it("resolves only from pending", async () => {
    const repo = createDrizzleVerificationRepo(handle.db);
    const a = await repo.insert(v());
    expect(await repo.resolve(a.id, "denied", at("03"))).toBe(true);
    expect(await repo.resolve(a.id, "confirmed", at("04"))).toBe(false);
    expect(await repo.get(a.id)).toMatchObject({ status: "denied", resolvedAt: at("03") });
  });
  it("tolerates non-uuid ids", async () => {
    const repo = createDrizzleVerificationRepo(handle.db);
    expect(await repo.get("nope")).toBeNull();
    expect(await repo.listForPayment("nope")).toEqual([]);
    expect(await repo.resolve("nope", "denied", at("01"))).toBe(false);
  });
});
