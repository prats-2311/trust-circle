import type { EvalResult } from "./runEval";

const PATTERN = "KNOWN_SCAM_PATTERN";

/** What the pattern matcher cost on genuine cases: false alarms that carry its signal, and holds it caused alone. */
export function matcherEffect(results: EvalResult[]) {
  const alarms = results.filter((r) => r.label === "genuine" && r.level !== "low");
  return {
    falseAlarms: alarms.length,
    withPattern: alarms.filter((r) => r.signals.includes(PATTERN)).map((r) => r.id),
    heldOnPatternAlone: alarms.filter((r) => r.level === "high" && r.signals.length === 1 && r.signals[0] === PATTERN).map((r) => r.id),
  };
}
