import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  it("refuses the take after the limit, inside the window", () => {
    const t = 0;
    const l = createRateLimiter({ limit: 20, windowMs: 600_000, now: () => t });
    for (let i = 0; i < 20; i++) expect(l.take("a")).toBe(true);
    expect(l.take("a")).toBe(false);
  });

  it("allows again once the window has passed", () => {
    let t = 0;
    const l = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    l.take("a");
    l.take("a");
    expect(l.take("a")).toBe(false);
    t = 1001;
    expect(l.take("a")).toBe(true);
  });

  it("keeps keys independent", () => {
    const l = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(l.take("a")).toBe(true);
    expect(l.take("a")).toBe(false);
    expect(l.take("b")).toBe(true);
  });
});

describe("clientKey", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  it("uses the first x-forwarded-for entry, trimmed", () => {
    expect(clientKey(req({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" }), "u1")).toBe("1.2.3.4");
  });
  it("falls back to the user", () => {
    expect(clientKey(req({}), "u1")).toBe("user:u1");
    expect(clientKey(req({ "x-forwarded-for": "  " }), "u1")).toBe("user:u1");
  });
});
