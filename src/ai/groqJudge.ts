import type { AiOutcome } from "@/risk/decide";
import type { PaymentRiskInput, Signal } from "@/risk/signals";
import { JudgementSchema } from "./judgementSchema";
import { buildPaymentUserMessage, PAYMENT_SYSTEM_PROMPT } from "./prompts";

export type PaymentJudge = (input: PaymentRiskInput, signals: Signal[]) => Promise<AiOutcome>;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function createGroqJudge(opts: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): PaymentJudge {
  const timeoutMs = opts.timeoutMs ?? 8000;

  return async (input, signals) => {
    try {
      const res = await (opts.fetchImpl ?? fetch)(GROQ_URL, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PAYMENT_SYSTEM_PROMPT },
            { role: "user", content: buildPaymentUserMessage(input, signals) },
          ],
        }),
      });
      if (!res.ok) return { ok: false, error: `groq http ${res.status}` };
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: "groq empty response" };
      const parsed = JudgementSchema.safeParse(JSON.parse(content));
      if (!parsed.success) return { ok: false, error: "groq output failed validation" };
      return { ok: true, judgement: parsed.data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.name : "groq error" };
    }
  };
}
