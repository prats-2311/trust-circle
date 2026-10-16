import { describe, expect, it } from "vitest";
import { paymentOutcome } from "./paymentOutcome";

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
