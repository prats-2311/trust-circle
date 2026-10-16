import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS, homeFor, isPersona } from "./demo";

describe("demo personas", () => {
  it("knows the four seeded accounts", () => {
    expect(Object.keys(DEMO_PERSONAS)).toEqual(["margaret", "sarah", "daniel", "robert"]);
    expect(DEMO_PERSONAS.margaret).toBe("margaret.demo@trustcircle.example");
  });
  it("accepts only persona names", () => {
    expect(isPersona("sarah")).toBe(true);
    expect(isPersona("00000000-0000-4000-8000-000000000001")).toBe(false);
    expect(isPersona(undefined)).toBe(false);
  });
  it("sends senders home and contacts to their circle", () => {
    expect(homeFor("margaret")).toBe("/home");
    expect(homeFor("robert")).toBe("/home");
    expect(homeFor("sarah")).toBe("/circle");
    expect(homeFor("daniel")).toBe("/circle");
  });
});
