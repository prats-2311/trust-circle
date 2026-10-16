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
      await db.insert(scamReports).values(r).onConflictDoNothing({ target: scamReports.messageCheckId });
      return (await findByCheck(r.messageCheckId))!;
    },
    findByCheck,
  };
}
