import type { PaymentJudge } from "@/ai/groqJudge";
import { INJECTION_THRESHOLD, type PromptGuard } from "@/ai/promptGuard";
import { decide, type AiOutcome, type RiskDecision } from "./decide";
import type { PatternMatch, PatternMatcher } from "@/patterns/patternService";
import { computeSignals, HIDDEN_INSTRUCTIONS_SIGNAL, KNOWN_PATTERN_SIGNAL, type PaymentRiskInput, type SenderContext } from "./signals";

async function isInjection(guard: PromptGuard | undefined, text: string): Promise<boolean> {
  if (!guard || !text) return false;
  try {
    const score = await guard(text);
    if (score === null) console.warn("prompt guard unavailable", { where: "payment", error: "no score" });
    return score !== null && score >= INJECTION_THRESHOLD;
  } catch (e) {
    // An unavailable guard removes one signal; the rules and the AI still apply.
    console.warn("prompt guard unavailable", { where: "payment", error: e instanceof Error ? e.name : "unknown" });
    return false;
  }
}

async function knownPattern(patterns: PatternMatcher | undefined, text: string): Promise<PatternMatch | null> {
  if (!patterns || !text) return null;
  try {
    return await patterns(text);
  } catch {
    // An unavailable matcher removes one signal; the rules and the AI still apply.
    return null;
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
  const [injected, pattern] = await Promise.all([isInjection(guard, freeText), knownPattern(patterns, freeText)]);
  if (injected) signals.push(HIDDEN_INSTRUCTIONS_SIGNAL);
  if (pattern) signals.push(KNOWN_PATTERN_SIGNAL);
  let ai: AiOutcome;
  try {
    ai = await judge(input, signals);
  } catch {
    ai = { ok: false, error: "judge threw" };
  }
  return decide(signals, ai, pattern?.scamType);
}
