import { describe, expect, it } from "vitest";
import { draftReport, mailtoFor, PAYPAL_PHISHING_ADDRESS } from "./reportDraft";

const check = {
  scamType: "impersonation_family" as const,
  reasons: ["Asks for gift cards.", "Asks you to keep it secret."],
  identifiers: [
    { type: "phone" as const, value: "+14155550199" },
    { type: "url" as const, value: "bit.ly/abc123" },
  ],
  text: "Hi Grandma it's me, I need $800 in gift cards today. Don't tell mom.",
};

describe("draftReport", () => {
  it("writes a plain report with the scam type, reasons, contact details and the message", () => {
    const d = draftReport(check);
    expect(d.subject).toBe("Scam report: Family member in trouble");
    expect(d.body).toContain("Why it looks like a scam:\n- Asks for gift cards.\n- Asks you to keep it secret.");
    expect(d.body).toContain("- Phone number: +14155550199");
    expect(d.body).toContain("- Link: bit.ly/abc123");
    expect(d.body).toContain(`"${check.text}"`);
  });
  it("builds a mailto link to PayPal's phishing address within 1,800 characters", () => {
    const url = mailtoFor(draftReport({ ...check, text: "x".repeat(5000) }));
    expect(url.startsWith(`mailto:${PAYPAL_PHISHING_ADDRESS}?subject=`)).toBe(true);
    expect(url.length).toBeLessThanOrEqual(1800);
    expect(decodeURIComponent(url)).toContain("Scam report: Family member in trouble");
  });
});
