import { describe, expect, it } from "vitest";
import { canonicalKey, keySet, matchKeys, normalisePayee, sharesKey } from "./matchKeys";

describe("match keys", () => {
  it("normalises payees as before", () => {
    expect(normalisePayee(" Grandson@Example.com ")).toBe("grandson@example.com");
    expect(normalisePayee("+1 (415) 555-0199")).toBe("+14155550199");
  });
  it("gives every written form of a US number the same canonical key", () => {
    for (const v of ["+1 (415) 555-0199", "14155550199", "415.555.0199", "(415) 555-0199"]) {
      expect(canonicalKey(v)).toBe("4155550199");
    }
  });
  it("keeps emails and links as single keys", () => {
    expect(canonicalKey("A@B.example")).toBe("a@b.example");
    expect(canonicalKey("https://www.Evil.example/login?x=1")).toBe("evil.example/login");
    expect(matchKeys("bit.ly/abc123")).toEqual(["bit.ly/abc123"]);
  });
  it("compares any two forms", () => {
    expect(sharesKey("+1 (415) 555-0199", "4155550199")).toBe(true);
    expect(sharesKey("a@b.example", "c@b.example")).toBe(false);
    expect(keySet(["+1 415 555 0199"]).has("4155550199")).toBe(true);
  });
  it("treats an @ inside a link as part of the link, not an email", () => {
    expect(matchKeys("http://paypal.com@Evil.example/x")).toEqual(["evil.example/x"]);
    expect(matchKeys("https://x.example/unsub?e=a@b.com")).toEqual(["x.example/unsub"]);
    expect(matchKeys("A@B.example")).toEqual(["a@b.example"]);
  });
  it("keys a link by the host a browser would really open", () => {
    expect(matchKeys("https://evil.example?@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("https://evil.example#@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("https://evil.example\\@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("http://paypal.com@evil.example/x")).toEqual(["evil.example/x"]);
  });
});
