import { describe, expect, it } from "vitest";
import { firstUnfinished, stepNumber } from "./steps";

const fresh = { preset: null, onboarded: false, safeWordSet: false };

describe("firstUnfinished", () => {
  it("starts a fresh user at the preset", () => {
    expect(firstUnfinished(fresh, [])).toBe("preset");
  });
  it("resumes at the first step not yet visited", () => {
    expect(firstUnfinished(fresh, ["preset"])).toBe("circle");
    expect(firstUnfinished(fresh, ["preset", "circle"])).toBe("safe_word");
  });
  it("counts the safe word as finished when it is already set", () => {
    expect(firstUnfinished({ ...fresh, safeWordSet: true }, ["preset", "circle"])).toBe("alerts");
  });
  it("starts from the beginning when the user is already onboarded", () => {
    expect(firstUnfinished({ preset: "family", onboarded: true, safeWordSet: true }, ["preset", "circle", "safe_word", "alerts"])).toBe("preset");
  });
  it("ends on alerts when every step is finished", () => {
    expect(firstUnfinished(fresh, ["preset", "circle", "safe_word", "alerts"])).toBe("alerts");
  });
});

describe("stepNumber", () => {
  it("is 1-based", () => {
    expect(stepNumber("preset")).toBe(1);
    expect(stepNumber("safe_word")).toBe(3);
    expect(stepNumber("alerts")).toBe(4);
  });
});
