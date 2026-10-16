# Plan 2 carry-forward

Plan 2 (message checker, real-person verification, alerts, evaluation set) is complete on branch `plan-2-messages-verification`. This note records decisions that changed or sharpened the plan, and follow-ups later plans must pick up. Commits and tests are the source of truth for behaviour.

## Decisions

| Decision | Why | Cost if wrong |
|---|---|---|
| URL identifiers are compared by host and path only (no scheme, `www.`, query or fragment) | Scammers vary links trivially; the registry must still match | Two links that differ only by query string count as the same link |
| `markRead` passes the timestamp as an ISO string cast to `timestamptz` | postgres-js cannot serialise a `Date` inside a Drizzle `sql` template | None |
| A verification follow-up failure (resolve, alert, report hook) is logged by name and never changes the result | After money may have moved, the API must never say "Nothing has been sent" | A verification row can stay `pending` after the payment settled |
| A failed safe-word or memory-question answer is final while the payment is held; a retry re-attempts the block | Spec 4.3: the challenge is one-way | None |
| An unchecked message check is returned with `level: null` and `scamType: "unknown"` | A screen that reads only the level must never show "looks fine" | Clients must handle `null` |
| Circle alerts after a hold are sent concurrently, after the real-person request | Email latency on the approval request | None |
| The held-payment alert carries name, amount and payee only; the sender's answer and the AI's reasons are on the contact's payment view | Keeps the sender's answer out of email bodies | The contact must open the app to read the reasons |

## Follow-ups

Plan 3 (registry)
- Wire `onImpersonationConfirmed` (verification service) to report the payee when the real person says "It wasn't me", and fill `registry` in `extraContext` and the message service.
- Extract scheme-less short links (`bit.ly/abc`) and letter phone numbers.
- The payment assessment does not run the injection screen on a linked message; screen it, or rely on the stored check's verdict.

Plan 4 (screens, PWA)
- Push is the third alert channel in `alertService.notify`.
- Screens must handle `level: null` (unchecked) on message checks and the `VerificationStage` union, including `resolved`/`failed` after a wrong answer.
- Tell the sender and circle when a challenge fails. The matched contact currently gets both `verify_request` and `payment_held`; merge or de-duplicate.
- `emit` is still awaited on the approval request; with email enabled the real-person request can add up to 8 seconds.
- A missed `verify_request` alert is never re-sent (the challenge opens after 10 minutes as the fallback).

Plan 5 (README, deploy)
- The live evaluation (`docs/eval/results.md`) had 2 of 60 cases the AI could not check (p16, g14), so they count as fail-closed outcomes. Add one retry per unchecked case, record the cause, rerun, and say so in the README.
- Log guard failures (by error name) so a Prompt Guard outage is visible.

Hardening, any time
- `startForHeld` and two concurrent `challenge()` calls are check-then-insert; a partial unique index on `verifications(payment_id)` per method would close both.
- The upload size check relies on `content-length`; stream with a byte counter if exposed beyond sign-in.
- Test gaps: route-level 401 and non-uuid tests, the sweep's `authorised`-phase held event, image check with AI failure, `history()`.
