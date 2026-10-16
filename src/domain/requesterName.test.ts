import { describe, expect, it } from "vitest";
import { cleanRequesterName } from "./requesterName";

describe("cleanRequesterName", () => {
  it.each([
    ["my grandson Daniel", "Daniel"],
    ["My Grandson Daniel", "Daniel"],
    ["your daughter Sarah", "Sarah"],
    ["grandson Daniel", "Daniel"],
    ["my grandson", "grandson"],
    ["your bank", "bank"],
    ["Daniel", "Daniel"],
    ["  my  nephew  Tom ", "Tom"],
    ["my son-in-law", "son-in-law"],
    ["grandson daniel", "grandson daniel"],
  ])("%j → %j", (raw, clean) => expect(cleanRequesterName(raw)).toBe(clean));
});
