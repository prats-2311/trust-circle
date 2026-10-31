import { audioFileName, type AudioFormat } from "@/messages/audio";

export const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export type TranscriptResult = { ok: true; text: string } | { ok: false; error: string };
export type Transcriber = (audio: { bytes: Uint8Array; format: AudioFormat }) => Promise<TranscriptResult>;

export function createGroqTranscriber(opts: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Transcriber {
  return async (audio) => {
    const started = Date.now();
    const result = await call(opts, audio);
    console.info("groq transcription", { model: opts.model, ms: Date.now() - started, ok: result.ok });
    return result;
  };
}

async function call(
  opts: Parameters<typeof createGroqTranscriber>[0],
  audio: Parameters<Transcriber>[0],
): Promise<TranscriptResult> {
  try {
    const form = new FormData();
    form.append("model", opts.model);
    form.append("file", new Blob([new Uint8Array(audio.bytes)]), audioFileName(audio.format));
    const res = await (opts.fetchImpl ?? fetch)(GROQ_AUDIO_URL, {
      method: "POST",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
    });
    if (!res.ok) return { ok: false, error: `groq http ${res.status}` };
    const data = (await res.json()) as { text?: unknown };
    if (typeof data.text !== "string") return { ok: false, error: "groq empty response" };
    return { ok: true, text: data.text.trim() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.name : "groq error" };
  }
}
