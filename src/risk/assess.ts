import type { PaymentJudge } from "@/ai/groqJudge";
import { decide, type AiOutcome, type RiskDecision } from "./decide";
import { computeSignals, type PaymentRiskInput, type SenderContext } from "./signals";

export async function assessPayment(
  input: PaymentRiskInput,
  ctx: SenderContext,
  judge: PaymentJudge,
): Promise<RiskDecision> {
  const signals = computeSignals(input, ctx);
  let ai: AiOutcome;
  try {
    ai = await judge(input, signals);
  } catch {
    ai = { ok: false, error: "judge threw" };
  }
  return decide(signals, ai);
}
