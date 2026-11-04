import { describe, expect, it, vi } from "vitest";
import { createGroqBudget } from "./groqBudget";
import { groqChat } from "./groqClient";
import { createGroqTranscriber } from "./groqTranscriber";

const GROQ = "https://api.groq.com/openai/v1/chat/completions";
const okFetch = () => vi.fn().mockResolvedValue(new Response("{}"));

describe("createGroqBudget", () => {
  it("passes the call through while under the cap", async () => {
    const inner = okFetch();
    const f = createGroqBudget({ cap: 2, count: async () => 2, fetchImpl: inner });
    await f(GROQ, { method: "POST" });
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("throws GroqBudgetError over the cap without touching the network", async () => {
    const inner = okFetch();
    const f = createGroqBudget({ cap: 2, count: async () => 3, fetchImpl: inner });
    await expect(f(GROQ)).rejects.toMatchObject({ name: "GroqBudgetError" });
    expect(inner).not.toHaveBeenCalled();
  });

  it("does not count or limit other hosts", async () => {
    const inner = okFetch();
    const count = vi.fn().mockResolvedValue(999);
    const f = createGroqBudget({ cap: 1, count, fetchImpl: inner });
    await f("https://api.sandbox.paypal.com/v1/x");
    expect(count).not.toHaveBeenCalled();
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("goes ahead and warns when the counter is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = okFetch();
    const f = createGroqBudget({ cap: 1, count: async () => { throw new TypeError("db down"); }, fetchImpl: inner });
    await f(GROQ);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("ai usage unavailable", { error: "TypeError" });
    warn.mockRestore();
  });

  it("keys the count by the UTC date", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const f = createGroqBudget({ cap: 5, count, fetchImpl: okFetch(), now: () => new Date("2026-11-05T23:30:00-05:00") });
    await f(GROQ);
    expect(count).toHaveBeenCalledWith("2026-11-06");
  });

  it("accepts URL and Request inputs", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const f = createGroqBudget({ cap: 5, count, fetchImpl: okFetch() });
    await f(new URL(GROQ));
    await f(new Request(GROQ));
    expect(count).toHaveBeenCalledTimes(2);
  });

  it("turns into a failed result, not a throw, for groqChat and the transcriber", async () => {
    const inner = okFetch();
    const spent = createGroqBudget({ cap: 1, count: async () => 2, fetchImpl: inner });
    const chat = await groqChat({ apiKey: "k", model: "m", messages: [], json: false, timeoutMs: 1000, fetchImpl: spent });
    expect(chat).toEqual({ ok: false, error: "GroqBudgetError" });
    const transcribe = createGroqTranscriber({ apiKey: "k", model: "m", fetchImpl: spent });
    expect(await transcribe({ bytes: new Uint8Array([1]), format: "webm" })).toEqual({ ok: false, error: "GroqBudgetError" });
    expect(inner).not.toHaveBeenCalled();
  });
});
