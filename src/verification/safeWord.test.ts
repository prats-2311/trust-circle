import { describe, expect, it } from "vitest";
import { hashSafeWord, normaliseSafeWord, validateSafeWord, verifySafeWord } from "./safeWord";

describe("safe word", () => {
  it("normalises case and spacing", () => expect(normaliseSafeWord("  Blue   Heron ")).toBe("blue heron"));
  it("verifies a matching word however it was typed", async () => {
    const stored = await hashSafeWord("Blue Heron");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("heron");
    expect(await verifySafeWord("blue  HERON", stored)).toBe(true);
    expect(await verifySafeWord("blue herring", stored)).toBe(false);
  });
  it("salts each hash", async () => {
    expect(await hashSafeWord("heron")).not.toBe(await hashSafeWord("heron"));
  });
  it("rejects a malformed stored value", async () => {
    expect(await verifySafeWord("heron", "plain-text")).toBe(false);
  });
  it("rejects a stored key of the wrong length", async () => {
    expect(await verifySafeWord("x", "scrypt$abc$!!!")).toBe(false);
  });
  it("validates length", () => {
    expect(validateSafeWord("ab")).toBe("Please choose a safe word with at least 3 letters.");
    expect(validateSafeWord("x".repeat(41))).toBe("Please choose a safe word of 40 letters or fewer.");
    expect(validateSafeWord("heron")).toBeNull();
  });
});
