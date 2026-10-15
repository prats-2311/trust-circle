import { ConcurrentUpdateError, type AuditEntry, type PaymentRecord, type PaymentRepo } from "./paymentRepo";

export function createMemoryPaymentRepo(seed: { trustLinks?: { senderId: string; contactId: string }[]; users?: string[] } = {}): PaymentRepo {
  const rows = new Map<string, PaymentRecord>();
  const audits: AuditEntry[] = [];
  const links = seed.trustLinks ?? [];
  if (links.some((l) => l.senderId === l.contactId)) throw new Error("A sender cannot be their own trusted contact");
  const clone = (p: PaymentRecord) => structuredClone(p);

  return {
    async insert(p) {
      const now = new Date();
      const row = { ...p, version: 0, createdAt: now, updatedAt: now };
      rows.set(p.id, row);
      return clone(row);
    },
    async get(id) {
      const r = rows.get(id);
      return r ? clone(r) : null;
    },
    async transition(id, expected, patch, expectedVersion) {
      const r = rows.get(id);
      if (!r || r.state !== expected || (expectedVersion !== undefined && r.version !== expectedVersion)) {
        throw new ConcurrentUpdateError(id, expected);
      }
      const next = { ...r, ...patch, version: r.version + 1, updatedAt: new Date() };
      rows.set(id, next);
      return clone(next);
    },
    async listBySender(senderId) {
      return [...rows.values()].filter((r) => r.senderId === senderId).map(clone);
    },
    async listHeldForContact(contactId) {
      const senders = new Set(links.filter((l) => l.contactId === contactId).map((l) => l.senderId));
      return [...rows.values()].filter((r) => r.state === "held" && senders.has(r.senderId)).map(clone);
    },
    async listByStates(states) {
      return [...rows.values()].filter((r) => states.includes(r.state)).map(clone);
    },
    async senderContextFacts(senderId, now) {
      const mine = [...rows.values()].filter((r) => r.senderId === senderId);
      const paid = mine.filter((r) => r.state === "paid_out");
      return {
        previousPayees: [...new Set(paid.map((r) => r.payee))],
        recentAmountsCents: paid.map((r) => r.amountCents),
        paymentsInLastHour: mine.filter((r) => now.getTime() - r.createdAt.getTime() < 3_600_000).length,
      };
    },
    async isContactFor(contactId, senderId) {
      return links.some((l) => l.contactId === contactId && l.senderId === senderId);
    },
    async userExists(id) {
      return (seed.users ?? []).includes(id) || links.some((l) => l.senderId === id || l.contactId === id);
    },
    async audit(e) {
      audits.push(structuredClone(e));
    },
    async auditFor(paymentId) {
      return audits.filter((a) => a.paymentId === paymentId).map((a) => structuredClone(a));
    },
  };
}
