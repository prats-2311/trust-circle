import { createGroqJudge } from "@/ai/groqJudge";
import { loadEnv, type Env } from "@/config/env";
import { createDb } from "@/db/client";
import { createDrizzlePaymentRepo } from "@/payments/drizzlePaymentRepo";
import type { PaymentRepo } from "@/payments/paymentRepo";
import { createPaymentService } from "@/payments/paymentService";
import { createPayPalGateway } from "@/payments/paypalGateway";

type Container = { service: ReturnType<typeof createPaymentService>; repo: PaymentRepo; env: Env };
let container: Container | undefined;

export function getContainer(): Container {
  if (container) return container;
  const env = loadEnv();
  const { db } = createDb(env.DATABASE_URL);
  const repo = createDrizzlePaymentRepo(db);
  const service = createPaymentService({
    repo,
    gateway: createPayPalGateway({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET }),
    judge: createGroqJudge({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TEXT_MODEL }),
  });
  container = { service, repo, env };
  return container;
}
