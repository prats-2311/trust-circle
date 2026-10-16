import { randomUUID } from "node:crypto";
import type { IdentifierType, ScamType } from "@/domain/types";
import type { RegistrySource } from "./confirmation";

export interface RegistryEntry {
  id: string;
  identifierType: IdentifierType;
  key: string;
  scamType: ScamType;
  status: "unconfirmed" | "confirmed";
  confirmedAt: Date | null;
}

export interface WeeklyCount {
  /** Monday of the week, YYYY-MM-DD in UTC. */
  week: string;
  scamType: ScamType;
  count: number;
}

export interface RegistryRepo {
  upsertEntry(e: { identifierType: IdentifierType; key: string; scamType: ScamType }): Promise<RegistryEntry>;
  /** False when this reporter already reported this entry from this source. */
  addReport(r: { entryId: string; reporterId: string; source: RegistrySource; at?: Date }): Promise<boolean>;
  reportsFor(entryId: string): Promise<{ reporterId: string; source: RegistrySource }[]>;
  setStatus(entryId: string, status: "unconfirmed" | "confirmed", at: Date): Promise<void>;
  listKeys(): Promise<{ confirmed: string[]; unconfirmed: string[] }>;
  weeklyCounts(since: Date): Promise<WeeklyCount[]>;
}

export function mondayOf(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

export function createMemoryRegistryRepo(): RegistryRepo {
  const entries = new Map<string, RegistryEntry>();
  const reports: { entryId: string; reporterId: string; source: RegistrySource; at: Date }[] = [];
  return {
    async upsertEntry(e) {
      const existing = [...entries.values()].find((x) => x.key === e.key);
      if (existing) return { ...existing };
      const row: RegistryEntry = { id: randomUUID(), ...e, status: "unconfirmed", confirmedAt: null };
      entries.set(row.id, row);
      return { ...row };
    },
    async addReport(r) {
      if (reports.some((x) => x.entryId === r.entryId && x.reporterId === r.reporterId && x.source === r.source)) return false;
      reports.push({ entryId: r.entryId, reporterId: r.reporterId, source: r.source, at: r.at ?? new Date() });
      return true;
    },
    async reportsFor(entryId) {
      return reports.filter((r) => r.entryId === entryId).map(({ reporterId, source }) => ({ reporterId, source }));
    },
    async setStatus(entryId, status, at) {
      const e = entries.get(entryId);
      if (!e) return;
      e.status = status;
      e.confirmedAt = status === "confirmed" ? (e.confirmedAt ?? at) : null;
    },
    async listKeys() {
      const all = [...entries.values()];
      return {
        confirmed: all.filter((e) => e.status === "confirmed").map((e) => e.key),
        unconfirmed: all.filter((e) => e.status === "unconfirmed").map((e) => e.key),
      };
    },
    async weeklyCounts(since) {
      const counts = new Map<string, WeeklyCount>();
      for (const r of reports.filter((x) => x.at >= since)) {
        const scamType = entries.get(r.entryId)!.scamType;
        const week = mondayOf(r.at);
        const k = `${week}|${scamType}`;
        const c = counts.get(k) ?? { week, scamType, count: 0 };
        c.count += 1;
        counts.set(k, c);
      }
      return [...counts.values()];
    },
  };
}
