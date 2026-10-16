import { describe, expect, it } from "vitest";
import { parseAmountCents } from "./amount";

describe("parseAmountCents", () => {
  it.each([
    ["800", 80000],
    ["$1,200.50", 120050],
    [" 20 ", 2000],
    ["0.01", 1],
    ["10000", 1_000_000],
  ])("%s → %d", (input, cents) => expect(parseAmountCents(input)).toBe(cents));
  it.each(["", "abc", "0", "-5", "12.345", "10000.01", "1e3"])("rejects %s", (input) => expect(parseAmountCents(input)).toBeNull());
});
