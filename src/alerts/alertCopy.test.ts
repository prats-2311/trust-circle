import { describe, expect, it } from "vitest";
import { alertCopy, formatUsd } from "./alertCopy";

const payload = { senderName: "Margaret", amountCents: 80000, payee: "dhill.urgent@outlook.example" };
const ids = { paymentId: "p1", verificationId: "v1" };

describe("formatUsd", () => {
  it("drops cents for whole dollars and keeps them otherwise", () => {
    expect(formatUsd(80000)).toBe("$800");
    expect(formatUsd(123456)).toBe("$1,234.56");
    expect(formatUsd(5)).toBe("$0.05");
  });
});

describe("alertCopy", () => {
  it("tells the circle a payment is on hold", () => {
    expect(alertCopy({ kind: "payment_held", payload, ...ids })).toEqual({
      title: "Margaret's payment of $800 is on hold",
      body: "Margaret tried to send $800 to dhill.urgent@outlook.example. We've paused it so you can take a look. The money stays in their account while you take a look.",
      path: "/circle/payments/p1",
    });
  });
  it("asks the real person whether they asked for the money", () => {
    expect(alertCopy({ kind: "verify_request", payload, ...ids })).toEqual({
      title: "Did you just ask Margaret for $800?",
      body: "Someone asked Margaret to send $800 and said they were you. Please tell us if it was really you. The money is on hold until you answer.",
      path: "/verify/v1",
    });
  });
  it("tells the sender calmly that a payment was stopped", () => {
    expect(alertCopy({ kind: "payment_stopped", payload: { ...payload, requesterName: "Daniel" }, ...ids })).toEqual({
      title: "Your payment has been stopped",
      body: "Daniel told us they didn't ask for this money, so we stopped your payment of $800 to dhill.urgent@outlook.example. The money was never sent.",
      path: "/payments/p1",
    });
  });
  it("covers the medium notice and the confirmation", () => {
    expect(alertCopy({ kind: "medium_payment_sent", payload, ...ids }).title).toBe("Margaret sent $800 to someone new");
    expect(alertCopy({ kind: "payment_confirmed", payload: { ...payload, requesterName: "Daniel" }, ...ids }).title).toBe(
      "Daniel confirmed the payment",
    );
  });
  it("never blames the sender", () => {
    for (const kind of ["payment_held", "medium_payment_sent", "verify_request", "payment_stopped", "payment_confirmed"] as const) {
      const { title, body } = alertCopy({ kind, payload, ...ids });
      expect(`${title} ${body}`).not.toMatch(/\b(fell for|mistake|careless|should have|fault)\b/i);
    }
  });
});
