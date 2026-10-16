import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { verifications } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { VerificationRepo } from "./verificationRepo";

export function createDrizzleVerificationRepo(db: Db): VerificationRepo {
  return {
    async insert(v) {
      const [row] = await db.insert(verifications).values(v).returning();
      return row!;
    },
    async get(id) {
      if (!isUuid(id)) return null;
      const [row] = await db.select().from(verifications).where(eq(verifications.id, id));
      return row ?? null;
    },
    async listForPayment(paymentId) {
      if (!isUuid(paymentId)) return [];
      return db.select().from(verifications).where(eq(verifications.paymentId, paymentId)).orderBy(asc(verifications.createdAt));
    },
    async resolve(id, to, at) {
      if (!isUuid(id)) return false;
      const [row] = await db
        .update(verifications)
        .set({ status: to, resolvedAt: at })
        .where(and(eq(verifications.id, id), eq(verifications.status, "pending")))
        .returning({ id: verifications.id });
      return Boolean(row);
    },
  };
}
