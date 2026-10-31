-- Gives the seeded demo people their phone numbers on databases seeded before the new-number check.
-- Idempotent: only fills a missing number. Keep in step with DEMO_PHONES in src/server/demo.ts.
UPDATE users SET phone = '+1 (415) 555-0131' WHERE email = 'daniel.demo@trustcircle.example' AND phone IS NULL;--> statement-breakpoint
UPDATE users SET phone = '+1 (415) 555-0135' WHERE email = 'sarah.demo@trustcircle.example' AND phone IS NULL;--> statement-breakpoint
UPDATE users SET phone = '+1 (415) 555-0147' WHERE email = 'tom.demo@trustcircle.example' AND phone IS NULL;
