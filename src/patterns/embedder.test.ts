import { describe, expect, it } from "vitest";
import { getEmbedder } from "./embedder";

describe("getEmbedder", () => {
  it("returns one process-wide instance (the model is never loaded here)", () => {
    expect(getEmbedder()).toBe(getEmbedder());
  });
});
