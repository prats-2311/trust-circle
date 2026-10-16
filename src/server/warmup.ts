import { getEmbedder } from "@/patterns/embedder";

const OVERALL_LIMIT_MS = 30_000;

async function step(name: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.warn("warm up failed", { step: name, error: e instanceof Error ? e.name : "unknown" });
  }
}

/** Loads the embedding model and opens the Groq connection before the first user needs them. Never throws. */
export async function warmUp(): Promise<void> {
  const signal = AbortSignal.timeout(OVERALL_LIMIT_MS);
  const limit = new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  const work = Promise.all([
    step("embedder", () => getEmbedder()(["warm up"])),
    step("groq", async () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) return;
      await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal });
    }),
  ]);
  await Promise.race([work, limit]);
}
