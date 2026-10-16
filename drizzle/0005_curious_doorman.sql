ALTER TABLE "users" ADD COLUMN "cooling_off_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cooling_off_choice" CHECK ("users"."cooling_off_hours" in (12, 24, 48));