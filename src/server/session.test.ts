import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "s".repeat(32);

describe("session", () => {
  it("round-trips a user id", () => {
    expect(verifySession(signSession("u1", SECRET), SECRET)).toBe("u1");
  });
  it("rejects a tampered token", () => {
    const t = signSession("u1", SECRET);
    expect(verifySession(t.replace("u1", "u2"), SECRET)).toBeNull();
  });
  it("rejects a token signed with another secret", () => {
    expect(verifySession(signSession("u1", "x".repeat(32)), SECRET)).toBeNull();
  });
  it("rejects missing or malformed tokens", () => {
    expect(verifySession(undefined, SECRET)).toBeNull();
    expect(verifySession("garbage", SECRET)).toBeNull();
  });
});
