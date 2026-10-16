import { describe, expect, it } from "vitest";
import type { Embedder } from "@/patterns/embedder";
import { createMemoryPatternMatcher } from "./memoryPatterns";

// Unit vectors: cosine similarity between [1,0] and [c, sqrt(1-c^2)] is c.
const at = (c: number) => [c, 0, Math.sqrt(1 - c * c)];
const fake: Embedder = async (texts) =>
  texts.map((t) => {
    if (t === "pattern-a") return [1, 0, 0];
    if (t === "pattern-b") return [0, 1, 0];
    if (t === "near") return at(0.5);
    if (t === "edge") return at(0.35);
    if (t === "far") return at(0.2);
    return [0, 0, 0];
  });
const patterns = [
  { description: "pattern-a", scamType: "romance" as const },
  { description: "pattern-b", scamType: "invoice" as const },
];

describe("createMemoryPatternMatcher", () => {
  it("matches at or above the threshold and keeps the pattern's scam type", async () => {
    const match = await createMemoryPatternMatcher(fake, patterns);
    const m = await match("near");
    expect(m).toMatchObject({ scamType: "romance" });
    expect(m!.similarity).toBeCloseTo(0.5);
    expect(await match("edge")).not.toBeNull();
  });
  it("does not match below the threshold", async () => {
    const match = await createMemoryPatternMatcher(fake, patterns);
    expect(await match("far")).toBeNull();
  });
  it("returns null for empty text and honours a custom threshold", async () => {
    const match = await createMemoryPatternMatcher(fake, patterns, 0.6);
    expect(await match("   ")).toBeNull();
    expect(await match("near")).toBeNull();
  });
});
