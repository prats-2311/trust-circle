import { describe, expect, it, vi } from "vitest";
import type { Embedder } from "./embedder";
import { createMemoryPatternRepo } from "./patternRepo";
import { createPatternService } from "./patternService";

// Three-dimensional stand-ins for the real 384-dimension vectors.
const vectors: Record<string, number[]> = {
  "grandchild in custody asks for secret bail money": [1, 0, 0],
  "Grandma it's Josh, I'm in jail and need bail, don't tell anyone": [0.9, 0.3, 0],
  "Hi Mom, landed safely, call you after dinner": [0, 0, 1],
  "grandchild in jail wants secret bail": [0.99, 0.05, 0],
};
const fakeEmbed: Embedder = async (texts) => texts.map((t) => vectors[t] ?? [0, 1, 0]);

async function seeded() {
  const repo = createMemoryPatternRepo();
  const service = createPatternService({ repo, embed: fakeEmbed });
  await service.add({ description: "grandchild in custody asks for secret bail money", scamType: "impersonation_family" });
  return { repo, service };
}

describe("pattern service timeout", () => {
  it("returns null when the embedder never answers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = createPatternService({ repo: createMemoryPatternRepo(), embed: () => new Promise(() => {}), timeoutMs: 20 });
    const started = Date.now();
    expect(await service.match("Grandma it's me")).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(warn).toHaveBeenCalledWith("pattern match unavailable", { error: "Timeout" });
    warn.mockRestore();
  });
});

describe("pattern service", () => {
  it("matches a reworded scam above the threshold", async () => {
    const { service } = await seeded();
    const m = await service.match("Grandma it's Josh, I'm in jail and need bail, don't tell anyone");
    expect(m).toMatchObject({ scamType: "impersonation_family" });
    expect(m!.similarity).toBeGreaterThan(0.9);
  });
  it("does not match an ordinary message", async () => {
    const { service } = await seeded();
    expect(await service.match("Hi Mom, landed safely, call you after dinner")).toBeNull();
  });
  it("returns null for empty text without embedding", async () => {
    const embed = vi.fn(fakeEmbed);
    const service = createPatternService({ repo: createMemoryPatternRepo(), embed });
    expect(await service.match("   ")).toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });
  it("skips matching when the model or store fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = createPatternService({ repo: createMemoryPatternRepo(), embed: vi.fn().mockRejectedValue(new Error("load failed")) });
    expect(await service.match("anything")).toBeNull();
    expect(console.warn).toHaveBeenCalledWith("pattern match unavailable", { error: "Error" });
  });
  it("counts a near-duplicate description instead of storing it twice", async () => {
    const { service, repo } = await seeded();
    const p = await service.add({ description: "grandchild in jail wants secret bail", scamType: "impersonation_family" });
    expect(p.reportCount).toBe(2);
    expect(await repo.nearest([1, 0, 0], 5)).toHaveLength(1);
  });
});
