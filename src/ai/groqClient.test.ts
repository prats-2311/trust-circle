import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { installMsw, server } from "@/test/msw";
import { GROQ_URL, groqChat, parseJsonObject } from "./groqClient";

installMsw();
const base = { apiKey: "gsk_test", model: "m", timeoutMs: 500 };

describe("parseJsonObject", () => {
  it("parses plain JSON", () => expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 }));
  it("ignores reasoning tags and code fences around the object", () => {
    expect(parseJsonObject('<think>maybe {"no":1}</think>\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("throws when there is no object", () => expect(() => parseJsonObject("0.98")).toThrow(SyntaxError));
});

describe("groqChat", () => {
  it("sends json mode only when asked and returns the content", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ choices: [{ message: { content: "hello" } }] });
      }),
    );
    expect(await groqChat({ ...base, json: true, messages: [{ role: "user", content: "x" }] })).toEqual({ ok: true, content: "hello" });
    await groqChat({ ...base, json: false, messages: [{ role: "user", content: "x" }] });
    expect(bodies[0]!.response_format).toEqual({ type: "json_object" });
    expect(bodies[1]).not.toHaveProperty("response_format");
    expect(bodies[0]!.temperature).toBe(0);
  });
  it("passes multi-part image content through unchanged", async () => {
    let body: { messages: { content: unknown }[] } | undefined;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ choices: [{ message: { content: "{}" } }] });
      }),
    );
    const content = [
      { type: "text" as const, text: "read this" },
      { type: "image_url" as const, image_url: { url: "data:image/png;base64,AAAA" } },
    ];
    await groqChat({ ...base, json: true, messages: [{ role: "user", content }] });
    expect(body!.messages[0]!.content).toEqual(content);
  });
  it("logs the model, duration and outcome of each call, never the content", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    server.use(http.post(GROQ_URL, () => HttpResponse.json({ choices: [{ message: { content: "secret reply" } }] })));
    await groqChat({ ...base, json: true, messages: [{ role: "user", content: "secret text" }] });
    expect(info).toHaveBeenCalledWith("groq call", { model: "m", ms: expect.any(Number), ok: true });
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret");
    info.mockRestore();
  });
  it("reports http errors and empty responses without throwing", async () => {
    server.use(http.post(GROQ_URL, () => HttpResponse.json({}, { status: 500 })));
    expect(await groqChat({ ...base, json: true, messages: [] })).toEqual({ ok: false, error: "groq http 500" });
    server.use(http.post(GROQ_URL, () => HttpResponse.json({ choices: [] })));
    expect(await groqChat({ ...base, json: true, messages: [] })).toEqual({ ok: false, error: "groq empty response" });
  });
});
