import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { webhookEvents } from "@/db/schema";
import type { WebhookRepo } from "./webhookRepo";

export function createDrizzleWebhookRepo(db: Db): WebhookRepo {
  return {
    async claim(eventId, type, at) {
      const rows = await db
        .insert(webhookEvents)
        .values({ id: eventId, type, receivedAt: at, attempts: 1 })
        .onConflictDoUpdate({
          target: webhookEvents.id,
          set: { attempts: sql`${webhookEvents.attempts} + 1` },
          setWhere: isNull(webhookEvents.processedAt),
        })
        .returning({ attempts: webhookEvents.attempts });
      return rows[0] ?? null;
    },
    async markProcessed(eventId, at, result) {
      await db.update(webhookEvents).set({ processedAt: at, result }).where(eq(webhookEvents.id, eventId));
    },
    async markFailed(eventId, _at, errorName) {
      await db.update(webhookEvents).set({ processedAt: null, result: `failed:${errorName}` }).where(eq(webhookEvents.id, eventId));
    },
  };
}
