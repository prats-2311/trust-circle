import { describe, expect, it } from "vitest";
import { screenCopy, screenFor, type ScreenKind } from "./screen";

const held = { state: "held", outcome: null };
describe("screenFor", () => {
  it.each([
    [{ state: "created", outcome: null }, null, "not_approved"],
    [{ state: "captured", outcome: null }, null, "pending"],
    [{ state: "approved", outcome: null }, null, "pending"],
    [{ state: "paid_out", outcome: null }, null, "sent"],
    [{ state: "refunded", outcome: null }, null, "refunded"],
    [{ state: "payout_failed", outcome: null }, null, "refunded"],
    [held, { stage: "waiting_for_person", contactName: "Daniel", askedAt: "x", challengeOpensAt: "y" }, "waiting"],
    [held, { stage: "challenge", method: "memory_question", requesterName: "grandson", guidance: [] }, "challenge_memory"],
    [held, { stage: "challenge", method: "safe_word", requesterName: "grandson", guidance: [] }, "challenge_safe_word"],
    [held, { stage: "official_routes", organisation: "PayPal", steps: [] }, "official_routes"],
    [held, { stage: "resolved", outcome: "failed" }, "stopped_by_check"],
    [held, { stage: "resolved", outcome: "denied" }, "stopped_by_person"],
    [held, { stage: "challenge_passed" }, "held"],
    [held, { stage: "none" }, "held"],
    [held, null, "held"],
    [{ state: "voided", outcome: null }, { stage: "resolved", outcome: "denied" }, "stopped_by_person"],
    [{ state: "blocked", outcome: "circle" }, { stage: "resolved", outcome: "failed" }, "stopped_by_check"],
    [{ state: "voided", outcome: "circle" }, { stage: "none" }, "stopped_by_circle"],
    [{ state: "voided", outcome: "sender" }, { stage: "none" }, "cancelled"],
    [{ state: "voided", outcome: "expired" }, { stage: "none" }, "hold_ended"],
    [{ state: "expired", outcome: null }, null, "hold_ended"],
  ] as const)("%j + %j → %s", (p, stage, kind) => expect(screenFor(p, stage as never)).toBe(kind));
});

describe("screenCopy", () => {
  const d = { amount: "$800", payee: "dhill@x.example", contactName: "Daniel" };
  const ALL: ScreenKind[] = [
    "not_approved", "pending", "waiting", "challenge_memory", "challenge_safe_word", "official_routes", "held", "sent", "refunded",
    "stopped_by_person", "stopped_by_check", "stopped_by_circle", "cancelled", "hold_ended",
  ];
  it("only says 'Nothing has been sent' when no money can have moved", () => {
    for (const k of ALL) {
      const text = `${screenCopy(k, d).title} ${screenCopy(k, d).lead}`;
      if (k === "not_approved") expect(text).toContain("Nothing has been sent");
      else expect(text).not.toContain("Nothing has been sent");
    }
  });
  it("names the real person when stopped by them", () => {
    expect(screenCopy("stopped_by_person", d)).toMatchObject({
      title: "Payment stopped. Your money is safe.",
      lead: "Daniel told us they didn't ask for this money. The $800 was never sent.",
    });
  });
  it("falls back when no contact is known", () => {
    expect(screenCopy("waiting", { ...d, contactName: null }).title).toBe("We've asked the real person if it was really them");
    expect(screenCopy("held", { ...d, contactName: null }).lead).toBe("Your circle is looking at this payment. Nothing is sent unless it's approved.");
    expect(screenCopy("sent", d).title).toBe("$800 sent to dhill@x.example");
  });
});
