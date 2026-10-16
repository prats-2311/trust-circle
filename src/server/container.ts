import { createAlertService, type AlertService } from "@/alerts/alertService";
import { createDrizzleAlertRepo } from "@/alerts/drizzleAlertRepo";
import { createResendEmailSender } from "@/alerts/emailSender";
import { createGroqJudge } from "@/ai/groqJudge";
import { createGroqMessageJudge } from "@/ai/groqMessageJudge";
import { createPromptGuard } from "@/ai/promptGuard";
import { createDrizzleCircleRepo } from "@/circle/drizzleCircleRepo";
import { loadEnv, type Env } from "@/config/env";
import { createDb } from "@/db/client";
import { createDrizzleMessageRepo } from "@/messages/drizzleMessageRepo";
import { createMessageService, type MessageService } from "@/messages/messageService";
import { createDrizzlePaymentRepo } from "@/payments/drizzlePaymentRepo";
import type { PaymentRepo } from "@/payments/paymentRepo";
import { createPaymentService, type PaymentService, type PaymentServiceEvent } from "@/payments/paymentService";
import { createPayPalGateway } from "@/payments/paypalGateway";
import { createDrizzleVerificationRepo } from "@/verification/drizzleVerificationRepo";
import { createVerificationService, type VerificationService } from "@/verification/verificationService";
import { createPaymentEventHandler } from "./paymentEvents";

type Container = {
  env: Env;
  repo: PaymentRepo;
  service: PaymentService;
  messages: MessageService;
  alerts: AlertService;
  verification: VerificationService;
};
let container: Container | undefined;

export function getContainer(): Container {
  if (container) return container;
  const env = loadEnv();
  const { db } = createDb(env.DATABASE_URL);
  const repo = createDrizzlePaymentRepo(db);
  const circle = createDrizzleCircleRepo(db);
  const guard = createPromptGuard({ apiKey: env.GROQ_API_KEY, model: env.GROQ_GUARD_MODEL });
  const messages = createMessageService({
    repo: createDrizzleMessageRepo(db),
    judge: createGroqMessageJudge({ apiKey: env.GROQ_API_KEY, textModel: env.GROQ_TEXT_MODEL, visionModel: env.GROQ_VISION_MODEL }),
    guard,
  });
  const alerts = createAlertService({
    repo: createDrizzleAlertRepo(db),
    users: circle,
    email: env.RESEND_API_KEY ? createResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.ALERT_FROM_EMAIL }) : undefined,
    appUrl: env.APP_URL,
  });
  // Payments and verification depend on each other through events, so the handler is bound once both exist.
  let onEvent: (e: PaymentServiceEvent) => Promise<void> = async () => {};
  const service = createPaymentService({
    repo,
    gateway: createPayPalGateway({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET }),
    judge: createGroqJudge({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TEXT_MODEL }),
    guard,
    linkedMessage: messages.linkedMessage,
    extraContext: async (senderId) => ({ flaggedPayees: await messages.flaggedPayees(senderId), registry: { confirmed: [], unconfirmed: [] } }),
    onEvent: (e) => onEvent(e),
  });
  const verification = createVerificationService({ verifications: createDrizzleVerificationRepo(db), payments: repo, paymentOps: service, circle, alerts });
  onEvent = createPaymentEventHandler({ circle, alerts, verification });
  container = { env, repo, service, messages, alerts, verification };
  return container;
}
