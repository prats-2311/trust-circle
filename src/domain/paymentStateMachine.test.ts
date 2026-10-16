import { describe, expect, it } from "vitest";
import { InvalidTransitionError, isTerminal, nextState } from "./paymentStateMachine";
import { maxLevel } from "./types";

describe("payment state machine", () => {
  it("follows the low-risk path to paid out", () => {
    let s = nextState("created", "APPROVE");
    s = nextState(s, "AUTHORISE");
    s = nextState(s, "RELEASE");
    s = nextState(s, "CAPTURE");
    s = nextState(s, "PAY_OUT");
    expect(s).toBe("paid_out");
  });

  it("moves a paid out payment to payout_failed when the payout comes back", () => {
    expect(nextState("paid_out", "PAYOUT_FAIL")).toBe("payout_failed");
    expect(isTerminal("paid_out")).toBe(false);
    expect(isTerminal("refunded")).toBe(true);
  });

  it("holds, then voids on block", () => {
    const held = nextState("authorised", "HOLD");
    expect(held).toBe("held");
    expect(nextState(nextState(held, "BLOCK"), "VOID")).toBe("voided");
  });

  it("voids an expired hold", () => {
    expect(nextState(nextState("held", "EXPIRE"), "VOID")).toBe("voided");
  });

  it("refunds after a failed payout", () => {
    expect(nextState(nextState("captured", "PAYOUT_FAIL"), "REFUND")).toBe("refunded");
  });

  it.each([
    ["created", "CAPTURE"],
    ["held", "CAPTURE"],
    ["blocked", "RELEASE"],
    ["voided", "RELEASE"],
    ["paid_out", "REFUND"],
    ["released", "BLOCK"],
  ] as const)("rejects %s + %s", (state, event) => {
    expect(() => nextState(state, event)).toThrow(InvalidTransitionError);
  });
});

describe("maxLevel", () => {
  it("returns the more severe level", () => {
    expect(maxLevel("low", "high")).toBe("high");
    expect(maxLevel("medium", "low")).toBe("medium");
    expect(maxLevel("high", "medium")).toBe("high");
  });
});
