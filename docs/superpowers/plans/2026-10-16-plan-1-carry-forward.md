# Plan 1 carry-forward

Plan 1 (protected transfer core) is complete on branch `plan-1-core`. This note records the decisions made during the build that changed the plan, and the follow-ups later plans must pick up. Commits and tests are the source of truth for behaviour; this file explains why.

## Decisions that changed the plan

| # | Decision | Why |
|---|---|---|
| 4 | Groq text and vision model: `qwen/qwen3.8-27b` (env `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`) | Fastest valid JSON (275 ms) and read screenshot text exactly. `openai/gpt-oss-120b` works only with a protective system prompt and is about twice as slow. |
| 6 | PayPal order sets brand "Trust Circle", no shipping, user action "Continue"; no return or cancel URLs | Approval happens only in the JS SDK v6 popup. |
| 9 | When rules force a level above the AI's, reasons come from rule signals and scam type is `unknown`; AI reasons are trimmed, de-duplicated and capped at 3 | A held payment must explain itself, and AI text is untrusted. |
| 10, 13 | `PayPalError.uncertain` marks outcomes that may have moved money. Refund only when the first payout attempt is a definite 4xx (not 401, 408 or 429). Never compensate after an uncertain attempt; the sweep never compensates `captured` rows | A refund after a payout that landed pays twice. |
| 11, 14 | `expireStale` is a self-healing sweep: voids expired holds, retries voids, recovers stale `approved` and `authorised` rows into `held`, replays capture for `released`, retries payouts and refunds. Rows older than `STALE_MS` (5 min) only; each row isolated | Interrupted steps must finish without a person. |
| 12 | `RELEASE` (held or authorised to released) is the claim, applied before capture | A version bump without a state change did not stop a later reader; the probe showed capture and void both called. |
| 15, 17 | After a claim commits, errors become `PaymentPendingError` and return 202 "We're finishing this payment for you... Please don't send it again." | "Nothing has been sent, try again" after money moved invites a double payment. |
| 16 | API returns view DTOs (no PayPal IDs); demo login only for existing users | Least data to the browser; demo stays usable for judges. |

## Follow-ups for later plans

Plan 2
- Pre-claim uncertain PayPal errors (for example `createAuthorizeOrder`) currently get the 202 "we will finish it" copy, but nothing finishes a `created` payment. Map them to "Please try again in a moment."
- `step()` writes the transition then the audit row outside a transaction; an audit failure right after `RELEASE` escapes as a generic 500. Wrap it.
- Add an `assessPayment`-level prompt-injection test (level never below the rule level, at most 3 reasons).
- Add `meta-llama/llama-prompt-guard-2-86m` as an injection screen (spike: 0.9995 on injection text, 0.0004 on plain scam text). Consider `whisper-large-v3-turbo` for voicemail checks.

Plan 4
- `/api/demo/login` mints a session for any existing user id; demo ids are public in the bundle. Gate or replace with Auth.js. Sessions have no expiry.
- Screens must handle 202 `{ error, paymentId }` responses explicitly (the bare `/payments/[id]` release button drops the message).
- After an `/approved` failure, offer a direct "Try again" rather than reopening PayPal on an approved order.
- The sandbox popup still reads "Complete Purchase" although the order asks for user action "Continue". Verify `experience_context` in the popup flow.
- Replace the create-next-app `README.md` and `src/app/page.tsx`.

Plan 5
- `paid_out` is terminal, but a Payouts item can later fail or go unclaimed. Add `payout_pending` or a `paid_out` to `payout_failed` path with a migration, driven by webhooks.
- Reconcile "already done" PayPal answers once request-id retention lapses: `ORDER_ALREADY_AUTHORIZED` (GET the order for the authorization id) and a duplicate `sender_batch_id` (treat as paid).
- A stale `released` row whose capture gets a definite 4xx retries forever; add a terminal or alert path. Surface `needsAttention` rows and `sweep_failed` audits somewhere a person sees them.
- Log the cause (name, status, debugId) when mapping `PaymentPendingError`.
- Schedule `/api/cron/expire` (Render cron) and keep `CRON_SECRET` in the host's secret store.

Test hygiene, any time
- Exhaustive (state, event) matrix test; boundary tests for 3x median, even-length median, 2 vs 3 payments per hour; a `reasons` jsonb round-trip assertion; memory repo cloning inputs.
