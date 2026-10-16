import { describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import { createMemoryPaymentRepo } from "@/payments/memoryPaymentRepo";
import { NotAllowedError } from "@/payments/paymentService";
import { createAftercareService } from "./aftercareService";

const SARAH = "22222222-2222-4222-8222-222222222222";
const MARGARET = "11111111-1111-4111-8111-111111111111";
const ROBERT = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-16T12:00:00Z");
const DAY = 86_400_000;

async function setup() {
  const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: MARGARET, contactId: SARAH }] });
  const base = { senderId: MARGARET, note: null, senderAnswer: null, state: "paid_out" as const, riskLevel: "low" as const, scamType: "none" as const, reasons: [], impersonatedRequester: null,
    paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null, authorisedAt: null, coolingOffUntil: null };
  const old = await repo.insert({ ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", payee: "old@x.com", amountCents: 100 });
  const recent = await repo.insert({ ...base, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", payee: "+1 (555) 010-9999", amountCents: 200 });
  const circle = createMemoryCircleRepo({
    users: [{ id: MARGARET, email: "m@x", displayName: "Margaret", safeWordHash: null }, { id: SARAH, email: "s@x", displayName: "Sarah", safeWordHash: null }],
    links: [{ senderId: MARGARET, contactId: SARAH, relationship: "daughter" }],
  });
  return { repo, circle, old, recent };
}

describe("aftercare service", () => {
  it("refuses a contact who is not in the sender's circle", async () => {
    const { repo, circle } = await setup();
    const agent = vi.fn();
    const svc = createAftercareService({ payments: repo, circle, registryConfirmed: async () => new Set(), agent, now: () => NOW });
    await expect(svc.review({ contactId: ROBERT, senderId: MARGARET })).rejects.toBeInstanceOf(NotAllowedError);
    expect(agent).not.toHaveBeenCalled();
  });

  it("passes only the last 30 days, flags confirmed scam payees by comparable key and names the sender", async () => {
    const { repo, circle, old, recent } = await setup();
    // memory repo stamps createdAt on insert; age one row beyond 30 days
    const all = await repo.listBySender(MARGARET);
    expect(all).toHaveLength(2);
    const agent = vi.fn(async () => ({ findings: [], toolCalls: [], usedPayPal: false, summary: "s" }));
    const svc = createAftercareService({
      payments: { ...repo, listBySender: async (id: string) => (await repo.listBySender(id)).map((p) => (p.id === old.id ? { ...p, createdAt: new Date(NOW.getTime() - 31 * DAY) } : { ...p, createdAt: new Date(NOW.getTime() - 2 * DAY) })) } as typeof repo,
      circle, registryConfirmed: async () => new Set(["5550109999"]), agent, now: () => NOW,
    });
    await svc.review({ contactId: SARAH, senderId: MARGARET });
    const arg = (agent.mock.calls[0] as unknown as [{ senderName: string; payments: { id: string; confirmedScamPayee: boolean; createdAt: string }[] }])[0];
    expect(arg.senderName).toBe("Margaret");
    expect(arg.payments.map((p) => p.id)).toEqual([recent.id]);
    expect(arg.payments[0]).toMatchObject({ confirmedScamPayee: true, createdAt: new Date(NOW.getTime() - 2 * DAY).toISOString() });
  });
});
