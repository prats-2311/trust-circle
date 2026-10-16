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
  /** Idempotent on messageCheckId: a second insert returns the first report with created: false. */
  insert(r: Omit<ScamReportRecord, "id" | "createdAt">): Promise<{ record: ScamReportRecord; created: boolean }>;
  setPattern(id: string, patternId: string): Promise<void>;
  findByCheck(messageCheckId: string): Promise<ScamReportRecord | null>;
}

export function createMemoryScamReportRepo(): ScamReportRepo {
  const rows: ScamReportRecord[] = [];
  return {
    async insert(r) {
      const existing = rows.find((x) => x.messageCheckId === r.messageCheckId);
      if (existing) return { record: { ...existing }, created: false };
      const row = { ...r, id: randomUUID(), createdAt: new Date() };
      rows.push(row);
      return { record: { ...row }, created: true };
    },
    async setPattern(id, patternId) {
      const r = rows.find((x) => x.id === id);
      if (r) r.patternId = patternId;
    },
    async findByCheck(messageCheckId) {
      const r = rows.find((x) => x.messageCheckId === messageCheckId);
      return r ? { ...r } : null;
    },
  };
}
