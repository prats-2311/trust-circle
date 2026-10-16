import { describe, expect, it } from "vitest";
import { approvalErrorCopy, riskScreen } from "./riskScreen";

describe("riskScreen", () => {
  it("explains a hold in terms of the circle", () => {
    expect(riskScreen("high", { circleName: "Sarah" })).toMatchObject({
      chipTone: "held", title: "Let's pause before this goes", continueLabel: "Continue, and let Sarah review it",
      holdNote: "If you continue, PayPal holds the money. It isn't sent until Sarah approves it.",
    });
    expect(riskScreen("high", { circleName: null }).continueLabel).toBe("Continue, and hold it for 24 hours");
    expect(riskScreen("high", { circleName: null }).holdNote).toBe(
      "If you continue, PayPal holds the money. It isn't sent until the waiting time is over and you release it.",
    );
  });
  it("asks for a pause on medium and stays plain on low", () => {
    expect(riskScreen("medium", { circleName: "Sarah" })).toMatchObject({ chipTone: "caution", continueLabel: "I understand, continue to PayPal", holdNote: null });
    expect(riskScreen("low", { circleName: "Sarah" })).toMatchObject({ chipTone: "safe", title: "This payment looks fine", holdNote: null });
  });
});

describe("approvalErrorCopy", () => {
  it("does not offer a retry when the payment was already decided", () => {
    expect(approvalErrorCopy(409, "This payment has already been dealt with.")).toEqual({ message: "This payment has already been dealt with.", canRetry: false });
  });
  it("offers a retry otherwise, keeping the server's calm message", () => {
    expect(approvalErrorCopy(503, "PayPal didn't answer in time. Nothing has been sent. Please try again in a moment.")).toEqual({
      message: "PayPal didn't answer in time. Nothing has been sent. Please try again in a moment.", canRetry: true,
    });
  });
});
