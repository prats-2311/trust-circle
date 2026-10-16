import { cosineDistance, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { scamPatterns } from "@/db/schema";
import type { ScamType } from "@/domain/types";
import type { PatternRecord, PatternRepo } from "./patternRepo";

const fields = {
  id: scamPatterns.id,
  description: scamPatterns.description,
  scamType: scamPatterns.scamType,
  reportCount: scamPatterns.reportCount,
};
const toRecord = (r: { id: string; description: string; scamType: string; reportCount: number }): PatternRecord => ({
  ...r,
  scamType: r.scamType as ScamType,
});

export function createDrizzlePatternRepo(db: Db): PatternRepo {
  return {
    async insert(p) {
      await db.insert(scamPatterns).values(p).onConflictDoNothing({ target: scamPatterns.description });
      const [row] = await db.select(fields).from(scamPatterns).where(eq(scamPatterns.description, p.description));
      return toRecord(row!);
    },
    async nearest(embedding, limit) {
      const distance = cosineDistance(scamPatterns.embedding, embedding);
      const rows = await db.select({ ...fields, distance }).from(scamPatterns).orderBy(distance).limit(limit);
      return rows.map(({ distance: d, ...r }) => ({ pattern: toRecord(r), similarity: 1 - Number(d) }));
    },
    async incrementReports(id) {
      await db
        .update(scamPatterns)
        .set({ reportCount: sql`${scamPatterns.reportCount} + 1` })
        .where(eq(scamPatterns.id, id));
    },
  };
}
