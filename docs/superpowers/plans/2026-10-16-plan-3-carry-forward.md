# Plan 3 carry-forward

Plan 3 (scam registry, meaning-based pattern matching, one-tap report, circle dashboard and trends) is complete on branch `plan-3-registry-patterns`. This note records decisions that changed or sharpened the plan, and follow-ups for later plans. Commits and tests are the source of truth for behaviour.

## Decisions

| Decision | Why | Cost if wrong |
|---|---|---|
| pgvector and a local `all-MiniLM-L6-v2` model replace Elastic (user decision) | An Elastic trial would expire before judging, and Elastic offers no prize | No Elastic in the sponsor list |
| Pattern threshold 0.35 | 2026-10-16 spike: reworded scams 0.42 to 0.46, genuine messages at most 0.27 | Measured on a small set; re-run the evaluation with the matcher on (Plan 5) |
| One canonical key per identifier. Links drop the scheme, `www.`, userinfo, query and fragment; an email is only a value with `@` and no `/` or `:` | Every written form of a number or link must meet in the registry | Two links that differ only after `?` count as one |
| The report to PayPal is a `mailto:` draft the user sends from their own email | Consent, and no invented scams sent to PayPal's real phishing desk | One more tap for the user |
| A report claims its row first; the registry and pattern store run only for the first claim | A double tap must not count twice | `patternId` is saved in a second step |
| Reports never put the reporter's own email, their circle's emails, previous payees or bare well-known domains into the registry | The registry holds scammer identifiers only; real domains must never become "confirmed scams" | A scammer who reuses a family member's address is not recorded |
| Pattern descriptions must pass `isAnonymous`: no digit runs, `@`, `$`, links, identifiers or capitalised words after the first | Names and company names must never reach the shared table | A two-sentence description is silently not stored |
| The embedding model and the Groq connection warm up at server start (`src/instrumentation.ts`); pattern matching times out after 3 seconds | The first message check after a restart timed out at 20 seconds | Under `next start` the server waits up to 30 seconds before taking requests |
| When the pattern signal raises a level over the AI, the matched pattern's scam type is kept instead of `unknown` | Reworded scams must show in trends | None |
| "Money protected" counts only payments stopped by a decision | A stopped scam is something the contact did | Undercounts if an expired hold was also a scam |
| Trends count registry report rows (one per identifier) | Demo scale | Bars are slightly inflated for multi-identifier reports |

## Open before merge (from the final review)

- `matchKeys` strips the userinfo before `?`, `#` or `\`. So `https://evil.example?@paypal.com` gets the key `paypal.com`. The report then drops it as a trusted domain, and a crafted scam link stays out of the registry. Fix in `src/domain/matchKeys.ts`: cut `[?#\\].*` (and treat `\` as `/`) before stripping userinfo, or parse with `new URL()`. Add tests for the three inputs.

## Follow-ups

Plan 4 (screens)
- A report button on the message-check result, opening the `mailtoUrl` and confirming "added to the shared list".
- Restyle the dashboard and trends pages with `DESIGN.md`.
  - At 390 px the To column is about 60 px; consider a card list on phones.
  - The trends table can flash its wide layout first.
  - Trends rows are a fixed 88 px and would clip a label of five or more lines.
- Before recording the demo, reset the dev database and run `npm run seed`, `npm run seed:patterns` and `npm run seed:history`. The dev database holds end-to-end rows with the sandbox grandson's email.

Plan 5 (deploy, README)
- Render health check grace period of at least 45 seconds for the warm-up. Cache the model in the build so the first boot does not download it.
- Run `npm run eval:live` with the pattern matcher on, and publish any change in false alarms on genuine payments.

Hardening, any time
- Registry entries cannot be removed or expire; a mistaken confirmation is permanent (spec 4.5 wording).
- Test gaps:
  - `mondayOf` and memory `weeklyCounts`;
  - the pending-void `blocked_by_contact` path;
  - a `setPattern` failure;
  - Close-focus return on the dashboard panel.
