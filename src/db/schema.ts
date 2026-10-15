import { check, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const presetEnum = pgEnum("preset", ["family", "business", "solo"]);
export const paymentStateEnum = pgEnum("payment_state", [
  "created", "approved", "authorised", "held", "released", "captured",
  "paid_out", "blocked", "expired", "voided", "payout_failed", "refunded",
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  preset: presetEnum("preset").notNull().default("family"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
