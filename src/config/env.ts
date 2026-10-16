import { z } from "zod";

// An empty value in an env file means "not set".
const withDefault = (d: string, schema: z.ZodString = z.string().min(1)) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.default(d));
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

// Opt-in flag: only the exact value "1" turns it on; anything else is treated as off.
const oneFlag = z.preprocess((v) => (v === "1" ? v : undefined), z.literal("1").optional());

const EnvSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_ENV: z.literal("sandbox"),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().url(),
  GROQ_API_KEY: z.string().min(1),
  GROQ_TEXT_MODEL: z.string().min(1),
  GROQ_VISION_MODEL: z.string().min(1),
  GROQ_GUARD_MODEL: withDefault("meta-llama/llama-prompt-guard-2-86m"),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(24),
  RESEND_API_KEY: optionalString,
  ALERT_FROM_EMAIL: withDefault("Trust Circle <onboarding@resend.dev>"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: withDefault("mailto:alerts@trustcircle.example", z.string().regex(/^(mailto:|https:)/)),
  PAYPAL_WEBHOOK_ID: optionalString,
  DEMO_DAILY_RESET: oneFlag,
  APP_URL: withDefault("http://localhost:3000", z.string().url()),
});

export type Env = z.infer<typeof EnvSchema>;

export interface EnvResult {
  env: Env;
  warnings: string[];
}

const VAPID_SUBJECT_RULE = /^(mailto:|https:)/;
const set = (v: string | undefined): v is string => v !== undefined && v !== "";

/**
 * Required variables throw. A broken optional setting never does: push is turned off or
 * the default is used, and a warning names the variable (never its value).
 */
export function loadEnvSafe(source: Record<string, string | undefined> = process.env): EnvResult {
  const warnings: string[] = [];
  const cleaned: Record<string, string | undefined> = { ...source };

  const pushVars = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;
  const publicKey = source.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = source.VAPID_PRIVATE_KEY;
  const subject = source.VAPID_SUBJECT;
  let pushProblem: string | null = null;
  if (set(subject) && !VAPID_SUBJECT_RULE.test(subject)) pushProblem = "VAPID_SUBJECT must start with mailto: or https:";
  else if (set(publicKey) !== set(privateKey)) pushProblem = "NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must both be set";
  if (pushProblem) {
    for (const name of pushVars) cleaned[name] = undefined;
    warnings.push(`Push alerts are off: ${pushProblem}`);
  }

  if (set(source.APP_URL) && !z.string().url().safeParse(source.APP_URL).success) {
    cleaned.APP_URL = undefined;
    warnings.push("APP_URL is not a valid URL, so http://localhost:3000 is being used");
  }

  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  return { env: parsed.data, warnings };
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return loadEnvSafe(source).env;
}
