import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { registryEntries, registryReports } from "@/db/schema";
import type { ScamType } from "@/domain/types";
import type { RegistryEntry, RegistryRepo } from "./registryRepo";

type Row = typeof registryEntries.$inferSelect;
const toEntry = (r: Row): RegistryEntry => ({
  id: r.id,
  identifierType: r.identifierType,
  key: r.key,
  scamType: r.scamType as ScamType,
  status: r.status,
  confirmedAt: r.confirmedAt,
});

export function createDrizzleRegistryRepo(db: Db): RegistryRepo {
  return {
    async upsertEntry(e) {
      await db.insert(registryEntries).values(e).onConflictDoNothing({ target: registryEntries.key });
      const [row] = await db.select().from(registryEntries).where(eq(registryEntries.key, e.key));
      return toEntry(row!);
    },
    async addReport(r) {
      const rows = await db
        .insert(registryReports)
        .values({ entryId: r.entryId, reporterId: r.reporterId, source: r.source, ...(r.at ? { createdAt: r.at } : {}) })
        .onConflictDoNothing()
        .returning({ id: registryReports.id });
      return rows.length > 0;
    },
    async reportsFor(entryId) {
      return db
        .select({ reporterId: registryReports.reporterId, source: registryReports.source })
        .from(registryReports)
        .where(eq(registryReports.entryId, entryId))
        .orderBy(registryReports.createdAt);
    },
    async setStatus(entryId, status, at) {
      await db
        .update(registryEntries)
        .set({
          status,
          confirmedAt: status === "confirmed" ? sql`coalesce(${registryEntries.confirmedAt}, ${at.toISOString()}::timestamptz)` : null,
          updatedAt: at,
        })
        .where(eq(registryEntries.id, entryId));
    },
    async listKeys() {
      const rows = await db.select({ key: registryEntries.key, status: registryEntries.status }).from(registryEntries);
      return {
        confirmed: rows.filter((r) => r.status === "confirmed").map((r) => r.key),
        unconfirmed: rows.filter((r) => r.status === "unconfirmed").map((r) => r.key),
      };
    },
    async weeklyCounts(since) {
      const week = sql<string>`to_char(date_trunc('week', ${registryReports.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
      const rows = await db
        .select({ week, scamType: registryEntries.scamType, count: sql<number>`count(*)::int` })
        .from(registryReports)
        .innerJoin(registryEntries, eq(registryEntries.id, registryReports.entryId))
        .where(and(gte(registryReports.createdAt, since)))
        .groupBy(week, registryEntries.scamType)
        .orderBy(week);
      return rows.map((r) => ({ week: r.week, scamType: r.scamType as ScamType, count: r.count }));
    },
  };
}
