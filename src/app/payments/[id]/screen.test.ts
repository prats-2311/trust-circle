import { describe, expect, it } from "vitest";
import { circleNamesText, screenCopy, screenFor, toldLine, type ScreenKind } from "./screen";

const held = { state: "held", outcome: null };
describe("screenFor", () => {
  it.each([
    [{ state: "created", outcome: null }, null, "not_approved"],
    [{ state: "captured", outcome: null }, null, "pending"],
    [{ state: "approved", outcome: null }, null, "pending"],
    [{ state: "paid_out", outcome: null }, null, "sent"],
    [{ state: "refunded", outcome: null }, null, "refunded"],
    [{ state: "payout_failed", outcome: null }, null, "returning"],
    [held, { stage: "waiting_for_person", contactName: "Daniel", askedAt: "x", challengeOpensAt: "y" }, "waiting"],
    [held, { stage: "challenge", method: "memory_question", requesterName: "grandson", guidance: [] }, "challenge_memory"],
    [held, { stage: "challenge", method: "safe_word", requesterName: "grandson", guidance: [] }, "challenge_safe_word"],
    [held, { stage: "official_routes", organisation: "PayPal", steps: [] }, "official_routes"],
    [held, { stage: "resolved", outcome: "failed" }, "stopped_by_check"],
    [held, { stage: "resolved", outcome: "denied", contactName: "Daniel" }, "stopped_by_person"],
    [held, { stage: "challenge_passed" }, "held"],
    [held, { stage: "none" }, "held"],
    [held, null, "held"],
    [{ state: "voided", outcome: null }, { stage: "resolved", outcome: "denied", contactName: "Daniel" }, "stopped_by_person"],
    [{ state: "blocked", outcome: "circle" }, { stage: "resolved", outcome: "failed" }, "stopped_by_check"],
    [{ state: "voided", outcome: "circle" }, { stage: "none" }, "stopped_by_circle"],
    [{ state: "voided", outcome: "sender" }, { stage: "none" }, "cancelled"],
    [{ state: "voided", outcome: "expired" }, { stage: "none" }, "hold_ended"],
    [{ state: "expired", outcome: null }, null, "hold_ended"],
  ] as const)("%j + %j → %s", (p, stage, kind) => expect(screenFor(p, stage as never)).toBe(kind));
});

describe("screenCopy", () => {
  const d = { amount: "$800", payee: "dhill@x.example", contactName: "Daniel", circleNames: ["Daniel"], coolingOffHours: 24 };
  const ALL: ScreenKind[] = [
    "not_approved", "pending", "waiting", "challenge_memory", "challenge_safe_word", "official_routes", "held", "sent", "refunded", "returning",
    "stopped_by_person", "stopped_by_check", "stopped_by_circle", "cancelled", "hold_ended",
  ];
  it("a held payment with no circle does not claim anyone can approve or stop it", () => {
    expect(screenCopy("held", { ...d, circleNames: [] }).lead).toBe("You can cancel any time, or release it yourself after 24 hours.");
    expect(screenCopy("held", d).lead).toContain("Daniel can approve or stop this payment.");
  });
  it("only says 'Nothing has been sent' when no money can have moved", () => {
    for (const k of ALL) {
      const text = `${screenCopy(k, d).title} ${screenCopy(k, d).lead}`;
      if (k === "not_approved") expect(text).toContain("Nothing has been sent");
      else expect(text).not.toContain("Nothing has been sent");
    }
  });
  it("says a failed payout is on its way back, not already refunded", () => {
    expect(screenCopy("returning", d)).toEqual({
      chipTone: "caution",
      chip: "Being returned",
      title: "We're returning this payment to you",
      lead: "It couldn't be delivered, so the money is on its way back to your account.",
    });
  });
  it("tells the sender not to resend while a payment is going through PayPal", () => {
    expect(screenCopy("pending", d).lead).toBe("It's going through PayPal. Please don't send it again.");
  });
  it("names the real person when stopped by them", () => {
    expect(screenCopy("stopped_by_person", d)).toMatchObject({
      title: "Payment stopped. Your money is safe.",
      lead: "Daniel told us they didn't ask for this money. The $800 was never sent.",
    });
  });
  it("cleans the claimed name the same way as the message check", () => {
    expect(screenCopy("challenge_memory", { ...d, requesterName: "my grandson Daniel" }).title).toBe("Ask the caller something only Daniel would know");
  });
  it("names who the caller claims to be, not the circle member, on the memory question", () => {
    expect(screenCopy("challenge_memory", { ...d, contactName: "Sarah", requesterName: "Daniel" }).title).toBe("Ask the caller something only Daniel would know");
    expect(screenCopy("challenge_memory", { ...d, contactName: "Sarah" }).title).toBe("Ask the caller something only they would know");
  });
  it("falls back when no contact is known", () => {
    expect(screenCopy("waiting", { ...d, contactName: null }).title).toBe("We've asked the real person if it was really them");
    expect(screenCopy("sent", d).title).toBe("$800 sent to dhill@x.example");
  });
});

describe("circleNamesText", () => {
  it.each([
    [[], "Your circle"],
    [["Sarah"], "Sarah"],
    [["Sarah", "Daniel"], "Sarah and Daniel"],
    [["A", "B", "C"], "A, B and C"],
  ])("%j → %s", (names, text) => expect(circleNamesText(names)).toBe(text));
});

describe("held copy", () => {
  const d = { amount: "$800", payee: "dhill@x.example", contactName: "Daniel", circleNames: ["Daniel"], coolingOffHours: 24 };
  it("names every circle member and the real hours", () => {
    expect(screenCopy("held", { ...d, circleNames: ["Sarah", "Daniel"], coolingOffHours: 24 }).lead).toBe(
      "Sarah and Daniel can approve or stop this payment. If nobody decides, you can release it yourself after 24 hours.",
    );
    expect(screenCopy("held", { ...d, circleNames: ["Sarah"], coolingOffHours: 48 }).lead).toContain("after 48 hours");
  });
});

describe("toldLine", () => {
  it.each([
    [[], null],
    [["Sarah"], "Sarah has been told."],
    [["Sarah", "Daniel"], "Sarah and Daniel have been told."],
  ] as const)("%j → %s", (names, line) => expect(toldLine([...names])).toBe(line));
});
