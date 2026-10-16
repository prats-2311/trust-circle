import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { scamReports } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { ScamReportRepo } from "./scamReportRepo";

export function createDrizzleScamReportRepo(db: Db): ScamReportRepo {
  const findByCheck: ScamReportRepo["findByCheck"] = async (messageCheckId) => {
    if (!isUuid(messageCheckId)) return null;
    const [row] = await db.select().from(scamReports).where(eq(scamReports.messageCheckId, messageCheckId));
    return row ?? null;
  };
  return {
    async insert(r) {
      const [row] = await db.insert(scamReports).values(r).onConflictDoNothing({ target: scamReports.messageCheckId }).returning();
      if (row) return { record: row, created: true };
      return { record: (await findByCheck(r.messageCheckId))!, created: false };
    },
    async setPattern(id, patternId) {
      if (!isUuid(id)) return;
      await db.update(scamReports).set({ patternId }).where(eq(scamReports.id, id));
    },
    findByCheck,
  };
}
