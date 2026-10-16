import type { ScamType } from "@/domain/types";
import type { Embedder } from "@/patterns/embedder";
import { PATTERN_THRESHOLD, type PatternMatcher } from "@/patterns/patternService";

const MAX_TEXT = 2000;
const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);

/**
 * The production matcher without a database: same embedder, same text cut, same threshold. Vectors are
 * unit length, so the dot product is the cosine similarity the database computes.
 */
export async function createMemoryPatternMatcher(
  embed: Embedder,
  patterns: { description: string; scamType: ScamType }[],
  threshold = PATTERN_THRESHOLD,
): Promise<PatternMatcher> {
  const vectors = await embed(patterns.map((p) => p.description));
  return async (text) => {
    const t = text.trim();
    if (!t) return null;
    const [v] = await embed([t.slice(0, MAX_TEXT)]);
    let best = -1;
    let bestSim = -Infinity;
    vectors.forEach((pv, i) => {
      const sim = dot(v!, pv);
      if (sim > bestSim) {
        best = i;
        bestSim = sim;
      }
    });
    if (best < 0 || bestSim < threshold) return null;
    return { patternId: `seed-${best}`, scamType: patterns[best]!.scamType, similarity: bestSim };
  };
}
