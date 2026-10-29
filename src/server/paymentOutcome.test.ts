import { describe, expect, it } from "vitest";
import { paymentOutcome, paypalVoided } from "./paymentOutcome";

const S = "sender";
describe("paymentOutcome", () => {
  it.each([
    [[{ action: "BLOCK", actorId: "sarah" }], "circle"],
    [[{ action: "BLOCK", actorId: S }], "sender"],
    [[{ action: "EXPIRE", actorId: null }], "expired"],
    [[{ action: "PAY_OUT", actorId: S }], null],
    [[], null],
  ] as const)("%j → %s", (audits, outcome) => expect(paymentOutcome([...audits], S)).toBe(outcome));

  it("uses the last stopping event", () => {
    expect(paymentOutcome([{ action: "BLOCK", actorId: "sarah" }, { action: "EXPIRE", actorId: null }], S)).toBe("expired");
  });
});

describe("paypalVoided", () => {
  it("is true only when PayPal itself answered VOIDED", () => {
    expect(paypalVoided([{ action: "VOID", detail: { paypalStatus: "VOIDED" } }])).toBe(true);
    expect(paypalVoided([{ action: "VOID", detail: { paypalStatus: null } }])).toBe(false);
    expect(paypalVoided([{ action: "VOID", detail: {} }])).toBe(false);
    expect(paypalVoided([{ action: "BLOCK", detail: { paypalStatus: "VOIDED" } }])).toBe(false);
    expect(paypalVoided([])).toBe(false);
  });
});
