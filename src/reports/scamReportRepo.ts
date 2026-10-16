import { randomUUID } from "node:crypto";

export interface ScamReportRecord {
  id: string;
  reporterId: string;
  messageCheckId: string;
  patternId: string | null;
  subject: string;
  body: string;
  createdAt: Date;
}

export interface ScamReportRepo {
  /** Idempotent on messageCheckId: a second insert returns the first report. */
  insert(r: Omit<ScamReportRecord, "id" | "createdAt">): Promise<ScamReportRecord>;
  findByCheck(messageCheckId: string): Promise<ScamReportRecord | null>;
}

export function createMemoryScamReportRepo(): ScamReportRepo {
  const rows: ScamReportRecord[] = [];
  return {
    async insert(r) {
      const existing = rows.find((x) => x.messageCheckId === r.messageCheckId);
      if (existing) return { ...existing };
      const row = { ...r, id: randomUUID(), createdAt: new Date() };
      rows.push(row);
      return { ...row };
    },
    async findByCheck(messageCheckId) {
      const r = rows.find((x) => x.messageCheckId === messageCheckId);
      return r ? { ...r } : null;
    },
  };
}
