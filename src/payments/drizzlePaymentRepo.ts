import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditLog, payments, trustLinks, users } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { ScamType } from "@/domain/types";
import { ConcurrentUpdateError, type PaymentRecord, type PaymentRepo } from "./paymentRepo";

type Row = typeof payments.$inferSelect;
const toRecord = (r: Row): PaymentRecord => ({
  ...r,
  scamType: r.scamType as ScamType,
  impersonatedRequester: r.impersonatedRequester ?? null,
});

export function createDrizzlePaymentRepo(db: Db): PaymentRepo {
  return {
    async insert(p) {
      const [row] = await db.insert(payments).values(p).returning();
      return toRecord(row!);
    },
    async get(id) {
      if (!isUuid(id)) return null;
      const [row] = await db.select().from(payments).where(eq(payments.id, id));
      return row ? toRecord(row) : null;
    },
    async transition(id, expected, patch, expectedVersion, audit) {
      return db.transaction(async (tx) => {
        const conditions = [eq(payments.id, id), eq(payments.state, expected)];
        if (expectedVersion !== undefined) conditions.push(eq(payments.version, expectedVersion));
        const [row] = await tx
          .update(payments)
          .set({ ...patch, version: sql`${payments.version} + 1`, updatedAt: new Date() })
          .where(and(...conditions))
          .returning();
        if (!row) throw new ConcurrentUpdateError(id, expected);
        if (audit) {
          await tx.insert(auditLog).values({
            paymentId: id,
            actorId: audit.actorId,
            action: audit.action,
            fromState: expected,
            toState: row.state,
            detail: audit.detail ?? {},
          });
        }
        return toRecord(row);
      });
    },
    async listBySender(senderId) {
      return (await db.select().from(payments).where(eq(payments.senderId, senderId))).map(toRecord);
    },
    async listHeldForContact(contactId) {
      const rows = await db
        .select({ p: payments })
        .from(payments)
        .innerJoin(trustLinks, eq(trustLinks.senderId, payments.senderId))
        .where(and(eq(trustLinks.contactId, contactId), eq(payments.state, "held")));
      return rows.map((r) => toRecord(r.p));
    },
    async listByStates(states) {
      if (states.length === 0) return [];
      return (await db.select().from(payments).where(inArray(payments.state, states))).map(toRecord);
    },
    async senderContextFacts(senderId, now) {
      const paid = await db
        .select({ payee: payments.payee, amountCents: payments.amountCents })
        .from(payments)
        .where(and(eq(payments.senderId, senderId), eq(payments.state, "paid_out")));
      const hourAgo = new Date(now.getTime() - 3_600_000);
      const [count] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(payments)
        .where(and(eq(payments.senderId, senderId), gte(payments.createdAt, hourAgo)));
      return {
        previousPayees: [...new Set(paid.map((r) => r.payee))],
        recentAmountsCents: paid.map((r) => r.amountCents),
        paymentsInLastHour: count?.n ?? 0,
      };
    },
    async userExists(id) {
      if (!isUuid(id)) return false;
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
      return Boolean(row);
    },
    async isContactFor(contactId, senderId) {
      const [row] = await db
        .select({ id: trustLinks.id })
        .from(trustLinks)
        .where(and(eq(trustLinks.contactId, contactId), eq(trustLinks.senderId, senderId)));
      return Boolean(row);
    },
    async audit(e) {
      await db.insert(auditLog).values(e);
    },
    async auditFor(paymentId) {
      const rows = await db.select().from(auditLog).where(eq(auditLog.paymentId, paymentId)).orderBy(auditLog.createdAt);
      return rows.map(({ paymentId, actorId, action, fromState, toState, detail }) => ({
        paymentId, actorId, action, fromState, toState, detail,
      }));
    },
  };
}
