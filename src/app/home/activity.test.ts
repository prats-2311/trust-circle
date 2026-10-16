import { describe, expect, it } from "vitest";
import { checkChip, paymentChip, recentActivity } from "./activity";

describe("chips", () => {
  it.each([
    ["paid_out", "safe", "Sent"],
    ["held", "held", "On hold"],
    ["voided", "neutral", "Not sent"],
    ["blocked", "neutral", "Not sent"],
    ["expired", "neutral", "Not sent"],
    ["refunded", "caution", "Refunded"],
    ["captured", "neutral", "In progress"],
  ])("payment %s → %s %s", (state, tone, label) => expect(paymentChip(state)).toEqual({ tone, label }));

  it("never shows an unchecked message as safe", () => {
    expect(checkChip({ checked: false, level: "low" })).toEqual({ tone: "neutral", label: "Not checked" });
    expect(checkChip({ checked: true, level: null })).toEqual({ tone: "neutral", label: "Not checked" });
    expect(checkChip({ checked: true, level: "high" })).toEqual({ tone: "blocked", label: "Likely a scam" });
    expect(checkChip({ checked: true, level: "low" })).toEqual({ tone: "safe", label: "No warning signs" });
  });
});

describe("recentActivity", () => {
  it("merges payments and checks newest first, up to the limit", () => {
    const items = recentActivity(
      [{ id: "p1", payee: "vet.clinic@example.com", amountCents: 32000, state: "paid_out", createdAt: "2026-10-14T10:00:00Z" }],
      [
        { id: "c1", source: "text", checked: true, level: "high", createdAt: "2026-10-16T10:00:00Z" },
        { id: "c2", source: "image", checked: true, level: "low", createdAt: "2026-10-10T10:00:00Z" },
      ],
      2,
    );
    expect(items.map((i) => [i.title, i.href])).toEqual([
      ["Message checked", "/check?id=c1"],
      ["$320 to vet.clinic@example.com", "/payments/p1"],
    ]);
  });
});
