import { describe, expect, it } from "vitest";
import { rulesOnlyComparison } from "./rulesOnly";
import type { EvalResult } from "./runEval";

const r = (
  id: string,
  kind: "payment" | "message",
  label: "scam" | "genuine",
  level: "low" | "medium" | "high",
  signals: string[],
): EvalResult => ({ id, kind, preset: "family", label, level, scamType: "other", checked: true, signals, attempts: 1, uncheckedCause: null });

describe("rulesOnlyComparison", () => {
  it("scores payments three ways: with the AI, rules alone, and the AI-unavailable fallback", () => {
    const c = rulesOnlyComparison([
      // A scam the rules see as one contributing signal only: low on rules, held by the fallback.
      r("s1", "payment", "scam", "high", ["FIRST_TIME_PAYEE"]),
      // Three contributing signals: the rules hold it too.
      r("s2", "payment", "scam", "high", ["FIRST_TIME_PAYEE", "UNUSUAL_AMOUNT", "RAPID_REPEAT"]),
      // No signal at all: only the AI catches it.
      r("s3", "payment", "scam", "high", []),
      // A genuine first payment: the AI clears it, the fallback holds it.
      r("g1", "payment", "genuine", "low", ["FIRST_TIME_PAYEE"]),
      // AI-derived signals are dropped for the no-AI scores.
      r("g2", "payment", "genuine", "medium", ["KNOWN_SCAM_PATTERN"]),
      r("g3", "payment", "genuine", "low", []),
      r("m1", "message", "scam", "high", []),
      // Flagged by the pattern matcher while the AI timed out: not the AI's catch.
      { ...r("m2", "message", "scam", "high", ["KNOWN_SCAM_PATTERN"]), checked: false },
    ]);
    expect(c.payments).toEqual({
      scams: 3,
      genuine: 3,
      withAi: { scamsHeld: 3, scamsFlagged: 3, genuineHeld: 0, genuineFlagged: 1 },
      rulesAlone: { scamsHeld: 1, scamsFlagged: 1, genuineHeld: 0, genuineFlagged: 0 },
      aiUnavailable: { scamsHeld: 2, scamsFlagged: 2, genuineHeld: 1, genuineFlagged: 1 },
      onlyAiHeld: ["s1", "s3"],
    });
    expect(c.messages).toEqual({ scams: 2, genuine: 0, aiChecked: 1, withAiFlagged: 1 });
  });

  it("keeps rule signals that are not AI-derived, such as a confirmed scam payee", () => {
    const c = rulesOnlyComparison([r("s", "payment", "scam", "high", ["REGISTRY_CONFIRMED", "HIDDEN_INSTRUCTIONS"])]);
    expect(c.payments.rulesAlone.scamsHeld).toBe(1);
    expect(c.payments.onlyAiHeld).toEqual([]);
  });

  it("handles an empty run", () => {
    const zero = { scamsHeld: 0, scamsFlagged: 0, genuineHeld: 0, genuineFlagged: 0 };
    expect(rulesOnlyComparison([])).toEqual({
      payments: { scams: 0, genuine: 0, withAi: zero, rulesAlone: zero, aiUnavailable: zero, onlyAiHeld: [] },
      messages: { scams: 0, genuine: 0, aiChecked: 0, withAiFlagged: 0 },
    });
  });
});
