# Plan 5 carry-forward

Plan 5's code phase is complete on branch `plan-5-ship`. It covers:
- a safe boot-time config check;
- the eval re-run with the pattern matcher;
- verified PayPal webhooks;
- the thin aftercare agent;
- free-tier Render + Neon deploy plumbing (migrations, health check, daily demo reset, GitHub Actions cron);
- the README, architecture doc, video script and Devpost draft.

This note records the decisions that changed or sharpened the plan, and what is left for Phase 2 (deploy and submission). Commits and tests are the source of truth for behaviour.

## Decisions

| Decision | Why | Cost if wrong |
|---|---|---|
| `DEMO_DAILY_RESET` is an optional `"1"`-only flag in `EnvSchema`, like `PAYPAL_WEBHOOK_ID` | Config stays in one place | None |
| Webhooks: `webhook_events.attempts`. An unprocessed event can be claimed again. A handler error answers 500 for up to 5 attempts, then is recorded and answers 200. Processed events answer "duplicate". | Swallowing an error loses refunds. Handlers are idempotent and PayPal retries up to 25 times. | Up to 5 duplicate audit rows for a poisoned audit-only event |
| A failed payout on a payment still `captured` returns "deferred" and always answers 500 | PayPal retries after the sweep reaches `paid_out` | Extra retries |
| A verified but malformed event answers 200 "ignored" | It is signed, so retrying is pointless | None |
| The aftercare agent has only two tools, each scoped to the sender: `list_transactions` (filtered by `custom_id` to the sender's payment ids, reduced to {paymentId, date, amount, status}) and `get_order` (the sender's own order ids only) | Privacy across circles outranks agent breadth | A dispute opened in PayPal isn't visible to the agent (the webhook audit still records it) |
| The code's scam-payee finding always wins and carries `source: "code"`. When one exists, the summary is a code sentence. Only code findings offer a dispute draft. | Copy truth | Less model voice in the summary |
| The Agent Toolkit instance is cached for 1 hour and rebuilt on a 401. `@paypal/agent-toolkit` is pinned to exactly 1.11.0. | The toolkit keeps its token for the life of the instance | One rebuild an hour |
| Smoke requests use 90 s timeouts | A cold Render free start can take longer than 30 s | None |
| Screenshots use the invented payee `daniel.newphone@example.com`. `dashboard-aftercare.png` is a stubbed sample. | Copy truth: never show a real sandbox account as a scammer | None |
| The vision model is described as "Groq vision model (GROQ_VISION_MODEL)" without a name | The name isn't confirmed | Less specificity |
| The daily reset sweeps, voids every held payment, skips if any payment is held, approved, authorised, released, captured, payout_failed, blocked or expired, and otherwise resets in one transaction | No refund or authorisation is ever orphaned | The demo reset may skip a day |

## Open: Phase 2 (deploy, with the user)

Follow `docs/deploy.md`:
1. The user creates an empty **public** GitHub repo (public keeps Actions minutes free). I add the remote, verify `git ls-files` holds no secrets or private folders, and push after the user confirms.
2. The user sets up Neon, runs `npm run deploy:seed` in their own terminal, creates the Render Blueprint, registers the sandbox webhook, adds `PAYPAL_WEBHOOK_ID`, and switches on Transaction Search for the sandbox app.
3. The user adds the GitHub secret `CRON_SECRET` and the variable `APP_URL`.
4. Run both workflows by hand, then the smoke test against the Render URL, then one live sandbox story.
5. Take production screenshots. Replace `{{DEMO_URL}}`, `{{REPO_URL}}` and `{{VIDEO_URL}}` in `docs/submission.md`.

Check during deploy:
- A real sandbox payout event carries `resource.payout_item.sender_item_id`.
- Prefetch logs "model cached" and `.cache/transformers` survives from build to runtime.
- Render accepts blank `sync: false` values.
- The 5-minute keep-warm job uses about 744 of the 750 free hours a month, so no second free web service fits.
- Payments made before Plan 5 have no `custom_id` in PayPal, so aftercare can't match them.
- The Devpost claim "tested with real sandbox events" may only be made after the live story.

## Follow-ups

- Optional: lock the payments table inside the reset transaction to close the gap between the in-flight check and the reset (TOCTOU). It is rare on a demo.
- Optional: tune the pattern threshold (for example 0.35 → 0.40). The matcher drives 4 of the 5 false alarms (g11, g13, n07, n12), and g11 is held on that signal alone. Re-run `scripts/eval-live.ts` after any change.
- Name the vision model in the README once the user confirms `GROQ_VISION_MODEL`.
- Carried from Plan 4B: page-level tests for `EnableNotifications`, onboarding and settings rollback; the `NoticeLine` and `Field` accessibility hardening items.
