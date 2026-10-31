import { describe, expect, it, vi } from "vitest";
import { createGroqTranscriber } from "./groqTranscriber";

const audio = { bytes: new Uint8Array([1, 2, 3]), format: "ogg" as const };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("createGroqTranscriber", () => {
  it("posts the audio and model as multipart with the bearer key", async () => {
    const fetchImpl = vi.fn(async () => json({ text: "hello" }));
    await createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl: fetchImpl as unknown as typeof fetch })(audio);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("m");
    expect((form.get("file") as File).name).toBe("voice.ogg");
  });

  it("trims the transcript", async () => {
    const t = createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl: (async () => json({ text: " hi " })) as typeof fetch });
    expect(await t(audio)).toEqual({ ok: true, text: "hi" });
  });

  it("returns an HTTP failure as an error", async () => {
    const t = createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl: (async () => json({}, 500)) as typeof fetch });
    expect(await t(audio)).toEqual({ ok: false, error: "groq http 500" });
  });

  it("returns a timeout as an error", async () => {
    const fetchImpl = (async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    }) as typeof fetch;
    expect(await createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl })(audio)).toEqual({ ok: false, error: "TimeoutError" });
  });

  it("treats a body without text as empty", async () => {
    const t = createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl: (async () => json({ nope: 1 })) as typeof fetch });
    expect(await t(audio)).toEqual({ ok: false, error: "groq empty response" });
  });
});
