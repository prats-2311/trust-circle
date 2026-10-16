import { z } from "zod";
import type { AiJudgement } from "@/risk/decide";
import type { Signal } from "@/risk/signals";
import { groqChat, parseJsonObject } from "./groqClient";
import { JudgementSchema } from "./judgementSchema";
import { buildMessageUserContent, MESSAGE_SYSTEM_PROMPT } from "./messagePrompts";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";
export type MessageInput = { kind: "text"; text: string } | { kind: "image"; mimeType: ImageMime; base64: string };
export interface MessageJudgement extends AiJudgement {
  transcript: string;
}
export type MessageAiOutcome = { ok: true; judgement: MessageJudgement } | { ok: false; error: string };
export type MessageJudge = (input: MessageInput, signals: Signal[]) => Promise<MessageAiOutcome>;

const MessageJudgementSchema = JudgementSchema.extend({ transcript: z.string().default("") });

export function createGroqMessageJudge(opts: {
  apiKey: string;
  textModel: string;
  visionModel: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): MessageJudge {
  return async (input, signals) => {
    const out = await groqChat({
      apiKey: opts.apiKey,
      model: input.kind === "image" ? opts.visionModel : opts.textModel,
      json: true,
      timeoutMs: opts.timeoutMs ?? 20_000,
      fetchImpl: opts.fetchImpl,
      messages: [
        { role: "system", content: MESSAGE_SYSTEM_PROMPT },
        { role: "user", content: buildMessageUserContent(input, signals) },
      ],
    });
    if (!out.ok) return out;
    try {
      const parsed = MessageJudgementSchema.safeParse(parseJsonObject(out.content));
      return parsed.success ? { ok: true, judgement: parsed.data } : { ok: false, error: "groq output failed validation" };
    } catch {
      return { ok: false, error: "groq output was not JSON" };
    }
  };
}
