import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, signSession, verifySession } from "./session";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-11-01T10:00:00Z");

describe("session", () => {
  it("round-trips a user id before it expires", () => {
    const t = signSession("u1", SECRET, NOW);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + SESSION_TTL_MS - 1000))).toBe("u1");
  });
  it("rejects an expired token", () => {
    const t = signSession("u1", SECRET, NOW, 60_000);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + 60_001))).toBeNull();
  });
  it("rejects tampering with the user or the expiry", () => {
    const t = signSession("u1", SECRET, NOW);
    expect(verifySession(t.replace("u1", "u2"), SECRET, NOW)).toBeNull();
    const [id, , mac] = t.split(".");
    expect(verifySession(`${id}.${NOW.getTime() + 10 * SESSION_TTL_MS}.${mac}`, SECRET, NOW)).toBeNull();
  });
  it("rejects another secret, old two-part tokens and garbage", () => {
    expect(verifySession(signSession("u1", "x".repeat(32), NOW), SECRET, NOW)).toBeNull();
    expect(verifySession("u1.abc", SECRET, NOW)).toBeNull();
    expect(verifySession(undefined, SECRET, NOW)).toBeNull();
    expect(verifySession("garbage", SECRET, NOW)).toBeNull();
  });
});
