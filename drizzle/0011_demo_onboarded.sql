-- Marks the seeded demo people as set up on databases seeded before demo people arrived set up.
-- Idempotent: only fills a missing time. Keep in step with DEMO_PERSONAS in src/server/demo.ts.
UPDATE users SET onboarded_at = now() WHERE email IN (
  'margaret.demo@trustcircle.example',
  'sarah.demo@trustcircle.example',
  'daniel.demo@trustcircle.example',
  'robert.demo@trustcircle.example',
  'priya.demo@trustcircle.example',
  'tom.demo@trustcircle.example'
) AND onboarded_at IS NULL;
