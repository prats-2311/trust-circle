import type { RiskLevel } from "@/domain/types";
import { ruleLevel, type Signal, type SignalCode } from "@/risk/signals";
import type { EvalResult } from "./runEval";

// Signals that need AI: Prompt Guard raises HIDDEN_INSTRUCTIONS, and KNOWN_SCAM_PATTERN matches AI-written descriptions.
const AI_SIGNALS: readonly string[] = ["HIDDEN_INSTRUCTIONS", "KNOWN_SCAM_PATTERN"];

interface Counts {
  scamsHeld: number;
  scamsFlagged: number;
  genuineHeld: number;
  genuineFlagged: number;
}

function count(cases: EvalResult[], levelOf: (r: EvalResult) => RiskLevel): Counts {
  const scams = cases.filter((r) => r.label === "scam").map(levelOf);
  const genuine = cases.filter((r) => r.label === "genuine").map(levelOf);
  return {
    scamsHeld: scams.filter((l) => l === "high").length,
    scamsFlagged: scams.filter((l) => l !== "low").length,
    genuineHeld: genuine.filter((l) => l === "high").length,
    genuineFlagged: genuine.filter((l) => l !== "low").length,
  };
}

const ruleSignals = (r: EvalResult): Signal[] =>
  r.signals.filter((code) => !AI_SIGNALS.includes(code)).map((code) => ({ code: code as SignalCode, detail: "" }));

/**
 * What the AI adds, scored from one run with no extra AI calls. Payments are scored three ways: as the app ran
 * (rules plus AI), by the rules alone, and by the fallback the app uses when the AI is unavailable (any rule
 * signal holds the payment). Messages have no rule-only score: without AI nothing reads the text.
 */
export function rulesOnlyComparison(results: EvalResult[]) {
  const payments = results.filter((r) => r.kind === "payment");
  const messages = results.filter((r) => r.kind === "message");
  const rulesLevel = (r: EvalResult) => ruleLevel(ruleSignals(r));
  return {
    payments: {
      scams: payments.filter((r) => r.label === "scam").length,
      genuine: payments.filter((r) => r.label === "genuine").length,
      withAi: count(payments, (r) => r.level),
      rulesAlone: count(payments, rulesLevel),
      aiUnavailable: count(payments, (r): RiskLevel => (ruleSignals(r).length > 0 ? "high" : "low")),
      onlyAiHeld: payments.filter((r) => r.label === "scam" && r.level === "high" && rulesLevel(r) !== "high").map((r) => r.id),
    },
    messages: {
      scams: messages.filter((r) => r.label === "scam").length,
      genuine: messages.filter((r) => r.label === "genuine").length,
      withAiFlagged: messages.filter((r) => r.label === "scam" && r.level !== "low").length,
    },
  };
}
