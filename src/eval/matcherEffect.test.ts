import { describe, expect, it } from "vitest";
import { matcherEffect } from "./matcherEffect";
import type { EvalResult } from "./runEval";

const r = (id: string, label: "scam" | "genuine", level: "low" | "medium" | "high", signals: string[]): EvalResult => ({
  id, kind: "message", preset: "family", label, level, scamType: "other", checked: true, signals, attempts: 1, uncheckedCause: null,
});

describe("matcherEffect", () => {
  it("counts genuine false alarms carrying the pattern signal and holds on that signal alone", () => {
    const e = matcherEffect([
      r("a", "genuine", "medium", ["KNOWN_SCAM_PATTERN"]),
      r("b", "genuine", "high", ["KNOWN_SCAM_PATTERN"]),
      r("c", "genuine", "high", ["KNOWN_SCAM_PATTERN", "UNUSUAL_AMOUNT"]),
      r("d", "genuine", "medium", ["FIRST_TIME_PAYEE"]),
      r("e", "genuine", "low", ["KNOWN_SCAM_PATTERN"]),
      r("f", "scam", "high", ["KNOWN_SCAM_PATTERN"]),
    ]);
    expect(e.falseAlarms).toBe(4);
    expect(e.withPattern).toEqual(["a", "b", "c"]);
    expect(e.heldOnPatternAlone).toEqual(["b"]);
  });
  it("handles a run with none", () => {
    expect(matcherEffect([])).toEqual({ falseAlarms: 0, withPattern: [], heldOnPatternAlone: [] });
  });
});
