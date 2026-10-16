import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { alerts } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { AlertKind, AlertPayload, AlertRecord, AlertRepo } from "./alertRepo";

type Row = typeof alerts.$inferSelect;
const toRecord = (r: Row): AlertRecord => ({ ...r, kind: r.kind as AlertKind, payload: r.payload as unknown as AlertPayload });

export function createDrizzleAlertRepo(db: Db): AlertRepo {
  return {
    async insert(a) {
      const [row] = await db
        .insert(alerts)
        .values({ ...a, payload: a.payload as unknown as Record<string, unknown> })
        .returning();
      return toRecord(row!);
    },
    async listForRecipient(recipientId, limit) {
      if (!isUuid(recipientId)) return [];
      const rows = await db
        .select()
        .from(alerts)
        .where(and(eq(alerts.recipientId, recipientId), eq(alerts.channel, "in_app")))
        .orderBy(desc(alerts.createdAt))
        .limit(limit);
      return rows.map(toRecord);
    },
    async markRead(id, recipientId, at) {
      if (!isUuid(id) || !isUuid(recipientId)) return false;
      const [row] = await db
        .update(alerts)
        .set({ readAt: sql`coalesce(${alerts.readAt}, ${at.toISOString()}::timestamptz)` })
        .where(and(eq(alerts.id, id), eq(alerts.recipientId, recipientId)))
        .returning({ id: alerts.id });
      return Boolean(row);
    },
  };
}
