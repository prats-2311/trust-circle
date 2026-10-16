import { randomUUID } from "node:crypto";
import type { ScamType } from "@/domain/types";

export interface PatternRecord {
  id: string;
  description: string;
  scamType: ScamType;
  reportCount: number;
}

export interface PatternRepo {
  /** Idempotent on description. */
  insert(p: { description: string; scamType: ScamType; embedding: number[] }): Promise<PatternRecord>;
  /** Closest first; similarity is cosine similarity (1 = same meaning). */
  nearest(embedding: number[], limit: number): Promise<{ pattern: PatternRecord; similarity: number }[]>;
  incrementReports(id: string): Promise<void>;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function createMemoryPatternRepo(): PatternRepo {
  const rows: (PatternRecord & { embedding: number[] })[] = [];
  const strip = (r: PatternRecord): PatternRecord => ({
    id: r.id,
    description: r.description,
    scamType: r.scamType,
    reportCount: r.reportCount,
  });
  return {
    async insert(p) {
      const existing = rows.find((r) => r.description === p.description);
      if (existing) return strip(existing);
      const row = { id: randomUUID(), description: p.description, scamType: p.scamType, reportCount: 1, embedding: [...p.embedding] };
      rows.push(row);
      return strip(row);
    },
    async nearest(embedding, limit) {
      return rows
        .map((r) => ({ pattern: strip(r), similarity: cosine(embedding, r.embedding) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },
    async incrementReports(id) {
      const r = rows.find((x) => x.id === id);
      if (r) r.reportCount += 1;
    },
  };
}
