import { describe, expect, it } from "vitest";
import { closedCopy, decisionResultCopy, verificationNotice } from "./reviewCopy";

const WAITING = { stage: "waiting_for_person", contactName: "Daniel", askedAt: "2026-10-16T14:15:00Z", challengeOpensAt: "2026-10-16T15:15:00Z" } as const;

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
    const text = verificationNotice({ stage: "waiting_for_person", contactName: "Daniel", askedAt: "2026-10-16T14:15:00Z", challengeOpensAt: "2026-10-16T15:15:00Z" }, "Margaret", "Sarah");
    expect(text).toMatch(/^We asked Daniel at .*No reply yet\.$/);
    expect(text).not.toContain("Margaret");
  });
  it("speaks to the viewer when they are the person who was asked", () => {
    const text = verificationNotice(WAITING, "Margaret", "Daniel");
    expect(text).toMatch(/^We asked you at .*\. Answer from your circle page\.$/);
    expect(text).not.toContain("Daniel");
    expect(text).not.toContain("No reply yet");
  });
  it("names the sender when the caller answered", () => {
    expect(verificationNotice({ stage: "challenge_passed" }, "Margaret", "Sarah")).toBe(
      "Margaret checked with the caller, and they answered. It's still your decision.",
    );
  });
  it("says the payment is being stopped when the caller failed", () => {
    expect(verificationNotice({ stage: "resolved", outcome: "failed" }, "Margaret", "Sarah")).toBe("The caller couldn't pass the check, so the payment is being stopped.");
  });
  it("is silent otherwise", () => {
    expect(verificationNotice(null, "Margaret", "Sarah")).toBeNull();
    expect(verificationNotice({ stage: "none" }, "Margaret", "Sarah")).toBeNull();
    expect(verificationNotice({ stage: "resolved", outcome: "denied", contactName: "Daniel" }, "Margaret", "Sarah")).toBeNull();
  });
});

describe("closedCopy", () => {
  const title = "This payment is no longer waiting for a decision";
  it("says the caller failed the check", () => {
    expect(closedCopy("blocked", { stage: "resolved", outcome: "failed" }, "Margaret")).toEqual({
      title, lead: "The caller couldn't pass the check, so the payment was stopped.",
    });
  });
  it("names the real person who denied it, or falls back", () => {
    expect(closedCopy("blocked", { stage: "resolved", outcome: "denied", contactName: "Daniel" }, "Margaret").lead).toBe(
      "Daniel said they didn't ask for this money, so the payment was stopped.",
    );
    expect(closedCopy("blocked", { stage: "resolved", outcome: "denied", contactName: null }, "Margaret").lead).toBe(
      "The real person said they didn't ask for this money, so the payment was stopped.",
    );
  });
  it.each(["paid_out"])("says %s has gone through", (state) => {
    expect(closedCopy(state, null, "Margaret").lead).toBe("This payment has already gone through.");
  });
  it("says it has gone through when the real person confirmed", () => {
    expect(closedCopy("blocked", { stage: "resolved", outcome: "confirmed", contactName: "Daniel" }, "Margaret").lead).toBe("This payment has already gone through.");
  });
  it.each(["blocked", "voided", "expired"])("says %s was stopped, with the money kept", (state) => {
    expect(closedCopy(state, { stage: "none" }, "Margaret").lead).toBe("It was stopped, and the money stayed in Margaret's account.");
  });
  it("says a refunded payment was returned to the sender", () => {
    expect(closedCopy("refunded", null, "Margaret").lead).toBe("It couldn't be delivered, so PayPal returned the money to Margaret.");
  });
  it("says a failed payout is on its way back, not yet refunded", () => {
    expect(closedCopy("payout_failed", { stage: "none" }, "Margaret").lead).toBe("It couldn't be delivered, so the money is on its way back to Margaret.");
  });
  it("says an unapproved payment was never sent", () => {
    expect(closedCopy("created", null, "Margaret").lead).toBe("Margaret didn't approve it in PayPal, so nothing was sent.");
  });
  it.each(["approved", "authorised", "released", "captured"])("says %s is going through PayPal", (state) => {
    expect(closedCopy(state, null, "Margaret").lead).toBe("It's going through PayPal now.");
  });
  it("lets a resolved stage win over the state", () => {
    expect(closedCopy("refunded", { stage: "resolved", outcome: "failed" }, "Margaret").lead).toBe("The caller couldn't pass the check, so the payment was stopped.");
    expect(closedCopy("payout_failed", { stage: "resolved", outcome: "confirmed", contactName: "Daniel" }, "Margaret").lead).toBe("This payment has already gone through.");
  });
  it("never uses the someone-else-answered line", () => {
    expect(closedCopy("voided", null, "Margaret").lead).not.toMatch(/Someone else/);
  });
});
