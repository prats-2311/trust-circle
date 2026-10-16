# Plan 4B: Presets, Onboarding, PWA and Push, and the Accessibility Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the product side of Trust Circle:
- truthful copy everywhere;
- presets that change thresholds and wording;
- Business and Solo demo personas;
- the circle told about every outcome;
- web push with an installable app;
- onboarding and settings;
- the final landing page with a verified statistic;
- a polish pass;
- an axe-checked accessibility pass over every screen.

**Architecture:**
- **Settings:** per-user settings (preset, cooling-off hours, circle limit, onboarded) live on `users`. A small `settingsService` reads them and feeds the payment service: the cooling-off length and the existing, unused `circleLimitCents` risk signal.
- **Push:** a third alert channel. `push_subscriptions` rows are sent through an injected `PushSender` (`web-push` in production). Push and email run side by side with timeouts, and a delivery failure is recorded, never thrown.
- **PWA:** a static `public/sw.js` service worker, `app/manifest.ts`, and icons rendered from one SVG mark.
- **UI:** new screens reuse the `src/ui` kit and the Plan 4A patterns.

**Tech Stack:**
- As Plans 1 to 4A.
- New: `web-push` 3.6.7, `@types/web-push` 3.6.4 (dev) and `@axe-core/playwright` (dev).

**Spec:** `docs/superpowers/specs/2026-10-12-trust-circle-design.md`. The relevant sections are:
- 3 (presets);
- 4.4 (configurable cooling-off);
- 5 (PWA, web-push, "email always alongside push");
- 6 (the circle limit signal);
- 10 (onboarding: connect PayPal, invite a contact, set a safe word, install and allow notifications);
- 10.1 (design bar and review gate);
- 11 ("push not delivered: email is always sent as well").

Earlier follow-ups:
- `docs/superpowers/plans/2026-10-16-plan-4a-carry-forward.md` (the "Open" items and the Plan 4B follow-ups);
- `docs/superpowers/plans/2026-10-16-plan-2-carry-forward.md` (the Plan 4 items).

**Design source:**
- `DESIGN.md` and `docs/design/concepts/*.dc.html`;
- `OnboardingSafeWord.dc.html` is the onboarding concept.

Screens without a concept follow the same tokens, the kit, and the nearest concept's layout.

**Research notes used by this plan** (kept in the session scratchpad; the facts are copied into the tasks):
- Next 16 PWA guide: `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.
- `web-push`: 404 and 410 `statusCode` mean the subscription is gone. It runs on the Node runtime only, and `userVisibleOnly: true` is required.

## Scope rulings (plan rulings, 2026-10-16)

| Ruling | Why | Cost if wrong |
|---|---|---|
| Demo mode still has no sign-up. Onboarding runs for a demo persona and changes that persona's settings. `demo:reset` puts Margaret back to "not onboarded" with no safe word. | User decision in 4A (demo mode only) | Judges can't create their own account |
| Onboarding's "invite a contact" step shows the seeded circle and does not invent invites. Its copy says the demo circle is already set up, and "Invite someone" opens a `mailto:` with the app link. | No real accounts can join in demo mode. A fake "invited" state would be a false claim. | No live invite flow |
| "Connect PayPal" is an explanation line, not an OAuth step: "You approve every payment in PayPal's own window. We never see your PayPal password." | Every payment already goes through PayPal approval (sandbox) | None |
| Cooling-off is a choice of 12, 24 or 48 hours (default 24). Each preset sets the default and the sender can change it in settings. | The spec says "configurable, never more than 72". 72 equals the auto-void, so a 72-hour cooling-off could never be used. A choice is easier than free input for older users. | Less flexibility |
| The circle limit comes only from the preset: Family $500, Business $2,500, Solo none. It is shown in settings and cannot be edited there. | It feeds the existing `OVER_CIRCLE_LIMIT` signal (spec 6). An edit screen is not needed for the demo. | The circle can't change the limit |
| A setting change never alters a payment that is already held: `coolingOffUntil` is fixed when the hold starts. | Predictable holds | None |
| Two new demo personas: Priya (Business; her accountant is Tom) and Tom. Robert becomes the Solo persona. They are listed under "Other demo accounts". | Spec 3: Business is the 15-second second scenario; Solo is supported | Two more seeded users |
| One new alert kind, `payment_update`, with a `reason`. It tells the circle when the real person says no, when the sender cancels, and when a check fails. It tells the sender when a circle member stops the payment. This restores the concept lines "Sarah has been told" and "We've told Margaret". | 4A removed those lines because nobody was alerted. Plan 2 asked for the circle to hear about a failed challenge. | More alerts per outcome |
| A contact who gets a `verify_request` for a payment does not also get `payment_held` for it. | Plan 2 carry-forward: de-duplicate | None |
| Push and email are sent concurrently, each with a 5-second timeout, after the in-app row. | Plan 2: alert latency held up the approval request | A slow email provider is cut off at 5 seconds and recorded as failed |
| Push needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. Without them the push channel is "skipped" and the UI explains that notifications aren't set up on this server. `npm run vapid:keys` prints a new key pair for the user to paste into `.env.local` themselves. | Secrets never go through an agent | Push is off until the user adds keys |
| Dates use one formatter module (`src/ui/format.ts`, en-US): "Friday, Oct 16" and "1:59 PM". | Consistency: 4A mixed en-GB and en-US | US style for every reader |
| The landing statistic is the verified figure in Task 8, with its source linked. | Global constraint since Plan 1 | None |

## Global Constraints

- Everything in Plans 1 to 4A's Global Constraints still applies:
  - strict TypeScript;
  - integer cents;
  - sandbox only;
  - the AI may raise a level, never lower it;
  - secrets only in `.env.local` (agents never open, print, edit or stage it);
  - `isUuid` guards ids;
  - nothing private is logged;
  - no browser dialogs.
- **Money safety:**
  - the claim happens before PayPal;
  - an error after the claim gives 202 pending;
  - never "Nothing has been sent" after money may have moved;
  - an alert or push failure never changes a payment outcome and never throws out of `notify`.
- **Copy truth:**
  - copy never claims something that didn't happen;
  - every name shown is the right person;
  - "has been told" appears only when an alert was really sent to that person.
- **Design rules (spec 10, 10.1, `DESIGN.md`):**
  - body text at least 16 px; primary actions at least 56 px; tap targets at least 44 px;
  - WCAG 2.1 AA, with focus visible;
  - status is a word plus an icon;
  - one accent (evergreen); held blue only for holds; blocked red only for stopping actions;
  - Phosphor icons only (`@phosphor-icons/react/dist/ssr`, names ending in `Icon`);
  - no gradients, glassmorphism or emoji;
  - motion only to explain, and none under `prefers-reduced-motion`;
  - designed loading, empty and error states.
- Pages work at 390 px and 1280 px wide with no horizontal scroll.
- Calm copy that never blames the sender. Use the words given in each task verbatim.
- Never stage `.env.local`, `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`. Never write screenshots inside the repo; they go to the session scratchpad under `shots/task-N/`.
- `next dev` may rewrite `AGENTS.md`. Restore it with `git checkout -- AGENTS.md`.
- **Commits:** commit after every task, using Conventional Commits. Subagents end the message with:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```
- **Commands:**

  | Purpose | Command |
  |---|---|
  | Unit tests | `npm test` |
  | Integration tests (Postgres via `docker compose up -d`) | `npm run test:int` |
  | Type check | `npm run typecheck` |
  | Lint | `npm run lint` |
  | End to end (serial, one worker, `globalSetup` runs `demo:reset` locally) | `npx playwright test <file>` |
  | Create a migration | edit `src/db/schema.ts`, then `npm run db:generate` |
  | Apply migrations | `npm run db:migrate` |

- **Screen review gate:** every task that builds or changes a screen ends with screenshots at 390 × 844 and 1280 × 800, which the implementer compares with the concept or the nearest concept. Stub states with Playwright `page.route` where live data can't reach them.

## Review Focus

1. **Push failure never breaks an alert or a payment.** A push send that throws, times out or returns 404/410 still leaves the in-app row and the email attempt recorded. A 404 or 410 deletes that subscription. `notify` never rejects. (Pinned in Task 5 by `alertService` tests with a throwing, hanging and 410 sender.)
2. **A notification click opens only our own pages.** The service worker opens `data.url` only when it is a same-origin path starting with `/`. Anything else opens `/`. (Pinned in Task 6 by the `safeTarget` unit test and the e2e push check.)
3. **A settings change mid-hold doesn't move an existing hold.** Changing cooling-off after a payment is held leaves its `coolingOffUntil` as it was. Only new holds use the new hours. (Pinned in Task 2 by a `paymentService` test.)
4. **Unsupported or refused notifications show a clear explanation, never a dead button.** This covers:
   - no `serviceWorker` or `PushManager`;
   - an iPhone that isn't installed to the home screen;
   - permission denied;
   - a server with no VAPID key.

   Each gets its own message. (Pinned in Task 6 by `notificationSupport` unit tests.)
5. **Onboarding can be skipped, left and resumed.**
   - Skipping the safe word leaves the memory question in place.
   - Coming back starts at the first unfinished step.
   - Choosing the same preset again doesn't reset a cooling-off the user changed.
   - "Finish" marks the user onboarded once.

   (Pinned in Task 2 by `settingsService` tests and in Task 7 by `onboardingStep` tests.)

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/dashboard/dashboardService.ts`, `src/app/circle/reviewCopy.ts`, `src/app/send/riskScreen.ts`, `src/app/payments/[id]/screen.ts`, `PaymentScreens.tsx` | Truthful leftover copy | 1 |
| `src/db/schema.ts`, `drizzle/0005_*`, `src/settings/*`, `src/payments/paymentService.ts`, `src/server/container.ts`, `src/app/api/me/*` | Settings, presets, cooling-off, circle limit | 2 |
| `src/server/demo.ts`, `scripts/seed.ts`, `scripts/seed-demo-history.ts`, `scripts/demo-reset.ts`, `src/app/DemoButtons.tsx` | Priya, Tom, Solo Robert | 3 |
| `src/alerts/*`, `src/server/paymentEvents.ts`, `src/verification/verificationService.ts`, `src/payments/paymentService.ts` | `payment_update` alerts, de-duplication, closed alerts dropped | 4 |
| `src/db/schema.ts`, `drizzle/0006_*`, `src/push/*`, `src/alerts/alertService.ts`, `src/app/api/push/*`, `src/config/env.ts`, `scripts/vapid-keys.ts` | Push channel and subscriptions | 5 |
| `src/app/manifest.ts`, `public/sw.js`, `public/icons/*`, `src/app/apple-icon.png`, `scripts/make-icons.ts`, `next.config.ts`, `src/ui/notificationSupport.ts`, `src/ui/EnableNotifications.tsx`, `src/app/ServiceWorker.tsx` | Installable app and notification opt-in | 6 |
| `src/app/onboarding/*`, `src/app/settings/*`, `src/app/home/page.tsx` | Onboarding and settings screens | 7 |
| `src/app/page.tsx` | Verified statistic, final landing | 8 |
| `src/ui/format.ts` and the screens listed in Task 9 | Polish pass | 9 |
| `src/app/layout.tsx`, `src/ui/*`, `e2e/a11y.spec.ts` | Accessibility pass, axe, final screenshot set | 10 |

---

### Task 1: Truthful leftover copy

**Files:**
- Modify: `src/dashboard/dashboardService.ts`, `src/dashboard/dashboardService.test.ts`
- Modify: `src/app/circle/reviewCopy.ts`, `src/app/circle/reviewCopy.test.ts`
- Modify: `src/app/send/riskScreen.ts`, `src/app/send/riskScreen.test.ts`
- Modify: `src/app/payments/[id]/screen.ts`, `src/app/payments/[id]/screen.test.ts`, `src/app/payments/[id]/PaymentScreens.tsx`
- Modify: `src/app/circle/payments/[id]/page.tsx` (verification note)

**Interfaces:**
- Consumes: `closedCopy(paymentState, stage, senderName)` and `verificationNotice(...)` (both in `reviewCopy.ts`); `riskScreen(level, { circleName })`; `screenCopy(kind, d)`.
- Produces:
  - `riskScreen(level, opts: { circleName: string | null; coolingOffHours: number })`. The new option replaces the hard-coded 24.
  - `screenCopy` for `held` takes `d.circleNames: string[]` and `d.coolingOffHours: number`.
  - `circleNamesText(names: string[]): string` in `src/app/payments/[id]/screen.ts`.

- [ ] **Step 1: Write the failing tests**

`src/dashboard/dashboardService.test.ts`: `payout_failed` now gives the label "Being returned" (tone `caution`), matching Margaret's home. Change the existing row that expects "Refunded" for `payout_failed`, and keep `refunded` → "Refunded".

`src/app/circle/reviewCopy.test.ts`: add `closedCopy` rows. `stage` is `null` unless stated.

| `paymentState` | stage | lead |
|---|---|---|
| `refunded` | none | "It couldn't be delivered, so PayPal returned the money to ${senderName}." |
| `payout_failed` | none | "It couldn't be delivered, so the money is on its way back to ${senderName}." |
| `created` | none | "${senderName} didn't approve it in PayPal, so nothing was sent." |
| `approved`, `authorised`, `released`, `captured` | none | "It's going through PayPal now." |
| `blocked`, `voided`, `expired` | none | "It was stopped, and the money stayed in ${senderName}'s account." (unchanged) |
| any | resolved failed | "The caller couldn't pass the check, so the payment was stopped." (unchanged) |
| any | resolved denied | the existing denied lead (unchanged) |
| any | resolved confirmed | "This payment has already gone through." (unchanged) |
| `paid_out` | none | "This payment has already gone through." (unchanged) |

Order of precedence: a resolved stage wins over the state rows.

`reviewCopy.test.ts` for `verificationNotice`. It gains a `viewerName` argument: `verificationNotice(stage, senderName, viewerName)`. When the stage's `contactName === viewerName`, the waiting text is "We asked you at {time}. Answer from your circle page." instead of "We asked {name}…".

`src/app/send/riskScreen.test.ts`:
- high with no circle and `coolingOffHours: 12`: continue label "Continue, and hold it for 12 hours".
- holdNote with a circle (Sarah, 24): "If you continue, PayPal holds the money. Sarah can approve or stop it. If nobody decides, you can release it yourself after 24 hours."
- holdNote with no circle (48): "If you continue, PayPal holds the money for 48 hours. After that you can release it yourself."

`src/app/payments/[id]/screen.test.ts`:
- `circleNamesText([])` is "Your circle".
- `circleNamesText(["Sarah"])` is "Sarah".
- `circleNamesText(["Sarah","Daniel"])` is "Sarah and Daniel".
- `circleNamesText(["A","B","C"])` is "A, B and C".
- `screenCopy("held", { …, circleNames: ["Sarah","Daniel"], coolingOffHours: 24 })` has the lead "Sarah and Daniel can approve or stop this payment. If nobody decides, you can release it yourself after 24 hours."

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/dashboard src/app/circle src/app/send src/app/payments`
Expected: FAIL on the new rows.

- [ ] **Step 3: Implement**

- **`dashboardService.ts`:** map `payout_failed` to `{ label: "Being returned", tone: "caution" }`.
- **`reviewCopy.ts`:**
  - Extend `closedCopy` with the rows above.
  - Add the `viewerName` parameter to `verificationNotice`. The review page passes `/api/me` `displayName`; it already loads `/api/me` for the sign-in check, so if it doesn't, fetch it once.
- **`riskScreen.ts`:**
  - Use `coolingOffHours` in place of the literal 24.
  - Write the holdNote as tabled above.
  - `src/app/send/page.tsx` passes `coolingOffHours` from `/api/me`. That field arrives in Task 2; until then, default to 24 when it is missing (`me.coolingOffHours ?? 24`).
- **`screen.ts`:**
  - Add `circleNamesText`.
  - The `held` lead uses all circle names and the hours.
- **`PaymentScreens.tsx`:**
  - The held timeline row 2 reads `${circleNamesText(names)} ${names.length > 1 ? "have" : "has"} been asked`, with the sub-line "They can approve or stop it".
  - The "Releasing it yourself opens …" fine print stays.
  - Names come from `/api/me` `circle`.
  - Hours come from `coolingOffUntil - authorisedAt`, as today. Pass `Math.round(span / HOUR)` into `screenCopy`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Screenshots and commit**

Re-shoot the held payment screen and Sarah's closed review (refunded and payout_failed stubs) at both widths.

```bash
git add src/dashboard src/app/circle src/app/send src/app/payments
git commit -m "fix: say what really happened on closed, refunded and held payments"
```

---

### Task 2: Settings and presets

**Files:**
- Modify: `src/db/schema.ts`; create `drizzle/0005_*.sql` with `npm run db:generate`
- Create: `src/settings/presets.ts`, `src/settings/presets.test.ts`, `src/settings/settingsRepo.ts`, `src/settings/drizzleSettingsRepo.ts`, `src/settings/drizzleSettingsRepo.int.test.ts`, `src/settings/settingsService.ts`, `src/settings/settingsService.test.ts`
- Modify: `src/payments/paymentService.ts`, `src/payments/paymentService.test.ts`, `src/server/container.ts`
- Create: `src/app/api/me/settings/route.ts`, `src/app/api/me/settings/route.test.ts`
- Modify: `src/app/api/me/route.ts` (and its test, if it has one)
- Modify: `scripts/demo-reset.ts`

**Interfaces:**
- Consumes: `Preset` from `src/domain/types.ts`; `ExtraContext.circleLimitCents` and `COOLING_OFF_MS` from `paymentService.ts`; `VerificationInputError` → 400 via `errorResponse`.
- Produces:
  ```ts
  // src/settings/presets.ts
  export const COOLING_OFF_CHOICES = [12, 24, 48] as const;
  export type CoolingOffHours = (typeof COOLING_OFF_CHOICES)[number];
  export interface PresetInfo {
    label: string;             // "Family" | "Business" | "Just me"
    description: string;       // shown on the preset choice
    circleWord: string;        // "your family" | "your business contacts" | "you"
    circleLimitCents: number | null;
    defaultCoolingOffHours: CoolingOffHours;
  }
  export const PRESETS: Record<Preset, PresetInfo>;
  export function isCoolingOffHours(x: unknown): x is CoolingOffHours;

  // src/settings/settingsRepo.ts
  export interface UserSettings { preset: Preset; coolingOffHours: CoolingOffHours; onboardedAt: Date | null }
  export interface SettingsRepo {
    get(userId: string): Promise<UserSettings | null>;
    update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings | null>;
  }
  export function createMemorySettingsRepo(seed?: Record<string, UserSettings>): SettingsRepo;

  // src/settings/settingsService.ts
  export class SettingsInputError extends Error {}
  export function createSettingsService(deps: { repo: SettingsRepo; now?: () => Date }): {
    get(userId: string): Promise<UserSettings & { circleLimitCents: number | null }>;
    choosePreset(userId: string, preset: Preset): Promise<UserSettings>;
    setCoolingOff(userId: string, hours: number): Promise<UserSettings>;
    finishOnboarding(userId: string): Promise<UserSettings>;
    coolingOffMs(userId: string): Promise<number>;
    circleLimitCents(userId: string): Promise<number | null>;
  };
  ```
  - `PUT /api/me/settings` accepts `{ preset?, coolingOffHours?, onboarded?: true }` and returns the settings view.
  - `GET /api/me` adds `preset`, `coolingOffHours`, `circleLimitCents` and `onboarded: boolean`.
  - `createPaymentService` gains the dependency `coolingOffMs?: (senderId: string) => Promise<number>`. The default is `async () => COOLING_OFF_MS`.

Preset values:

| Preset | label | description | circleWord | circleLimitCents | defaultCoolingOffHours |
|---|---|---|---|---|---|
| family | "Family" | "For an older relative. Children or grandchildren check risky payments." | "your family" | 50_000 | 24 |
| business | "Business" | "For a freelancer or small business. Your accountant or partner checks risky payments." | "your business contacts" | 250_000 | 24 |
| solo | "Just me" | "No circle. Risky payments wait before they go, so you have time to check." | "you" | null | 24 |

- [ ] **Step 1: Schema and migration**

Add to `users` in `src/db/schema.ts`:

```ts
coolingOffHours: integer("cooling_off_hours").notNull().default(24),
onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
```

Add the table check `check("users_cooling_off_choice", sql\`${t.coolingOffHours} in (12, 24, 48)\`)`. This means turning `users` into the `(t) => [...]` table form.

Run `npm run db:generate` and check that the SQL adds both columns and the check. Then run `npm run db:migrate` against the dev database (5433). The integration tests' `freshTestDb` applies migrations itself.

- [ ] **Step 2: Write the failing tests**

`src/settings/presets.test.ts`:
- every preset's `defaultCoolingOffHours` is in `COOLING_OFF_CHOICES`;
- `PRESETS.solo.circleLimitCents === null`;
- `isCoolingOffHours` accepts 12, 24 and 48;
- `isCoolingOffHours` rejects 72, 0, "24" and 24.5.

`src/settings/settingsService.test.ts`, using the memory repo:

```ts
const make = (s: Partial<UserSettings> = {}) => {
  const repo = createMemorySettingsRepo({ u1: { preset: "family", coolingOffHours: 24, onboardedAt: null, ...s } });
  return createSettingsService({ repo, now: () => new Date("2026-10-16T10:00:00Z") });
};

it("choosing a different preset applies its defaults", async () => {
  const svc = make({ coolingOffHours: 48 });
  const s = await svc.choosePreset("u1", "business");
  expect(s).toMatchObject({ preset: "business", coolingOffHours: 24 });
});
it("choosing the same preset again keeps a changed cooling-off", async () => {
  const svc = make({ coolingOffHours: 48 });
  expect((await svc.choosePreset("u1", "family")).coolingOffHours).toBe(48);
});
it("rejects a cooling-off outside the choices", async () => {
  await expect(make().setCoolingOff("u1", 72)).rejects.toThrow(SettingsInputError);
});
it("finishOnboarding sets the time once", async () => {
  const svc = make();
  const first = await svc.finishOnboarding("u1");
  const second = await svc.finishOnboarding("u1");
  expect(second.onboardedAt).toEqual(first.onboardedAt);
});
it("coolingOffMs and circleLimitCents follow the settings", async () => {
  const svc = make({ preset: "business", coolingOffHours: 12 });
  expect(await svc.coolingOffMs("u1")).toBe(12 * 3_600_000);
  expect(await svc.circleLimitCents("u1")).toBe(250_000);
});
it("an unknown user falls back to the defaults", async () => {
  const svc = make();
  expect(await svc.coolingOffMs("nobody")).toBe(24 * 3_600_000);
  expect(await svc.circleLimitCents("nobody")).toBe(50_000);
});
```

`src/payments/paymentService.test.ts` (Review Focus 3): using the existing test helpers in that file, build the service with `coolingOffMs: async () => 12 * 3_600_000`. A high-risk `completeApproval` then gives `coolingOffUntil = authorisedAt + 12h`.

Then change the closure so it returns 48h, and call `senderRelease` at `authorisedAt + 13h`:
- it succeeds, so the existing hold kept its 12h;
- the stored `coolingOffUntil` is unchanged.

`src/settings/drizzleSettingsRepo.int.test.ts`:
- `get` returns the defaults for a seeded user;
- `update` writes `preset`, `coolingOffHours` and `onboardedAt`;
- `get` of a non-UUID returns null without querying.

`src/app/api/me/settings/route.test.ts` (mock the container the way `src/app/api/circle/payments/[id]/route.test.ts` does):
- 401 without a session;
- 400 `{ error: "Please choose 12, 24 or 48 hours." }` for `coolingOffHours: 72`;
- 400 `{ error: "Please choose Family, Business or Just me." }` for `preset: "x"`;
- 200 with the view for `{ preset: "solo" }`;
- `{ onboarded: true }` calls `finishOnboarding`.

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run --project unit src/settings src/payments src/app/api/me` and `npm run test:int -- src/settings`
Expected: FAIL (the modules are missing).

- [ ] **Step 4: Implement**

- `presets.ts`: the values from the table.
- `settingsService`:
  - `get` merges `PRESETS[preset].circleLimitCents`.
  - An unknown user gets `{ preset: "family", coolingOffHours: 24, onboardedAt: null }` from `get`, `coolingOffMs` and `circleLimitCents`.
  - `choosePreset` throws `SettingsInputError("Please choose Family, Business or Just me.")` for an unknown preset. It sets `coolingOffHours` to the preset default only when the preset actually changes.
  - `setCoolingOff` throws `SettingsInputError("Please choose 12, 24 or 48 hours.")`.
- `drizzleSettingsRepo`: guard with `isUuid` and read and write the `users` columns.
- `errorResponse` in `src/server/http.ts` maps `SettingsInputError` to 400 `{ error }`, like the other input errors. Add a row to its test.
- `paymentService.ts`: in `completeApproval` and both recovery paths in the sweep, replace `COOLING_OFF_MS` with `await coolingOffMs(p.senderId)`.
- `container.ts`:
  - build `settings`;
  - pass `coolingOffMs: settings.coolingOffMs` to the payment service;
  - add `circleLimitCents: await settings.circleLimitCents(senderId)` to `extraContext`;
  - expose `settings` on the container.
- Routes:
  - `PUT /api/me/settings` applies, in order: `preset`, then `coolingOffHours`, then `onboarded`.
  - `GET /api/me` adds the four fields.
- `scripts/demo-reset.ts`: after the safe-word reset, run
  `UPDATE users SET onboarded_at = NULL, cooling_off_hours = 24 WHERE email IN (demo emails)`.
  Presets are restored in Task 3.

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test && npm run test:int && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle src/settings src/payments src/server src/app/api/me scripts/demo-reset.ts
git commit -m "feat: per-user presets, cooling-off choice and circle limit"
```

---

### Task 3: Business and Solo demo personas

**Files:**
- Modify: `src/server/demo.ts`, `src/server/demo.test.ts`, `scripts/seed.ts`, `scripts/seed-demo-history.ts`, `scripts/demo-reset.ts`, `src/app/DemoButtons.tsx`
- Modify: `e2e/access.spec.ts` (one sign-in check for each new persona)

**Interfaces:**
- Consumes: `DEMO_PERSONAS`, `homeFor` and `personaForEmail` (`src/server/demo.ts`); `Persona`.
- Produces: `DEMO_PERSONAS` gains these two personas:

  | Persona | Email | `homeFor` |
  |---|---|---|
  | `priya` | `priya.demo@trustcircle.example` | `/home` |
  | `tom` | `tom.demo@trustcircle.example` | `/circle` |

  The other personas are unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/server/demo.test.ts`, add:
- `homeFor("priya")` is `"/home"`;
- `homeFor("tom")` is `"/circle"`;
- `personaForEmail("PRIYA.demo@trustcircle.example")` is `"priya"`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/server/demo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/seed.ts` creates or updates these users and links. Existing users keep their ids: `onConflictDoUpdate` on email sets `preset` only.

Users:

| Name | Email | Preset |
|---|---|---|
| Margaret | margaret.demo@trustcircle.example | family |
| Sarah | sarah.demo@trustcircle.example | family |
| Daniel | daniel.demo@trustcircle.example | family |
| Robert | robert.demo@trustcircle.example | **solo** |
| Priya | priya.demo@trustcircle.example | **business** |
| Tom | tom.demo@trustcircle.example | business |

Trust links:

| Sender | Contact | Relationship |
|---|---|---|
| Margaret | Sarah | "daughter" |
| Margaret | Daniel | "grandson" |
| Priya | Tom | "accountant" |

`scripts/seed-demo-history.ts` adds two paid-out payments from Priya to `studio.supplies@example.com`, $180 and $240, dated 10 and 24 days ago. Use fixed UUIDs in the existing `00000000-0000-4000-a000-…` series, with the next free numbers. These give her a normal supplier and a normal amount.

`scripts/demo-reset.ts` resets the presets on these columns:
- Robert gets `preset = 'solo'`;
- Priya and Tom get `'business'`;
- Margaret, Sarah and Daniel get `'family'`.

`DemoButtons.tsx`: the "Other demo accounts" disclosure lists these entries, in this order:
- Daniel — "Daniel, the grandson";
- Priya — "Priya, a freelancer (business)";
- Tom — "Tom, Priya's accountant";
- Robert — "Robert, no circle".

Test ids are `try-priya` and `try-tom`. While a sign-in request is in flight, the pressed button's label becomes "Signing you in…" (this is a 4A follow-up). Import `type Persona` from `@/server/demo` and remove the local union.

In `e2e/access.spec.ts`, add a test that signs in as `priya` and `tom` through `signInAs` and expects the home and circle URLs.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm run seed && npm run demo:reset && npm test && npm run typecheck && npm run lint && npx playwright test e2e/access.spec.ts`
Expected: PASS.

- [ ] **Step 5: Screenshots and commit**

Screenshot the landing page with the disclosure open, at both widths.

```bash
git add src/server/demo.ts src/server/demo.test.ts scripts src/app/DemoButtons.tsx e2e/access.spec.ts
git commit -m "feat: add Priya and Tom for the business story and make Robert the solo account"
```

---

### Task 4: Tell the circle and the sender about every outcome

**Files:**
- Modify: `src/alerts/alertRepo.ts`, `src/alerts/alertCopy.ts`, `src/alerts/alertCopy.test.ts`, `src/alerts/alertService.ts`, `src/alerts/alertService.test.ts` (no migration: `alerts.kind` is a text column)
- Modify: `src/server/paymentEvents.ts`, `src/server/paymentEvents.test.ts`
- Modify: `src/verification/verificationService.ts`, `src/verification/verificationService.test.ts`
- Modify: `src/payments/paymentService.ts`, `src/payments/paymentService.test.ts` (new `cancelled_by_sender` event)
- Modify: `src/server/container.ts` (generalised open-check)
- Modify: `src/app/payments/[id]/PaymentScreens.tsx`, `src/app/circle/reviewCopy.ts` and its test (restore the "told" lines)

**Interfaces:**
- Consumes: `alerts.notify`, `circle.contactsOf`, `PaymentServiceEvent`, `verificationService.startForHeld`.
- Produces:
  - `AlertKind` gains `"payment_update"`.
  - `AlertPayload` gains `reason?: "denied" | "cancelled" | "check_failed" | "stopped_by_circle"` and `actorName?: string`.
  - `PaymentServiceEvent` gains `{ type: "cancelled_by_sender"; payment: PaymentRecord }`.
  - `verificationService.startForHeld(payment)` returns `Promise<{ targetContactId: string } | null>`.
  - `createAlertService` dependency `isVerifyRequestOpen` is renamed `isAlertOpen?: (a: { kind: AlertKind; paymentId: string | null; verificationId: string | null }) => Promise<boolean>`. It is used for `verify_request` and `payment_held`.

`payment_update` copy (`alertCopy`). The recipient decides the wording: the sender gets `reason: "stopped_by_circle"`, and every other reason goes to the circle.

| reason | title | body | path |
|---|---|---|---|
| denied | `${sender}'s payment was stopped` | `${actor} said it wasn't them, so we stopped ${sender}'s payment of ${amount} to ${payee}. The money was never sent.` | `/circle/payments/${paymentId}` |
| cancelled | `${sender} cancelled a payment` | `${sender} cancelled the payment of ${amount} to ${payee}. The money was never sent.` | `/circle/payments/${paymentId}` |
| check_failed | `${sender}'s payment was stopped` | `The caller couldn't pass ${sender}'s check, so we stopped the payment of ${amount} to ${payee}. The money was never sent.` | `/circle/payments/${paymentId}` |
| stopped_by_circle | `${actor} stopped your payment` | `${actor} stopped your payment of ${amount} to ${payee}. The money was never sent.` | `/payments/${paymentId}` |

- [ ] **Step 1: Write the failing tests**

`alertCopy.test.ts`: one test for each row above.

`paymentEvents.test.ts`:
- **`held`.** `startForHeld` resolves `{ targetContactId: "c-daniel" }` and the circle is Sarah and Daniel. `payment_held` goes only to Sarah.
- **`cancelled_by_sender`.** Every contact gets `payment_update` with `reason: "cancelled"`.
- **`blocked_by_contact`, actor Sarah.**
  - The sender gets `payment_update` with `reason: "stopped_by_circle"` and `actorName: "Sarah"`.
  - No other contact is alerted (out of scope for 4B).
  - The registry hook still runs.

`verificationService.test.ts`:
- **`respond(not_me)` by Daniel.** In addition to the sender's `payment_stopped`, every circle member except Daniel gets `payment_update` with `reason: "denied"` and `actorName: "Daniel"`.
- **A failed challenge.** Every circle member gets `payment_update` with `reason: "check_failed"`.
- **`startForHeld` return value.**
  - When it creates a request, it returns the target contact id.
  - When there is no matching contact or the requester is an organisation, it returns null.

`paymentService.test.ts`: `senderCancel` emits `cancelled_by_sender` after the block succeeds. On the 202 path (`PaymentPendingError` after the claim), it also emits it. This mirrors `contactDecision`.

`alertService.test.ts`: `list` drops a `payment_held` row when `isAlertOpen` returns false for it, and keeps it when it returns true.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/alerts src/server src/verification src/payments`
Expected: FAIL.

- [ ] **Step 3: Implement**

1. **Alert kind.** `alerts.kind` is a text column (`src/db/schema.ts:103`), so adding `"payment_update"` to the `AlertKind` union needs no migration.

2. **Payment events and copy.**
   - `paymentEvents.ts`:
     - On `held`, keep the result of `startForHeld` and skip that contact when sending `payment_held`.
     - Handle `cancelled_by_sender`.
     - On `blocked_by_contact`, alert the sender. Get `actorName` from `circle.getUser(actorId)`.
   - `verificationService.ts`: after the existing sender alert on `not_me`, notify the other circle members. Do the same for a failed challenge (`check_failed`) in the challenge path. Wrap each notify in the existing follow-up so a failure never changes the outcome.
   - `paymentService.ts`: `senderCancel` emits `cancelled_by_sender`.

3. **Container open-check.** In `container.ts`, `isAlertOpen` works as follows:

   | Alert kind | Open when |
   |---|---|
   | `verify_request` | (unchanged) |
   | `payment_held` | the payment is still `held` |
   | any other kind | always open |

4. **Restore the "told" lines.**
   - **`PaymentScreens.tsx`, `stopped_by_person`.** Add the line `${circleNamesText(otherNames)} ${otherNames.length > 1 ? "have" : "has"} been told.` before the scam-list line.
     - `otherNames` is the `/api/me` circle names minus `stage.contactName`. When that list is empty, add no line.
     - Also add this line on `cancelled`, where `otherNames` is the full circle.
   - **`reviewCopy.ts`, `decisionResultCopy`, block with status 200.** The lead becomes `We've told ${senderName}. Their money is safe, and this account is on the shared scam list now.`
   - Update the tests that pin the old wording.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run test:int && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Screenshots and commit**

Screenshot these at both widths:
- Sarah's circle "Earlier" list after a denial, with stubbed alerts;
- Margaret's stopped screen with the restored "Sarah has been told." line.

```bash
git add src/alerts src/server src/verification src/payments src/app/payments src/app/circle
git commit -m "feat: tell the circle when a payment is stopped or cancelled, and the sender when the circle stops it"
```

---

### Task 5: The push channel and subscriptions

**Files:**
- `package.json`: add `web-push@3.6.7` to dependencies and `@types/web-push@3.6.4` to devDependencies, using `npm i web-push@3.6.7 && npm i -D @types/web-push@3.6.4`.
- `src/db/schema.ts`: add the `push_subscriptions` table and add `"push"` to `alertChannelEnum`. Run `npm run db:generate` to create `drizzle/0006_*`.
- Create:
  - `src/push/pushRepo.ts`
  - `src/push/drizzlePushRepo.ts`
  - `src/push/drizzlePushRepo.int.test.ts`
  - `src/push/pushSender.ts`
  - `src/push/subscription.ts`
  - `src/push/subscription.test.ts`
- Modify: `src/alerts/alertRepo.ts` (`AlertChannel`), `src/alerts/alertService.ts`, `src/alerts/alertService.test.ts`
- Modify: `src/config/env.ts` and its test, and `src/server/container.ts`
- Create:
  - `src/app/api/push/subscription/route.ts`
  - `src/app/api/push/subscription/route.test.ts`
  - `src/app/api/push/config/route.ts`
- Create: `scripts/vapid-keys.ts`. Add the script `"vapid:keys": "tsx scripts/vapid-keys.ts"` to `package.json`.

**Interfaces:**
- Consumes: `alertCopy(base)` (gives the title, body and path), `currentUserId`, `readJsonObject`, `badBody`.
- Produces:
  ```ts
  // src/push/subscription.ts
  export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }
  export function parsePushSub(x: unknown): PushSub | null;  // https endpoint ≤ 2048 chars, base64url keys ≤ 256 chars
  // src/push/pushRepo.ts
  export interface PushRepo {
    save(userId: string, sub: PushSub, at: Date): Promise<void>;   // upsert by endpoint; moves it to this user
    listForUser(userId: string): Promise<PushSub[]>;
    remove(endpoint: string): Promise<void>;
    removeForUser(userId: string, endpoint: string): Promise<boolean>;
    countForUser(userId: string): Promise<number>;
  }
  export function createMemoryPushRepo(): PushRepo;
  // src/push/pushSender.ts
  export type PushSender = (sub: PushSub, payload: string) => Promise<void>;
  export function createWebPushSender(v: { publicKey: string; privateKey: string; subject: string }): PushSender;
  export const MAX_SUBSCRIPTIONS_PER_USER = 5;
  ```
  - `createAlertService` takes two new optional dependencies: `push?: { repo: PushRepo; send: PushSender }` and `timeoutMs?: number` (default `5_000`).
  - Push payload JSON: `{ title, body, url: path, tag: string }`, where `tag` is `${kind}:${paymentId ?? verificationId}`.
  - `GET /api/push/config` returns `{ publicKey: string | null }`.
  - `POST /api/push/subscription` takes a `PushSub` body and returns 201 `{ ok: true }`. It returns 400 for a bad body, 401 when signed out, and 409 `{ error: "This account already has notifications on 5 devices." }` when the user is at the limit and the endpoint is new.
  - `DELETE /api/push/subscription` takes `{ endpoint }` and returns 204.

Table:

```ts
export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("push_subscriptions_user").on(t.userId)]);
```

Env (all optional; an empty string means unset, following the existing `optionalString`):
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`: must start with `mailto:` or `https:`, default `mailto:alerts@trustcircle.example`.

Push is on only when both keys are set.

- [ ] **Step 1: Write the failing tests**

`src/push/subscription.test.ts`:
- accepts `{ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc…", auth: "tBH…" } }`, using realistic base64url strings;
- rejects an `http:` endpoint, a missing key, a non-base64url key, an endpoint longer than 2048 characters, and extra nesting.

`src/alerts/alertService.test.ts` (Review Focus 1), using memory repos:

```ts
const sub = { endpoint: "https://push.example/1", keys: { p256dh: "a", auth: "b" } };
it("pushes to every device and records one push row", async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  // repo with two subs for the recipient
  await svc.notify({ recipientId: "u1", kind: "payment_held", paymentId: "p1", payload });
  expect(send).toHaveBeenCalledTimes(2);
  expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({ title: expect.any(String), url: "/circle/payments/p1", tag: "payment_held:p1" });
  expect(channels()).toEqual([["in_app", "sent"], ["push", "sent"], ["email", "skipped"]]);
});
it("deletes a gone subscription and still records the alert", async () => {
  const send = vi.fn().mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
  await svc.notify(/* … */);
  expect(await pushRepo.listForUser("u1")).toEqual([]);
  expect(channels()).toContainEqual(["push", "failed"]);
});
it("a hanging push is cut off and notify still resolves", async () => {
  vi.useFakeTimers();
  const send = vi.fn(() => new Promise<void>(() => {}));
  const done = svc.notify(/* … */);
  await vi.advanceTimersByTimeAsync(5_000);
  await expect(done).resolves.toBeUndefined();
  expect(channels()).toContainEqual(["push", "failed"]);
  vi.useRealTimers();
});
it("no devices or no push config is 'skipped'", async () => { /* … */ });
it("push and email run at the same time", async () => {
  // both senders resolve after 100 ms on fake timers; notify settles after ~100 ms, not ~200 ms
});
```

Update the two existing tests that pin the channel order to `[["in_app","sent"],["push","skipped"],["email","skipped"]]`. When at least one device received the push, push counts as "sent"; if every device failed, it is "failed".

`src/push/drizzlePushRepo.int.test.ts`:
- `save` then `listForUser`;
- saving the same endpoint under another user moves it;
- `remove`;
- `removeForUser` returns false for someone else's endpoint;
- `countForUser`.

`src/app/api/push/subscription/route.test.ts`:
- 401;
- 400 for a bad body;
- 201;
- 409 at five devices for a new endpoint, but 201 when re-saving one of the user's own five;
- `DELETE` returns 204 and removes only the caller's own endpoint.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/push src/alerts src/app/api/push src/config`
Expected: FAIL.

- [ ] **Step 3: Implement**

`alertService.notify`:
1. Insert the in-app row, exactly as today.
2. Run push and email together, using `Promise.all` over two functions that each catch their own errors and race a `timeoutMs` timer.
3. Insert the push row, then the email row.

Push:
- With no `deps.push`, or no devices, the push row is "skipped".
- Send to every device with `Promise.allSettled`.
- A rejection with `statusCode` 404 or 410 calls `repo.remove(endpoint)`.
- Log `console.warn("alert push failed", { kind, status })` with only the status code. Never log the endpoint or the payload.

Email keeps today's behaviour inside the race.

`createWebPushSender` calls `webpush.sendNotification(sub, payload, { vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: "high" })`. Passing the VAPID details per call means importing the module needs no keys. Import `web-push` only in `pushSender.ts`, which runs on the Node runtime.

`container.ts` builds `push` only when both keys are set.

`scripts/vapid-keys.ts` prints the two lines `NEXT_PUBLIC_VAPID_PUBLIC_KEY=…` and `VAPID_PRIVATE_KEY=…` from `webpush.generateVAPIDKeys()`, then a reminder that the user should paste them into `.env.local`. The script never writes files. The implementer must not run it into any file.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm run db:migrate && npm test && npm run test:int && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/db/schema.ts drizzle src/push src/alerts src/config src/server/container.ts src/app/api/push scripts/vapid-keys.ts
git commit -m "feat: send alerts by web push alongside in-app and email"
```

---

### Task 6: Installable app and the notification opt-in

**Files:**
- Create: `src/app/manifest.ts`, `public/sw.js`, `src/app/ServiceWorker.tsx`
- Create: `scripts/make-icons.ts`, which writes these images:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/icon-maskable-512.png`
  - `public/icons/badge-96.png`
  - `src/app/apple-icon.png` (180 px)
  - `src/app/icon.png` (32 px)
- Delete: `src/app/favicon.ico` and the create-next-app SVGs in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). First check with `graft grep` that nothing references them.
- Modify: `next.config.ts`, `src/app/layout.tsx`
- Create: `src/ui/notificationSupport.ts`, `src/ui/notificationSupport.test.ts`, `src/ui/EnableNotifications.tsx`, `src/ui/swTarget.ts`, `src/ui/swTarget.test.ts`
- Create: `e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `GET /api/push/config` and `POST`/`DELETE /api/push/subscription` (Task 5); `fetchJson` and `useOnce` (kit).
- Produces:
  ```ts
  // src/ui/notificationSupport.ts — pure, environment passed in
  export type NotificationState =
    | "unsupported"        // no serviceWorker or PushManager
    | "ios_needs_install"  // iPhone/iPad and not standalone
    | "server_off"         // /api/push/config publicKey null
    | "denied" | "ask" | "on";
  export function notificationState(env: {
    hasServiceWorker: boolean; hasPushManager: boolean; isIos: boolean; isStandalone: boolean;
    permission: "default" | "denied" | "granted"; publicKey: string | null; subscribed: boolean;
  }): NotificationState;
  export function notificationCopy(s: NotificationState): { title: string; body: string; action: string | null };
  // src/ui/swTarget.ts — shared with public/sw.js by copy (sw.js cannot import); test pins both
  export function safeTarget(url: unknown, origin: string): string; // same-origin path or "/"
  ```
  `<EnableNotifications onDone?: () => void />` shows the state's copy. The `ask` action subscribes and POSTs the subscription; the `on` action turns notifications off.

`notificationState` order:
1. If the browser has no service worker or no PushManager, the state is `unsupported`. One exception: an iPhone or iPad that is not running as an installed app gets `ios_needs_install`, because iOS adds PushManager only to installed apps.
2. If there is no public key, `server_off`.
3. If permission is `denied`, `denied`.
4. If the user is subscribed and permission is `granted`, `on`.
5. Otherwise `ask`.

`notificationCopy`:

| State | Title | Body | Action |
|---|---|---|---|
| unsupported | "This browser can't show alerts" | "You'll still see every alert here in Trust Circle, and by email." | null |
| ios_needs_install | "Add Trust Circle to your Home Screen first" | "On iPhone, tap the Share button, then \"Add to Home Screen\". Open Trust Circle from there to turn on alerts." | null |
| server_off | "Phone alerts aren't set up on this server" | "You'll still see every alert here in Trust Circle, and by email." | null |
| denied | "Alerts are blocked for this site" | "To turn them on, allow notifications for Trust Circle in your browser settings, then come back." | null |
| ask | "Get an alert when something needs you" | "We'll only alert you about payments and checks in your circle." | "Turn on alerts" |
| on | "Alerts are on for this device" | "We'll alert you here and by email." | "Turn off alerts" |

- [ ] **Step 1: Write the failing tests**

`notificationSupport.test.ts`: write one test for each state, including these cases:
- iOS that is not standalone and has no PushManager gives `ios_needs_install`;
- iOS standalone with a PushManager falls through to `ask`;
- `granted` but not subscribed gives `ask`;
- the copy table, row by row.

`swTarget.test.ts`, with origin `https://app.example`:

| Input | Result |
|---|---|
| `"/payments/1"` | `"/payments/1"` |
| `"https://app.example/circle"` | `"/circle"` |
| `"https://evil.example/x"` | `"/"` |
| `"//evil.example"` | `"/"` |
| `"javascript:alert(1)"` | `"/"` |
| `42` | `"/"` |
| `"/\\evil"` | `"/"` |

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/ui/notificationSupport.test.ts src/ui/swTarget.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trust Circle", short_name: "Trust Circle",
    description: "Scammers pretend to be someone you trust. So we ask that person.",
    start_url: "/home", scope: "/", display: "standalone",
    background_color: "#F4F6F4", theme_color: "#1E5A47",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

`public/sw.js` (plain JS, no imports):
- `push`: parse JSON and call `showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", tag, data: { url } })`. A non-JSON payload shows "Trust Circle" with the body "Something in your circle needs a look." and `url: "/"`.
- `notificationclick`:
  1. Close the notification.
  2. Get the target from `safeTarget(event.notification.data && event.notification.data.url, self.location.origin)`. Copy the body of `safeTarget` into sw.js verbatim, with a comment that `src/ui/swTarget.ts` is the tested copy.
  3. Focus an open client on the same origin and navigate it, otherwise call `clients.openWindow(target)`.
- `install` calls `self.skipWaiting()` and `activate` calls `clients.claim()`.
- There is no fetch handler, so nothing is cached offline and stale data is never shown.

`src/app/ServiceWorker.tsx` is a client component rendered in `layout.tsx`. On mount, if `"serviceWorker" in navigator`, it registers `/sw.js` with `{ scope: "/", updateViaCache: "none" }` and ignores errors.

`next.config.ts` `headers()`:
- `/(.*)`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `/sw.js`:
  - `Content-Type: application/javascript; charset=utf-8`
  - `Cache-Control: no-cache, no-store, must-revalidate`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'`

Leave out `X-Frame-Options`. It is not needed here, and the PayPal popup isn't framed by us.

`scripts/make-icons.ts` uses Playwright's Chromium, which is already installed:
1. Render this inline SVG mark at each size and save a screenshot:
   - an evergreen `#1E5A47` rounded square (radius 22% of the size);
   - a white ring (stroke 9% of the size, radius 28%), open at the top-right with a 50° gap;
   - a small white dot (radius 6%) at the ring's centre.

   The ring and dot together read as "a circle around a person".
2. The maskable icon keeps the mark inside the central 80% safe zone, on a full-bleed evergreen background.
3. The badge is the white ring alone on transparent.

Add the script `"icons": "tsx scripts/make-icons.ts"` to `package.json`, run it once, and commit the PNGs.

`EnableNotifications.tsx`:
- Fetch `/api/push/config`.
- Read the environment:
  - isIos: `/iPad|iPhone|iPod/.test(navigator.userAgent)`;
  - isStandalone: `matchMedia("(display-mode: standalone)").matches`;
  - permission: `Notification.permission`;
  - subscribed: `(await navigator.serviceWorker.ready).pushManager.getSubscription()`.
- Render `notificationCopy` in a `Card`, with a `BellIcon` for `ask`/`on` and an `InfoIcon` otherwise.

The action is wrapped in `useOnce`:
- **"Turn on alerts":**
  1. Subscribe with `{ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }`.
  2. POST the result of `JSON.parse(JSON.stringify(sub))` to `/api/push/subscription`.
  3. On success, the state becomes `on` and `onDone?.()` is called.
- **"Turn off alerts":** unsubscribe, then DELETE.
- **Subscribe throws:**
  - If permission is now `denied`, show the denied copy.
  - Otherwise show `Notice tone="error"`: "We couldn't turn on alerts on this device. You'll still get them here and by email."
- **POST returns 409:** show its message.

Test ids:

| Element | Test id |
|---|---|
| card | `notifications` |
| action | `notifications-action` |

Each state also sets `data-state` on the card.

`e2e/pwa.spec.ts`:
- `GET /manifest.webmanifest` is JSON with `display: "standalone"` and 3 icons, and every icon URL returns 200 `image/png`.
- `GET /sw.js` has `Cache-Control` containing `no-store`.
- After `/` loads, `navigator.serviceWorker.getRegistration()` is truthy.
- The notification opt-in test lives in Task 7 (`/settings`), because this task builds no page that hosts `EnableNotifications`.
- **Push delivery (Review Focus 2), Chromium-only CDP:**
  1. Get the registration id with `cdp.send("ServiceWorker.enable")` and the `ServiceWorker.workerRegistrationUpdated` event.
  2. Call `cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId, data: JSON.stringify({ title: "T", body: "B", url: "https://evil.example/x", tag: "t" }) })`.
  3. Assert that `(await navigator.serviceWorker.ready).getNotifications()` has the title "T".

  The click target can't be clicked through the OS; the `safeTarget` unit test covers it.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm run icons && npm test && npm run typecheck && npm run lint && npx playwright test e2e/pwa.spec.ts`
Expected: PASS.

- [ ] **Step 5: Screenshots and commit**

1. Screenshot the six notification states: render `EnableNotifications` on a stub page or in Storybook-like isolation, using `page.route` and `addInitScript`.
2. Screenshot the icons. Open them, check they are crisp and on-brand, and list what you saw in the report.

```bash
git add src/app/manifest.ts public src/app/ServiceWorker.tsx src/app/layout.tsx src/app/apple-icon.png src/app/icon.png next.config.ts scripts/make-icons.ts package.json src/ui e2e/pwa.spec.ts
git rm --cached -q src/app/favicon.ico 2>/dev/null || true
git commit -m "feat: make Trust Circle installable and let people turn on phone alerts"
```

---

### Task 7: Onboarding and settings

**Files:**
- Create:
  - `src/app/onboarding/page.tsx`
  - `src/app/onboarding/steps.ts`
  - `src/app/onboarding/steps.test.ts`
  - `src/app/settings/page.tsx`
- Modify: `src/app/home/page.tsx`
- Modify: `e2e/pwa.spec.ts` (the opt-in test from Task 6, now on `/settings`)
- Create: `e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes:
  - `GET /api/me`, which returns `preset`, `coolingOffHours`, `circleLimitCents`, `onboarded`, `safeWordSet`, `circle` and `persona`;
  - `PUT /api/me/settings`;
  - `PUT /api/me/safe-word` (`{ safeWord }`, which returns 400 with the validation copy);
  - `PRESETS`, `COOLING_OFF_CHOICES` and `<EnableNotifications/>`.
- Produces:
  ```ts
  // src/app/onboarding/steps.ts
  export const STEPS = ["preset", "circle", "safe_word", "alerts"] as const;
  export type Step = (typeof STEPS)[number];
  export function firstUnfinished(me: { preset: string | null; onboarded: boolean; safeWordSet: boolean }, visited: Step[]): Step;
  export function stepNumber(s: Step): number; // 1-based
  ```

`firstUnfinished` rules, applied in order:
1. If `onboarded` is true, return `"preset"`. It is an explicit revisit, so start from the beginning.
2. Otherwise, return the first step not yet in `visited`.
3. `safe_word` counts as finished when `safeWordSet` is true, even if it was never visited.
4. If every step is finished, return `"alerts"`.

`visited` lives in `sessionStorage` under `tc_onboarding_visited`. Wrap every read and write in try/catch.

- [ ] **Step 1: Write the failing tests**

`steps.test.ts`:
- a fresh user gets `preset`;
- `visited: ["preset"]` gives `circle`;
- `visited: ["preset","circle"]` with `safeWordSet: true` gives `alerts`;
- `onboarded: true` gives `preset`;
- `stepNumber("safe_word")` is 3.

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/app/onboarding`
Expected: FAIL.

- [ ] **Step 3: Build the screens**

`/onboarding` is a client page. Every step uses `Screen`, the concept's "Step N of 4" label and progress bar (`role="progressbar"` with `aria-valuenow`), a Title, a Lead, and a footer with a primary button and a quiet "Skip for now". Skip marks the step visited and moves on.

1. **preset** ("Who are you protecting?")
   - Three large radio cards built from `PRESETS`, each with its label and description and a Phosphor icon: `UsersThreeIcon`, `BriefcaseIcon` or `UserIcon`. The cards are real `<input type="radio">` elements with visible labels, each at least 72 px tall.
   - Primary button: "Continue". It PUTs `{ preset }`.
   - Fine print: "You approve every payment in PayPal's own window. We never see your PayPal password."
2. **circle** ("Who checks risky payments")
   - List the `/api/me` circle with initials avatars, names and relationships.
   - Lead: "In this demo, ${circleWord}'s circle is already set up." For Solo: "You haven't added anyone. Risky payments wait ${coolingOffHours} hours so you have time to check."
   - Secondary button: "Invite someone". It opens `mailto:?subject=Join my Trust Circle&body=…`, with a body that includes the app URL `${location.origin}/` and one sentence of explanation.
   - Primary button: "Continue".
3. **safe_word**
   - This step follows `OnboardingSafeWord.dc.html` exactly: its copy, its lock note, "Save safe word" and "Skip for now".
   - "Save safe word" PUTs `/api/me/safe-word`. A 400 shows the error on the field. On success it moves on.
   - If `safeWordSet` is already true, show "You've already set a safe word. You can change it here." and keep the field.
4. **alerts** ("Turn on alerts")
   - `<EnableNotifications onDone={…}/>`.
   - Primary button: "Finish". It PUTs `{ onboarded: true }` and goes to `/home`, or to `/circle` for Sarah, Daniel and Tom; use `homeFor(persona)`.

Any step's PUT that returns 401 shows `SignedOut`. On 0 or 5xx, show `Notice tone="error"` "We couldn't save that just now. Please try again." and keep the user's input.

**`/settings`** is one screen with these sections, using `Screen` with `backHref="/home"`:
- **"Who you're protecting":** the preset radios. Changing one PUTs immediately and shows a `role="status"` line, "Saved."
- **"How long a held payment waits":** radios for 12, 24 and 48 hours. Fine print: "You can release a held payment yourself after this. It never changes a payment that's already on hold."
- **"Amount that always gets a second look":** read-only. For example: "$500 or more (set by the Family preset)." Solo shows "No limit (Just me)".
- **"Family safe word":** a link to `/onboarding?step=safe_word`. The page honours `?step=` when it names a valid step.
- **"Alerts":** `<EnableNotifications/>`.

Test ids:

| Element | Test id |
|---|---|
| Preset radios | `preset-family`, `preset-business`, `preset-solo` |
| Cooling-off radios | `cooling-12`, `cooling-24`, `cooling-48` |
| Each step's primary button | `onboarding-next` |
| Skip | `onboarding-skip` |

**`/home`:**
- When `onboarded` is false, show a top card "Finish setting up Trust Circle" with "Takes about a minute." and the button "Set up" linking to `/onboarding`.
- The existing safe-word row links to `/onboarding?step=safe_word`.
- Add a quiet "Settings" link next to Sign out (`GearIcon`, 44 px).
- The circle page header gets the same Settings link.

- [ ] **Step 4: e2e**

`e2e/onboarding.spec.ts`:
1. Sign in as Margaret after `globalSetup`'s reset; she is not onboarded.
2. `/home` shows the setup card. Follow it, then:
   - choose Family, then Continue;
   - Continue on the circle step;
   - type "bluebird" and save;
   - on alerts, the state is `unsupported`, `server_off` or `ask`, depending on the environment. Any of them is fine.
   - press Finish.
3. Expect `/home` with no setup card.
4. Then call `GET /api/me` and expect `safeWordSet: true` and `onboarded: true`.
5. Then sign in as Robert. Open `/settings`, choose `cooling-12`, reload, and expect `cooling-12` to be checked.
6. Reset Robert back with `PUT { coolingOffHours: 24 }` at the end.

Add the notification opt-in test to `e2e/pwa.spec.ts`, using `test.use({ permissions: ["notifications"] })`:
1. Stub `/api/push/config` with `{ publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" }`.
2. `addInitScript` replaces `PushManager.prototype.subscribe` and `PushManager.prototype.getSubscription`. `subscribe` resolves a fake: `{ endpoint: "https://push.example/e2e", toJSON: () => ({ endpoint: "https://push.example/e2e", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } }), unsubscribe: async () => true }`. `getSubscription` resolves null until `subscribe` has run.
3. Stub `POST /api/push/subscription` with 201 and record its body.
4. Sign in as Sarah, open `/settings`, tap `notifications-action`, and expect:
   - the recorded body's `endpoint` is `https://push.example/e2e`;
   - the `notifications` card's `data-state` is `on`.

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm test && npm run typecheck && npm run lint && npx playwright test e2e/onboarding.spec.ts e2e/pwa.spec.ts`
Expected: PASS.

- [ ] **Step 6: Screenshots and commit**

Take these screenshots at both widths:
- each onboarding step;
- the Solo circle step;
- `/settings`;
- `/home` with the setup card.

Compare the safe word step with `OnboardingSafeWord.dc.html`, and the others with the nearest concepts (`Send.dc.html` for forms, `Home.dc.html` for cards).

```bash
git add src/app/onboarding src/app/settings src/app/home src/app/circle/page.tsx e2e
git commit -m "feat: add onboarding with presets, safe word and alerts, and a settings screen"
```

---

### Task 8: The landing page, final

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: the Plan 4A landing page; `DemoButtons` (Task 3).
- Produces: the final landing page.

The figure is verified (on 2026-10-16 against the primary document, which was opened and read):
- **Document:** FBI IC3 *2025 Internet Crime Report*. URL: `https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf`, published April 2026.
- **Page 44 infographic, "IC3 Elder Fraud – Complaints filed by Individuals 60+":** "201,266 Complaints" and "$7.748 Billion in Losses".
- **Page 7:** "60+: 201,266 complaints, $7.7 billion in losses."

Use this wording only. Do not attribute the total to impersonation or grandparent scams; investment fraud is the largest share.

- [ ] **Step 1: Replace the statistic band**

The band keeps the 4A layout: the large sentence on the left and the explanatory paragraph on the right. Change these:
- **Large sentence:** "In 2025, people 60 and over reported losing $7.7 billion to online fraud."
- **Below it, at 16 px in `text-ink-2`:** "201,266 complaints to the FBI." followed by a source link "FBI IC3 2025 Internet Crime Report". The link is `rel="noopener"` with `target="_blank"`, and has an `aria-label` of "FBI IC3 2025 Internet Crime Report, opens in a new tab".
- **Explanatory paragraph:** unchanged.

- [ ] **Step 2: Finish the page against the design bar**

Run the `design-taste-frontend` skill's critique on the page and fix what it finds that fits `DESIGN.md`. Keep the concept's structure: no new sections, no template patterns.

Required checks:
- the hero headline wraps cleanly at 390 px;
- "Try as Margaret" and "Try as Sarah, her daughter" each fit on one line at 1280 px;
- the phone card shadow uses a token;
- the footer line stays as it is ("…PayPal Orders and Payouts, Groq, AG Grid and Render."). Plan 5 re-checks it after the Render deploy.

- [ ] **Step 3: Checks, screenshots and commit**

Run `npm run typecheck && npm run lint && npx playwright test e2e/access.spec.ts`. Screenshot `/` at both widths and compare it with `Landing.dc.html`.

```bash
git add src/app/page.tsx
git commit -m "feat: show the verified FBI figure on the landing page"
```

---

### Task 9: Polish pass

**Files:**
- Create: `src/ui/format.ts`, `src/ui/format.test.ts`
- Modify: every screen that formats a date or time. To list them, run `graft grep "toLocale"` and `graft grep "en-GB"`.
- Modify: `src/app/payments/[id]/page.tsx` (stale poll), `src/app/check/page.tsx` and `src/app/check/CheckResult.tsx`
- Modify: `src/app/circle/dashboard/DashboardGrid.tsx`, `src/app/globals.css`, `src/ui/Skeleton.tsx`
- Modify: `scripts/demo-reset.ts` (drop `CASCADE`), `src/app/SignOutButton.tsx`

**Interfaces:**
- Produces:
  ```ts
  // src/ui/format.ts — en-US, the viewer's time zone
  export function formatDay(d: Date | string): string;      // "Friday, Oct 16"
  export function formatTime(d: Date | string): string;     // "1:59 PM"
  export function formatDayTime(d: Date | string): string;  // "Friday, Oct 16 at 1:59 PM"
  export function formatWhen(d: Date | string, now?: Date): string; // "Today at 1:59 PM" | "Yesterday at …" | formatDayTime
  ```

- [ ] **Step 1: Write the failing tests**

`format.test.ts` sets `process.env.TZ = "UTC"` in a `beforeAll` (Vitest reads the zone at the time of the call). Expected results:

| Call | Result |
|---|---|
| `formatDay("2026-10-16T13:59:00Z")` | `"Friday, Oct 16"` |
| `formatTime(...)` | `"1:59 PM"` |
| `formatWhen` with `now` the same day | `"Today at 1:59 PM"` |
| `formatWhen` with `now` the next day | `"Yesterday at 1:59 PM"` |
| `formatWhen` with `now` 5 days later | `"Friday, Oct 16 at 1:59 PM"` |

- [ ] **Step 2: Run the tests and see them fail**

Run: `npx vitest run --project unit src/ui/format.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement and apply**

- **Dates:** replace every hand-rolled date or time formatter in the screens with `format.ts`. Afterwards, `graft grep "en-GB"` must find nothing in `src/app` or `src/ui`.
- **Payment screen polling (`page.tsx`):** keep a request counter. Each load takes `const seq = ++latest.current`, and a response is applied only when `seq === latest.current`. Then a poll that started before an action never overwrites that action's reload.
- **Check page:**
  - When a screenshot is chosen, the textarea is disabled. Under it, show the hint: "We'll check the screenshot. Remove it to paste text instead." There is also a "Remove screenshot" quiet button.
  - The object URL is revoked when it is replaced, on reset, and on unmount.
- **Report button:** after a successful report, the button becomes "Open the email again". It re-opens the same `mailtoUrl` without POSTing again.
- **Tokens:**
  - `DashboardGrid` search box: tokens instead of the inline `#D9DFDB` border and font weight.
  - `.tc-skeleton` uses a new token `--color-skeleton: #E4E9E6`.
  - The landing card shadow uses a token if Task 8 didn't already do it.
- **`SignOutButton`:** if the logout POST fails, show `Notice tone="error"` "We couldn't sign you out. Please try again." and stay on the page.
- **`scripts/demo-reset.ts`:** remove `CASCADE`. List every truncated table explicitly, in dependency order, and run it to prove it works.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test && npm run typecheck && npm run lint && npm run demo:reset && npx playwright test`
Expected: PASS (the full suite, serially).

- [ ] **Step 5: Screenshots and commit**

Re-shoot these at both widths:
- `/check` with a screenshot chosen;
- the held payment screen;
- Sarah's circle "Earlier" list;
- the dashboard.

```bash
git add src scripts
git commit -m "fix: one date style, no stale polls, clearer screenshot checks and token-only colours"
```

---

### Task 10: Accessibility pass and the final screenshot set

**Files:**
- `package.json`: add `@axe-core/playwright` as a dev dependency (`npm i -D @axe-core/playwright`).
- Modify: `src/app/layout.tsx` (skip link), `src/ui/Screen.tsx` (`<main id="main">`), `src/ui/Field.tsx`, `src/ui/HoldRing.tsx`, `src/ui/Notice.tsx`, `src/app/home/page.tsx`, `src/app/send/page.tsx`, plus any screen axe flags
- Create: `e2e/a11y.spec.ts`, `e2e/stubs.ts`

**Interfaces:**
- Consumes: every screen and its test ids, and `signInAs` from `e2e/helpers.ts`.
- Produces:
  - `Field` wires `aria-describedby` itself. It clones its single child input with `aria-describedby` set to the hint and error ids, and `aria-invalid` when there is an error. Callers no longer use `describedBy()` by hand. Keep the export so nothing breaks, but stop using it.
  - `Notice` keeps a mounted, empty live region and fills it. It renders `<div role={tone === "error" ? "alert" : "status"}>` once, then swaps the children, so screen readers announce it.
  - `e2e/stubs.ts` exports reusable `page.route` stubs for each payment, review and verify state, moved out of the Plan 4A screenshot scripts.

- [ ] **Step 1: Write the failing e2e test**

`e2e/a11y.spec.ts` defines a list of screens. For each screen and each viewport, at 390×844 and 1280×800, it:
- prepares the state: signs in or stubs it;
- runs `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()`;
- expects `violations.filter(v => v.impact === "serious" || v.impact === "critical")` to equal `[]`.

On failure, the message lists each violation's id and target selectors.

| Screen | How it's reached |
|---|---|
| `/` | landing |
| `/` | landing with "Other demo accounts" open |
| `/home` | Margaret, not onboarded |
| `/check` | input |
| `/check` | the scam result (stub) |
| `/check` | the not-checked result (stub) |
| `/send` | the form |
| `/send` | the high pause screen (stub) |
| `/payments/[id]` | every kind (stub): held, waiting, challenge_memory, challenge_safe_word, official_routes, stopped_by_person, sent, returning, cancelled, hold_ended, pending |
| `/circle` | Sarah, with a held payment (stub) |
| `/circle/payments/[id]` | review (stub) |
| `/circle/payments/[id]` | closed (stub) |
| `/circle/dashboard` | |
| `/trends` | |
| `/verify/[id]` | ask (stub) |
| `/verify/[id]` | not-for-you (stub) |
| `/onboarding` | each of the 4 steps |
| `/settings` | |

Add these tests to the same file:
- **Keyboard.**
  - On `/home`, the first Tab focuses the skip link ("Skip to main content"). Pressing Enter moves focus to `#main`.
  - On `/send`, a user can tab through every field and reach "Check this payment". Each focused element has a visible outline: its computed `outline-style` is not `none`.
- **Reduced motion.** With `page.emulateMedia({ reducedMotion: "reduce" })`, the held payment screen and the waiting screen have `document.getAnimations().length === 0` after load.
- **Zoom.** At 390 px with `document.documentElement.style.fontSize = "200%"`, `/home` and the held screen have `scrollWidth <= clientWidth + 1`. There is no horizontal scroll at 200% text.

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test e2e/a11y.spec.ts`
Expected: FAIL. The skip link is missing, and axe may report findings.

- [ ] **Step 3: Fix until it passes**

**Layout.** Add `<a href="#main" className="sr-only focus:not-sr-only …">Skip to main content</a>` as the first child of `<body>`. `Screen` renders its content in `<main id="main" tabIndex={-1}>`. Pages that don't use `Screen` get their own `<main id="main">`: the landing page, the dashboard and trends.

**The Plan 4A accessibility follow-ups:**
- `/home` renders a visually hidden `<h1>Home</h1>` while loading and on error.
- The `HoldRing` SVG is `aria-hidden`. The visible centre text plus a visually hidden "Hold time used: N of M hours" carry the meaning, so it is no longer read twice.
- The post-approval 401 line on `/send` sits inside the `Notice`.
- `Field` and `Notice` behave as described in Interfaces.

**Everything else axe reports:** fix it in the component, not with a page-level patch. List each fix in the report.

**Colour contrast.** Any axe contrast finding gets fixed by changing the token in `globals.css` and `DESIGN.md`, never one element. State the new ratio.

- [ ] **Step 4: Run everything and see it pass**

Run: `npm test && npm run test:int && npm run typecheck && npm run lint && npx playwright test`
Expected: PASS (the whole suite, serially, against the live sandbox and Groq).

- [ ] **Step 5: The final screenshot set and the design critique**

Save the final set (every screen in the a11y list at both widths) to the scratchpad `shots/final-4b/`.

Run a design critique against `DESIGN.md` and the concepts on these screens. Use the `frontend-design` skill's critique for product screens and `design-taste-frontend` for the landing page.
- **Screens to critique:** onboarding, settings, the notification card, Sarah's circle with alerts, and the landing page.
- **Fix:** anything that reads as a template or breaks the tokens.
- **Report:** what changed.

```bash
git add package.json package-lock.json src e2e
git commit -m "feat: pass an axe check on every screen, with a skip link, live notices and wired field hints"
```

---

## Self-review notes (completed by the plan author)

**Spec coverage**

| Spec | Where |
|---|---|
| 3: presets change the circle, thresholds and wording | Task 2 (thresholds, cooling-off), Task 3 (Business and Solo personas), Task 7 (wording on onboarding and settings), Task 1 (hold copy uses hours and names) |
| 3: Solo has a self-imposed cooling-off | Tasks 2 and 7 (Solo picks 12/24/48; no circle) |
| 4.4: cooling-off configurable, never more than 72 | Task 2 (12/24/48, ruling) |
| 5: installable PWA; `web-push` with VAPID; email alongside push | Tasks 5 and 6 |
| 6: amount above a limit the circle set | Task 2 (`circleLimitCents` from the preset feeds `OVER_CIRCLE_LIMIT`) |
| 10: onboarding (connect PayPal, invite, safe word, install and notifications) | Task 7 (PayPal line, invite mailto, safe word, alerts card with the iOS install copy) |
| 10.1: review gate (screenshots, design critique, accessibility review) | Every screen task; Task 10 runs axe on every screen and the final critique |
| 11: push not delivered means email is still sent | Task 5 (concurrent, independent, recorded) |
| 4A carry-forward "Open" items | Task 1 (dashboard label, `closedCopy`) and Task 8 (verified statistic) |
| 4A Plan 4B follow-ups | Task 1 (hold copy, held names, viewer naming), Task 4 (circle told), Task 9 (stale poll, file plus text, report re-tap, object URL, dates, tokens), Task 10 (accessibility items), Task 3 (DemoButtons loading) |
| Plan 2 Plan 4 items | Task 4 (circle told about a failed challenge; `verify_request` and `payment_held` de-duplicated), Task 5 (alert latency: concurrent channels with timeouts) |
| Hardening picked up | Task 9 (`CASCADE` dropped, `SignOutButton`), Task 3 (`Persona` union) |

Not in 4B, and left for Plan 5 or later:
- a missed `verify_request` is not re-sent (the challenge fallback covers it);
- the PayPal sandbox popup still says "Complete Purchase";
- demo login is open to CSRF;
- matchKeys edge cases;
- page-level tests for polling.

**Placeholder scan:** no TBD. UI tasks fix behaviour, copy, test ids and data flow. Visual markup follows the named concept and `DESIGN.md`. Two conditional instructions name their fallback: the empty `otherNames` list in Task 4, and the timing of the opt-in test, which moves to Task 7.

**Type consistency.** These names were checked across tasks:
- `UserSettings`, `CoolingOffHours`, `PRESETS` (Task 2 → 7);
- `coolingOffMs` (Task 2 → `paymentService`);
- `Persona` gaining `priya` and `tom` (Task 3 → 7 and 10);
- `payment_update` and `AlertPayload.reason` / `actorName` (Task 4);
- `isAlertOpen` (Task 4 → `container`);
- `PushSub`, `PushRepo`, `PushSender` (Task 5 → 6);
- `notificationState` and `notificationCopy` (Task 6 → 7);
- `circleNamesText` (Task 1 → 4);
- `formatWhen` (Task 9).

**Review Focus:** each line has a test.
1. `alertService` with throwing, hanging and 410 senders (Task 5).
2. `safeTarget` and the CDP push check (Task 6).
3. The mid-hold settings test (Task 2).
4. The `notificationState` and copy tests (Task 6).
5. `settingsService` (Task 2) and `firstUnfinished` (Task 7).
