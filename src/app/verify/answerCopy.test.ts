import { describe, expect, it } from "vitest";
import { answerCopy } from "./answerCopy";

const base = { viewerName: "Daniel", senderName: "Margaret", payee: "dhill@x.example", amount: "$800" };
describe("answerCopy", () => {
  it("thanks the real person by name when they stop it", () => {
    expect(answerCopy({ ...base, answer: "not_me", status: 200 })).toEqual({
      title: "Thank you, Daniel. We stopped it.",
      lead: "Margaret's money is safe, and other families are now warned about this account.",
    });
  });
  it("confirms a genuine request", () => {
    expect(answerCopy({ ...base, answer: "me", status: 202 }).title).toBe("Thanks. The payment is going ahead.");
  });
  it("says what is being sent for a genuine request", () => {
    expect(answerCopy({ ...base, answer: "me", status: 200 }).lead).toBe("We're sending $800 to dhill@x.example.");
  });
  it("handles a second answer calmly", () => {
    expect(answerCopy({ ...base, answer: "not_me", status: 409 })).toEqual({
      title: "This has already been answered",
      lead: "Nothing more is needed from you.",
    });
  });
});
