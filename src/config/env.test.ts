import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const valid = {
  PAYPAL_CLIENT_ID: "id",
  PAYPAL_CLIENT_SECRET: "secret",
  PAYPAL_ENV: "sandbox",
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: "id",
  DATABASE_URL: "postgres://u:p@localhost:5433/db",
  GROQ_API_KEY: "gsk_x",
  GROQ_TEXT_MODEL: "openai/gpt-oss-120b",
  SESSION_SECRET: "x".repeat(32),
  CRON_SECRET: "y".repeat(24),
};

describe("loadEnv", () => {
  it("parses a complete environment", () => {
    const env = loadEnv(valid);
    expect(env.PAYPAL_ENV).toBe("sandbox");
    expect(env.GROQ_TEXT_MODEL).toBe("openai/gpt-oss-120b");
  });

  it("refuses live PayPal credentials in this project", () => {
    expect(() => loadEnv({ ...valid, PAYPAL_ENV: "live" })).toThrow(/PAYPAL_ENV/);
  });

  it("names every missing variable without printing values", () => {
    let message = "";
    try {
      loadEnv({ ...valid, PAYPAL_CLIENT_SECRET: undefined, GROQ_API_KEY: undefined });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/PAYPAL_CLIENT_SECRET/);
    expect(message).toMatch(/GROQ_API_KEY/);
    expect(message).not.toMatch(/secret"/);
  });

  it("requires a session secret of at least 32 characters", () => {
    expect(() => loadEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });
});
