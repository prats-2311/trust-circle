import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { messageChecks } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { ScamType } from "@/domain/types";
import type { MessageCheckRecord, MessageRepo } from "./messageRepo";

type Row = typeof messageChecks.$inferSelect;
const toRecord = (r: Row): MessageCheckRecord => ({ ...r, scamType: r.scamType as ScamType });

export function createDrizzleMessageRepo(db: Db): MessageRepo {
  return {
    async insert(c) {
      const [row] = await db.insert(messageChecks).values(c).returning();
      return toRecord(row!);
    },
    async listBySender(senderId, limit) {
      if (!isUuid(senderId)) return [];
      const rows = await db
        .select()
        .from(messageChecks)
        .where(eq(messageChecks.senderId, senderId))
        .orderBy(desc(messageChecks.createdAt))
        .limit(limit);
      return rows.map(toRecord);
    },
  };
}
