import type { PaymentJudge } from "@/ai/groqJudge";
import { INJECTION_THRESHOLD, type PromptGuard } from "@/ai/promptGuard";
import { decide, type AiOutcome, type RiskDecision } from "./decide";
import type { PatternMatcher } from "@/patterns/patternService";
import { computeSignals, HIDDEN_INSTRUCTIONS_SIGNAL, KNOWN_PATTERN_SIGNAL, type PaymentRiskInput, type SenderContext } from "./signals";

async function isInjection(guard: PromptGuard | undefined, text: string): Promise<boolean> {
  if (!guard || !text) return false;
  try {
    const score = await guard(text);
    return score !== null && score >= INJECTION_THRESHOLD;
  } catch {
    // An unavailable guard removes one signal; the rules and the AI still apply.
    return false;
  }
}

async function isKnownPattern(patterns: PatternMatcher | undefined, text: string): Promise<boolean> {
  if (!patterns || !text) return false;
  try {
    return (await patterns(text)) !== null;
  } catch {
    // An unavailable matcher removes one signal; the rules and the AI still apply.
    return false;
  }
}

export async function assessPayment(
  input: PaymentRiskInput,
  ctx: SenderContext,
  judge: PaymentJudge,
  guard?: PromptGuard,
  patterns?: PatternMatcher,
): Promise<RiskDecision> {
  const signals = computeSignals(input, ctx);
  const freeText = [input.note, input.senderAnswer, input.linkedMessage].filter((t): t is string => Boolean(t)).join("\n");
  const [injected, knownPattern] = await Promise.all([isInjection(guard, freeText), isKnownPattern(patterns, freeText)]);
  if (injected) signals.push(HIDDEN_INSTRUCTIONS_SIGNAL);
  if (knownPattern) signals.push(KNOWN_PATTERN_SIGNAL);
  let ai: AiOutcome;
  try {
    ai = await judge(input, signals);
  } catch {
    ai = { ok: false, error: "judge threw" };
  }
  return decide(signals, ai);
}
