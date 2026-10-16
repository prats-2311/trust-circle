import type { AiOutcome } from "@/risk/decide";
import type { PaymentRiskInput, Signal } from "@/risk/signals";
import { groqChat, parseJsonObject } from "./groqClient";
import { JudgementSchema } from "./judgementSchema";
import { buildPaymentUserMessage, PAYMENT_SYSTEM_PROMPT } from "./prompts";

export type PaymentJudge = (input: PaymentRiskInput, signals: Signal[]) => Promise<AiOutcome>;

export function createGroqJudge(opts: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): PaymentJudge {
  const timeoutMs = opts.timeoutMs ?? 8000;

  return async (input, signals) => {
    const out = await groqChat({
      apiKey: opts.apiKey,
      model: opts.model,
      json: true,
      timeoutMs,
      fetchImpl: opts.fetchImpl,
      messages: [
        { role: "system", content: PAYMENT_SYSTEM_PROMPT },
        { role: "user", content: buildPaymentUserMessage(input, signals) },
      ],
    });
    if (!out.ok) return out;
    try {
      const parsed = JudgementSchema.safeParse(parseJsonObject(out.content));
      if (!parsed.success) return { ok: false, error: "groq output failed validation" };
      return { ok: true, judgement: parsed.data };
    } catch {
      return { ok: false, error: "groq output was not JSON" };
    }
  };
}
