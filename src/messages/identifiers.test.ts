import { describe, expect, it } from "vitest";
import { extractIdentifiers, matchKeys, phoneVariants } from "./identifiers";

describe("extractIdentifiers", () => {
  it("finds phones and emails in a scam text", () => {
    expect(extractIdentifiers("Text me back at +1 (415) 555-0199 or dhill.urgent@outlook.example")).toEqual([
      { type: "email", value: "dhill.urgent@outlook.example" },
      { type: "phone", value: "+14155550199" },
    ]);
  });
  it("keeps a URL whole and does not read digits inside it as a phone", () => {
    expect(extractIdentifiers("Verify now: http://paypal-secure-verify.example/login/12345678901.")).toEqual([
      { type: "url", value: "http://paypal-secure-verify.example/login/12345678901" },
    ]);
  });
  it("lower-cases emails and URLs and de-duplicates", () => {
    expect(extractIdentifiers("Mail A@B.example or a@b.example, see WWW.X.example")).toEqual([
      { type: "url", value: "www.x.example" },
      { type: "email", value: "a@b.example" },
    ]);
  });
  it("ignores dates, money, order numbers and short codes", () => {
    expect(extractIdentifiers("On 2026-10-16 pay $1,500 for order #44812, code 482913, invoice INV-2291")).toEqual([]);
  });
  it("normalises toll-free style numbers", () => {
    expect(extractIdentifiers("Call 1-888-555-0123 now")).toEqual([{ type: "phone", value: "18885550123" }]);
  });
  it("returns at most 20 identifiers", () => {
    const many = Array.from({ length: 30 }, (_, i) => `u${i}@x.example`).join(" ");
    expect(extractIdentifiers(many)).toHaveLength(20);
  });
  it("finds bare short links and bare domains on common endings", () => {
    expect(extractIdentifiers("Claim here: bit.ly/abc123 or visit medicare-update.example today")).toEqual([
      { type: "url", value: "bit.ly/abc123" },
      { type: "url", value: "medicare-update.example" },
    ]);
  });
  it("does not read abbreviations or emails as links", () => {
    expect(extractIdentifiers("Meet at Main St. at 3.30, Dr. Patel said e.g. bring a@b.example")).toEqual([
      { type: "email", value: "a@b.example" },
    ]);
  });
});

describe("phoneVariants and matchKeys", () => {
  it("matches a US number with or without country code", () => {
    expect(phoneVariants("+14155550199")).toEqual(["+14155550199", "14155550199", "4155550199"]);
    expect(phoneVariants("5550199")).toEqual(["5550199"]);
  });
  it("normalises any identifier to comparable keys", () => {
    expect(matchKeys(" A@B.example ")).toEqual(["a@b.example"]);
    expect(matchKeys("http://x.example/login/")).toEqual(["x.example/login"]);
    expect(matchKeys("https://WWW.Evil.example/login?x=1#top")).toEqual(["evil.example/login"]);
    expect(matchKeys("(415) 555-0199")).toEqual(["4155550199"]);
  });
});
