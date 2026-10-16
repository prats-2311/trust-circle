import { and, count, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import type { PushRepo } from "./pushRepo";

export function createDrizzlePushRepo(db: Db): PushRepo {
  return {
    async save(userId, sub, at) {
      const rows = await db
        .insert(pushSubscriptions)
        .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: at })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: at },
          // One statement, so two users can't race: take over only your own row or one with identical keys.
          setWhere: or(
            eq(pushSubscriptions.userId, userId),
            and(eq(pushSubscriptions.p256dh, sql`excluded.p256dh`), eq(pushSubscriptions.auth, sql`excluded.auth`)),
          ),
        })
        .returning({ endpoint: pushSubscriptions.endpoint });
      return rows.length > 0 ? "saved" : "conflict";
    },
    async listForUser(userId) {
      const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      return rows.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
    },
    async remove(endpoint) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    },
    async removeForUser(userId, endpoint) {
      const gone = await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
        .returning({ endpoint: pushSubscriptions.endpoint });
      return gone.length > 0;
    },
    async countForUser(userId) {
      const [r] = await db.select({ n: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      return r?.n ?? 0;
    },
  };
}
