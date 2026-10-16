import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installMsw, server } from "@/test/msw";

installMsw();
const embed = vi.fn();
vi.mock("@/patterns/embedder", () => ({ getEmbedder: () => embed }));
import { warmUp } from "./warmup";

afterEach(() => vi.unstubAllEnvs());

describe("warmUp", () => {
  it("embeds a throwaway text and pings Groq with the key, sending nothing else", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    embed.mockResolvedValue([[0]]);
    let auth: string | null = null;
    server.use(
      http.get("https://api.groq.com/openai/v1/models", ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ data: [] });
      }),
    );
    await warmUp();
    expect(embed).toHaveBeenCalledWith(["warm up"]);
    expect(auth).toBe("Bearer gsk_test");
  });

  it("never throws, logging only error names", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    embed.mockRejectedValue(new TypeError("secret detail"));
    server.use(http.get("https://api.groq.com/openai/v1/models", () => HttpResponse.error()));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(warmUp()).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret detail");
    expect(warn).toHaveBeenCalledWith("warm up failed", { step: "embedder", error: "TypeError" });
    warn.mockRestore();
  });
});
