import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const MARGARET = "11111111-1111-4111-8111-111111111111";

const check = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ env: { SESSION_SECRET: SECRET }, messages: { check } }) }));
import { POST } from "./route";

beforeEach(() => {
  check.mockReset().mockResolvedValue({ id: "m1" });
});

const call = (userId?: string) =>
  POST(new Request("http://x/api/messages/check", {
    method: "POST",
    headers: { "content-type": "application/json", ...(userId ? { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } : {}) },
    body: JSON.stringify({ text: "hello there" }),
  }));

describe("POST /api/messages/check rate limit", () => {
  it("answers 401 when signed out, without using up the limit", async () => {
    for (let i = 0; i < 25; i++) expect((await call()).status).toBe(401);
  });

  it("answers 429 with the exact copy on the 21st check, without calling the judge", async () => {
    for (let i = 0; i < 20; i++) expect((await call(MARGARET)).status).not.toBe(429);
    expect(check).toHaveBeenCalledTimes(20);
    const res = await call(MARGARET);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "You've checked a lot of messages in the last few minutes. Please wait a little and try again." });
    expect(check).toHaveBeenCalledTimes(20);
  });
});
