import { describe, expect, it } from "vitest";
import { draftDispute } from "./disputeDraft";

describe("dispute draft", () => {
  it("states the payee, amount, date and reason", () => {
    const t = draftDispute({ senderName: "Margaret", payee: "scam@x.com", amountCents: 80050, date: new Date("2026-10-11T09:00:00Z") });
    expect(t).toContain("Paid to: scam@x.com");
    expect(t).toContain("Amount: $800.50");
    expect(t).toContain("Date: 2026-10-11");
    expect(t).toContain("reported as a scam to Trust Circle");
  });
});
