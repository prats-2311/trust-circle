import { describe, expect, it } from "vitest";
import type { PaymentRecord } from "@/payments/paymentRepo";
import { toContactView, toSenderView } from "./paymentView";

const rec: PaymentRecord = {
  id: "p1", senderId: "s1", payee: "a@b.com", amountCents: 100, note: "hi", senderAnswer: "my answer",
  state: "held", riskLevel: "high", scamType: "impersonation_family", reasons: ["r"],
  paypalOrderId: "ORD", authorizationId: "AUTH", captureId: "CAP", payoutBatchId: "BATCH", refundId: "REF",
  authorisedAt: new Date(1), coolingOffUntil: new Date(2), version: 3, createdAt: new Date(4), updatedAt: new Date(5),
};
const hidden = ["paypalOrderId", "authorizationId", "captureId", "payoutBatchId", "refundId", "version", "senderId"];

describe("payment views", () => {
  it("sender view omits PayPal ids, version, senderId and the sender answer", () => {
    const v = toSenderView(rec);
    for (const k of hidden) expect(v).not.toHaveProperty(k);
    expect(v).not.toHaveProperty("senderAnswer");
    expect(JSON.stringify(v)).not.toMatch(/ORD|AUTH|CAP|BATCH|REF/);
    expect(v).toMatchObject({ id: "p1", payee: "a@b.com", amountCents: 100, state: "held", reasons: ["r"] });
  });
  it("contact view adds the sender answer but still no ids", () => {
    const v = toContactView(rec);
    for (const k of hidden) expect(v).not.toHaveProperty(k);
    expect(v.senderAnswer).toBe("my answer");
  });
});
