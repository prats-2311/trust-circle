import { describe, expect, it } from "vitest";
import { approvalErrorCopy, cancelErrorCopy, riskScreen } from "./riskScreen";

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
  const SAFE = "We couldn't confirm this payment just now. You approved it in PayPal, so it may already be in progress. Check your payments before you try again.";
  it.each([0, 500, 502, 503])("never passes server text through for status %d", (status) => {
    const r = approvalErrorCopy(status, "Something went wrong. Nothing has been sent.");
    expect(r).toEqual({ message: SAFE, canRetry: true });
    expect(r.message).not.toContain("Nothing has been sent");
  });
  it("keeps the server's message for other 4xx errors and allows a retry", () => {
    expect(approvalErrorCopy(400, "Please try again.")).toEqual({ message: "Please try again.", canRetry: true });
  });
});

describe("cancelErrorCopy", () => {
  it.each([0, 500, 503])("tells the sender to refresh, never to retry the approval, for status %d", (status) => {
    const text = cancelErrorCopy(status, "Something went wrong. Nothing has been sent.");
    expect(text).toBe("We couldn't confirm the cancel just now. Please refresh to see where this payment is.");
  });
  it("keeps the server's message for other 4xx errors", () => {
    expect(cancelErrorCopy(400, "That can't be cancelled.")).toBe("That can't be cancelled.");
  });
});
