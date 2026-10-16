import { groqChat } from "./groqClient";

/** Probability (0 to 1) that the text tries to instruct an AI, or null when the guard could not run. */
export type PromptGuard = (text: string) => Promise<number | null>;

export const INJECTION_THRESHOLD = 0.9;
// Prompt Guard 2 reads 512 tokens; 1,800 characters stays under that.
const CHUNK_CHARS = 1800;
const MAX_CHUNKS = 4;

export function chunksOf(text: string): string[] {
  const t = text.trim();
  const out: string[] = [];
  for (let i = 0; i < t.length && out.length < MAX_CHUNKS; i += CHUNK_CHARS) out.push(t.slice(i, i + CHUNK_CHARS));
  return out;
}

export function createPromptGuard(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }): PromptGuard {
  return async (text) => {
    const parts = chunksOf(text);
    if (parts.length === 0) return 0;
    const scores = await Promise.all(
      parts.map(async (part) => {
        const out = await groqChat({
          apiKey: opts.apiKey,
          model: opts.model,
          json: false,
          timeoutMs: opts.timeoutMs ?? 4000,
          fetchImpl: opts.fetchImpl,
          messages: [{ role: "user", content: part }],
        });
        if (!out.ok) return null;
        const n = Number.parseFloat(out.content.trim());
        return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
      }),
    );
    const known = scores.filter((s): s is number => s !== null);
    if (known.some((s) => s >= INJECTION_THRESHOLD)) return Math.max(...known);
    if (known.length < scores.length) return null;
    return Math.max(...known);
  };
}
