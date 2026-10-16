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
  GROQ_VISION_MODEL: "v",
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

  it("requires the vision model and defaults the guard model", () => {
    const missing: Record<string, string | undefined> = { ...valid };
    delete missing.GROQ_VISION_MODEL;
    expect(() => loadEnv(missing)).toThrow(/GROQ_VISION_MODEL/);
    expect(loadEnv({ ...valid, GROQ_VISION_MODEL: "v" }).GROQ_GUARD_MODEL).toBe("meta-llama/llama-prompt-guard-2-86m");
  });

  it("requires a session secret of at least 32 characters", () => {
    expect(() => loadEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("treats an empty RESEND_API_KEY as unset and defaults alert settings", () => {
    const env = loadEnv({ ...valid, RESEND_API_KEY: "" });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.ALERT_FROM_EMAIL).toBe("Trust Circle <onboarding@resend.dev>");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });
});
