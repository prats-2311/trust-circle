import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Identifier, IdentifierType, Requester } from "@/domain/types";

export const presetEnum = pgEnum("preset", ["family", "business", "solo"]);
export const paymentStateEnum = pgEnum("payment_state", [
  "created", "approved", "authorised", "held", "released", "captured",
  "paid_out", "blocked", "expired", "voided", "payout_failed", "refunded",
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    preset: presetEnum("preset").notNull().default("family"),
    safeWordHash: text("safe_word_hash"),
    coolingOffHours: integer("cooling_off_hours").notNull().default(24),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("users_cooling_off_choice", sql`${t.coolingOffHours} in (12, 24, 48)`)],
);

export const trustLinks = pgTable(
  "trust_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id").notNull().references(() => users.id),
    contactId: uuid("contact_id").notNull().references(() => users.id),
    relationship: text("relationship").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trust_links_pair").on(t.senderId, t.contactId),
    check("trust_links_no_self", sql`${t.senderId} <> ${t.contactId}`),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey(),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  payee: text("payee").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  senderAnswer: text("sender_answer"),
  state: paymentStateEnum("state").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull(),
  scamType: text("scam_type").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
  impersonatedRequester: jsonb("impersonated_requester").$type<Requester>(),
  paypalOrderId: text("paypal_order_id"),
  authorizationId: text("authorization_id"),
  captureId: text("capture_id"),
  payoutBatchId: text("payout_batch_id"),
  refundId: text("refund_id"),
  authorisedAt: timestamp("authorised_at", { withTimezone: true }),
  coolingOffUntil: timestamp("cooling_off_until", { withTimezone: true }),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  fromState: paymentStateEnum("from_state"),
  toState: paymentStateEnum("to_state"),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationMethodEnum = pgEnum("verification_method", ["real_person", "official_routes", "safe_word", "memory_question"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "confirmed", "denied", "passed", "failed"]);
export const alertChannelEnum = pgEnum("alert_channel", ["in_app", "push", "email"]);
export const alertStatusEnum = pgEnum("alert_status", ["sent", "skipped", "failed"]);

export const messageChecks = pgTable("message_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  source: text("source").$type<"text" | "image" | "voice">().notNull(),
  text: text("text").notNull(),
  checked: boolean("checked").notNull(),
  level: riskLevelEnum("level").notNull(),
  scamType: text("scam_type").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
  identifiers: jsonb("identifiers").$type<Identifier[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id),
  method: verificationMethodEnum("method").notNull(),
  status: verificationStatusEnum("status").notNull(),
  targetContactId: uuid("target_contact_id").references(() => users.id),
  requesterName: text("requester_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientId: uuid("recipient_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  paymentId: uuid("payment_id").references(() => payments.id),
  verificationId: uuid("verification_id").references(() => verifications.id),
  channel: alertChannelEnum("channel").notNull(),
  status: alertStatusEnum("status").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const registryStatusEnum = pgEnum("registry_status", ["unconfirmed", "confirmed"]);
export const registrySourceEnum = pgEnum("registry_source", ["message_report", "contact_block", "real_person_denied"]);

/** Shared registry: scammer identifiers only, never message text or victim details. */
export const registryEntries = pgTable(
  "registry_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifierType: text("identifier_type").$type<IdentifierType>().notNull(),
    // canonicalKey() of the identifier, so every written form of a number or link meets here.
    key: text("key").notNull(),
    scamType: text("scam_type").notNull(),
    status: registryStatusEnum("status").notNull().default("unconfirmed"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("registry_entries_key").on(t.key)],
);

export const registryReports = pgTable(
  "registry_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").notNull().references(() => registryEntries.id),
    reporterId: uuid("reporter_id").notNull().references(() => users.id),
    source: registrySourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("registry_reports_entry_reporter_source").on(t.entryId, t.reporterId, t.source)],
);

/** Anonymised scam scripts with their meaning-vectors (all-MiniLM-L6-v2, 384 dimensions). */
export const scamPatterns = pgTable(
  "scam_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    description: text("description").notNull(),
    scamType: text("scam_type").notNull(),
    reportCount: integer("report_count").notNull().default(1),
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("scam_patterns_description").on(t.description),
    index("scam_patterns_embedding").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** A user's own drafted report to PayPal for one message check. */
export const scamReports = pgTable(
  "scam_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").notNull().references(() => users.id),
    messageCheckId: uuid("message_check_id").notNull().references(() => messageChecks.id),
    patternId: uuid("pattern_id").references(() => scamPatterns.id),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("scam_reports_check").on(t.messageCheckId)],
);

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // PayPal event id
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  result: text("result"), // "applied" | "ignored" | "failed:<ErrorName>"
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("push_subscriptions_user").on(t.userId)]);
