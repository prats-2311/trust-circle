import type { ScamType } from "@/domain/types";
import type { Embedder } from "./embedder";
import type { PatternRecord, PatternRepo } from "./patternRepo";

// From the 2026-10-16 spike with all-MiniLM-L6-v2: reworded scams scored 0.42-0.46, genuine messages at most 0.27.
export const PATTERN_THRESHOLD = 0.35;
export const DUPLICATE_THRESHOLD = 0.9;
const MAX_TEXT = 2000;
const DEFAULT_MATCH_TIMEOUT_MS = 3000;

export interface PatternMatch {
  patternId: string;
  scamType: ScamType;
  similarity: number;
}
export type PatternMatcher = (text: string) => Promise<PatternMatch | null>;

export function createPatternService(deps: { repo: PatternRepo; embed: Embedder; threshold?: number; timeoutMs?: number }) {
  const threshold = deps.threshold ?? PATTERN_THRESHOLD;

  const match: PatternMatcher = async (text) => {
    const t = text.trim();
    if (!t) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const lookup = async () => {
        const [v] = await deps.embed([t.slice(0, MAX_TEXT)]);
        const [nearest] = await deps.repo.nearest(v!, 1);
        return nearest;
      };
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("pattern match timed out"), { name: "Timeout" })), deps.timeoutMs ?? DEFAULT_MATCH_TIMEOUT_MS);
      });
      const lookedUp = lookup();
      lookedUp.catch(() => {}); // a late failure after the timeout is already handled
      const best = await Promise.race([lookedUp, timeout]);
      if (!best || best.similarity < threshold) return null;
      return { patternId: best.pattern.id, scamType: best.pattern.scamType, similarity: best.similarity };
    } catch (e) {
      // Matching is one signal among several; when it is unavailable the others still decide.
      console.warn("pattern match unavailable", { error: e instanceof Error ? e.name : "unknown" });
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    match,
    /** Stores an anonymised script, or counts another report of a near-identical one. */
    async add(p: { description: string; scamType: ScamType }): Promise<PatternRecord> {
      const [v] = await deps.embed([p.description]);
      const [best] = await deps.repo.nearest(v!, 1);
      if (best && best.similarity >= DUPLICATE_THRESHOLD) {
        await deps.repo.incrementReports(best.pattern.id);
        return { ...best.pattern, reportCount: best.pattern.reportCount + 1 };
      }
      return deps.repo.insert({ ...p, embedding: v! });
    },
  };
}

export type PatternService = ReturnType<typeof createPatternService>;
