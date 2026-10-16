import { describe, expect, it } from "vitest";
import path from "node:path";
import { getEmbedder, loadTransformers } from "./embedder";

describe("getEmbedder", () => {
  it("returns one process-wide instance (the model is never loaded here)", () => {
    expect(getEmbedder()).toBe(getEmbedder());
  });
});

describe("transformers cache", () => {
  it("keeps downloaded models in .cache/transformers under the working directory", async () => {
    const { env } = await loadTransformers();
    expect(env.cacheDir).toBe(path.join(process.cwd(), ".cache", "transformers"));
    expect(env.cacheDir?.endsWith(path.join(".cache", "transformers"))).toBe(true);
  });
});
