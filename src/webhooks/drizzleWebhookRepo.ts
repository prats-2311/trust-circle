import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { webhookEvents } from "@/db/schema";
import type { WebhookRepo } from "./webhookRepo";

export function createDrizzleWebhookRepo(db: Db): WebhookRepo {
  return {
    async claim(eventId, type, at) {
      const rows = await db
        .insert(webhookEvents)
        .values({ id: eventId, type, receivedAt: at })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id });
      return rows.length > 0;
    },
    async markProcessed(eventId, at, result) {
      await db.update(webhookEvents).set({ processedAt: at, result }).where(eq(webhookEvents.id, eventId));
    },
    async markFailed(eventId, _at, errorName) {
      await db.update(webhookEvents).set({ result: `failed:${errorName}` }).where(eq(webhookEvents.id, eventId));
    },
  };
}
