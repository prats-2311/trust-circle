import { describe, expect, it } from "vitest";
import { canDraftDispute, draftDispute, SCAM_PAYEE_TITLE } from "./disputeDraft";

describe("dispute draft", () => {
  it("states the payee, amount, date and reason", () => {
    const t = draftDispute({ senderName: "Margaret", payee: "scam@x.com", amountCents: 80050, date: new Date("2026-10-11T09:00:00Z") });
    expect(t).toContain("Paid to: scam@x.com");
    expect(t).toContain("Amount: $800.50");
    expect(t).toContain("Date: 2026-10-11");
    expect(t).toContain("reported as a scam to Trust Circle");
  });

  it("offers the draft only for the code's own scam-payee finding", () => {
    const f = { paymentId: "p", severity: "act" as const, title: SCAM_PAYEE_TITLE, detail: "d" };
    expect(canDraftDispute({ ...f, source: "code" })).toBe(true);
    expect(canDraftDispute({ ...f, source: "model" })).toBe(false);
    expect(canDraftDispute({ ...f, source: "code", severity: "check" })).toBe(false);
  });
});
