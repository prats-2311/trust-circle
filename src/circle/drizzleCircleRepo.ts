import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { trustLinks, users } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { CircleRepo } from "./circleRepo";

export function createDrizzleCircleRepo(db: Db): CircleRepo {
  return {
    async contactsOf(senderId) {
      if (!isUuid(senderId)) return [];
      return db
        .select({ contactId: trustLinks.contactId, displayName: users.displayName, relationship: trustLinks.relationship })
        .from(trustLinks)
        .innerJoin(users, eq(users.id, trustLinks.contactId))
        .where(eq(trustLinks.senderId, senderId))
        .orderBy(trustLinks.createdAt);
    },
    async getUser(id) {
      if (!isUuid(id)) return null;
      const [row] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, safeWordHash: users.safeWordHash })
        .from(users)
        .where(eq(users.id, id));
      return row ?? null;
    },
    async getUserByEmail(email) {
      const [row] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName, safeWordHash: users.safeWordHash })
        .from(users)
        .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
      return row ?? null;
    },
    async sendersOf(contactId) {
      if (!isUuid(contactId)) return [];
      return db
        .select({ senderId: trustLinks.senderId, displayName: users.displayName, relationship: trustLinks.relationship })
        .from(trustLinks)
        .innerJoin(users, eq(users.id, trustLinks.senderId))
        .where(eq(trustLinks.contactId, contactId))
        .orderBy(trustLinks.createdAt);
    },
    async setSafeWordHash(userId, hash) {
      if (!isUuid(userId)) return;
      await db.update(users).set({ safeWordHash: hash }).where(eq(users.id, userId));
    },
  };
}
