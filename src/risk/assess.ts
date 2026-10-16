import type { PaymentJudge } from "@/ai/groqJudge";
import { INJECTION_THRESHOLD, type PromptGuard } from "@/ai/promptGuard";
import { decide, type AiOutcome, type RiskDecision } from "./decide";
import { computeSignals, HIDDEN_INSTRUCTIONS_SIGNAL, type PaymentRiskInput, type SenderContext } from "./signals";

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

export async function assessPayment(
  input: PaymentRiskInput,
  ctx: SenderContext,
  judge: PaymentJudge,
  guard?: PromptGuard,
): Promise<RiskDecision> {
  const signals = computeSignals(input, ctx);
  const freeText = [input.note, input.senderAnswer].filter((t): t is string => Boolean(t)).join("\n");
  if (await isInjection(guard, freeText)) signals.push(HIDDEN_INSTRUCTIONS_SIGNAL);
  let ai: AiOutcome;
  try {
    ai = await judge(input, signals);
  } catch {
    ai = { ok: false, error: "judge threw" };
  }
  return decide(signals, ai);
}
