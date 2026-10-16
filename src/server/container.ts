import { createAftercareService } from "@/aftercare/aftercareService";
import { runAftercareAgent } from "@/aftercare/aftercareAgent";
import { createPayPalReadOnlyToolkit, createReadOnlyToolRunner, invalidatePayPalReadOnlyToolkit } from "@/aftercare/tools";
import { groqToolChat } from "@/ai/groqClient";
import { keySet } from "@/domain/matchKeys";
import { createAlertService, type AlertService } from "@/alerts/alertService";
import { createDrizzleAlertRepo } from "@/alerts/drizzleAlertRepo";
import { createResendEmailSender } from "@/alerts/emailSender";
import { createGroqJudge } from "@/ai/groqJudge";
import { createGroqMessageJudge } from "@/ai/groqMessageJudge";
import { createGroqPatternDescriber } from "@/ai/patternDescriber";
import { createPromptGuard } from "@/ai/promptGuard";
import { createDrizzleCircleRepo } from "@/circle/drizzleCircleRepo";
import { loadEnvSafe, type Env } from "@/config/env";
import { createDb } from "@/db/client";
import { createDashboardService, type DashboardService } from "@/dashboard/dashboardService";
import { createDrizzleMessageRepo } from "@/messages/drizzleMessageRepo";
import { createMessageService, type MessageService } from "@/messages/messageService";
import { createDrizzlePaymentRepo } from "@/payments/drizzlePaymentRepo";
import type { CircleRepo } from "@/circle/circleRepo";
import type { PaymentRepo } from "@/payments/paymentRepo";
import { createPaymentService, type PaymentService, type PaymentServiceEvent } from "@/payments/paymentService";
import { createPayPalGateway, type PayPalGateway } from "@/payments/paypalGateway";
import { createDrizzleVerificationRepo } from "@/verification/drizzleVerificationRepo";
import { createVerificationService, type VerificationService } from "@/verification/verificationService";
import { getEmbedder } from "@/patterns/embedder";
import { createDrizzlePatternRepo } from "@/patterns/drizzlePatternRepo";
import { createPatternService, type PatternService } from "@/patterns/patternService";
import { createDrizzleRegistryRepo } from "@/registry/drizzleRegistryRepo";
import { createRegistryHooks } from "@/registry/hooks";
import { createRegistryService, type RegistryService } from "@/registry/registryService";
import { createDrizzleScamReportRepo } from "@/reports/drizzleScamReportRepo";
import { createReportService, type ReportService } from "@/reports/reportService";
import { createDrizzleSettingsRepo } from "@/settings/drizzleSettingsRepo";
import { createSettingsService, type SettingsService } from "@/settings/settingsService";
import { createDrizzlePushRepo } from "@/push/drizzlePushRepo";
import type { PushRepo } from "@/push/pushRepo";
import { createWebPushSender } from "@/push/pushSender";
import { createDrizzleWebhookRepo } from "@/webhooks/drizzleWebhookRepo";
import type { WebhookRepo } from "@/webhooks/webhookRepo";
import { createWebhookService, type WebhookService } from "@/webhooks/webhookService";
import { createPaymentEventHandler } from "./paymentEvents";

type Container = {
  env: Env;
  repo: PaymentRepo;
  circle: CircleRepo;
  service: PaymentService;
  messages: MessageService;
  alerts: AlertService;
  verification: VerificationService;
  registry: RegistryService;
  patterns: PatternService;
  reports: ReportService;
  dashboard: DashboardService;
  settings: SettingsService;
  push: PushRepo;
  gateway: PayPalGateway;
  webhooks: WebhookService;
  webhookRepo: WebhookRepo;
  aftercare: ReturnType<typeof createAftercareService>;
};
let container: Container | undefined;

export function getContainer(): Container {
  if (container) return container;
  const { env, warnings } = loadEnvSafe();
  for (const warning of warnings) console.warn("config", warning);
  const { db } = createDb(env.DATABASE_URL);
  const repo = createDrizzlePaymentRepo(db);
  const circle = createDrizzleCircleRepo(db);
  const guard = createPromptGuard({ apiKey: env.GROQ_API_KEY, model: env.GROQ_GUARD_MODEL });
  const messageRepo = createDrizzleMessageRepo(db);
  const registryRepo = createDrizzleRegistryRepo(db);
  const registry = createRegistryService({ repo: registryRepo });
  const hooks = createRegistryHooks(registry);
  // The registry is one signal among several: if it cannot be read, assessments go ahead without it.
  const registryLists = () =>
    registry.lists().catch((e: unknown) => {
      console.warn("registry unavailable", { error: e instanceof Error ? e.name : "unknown" });
      return { confirmed: [] as string[], unconfirmed: [] as string[] };
    });
  const patterns = createPatternService({ repo: createDrizzlePatternRepo(db), embed: getEmbedder() });
  const messages = createMessageService({
    repo: messageRepo,
    registry: () => registryLists(),
    patterns: patterns.match,
    judge: createGroqMessageJudge({ apiKey: env.GROQ_API_KEY, textModel: env.GROQ_TEXT_MODEL, visionModel: env.GROQ_VISION_MODEL }),
    guard,
  });
  const settings = createSettingsService({ repo: createDrizzleSettingsRepo(db) });
  const verificationRepo = createDrizzleVerificationRepo(db);
  const pushRepo = createDrizzlePushRepo(db);
  const alerts = createAlertService({
    repo: createDrizzleAlertRepo(db),
    users: circle,
    email: env.RESEND_API_KEY ? createResendEmailSender({ apiKey: env.RESEND_API_KEY, from: env.ALERT_FROM_EMAIL }) : undefined,
    push:
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { repo: pushRepo, send: createWebPushSender({ publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }) }
        : undefined,
    appUrl: env.APP_URL,
    // A verify request is only worth showing while the verification is pending and the payment is still held.
    // A hold alert is only worth showing while the payment is still held. Every other kind stays visible.
    isAlertOpen: async ({ kind, paymentId, verificationId }) => {
      if (kind === "verify_request") {
        if (!paymentId || !verificationId) return false;
        const [v, p] = await Promise.all([verificationRepo.get(verificationId), repo.get(paymentId)]);
        return v?.status === "pending" && p?.state === "held";
      }
      if (kind === "payment_held") {
        if (!paymentId) return false;
        return (await repo.get(paymentId))?.state === "held";
      }
      return true;
    },
  });
  // Payments and verification depend on each other through events, so the handler is bound once both exist.
  let onEvent: (e: PaymentServiceEvent) => Promise<void> = async () => {};
  const gateway = createPayPalGateway({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET });
  const service = createPaymentService({
    repo,
    gateway,
    judge: createGroqJudge({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TEXT_MODEL }),
    guard,
    linkedMessage: messages.linkedMessage,
    patterns: patterns.match,
    extraContext: async (senderId) => ({ flaggedPayees: await messages.flaggedPayees(senderId), registry: await registryLists(),
      circleLimitCents: (await settings.circleLimitCents(senderId)) ?? undefined,
    }),
    coolingOffMs: settings.coolingOffMs,
    onEvent: (e) => onEvent(e),
  });
  const verification = createVerificationService({
    verifications: verificationRepo,
    payments: repo,
    paymentOps: service,
    circle,
    alerts,
    onImpersonationConfirmed: hooks.onImpersonationConfirmed,
  });
  const reports = createReportService({
    messages: messageRepo,
    reports: createDrizzleScamReportRepo(db),
    registry,
    patterns,
    describe: createGroqPatternDescriber({ apiKey: env.GROQ_API_KEY, model: env.GROQ_TEXT_MODEL }),
    appUrl: env.APP_URL,
    // Contact details of the reporter and the people they know are never a scammer's.
    excludeKeys: async (reporterId) => {
      const emailOf = async (id: string) => (await circle.getUser(id))?.email;
      const members = await circle.contactsOf(reporterId);
      const emails = await Promise.all([reporterId, ...members.map((m) => m.contactId)].map(emailOf));
      const { previousPayees } = await repo.senderContextFacts(reporterId, new Date());
      return [...emails.filter((e): e is string => Boolean(e)), ...previousPayees];
    },
  });
  const dashboard = createDashboardService({ payments: repo, circle, registry: registryRepo });
  onEvent = createPaymentEventHandler({ circle, alerts, verification, registry: hooks });
  const webhookRepo = createDrizzleWebhookRepo(db);
  const webhooks = createWebhookService({
    repo: webhookRepo,
    payments: service,
    audit: ({ paymentId, action, detail }) =>
      paymentId ? repo.audit({ paymentId, actorId: null, action, fromState: null, toState: null, detail }) : Promise.resolve(),
    paymentExists: async (id) => (await repo.get(id)) !== null,
  });
  // The toolkit is heavy, so it loads on the first review, not at boot.
  const aftercare = createAftercareService({
    payments: repo,
    circle,
    registryConfirmed: async () => keySet((await registryLists()).confirmed),
    agent: async (input) =>
      runAftercareAgent(
        {
          chat: groqToolChat,
          apiKey: env.GROQ_API_KEY,
          model: env.GROQ_TEXT_MODEL,
          tools: createReadOnlyToolRunner(await createPayPalReadOnlyToolkit({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET }), {
            paymentIds: new Set(input.payments.map((p) => p.id)),
            orderIds: new Set(input.paypalOrderIds),
          }, { onUnauthorized: invalidatePayPalReadOnlyToolkit }),
        },
        input,
      ),
  });
  container = { aftercare, env, repo, circle, service, messages, alerts, verification, registry, patterns, reports, dashboard, settings, push: pushRepo, gateway, webhooks, webhookRepo };
  return container;
}
