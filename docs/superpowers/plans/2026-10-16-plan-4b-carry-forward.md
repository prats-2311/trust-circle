# Plan 4B carry-forward

Plan 4B is complete on branch `plan-4b-pwa-push`. It covers:
- presets and settings;
- the Business and Solo personas;
- outcome alerts;
- web push and the installable app;
- onboarding;
- the verified landing statistic;
- a polish pass;
- the axe accessibility pass.

This note records the decisions that changed or sharpened the plan, and what is left for Plan 5. Commits and tests are the source of truth for behaviour.

## Decisions

| Decision | Why | Cost if wrong |
|---|---|---|
| The held screen shows two different times: the hold ends after 72 hours, and the sender can release the payment after the cooling-off (24 hours by default). | They are separate rules in spec 4.4. Both are true. | Two dates may confuse some readers |
| Cooling-off is 12, 24 or 48 hours. It is read once, when the hold starts, so changing settings never moves an existing hold. | Spec 4.4 caps it at 72 hours, which is the auto-void. A choice is easier than free input. | Less flexibility |
| The circle limit comes from the preset: Family over $500, Business over $2,500, Solo none. Settings shows it and can't change it. | It feeds the existing `OVER_CIRCLE_LIMIT` signal | The circle can't edit the limit |
| `payment_update` tells the circle when the real person says no, when the sender cancels, or when a check fails. It tells the sender when the circle stops a payment. A contact who gets `verify_request` doesn't also get `payment_held`. | Copy truth: "Sarah has been told" and "We've told Margaret" are now backed by real alerts | More alerts per outcome |
| Push and email are sent at the same time, each with a 5-second timeout. A push failure is recorded, never thrown. A 404 or 410 deletes the subscription. | Spec 11, and the Plan 2 latency item | A slow provider is cut off at 5 seconds |
| A push endpoint moves to another user only when its keys match the stored ones. Otherwise the request gets a 409. | Stops one user taking over another's device | A reinstalled browser must turn alerts off and on again |
| Push endpoints must be in canonical form: `endpoint === url.href`, a plain hostname of at most 253 characters with labels of at most 63, no userinfo, no port. The host must be on the allow-list: FCM, Mozilla, `web.push.apple.com`, `*.push.apple.com`, `*.notify.windows.com`. The check runs on save, again at send time (a failure counts as a 410), and in `demo:reset`. | It closes a parser difference that let disguised endpoints relay to any host (WHATWG vs legacy `url.parse` in web-push). 82+ adversarial inputs were probed. | An unusual browser push service is refused |
| "Alerts are on" is shown only after the server accepts the subscription. A 409 hides the "Turn on" action and never unsubscribes. `serviceWorker.ready` times out after 5 seconds. A failed config fetch shows an error with "Try again". | Copy truth, and no dead UI | One extra POST each time the card loads |
| The notification click target goes through `safeTarget`, which allows only a same-origin path that doesn't start with `//`. `sw.js` keeps a copy, and a drift test pins the two together. | No open redirect | None |
| Signing out unsubscribes the device as a best effort. | A signed-out user's alerts shouldn't reach the lock screen | Switching personas means turning alerts on again |
| Onboarding has four steps (preset, circle, safe word, alerts). It uses neutral safe-word wording for every preset. "Invite someone" opens a `mailto:`. | No sign-up in demo mode, and no invented invite state | Margaret no longer sees the word "family" |
| The landing page says: "In 2025, people 60 and over reported losing $7.7 billion to online fraud." Source: FBI IC3 2025 Internet Crime Report (PDF, published April 2026), p. 44 and p. 7. The paragraph next to it says "Many scams…" | Verified primary source. Investment fraud is the largest share, so the page doesn't attribute the total to impersonation. | None |
| One en-US date formatter (`src/ui/format.ts`) | 4A mixed en-GB and en-US formats | US style for every reader |
| `demo:reset` no longer uses CASCADE. It keeps users, trust links, patterns and push subscriptions, and resets onboarding, cooling-off and presets. | Safer resets | None |

## Open: first items for Plan 5

- Three lines promise email even though email isn't set up in the demo:
  - `notificationSupport.ts`, the "on" state: "We'll alert you here and by email."
  - `EnableNotifications.tsx`: `TURN_ON_FAILED`
  - the onboarding alerts step: "…and by email too."
- "Your family's safe word" and the "Family safe word" settings title appear for every preset, in:
  - `screen.ts:79`
  - `verificationService.ts:32`
  - `settings/page.tsx:135`
- Before recording the demo video, re-shoot the final screenshot set on a production build (`next build && next start`) so the dev "N" badge doesn't appear.
- To turn push on, the user runs `npm run vapid:keys` and pastes the keys into `.env.local` (and later into Render's secrets).

## Follow-ups

### Plan 5: deploy, README, video
- Keep `E2E_ALLOW_RESET` unset on Render. The reset guard already blocks non-local databases.
- An approved, released or expired hold sends the circle no update. Add `payment_update` reasons for these.
- If reading cooling-off fails after authorisation, fall back to 24 hours. Today it gives a 202 and the sweep recovers.

### Tests worth adding
- Page-level tests for:
  - the `EnableNotifications` 409, status 0 and conflict paths;
  - onboarding `?step=`, a failed save, and settings rollback;
  - the `SignOutButton` failure path;
  - report re-tap;
  - the disabled textarea.
- An e2e test for the `Field` error path (`aria-invalid` and the description).
- Sweep paths that use `coolingOffMs`, and the container's `circleLimitCents` wiring.
- A 195 px reflow check instead of a root font-size zoom.

### Hardening, any time
- `NoticeLine` changes its role from status to alert when an error arrives. Keep two regions.
- `Field`'s `cloneElement` overwrites a child's own `aria-describedby`.
- The device limit check isn't atomic.
- The 503 gate repeats the container's "push configured" logic.
- `verificationNotice` compares names rather than ids.
- `resolve()` runs before `tellCircle` in `respond(not_me)`.
- One `repo.get` runs per `payment_held` row in `alerts.list`.
- The manifest theme colour (evergreen) differs from the viewport colour (ground).
- Onboarding has no visible exit link, and the home safe-word row has no chevron.
