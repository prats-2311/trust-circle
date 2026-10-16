import { describe, expect, it } from "vitest";
import { decisionResultCopy, verificationNotice } from "./reviewCopy";

describe("decisionResultCopy", () => {
  it.each([
    ["block", 200, "safe", "You stopped the payment"],
    ["approve", 200, "safe", "Payment approved"],
    ["block", 202, "pending", "We're finishing this for you"],
    ["approve", 409, "info", "This payment has already been dealt with"],
  ] as const)("%s %d → %s", (decision, status, tone, title) => {
    expect(decisionResultCopy(decision, status, "Margaret")).toMatchObject({ tone, title });
  });

  it("does not claim anyone was told when a contact blocks", () => {
    const { lead } = decisionResultCopy("block", 200, "Margaret");
    expect(lead).toBe("Margaret's money is safe, and this account is on the shared scam list now.");
    expect(lead).not.toMatch(/told/i);
  });

  it("names the person the sender wanted to pay when approved", () => {
    expect(decisionResultCopy("approve", 200, "Margaret").lead).toBe("It's on its way to the person Margaret wanted to pay.");
  });

  it("tells the contact not to decide again while pending", () => {
    expect(decisionResultCopy("block", 202, "Margaret").lead).toContain("Please don't decide again.");
  });
});

describe("verificationNotice", () => {
  it("names who was asked, not the sender", () => {
    const text = verificationNotice({ stage: "waiting_for_person", contactName: "Daniel", askedAt: "2026-10-16T14:15:00Z", challengeOpensAt: "2026-10-16T15:15:00Z" }, "Margaret");
    expect(text).toMatch(/^We asked Daniel at .*No reply yet\.$/);
    expect(text).not.toContain("Margaret");
  });
  it("names the sender when the caller answered", () => {
    expect(verificationNotice({ stage: "challenge_passed" }, "Margaret")).toBe(
      "Margaret checked with the caller, and they answered. It's still your decision.",
    );
  });
  it("says the payment is being stopped when the caller failed", () => {
    expect(verificationNotice({ stage: "resolved", outcome: "failed" }, "Margaret")).toBe("The caller couldn't pass the check, so the payment is being stopped.");
  });
  it("is silent otherwise", () => {
    expect(verificationNotice(null, "Margaret")).toBeNull();
    expect(verificationNotice({ stage: "none" }, "Margaret")).toBeNull();
    expect(verificationNotice({ stage: "resolved", outcome: "denied", contactName: "Daniel" }, "Margaret")).toBeNull();
  });
});
