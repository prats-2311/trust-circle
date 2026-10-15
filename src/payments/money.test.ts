import { describe, expect, it } from "vitest";
import { centsToPayPalValue, requestId } from "./money";

describe("money", () => {
  it("formats cents as a PayPal decimal string", () => {
    expect(centsToPayPalValue(1)).toBe("0.01");
    expect(centsToPayPalValue(80000)).toBe("800.00");
    expect(centsToPayPalValue(123456)).toBe("1234.56");
  });
  it("rejects non-integer or non-positive amounts", () => {
    expect(() => centsToPayPalValue(0)).toThrow();
    expect(() => centsToPayPalValue(-5)).toThrow();
    expect(() => centsToPayPalValue(10.5)).toThrow();
  });
  it("builds deterministic idempotency keys", () => {
    expect(requestId("p1", "capture")).toBe("tc-p1-capture");
    expect(requestId("p1", "capture")).toBe(requestId("p1", "capture"));
  });
});
