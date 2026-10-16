CREATE TYPE "public"."alert_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('real_person', 'official_routes', 'safe_word', 'memory_question');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'confirmed', 'denied', 'passed', 'failed');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payment_id" uuid,
	"verification_id" uuid,
	"channel" "alert_channel" NOT NULL,
	"status" "alert_status" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"source" text NOT NULL,
	"text" text NOT NULL,
	"checked" boolean NOT NULL,
	"level" "risk_level" NOT NULL,
	"scam_type" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"identifiers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"method" "verification_method" NOT NULL,
	"status" "verification_status" NOT NULL,
	"target_contact_id" uuid,
	"requester_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "impersonated_requester" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "safe_word_hash" text;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_verification_id_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."verifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_checks" ADD CONSTRAINT "message_checks_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_target_contact_id_users_id_fk" FOREIGN KEY ("target_contact_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;