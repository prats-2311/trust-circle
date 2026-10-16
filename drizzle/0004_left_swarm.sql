CREATE TYPE "public"."registry_source" AS ENUM('message_report', 'contact_block', 'real_person_denied');--> statement-breakpoint
CREATE TYPE "public"."registry_status" AS ENUM('unconfirmed', 'confirmed');--> statement-breakpoint
CREATE TABLE "registry_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier_type" text NOT NULL,
	"key" text NOT NULL,
	"scam_type" text NOT NULL,
	"status" "registry_status" DEFAULT 'unconfirmed' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"source" "registry_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scam_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"scam_type" text NOT NULL,
	"report_count" integer DEFAULT 1 NOT NULL,
	"embedding" vector(384) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scam_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"message_check_id" uuid NOT NULL,
	"pattern_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registry_reports" ADD CONSTRAINT "registry_reports_entry_id_registry_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."registry_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_reports" ADD CONSTRAINT "registry_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_message_check_id_message_checks_id_fk" FOREIGN KEY ("message_check_id") REFERENCES "public"."message_checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_pattern_id_scam_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."scam_patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registry_entries_key" ON "registry_entries" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "registry_reports_entry_reporter_source" ON "registry_reports" USING btree ("entry_id","reporter_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "scam_patterns_description" ON "scam_patterns" USING btree ("description");--> statement-breakpoint
CREATE INDEX "scam_patterns_embedding" ON "scam_patterns" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "scam_reports_check" ON "scam_reports" USING btree ("message_check_id");