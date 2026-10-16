import { describe, expect, it } from "vitest";
import { computeSignals, HIDDEN_INSTRUCTIONS_SIGNAL, normalisePayee, ruleLevel, type SenderContext } from "./signals";

const ctx = (over: Partial<SenderContext> = {}): SenderContext => ({
  previousPayees: ["sarah@example.com"],
  recentAmountsCents: [2000, 3000, 2500, 4000],
  paymentsInLastHour: 0,
  flaggedPayees: [],
  registry: { confirmed: [], unconfirmed: [] },
  ...over,
});
const codes = (s: { code: string }[]) => s.map((x) => x.code).sort();

describe("normalisePayee", () => {
  it("lower-cases and trims emails, strips phone punctuation", () => {
    expect(normalisePayee("  Sarah@Example.COM ")).toBe("sarah@example.com");
    expect(normalisePayee("+1 (555) 010-2030")).toBe("+15550102030");
  });
});

describe("computeSignals", () => {
  it("is quiet for a familiar payee and normal amount", () => {
    expect(computeSignals({ payee: "sarah@example.com", amountCents: 3000 }, ctx())).toEqual([]);
  });

  it("flags a first-time payee and an unusual amount", () => {
    const s = computeSignals({ payee: "new@example.com", amountCents: 80000 }, ctx());
    expect(codes(s)).toEqual(["FIRST_TIME_PAYEE", "UNUSUAL_AMOUNT"]);
  });

  it("uses a $500 threshold when there is little history", () => {
    const thin = ctx({ recentAmountsCents: [1000] });
    expect(codes(computeSignals({ payee: "sarah@example.com", amountCents: 49999 }, thin))).toEqual([]);
    expect(codes(computeSignals({ payee: "sarah@example.com", amountCents: 50000 }, thin))).toEqual(["UNUSUAL_AMOUNT"]);
  });

  it("matches registry entries after normalising", () => {
    const s = computeSignals(
      { payee: " Scam@Evil.example ", amountCents: 1000 },
      ctx({ previousPayees: ["scam@evil.example"], registry: { confirmed: ["scam@evil.example"], unconfirmed: [] } }),
    );
    expect(codes(s)).toEqual(["REGISTRY_CONFIRMED"]);
  });

  it("flags payees linked to a scam message the sender checked", () => {
    const s = computeSignals(
      { payee: "sarah@example.com", amountCents: 1000 },
      ctx({ flaggedPayees: ["sarah@example.com"] }),
    );
    expect(codes(s)).toEqual(["LINKED_SCAM_MESSAGE"]);
  });

  it("flags the circle limit and rapid repeats", () => {
    const s = computeSignals(
      { payee: "sarah@example.com", amountCents: 6000 },
      ctx({ circleLimitCents: 5000, paymentsInLastHour: 3 }),
    );
    expect(codes(s)).toEqual(["OVER_CIRCLE_LIMIT", "RAPID_REPEAT"]);
  });
});

describe("ruleLevel", () => {
  const sig = (code: Parameters<typeof ruleLevel>[0][number]["code"]) => ({ code, detail: "" });
  it("is low with no signals or one contributing signal", () => {
    expect(ruleLevel([])).toBe("low");
    expect(ruleLevel([sig("FIRST_TIME_PAYEE")])).toBe("low");
  });
  it("is medium with two contributing signals", () => {
    expect(ruleLevel([sig("FIRST_TIME_PAYEE"), sig("UNUSUAL_AMOUNT")])).toBe("medium");
  });
  it("is high with three contributing signals", () => {
    expect(ruleLevel([sig("FIRST_TIME_PAYEE"), sig("UNUSUAL_AMOUNT"), sig("RAPID_REPEAT")])).toBe("high");
  });
  it("is at least medium for an unconfirmed registry entry or circle limit", () => {
    expect(ruleLevel([sig("REGISTRY_UNCONFIRMED")])).toBe("medium");
    expect(ruleLevel([sig("OVER_CIRCLE_LIMIT")])).toBe("medium");
  });
  it("is high for a confirmed registry entry or linked scam message", () => {
    expect(ruleLevel([sig("REGISTRY_CONFIRMED")])).toBe("high");
    expect(ruleLevel([sig("LINKED_SCAM_MESSAGE")])).toBe("high");
  });
  it("treats hidden instructions as high on their own", () => {
    expect(ruleLevel([HIDDEN_INSTRUCTIONS_SIGNAL])).toBe("high");
  });
});
