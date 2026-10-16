import { describe, expect, it } from "vitest";
import { loadEnv, loadEnvSafe } from "./env";

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

  it("treats empty guard model, from address and app url as unset", () => {
    const env = loadEnv({ ...valid, GROQ_GUARD_MODEL: "", ALERT_FROM_EMAIL: "", APP_URL: "" });
    expect(env.GROQ_GUARD_MODEL).toBe("meta-llama/llama-prompt-guard-2-86m");
    expect(env.ALERT_FROM_EMAIL).toBe("Trust Circle <onboarding@resend.dev>");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("treats VAPID keys as optional and defaults the subject", () => {
    const env = loadEnv({ ...valid, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "" });
    expect(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
    expect(env.VAPID_SUBJECT).toBe("mailto:alerts@trustcircle.example");
  });

  it("accepts a mailto: or https: VAPID subject and turns push off for anything else", () => {
    expect(loadEnv({ ...valid, VAPID_SUBJECT: "https://tc.example" }).VAPID_SUBJECT).toBe("https://tc.example");
    expect(loadEnv({ ...valid, VAPID_SUBJECT: "mailto:me@tc.example" }).VAPID_SUBJECT).toBe("mailto:me@tc.example");
    const bad = loadEnvSafe({ ...valid, VAPID_SUBJECT: "tel:123" });
    expect(bad.warnings[0]).toMatch(/VAPID_SUBJECT/);
  });
});

describe("loadEnvSafe", () => {
  it("a bad VAPID_SUBJECT turns push off with one warning", () => {
    const r = loadEnvSafe({ ...valid, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pk", VAPID_PRIVATE_KEY: "sk", VAPID_SUBJECT: "alerts@x.com" });
    expect(r.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(r.env.VAPID_PRIVATE_KEY).toBeUndefined();
    expect(r.warnings).toEqual(["Push alerts are off: VAPID_SUBJECT must start with mailto: or https:"]);
  });
  it("a bad APP_URL falls back with a warning", () => {
    const r = loadEnvSafe({ ...valid, APP_URL: "not a url" });
    expect(r.env.APP_URL).toBe("http://localhost:3000");
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/APP_URL/);
  });
  it("a complete, valid push group passes with no warnings", () => {
    const r = loadEnvSafe({ ...valid, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pk", VAPID_PRIVATE_KEY: "sk", VAPID_SUBJECT: "mailto:a@x.com" });
    expect(r.warnings).toEqual([]);
    expect(r.env.VAPID_PRIVATE_KEY).toBe("sk");
  });
  it("a missing required variable still throws with its name", () => {
    const rest = { ...valid, GROQ_API_KEY: undefined };
    expect(() => loadEnvSafe(rest)).toThrow("Invalid or missing environment variables: GROQ_API_KEY");
  });
  it("a required failure alongside a bad optional one still throws", () => {
    const rest = { ...valid, GROQ_API_KEY: undefined };
    expect(() => loadEnvSafe({ ...rest, VAPID_SUBJECT: "bad", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pk", VAPID_PRIVATE_KEY: "sk" })).toThrow(
      "Invalid or missing environment variables: GROQ_API_KEY",
    );
  });
  it("never puts a value in a warning", () => {
    const r = loadEnvSafe({ ...valid, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pk", VAPID_PRIVATE_KEY: "secret-value", VAPID_SUBJECT: "bad" });
    expect(r.warnings.join(" ")).not.toContain("secret-value");
    expect(r.warnings.join(" ")).not.toContain("bad\n");
  });
});
