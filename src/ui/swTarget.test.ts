import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeTarget } from "./swTarget";

const ORIGIN = "https://app.example";

describe("safeTarget", () => {
  it.each([
    ["/payments/1", "/payments/1"],
    ["https://app.example/circle", "/circle"],
    ["https://evil.example/x", "/"],
    ["//evil.example", "/"],
    ["javascript:alert(1)", "/"],
    [42, "/"],
    ["/\\evil", "/"],
    ["https://app.example//evil.example", "/"],
    ["/.//evil.example", "/"],
    ["/a/..//evil.example", "/"],
    ["https://app.example/\\\\evil.example", "/"],
  ])("%j opens %j", (input, expected) => {
    const out = safeTarget(input, ORIGIN);
    expect(out).toBe(expected);
    expect(out.startsWith("//")).toBe(false);
    expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
  });
});

describe("public/sw.js", () => {
  it("carries the same safeTarget body as src/ui/swTarget.ts", () => {
    const body = (src: string) => {
      const start = src.indexOf("function safeTarget");
      const open = src.indexOf("{", src.indexOf(")", start));
      let depth = 0;
      for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
      }
      throw new Error("safeTarget not found");
    };
    const ts = readFileSync(join(process.cwd(), "src/ui/swTarget.ts"), "utf8");
    const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    expect(body(sw)).toBe(body(ts));
  });
});
