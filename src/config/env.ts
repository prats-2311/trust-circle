import { z } from "zod";

// An empty value in an env file means "not set".
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const EnvSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_ENV: z.literal("sandbox"),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().url(),
  GROQ_API_KEY: z.string().min(1),
  GROQ_TEXT_MODEL: z.string().min(1),
  GROQ_VISION_MODEL: z.string().min(1),
  GROQ_GUARD_MODEL: z.string().min(1).default("meta-llama/llama-prompt-guard-2-86m"),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(24),
  RESEND_API_KEY: optionalString,
  ALERT_FROM_EMAIL: z.string().min(1).default("Trust Circle <onboarding@resend.dev>"),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  return parsed.data;
}
