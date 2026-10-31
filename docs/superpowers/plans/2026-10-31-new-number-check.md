# New-Number Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a checked message claims to be someone in the sender's circle and its only phone numbers aren't that person's known number, raise it to high with the first reason "It came from …, not Daniel's number." Users can add their own number in Settings.

**Architecture:**
- A nullable `users.phone` column, exposed through the existing settings service and route, and only ever returned to its owner.
- A circle-repo read gives the message service the sender's contacts with their numbers.
- A pure rule `newNumberSignal` runs inside `assessMessage` after the AI judge, reusing `matchRequester` (exactly-one match) and `matchKeys` (format-blind comparison).
- `ruleLevel` treats the new signal as high, so the existing `flaggedPayees` link to payments needs no change.
- A final task makes the eval write its git SHA and adds `eval:check`, which fails when the README or submission numbers drift from `docs/eval/results.md`.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs` before touching routes; route files may only export handlers), TypeScript strict, Drizzle + Postgres, Vitest (`npm test`; `npm run test:int` uses docker db-test on 5434, files `*.int.test.ts`), Playwright (`npm run test:e2e`).

**Spec:** `docs/superpowers/specs/2026-10-31-new-number-check-design.md`

## Global Constraints

- Never log a phone number, a known number or message text. Log only error class and status.
- A user's own number is returned only to that user (`GET /api/me`, the `PUT /api/me/settings` response). No other endpoint, view or screen returns it. Margaret's result names the *message's* number, never Daniel's.
- Numbers are compared only through `matchKeys` (`src/messages/identifiers.ts`).
- Stored number: trimmed, as written, at most 32 characters; valid with 7 to 15 digits; `""` or `null` clears it.
- Validation copy, exact: `Please enter a phone number with 7 to 15 digits, or leave it empty.`
- Signal code `NEW_NUMBER_CLAIMS_CIRCLE`. Detail copy, exact: `` `It came from ${number}, not ${member.displayName}'s number.` ``. `number` is the first non-matching phone *as written in the message* (recovered from the text with `phoneAsWritten`; `Identifier.value` is normalised).
- Settings copy, exact: heading `Your phone number`; helper `If someone messages your circle claiming to be you from a different number, they'll be warned. Your number is never shown to anyone else.`
- Demo numbers, exact: Daniel `+1 (415) 555-0131`, Sarah `+1 (415) 555-0135`, Tom `+1 (415) 555-0147`. Don't use any other `555-01xx` number already in the repo (0199, 0123, 0178, 0177, 0164, 0142, 0109, 0102).
- A message from the member's known number is never lowered or reassured; the signal simply doesn't fire.
- Never open, print or stage `.env.local`. Never stage `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- Commit trailers on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```

## Review Focus

1. **Daniel's number leaking to Margaret.** Any endpoint that returns circle contacts must not carry `phone`. Pinned in Task 1 (`/api/me` for Margaret has no phone of Daniel's) and Task 2 (`contactsOf` is unchanged; only the new method returns phones).
2. **A message with both Daniel's known number and a new one.** The spec says it fires only when *none* match, so this must not fire. Pinned in Task 2.
3. **The same number in another format** (`415-555-0131`, `4155550131`, `+1 (415) 555-0131`) must count as a match. Pinned in Task 2.
4. **Numbers that aren't phones** (times like "9:30", amounts like "$800", dates) must not create a phone and so must not fire. Pinned in Task 2.
5. **A judge on the public demo clears Daniel's number,** breaking the story for the next viewer. The demo reset restores the demo numbers. Pinned in Task 1.

---

### Task 1: Users can store their own phone number (data, settings, demo)

**Files:**
- Modify: `src/db/schema.ts` (users: `phone: text("phone")`, nullable). Generate migration `drizzle/0009_*.sql` with `npx drizzle-kit generate`; commit the SQL and the `drizzle/meta` changes.
- Modify: `src/settings/settingsRepo.ts`, `src/settings/drizzleSettingsRepo.ts`, `src/settings/settingsService.ts`
- Modify: `src/app/api/me/settings/route.ts`, `src/app/api/me/route.ts`
- Modify: `src/server/demo.ts` (add `DEMO_PHONES`), `src/server/demoSeed.ts`, `src/server/demoReset.ts`
- Test: `src/settings/settingsService.test.ts`, `src/settings/drizzleSettingsRepo.int.test.ts`, `src/app/api/me/settings/route.test.ts`, the existing `/api/me` route test (create `src/app/api/me/route.test.ts` if there is none), the existing demo reset test

**Interfaces:**
- Produces: `UserSettings.phone: string | null`; `settings.setPhone(userId: string, phone: string | null): Promise<UserSettings>`; `DEMO_PHONES: Partial<Record<Persona, string>>` in `src/server/demo.ts` = `{ daniel: "+1 (415) 555-0131", sarah: "+1 (415) 555-0135", tom: "+1 (415) 555-0147" }`.

- [ ] **Step 1: Failing tests**
  - `settingsService.test.ts`:
    - `setPhone stores a trimmed number`: `setPhone(id, "  +1 (415) 555-0131 ")` → `phone === "+1 (415) 555-0131"`.
    - `setPhone clears on empty or null`: `""` and `null` both → `phone === null`.
    - `setPhone rejects bad numbers`: `"call me"`, `"123456"` (6 digits), `"1234567890123456"` (16 digits), a 33-character string, and a non-string (`42 as never`) each throw `SettingsInputError` with the exact validation copy.
    - Defaults include `phone: null`.
  - `drizzleSettingsRepo.int.test.ts`: `update(id, { phone })` round-trips, and `get` returns it.
  - `route.test.ts` (settings): `PUT { phone: "+1 (415) 555-0131" }` → 200 and the body has `phone`; `PUT { phone: "nope" }` → 400 with the exact copy.
  - `/api/me` test: the response includes the caller's own `phone`; for Margaret, `JSON.stringify(body)` does not contain `555-0131` (Daniel's number) even though Daniel is in her circle.
  - Demo reset test: after a reset, Daniel's `phone` equals `DEMO_PHONES.daniel`, even if it was set to `null` before the reset.
- [ ] **Step 2: Run them and see them fail.** `npm test -- settings me demo` and `npm run test:int -- drizzleSettingsRepo`.
- [ ] **Step 3: Implement.**
  - Add `phone` to the settings repo `columns` and `view`.
  - `setPhone`: trim, `""` → `null`; validate the digit count with `replace(/\D/g, "")` (7–15) and the length (≤ 32).
  - The route reads `body.phone` when it isn't `undefined`. `/api/me` adds `phone: prefs.phone` for the caller only.
  - The demo seed sets the numbers from `DEMO_PHONES` (on insert and on conflict). The demo reset sets each persona's number from `DEMO_PHONES` and sets the others to `null`.
- [ ] **Step 4: Run all tests.** `npm test`, `npm run test:int`, `npm run typecheck`, `npm run lint`: all pass.
- [ ] **Step 5: Commit** `feat: people can add their own phone number in settings (data and API)`.

### Task 2: The new-number rule in the message check

**Files:**
- Create: `src/messages/newNumber.ts`, `src/messages/newNumber.test.ts`
- Modify: `src/risk/signals.ts` (add `"NEW_NUMBER_CLAIMS_CIRCLE"` to `SignalCode`; `ruleLevel` returns `"high"` for it, beside `LINKED_SCAM_MESSAGE`)
- Modify: `src/messages/assessMessage.ts` (new optional `ctx.circle`), `src/messages/messageService.ts` (new optional dep `circle`), `src/server/container.ts` (wiring)
- Modify: `src/circle/circleRepo.ts`, `src/circle/drizzleCircleRepo.ts` (new method)
- Test: `src/messages/assessMessage.test.ts`, `src/messages/messageService.test.ts`, `src/messages/messageService.int.test.ts`; any exhaustive `SignalCode` map that typecheck flags (e.g. signal labels) gets the new code

**Interfaces:**
- Consumes: `matchRequester(name, circle): CircleMember | null` (`src/verification/matchRequester.ts`; returns a member only on exactly one match); `matchKeys`; `Identifier`; `Requester`.
- Produces:
  - `type KnownContact = CircleMember & { phone: string | null }` (in `src/circle/circleRepo.ts`);
  - `CircleRepo.contactsWithPhones(senderId: string): Promise<KnownContact[]>`. `createMemoryCircleRepo` gets the numbers from a new optional seed field `phones?: Record<string, string>` (userId → number);
  - `newNumberSignal(requester: Requester | null, identifiers: Identifier[], circle: KnownContact[]): Signal | null`;
  - `assessMessage(input, ctx: { registry; circle?: KnownContact[] }, deps)`;
  - `createMessageService({ ..., circle?: (senderId: string) => Promise<KnownContact[]> })`.

- [ ] **Step 1: Failing tests in `newNumber.test.ts`.** Circle = Daniel (relationship "grandson", phone `+1 (415) 555-0131`) and Sarah ("daughter", `+1 (415) 555-0135`). The requester is `{ kind: "person", name }`.
  - `fires for Daniel from a new number`: name "Daniel", phones [`+1 (415) 555-0199`] → code `NEW_NUMBER_CLAIMS_CIRCLE`, detail exactly `It came from +1 (415) 555-0199, not Daniel's number.`
  - `matches by relationship`: name "your grandson" → fires, naming Daniel.
  - `same number in other formats does not fire`: `4155550131`, `415-555-0131`, `+1 (415) 555-0131` → `null` each.
  - `known number plus a new one does not fire` → `null`.
  - `null` for: no phone identifiers; requester `null`; `kind: "organisation"`; an unknown name ("Kevin"); an ambiguous name (two members with relationship "grandson"); a matched member with `phone: null`.
  - `names the first non-matching number as written`: phones [`+1 (415) 555-0131`, `(415) 555 0186`] → `null` (the known number is present). Phones [`(415) 555 0186`, `+44 7700 900123`] → detail uses `(415) 555 0186`.
- [ ] **Step 2: Failing tests in `assessMessage.test.ts`.**
  - `new-number raises medium to high and leads the reasons`: judge says medium for Daniel; text contains `+1 (415) 555-0199`; circle as above → level `high`, `reasons[0]` is the detail.
  - `new-number line leads even when the AI already said high`: judge high with reasons ["a","b","c"] → `reasons[0]` is the detail, `reasons.length <= 3`, no duplicates.
  - `times and amounts are not phones`: "Gran it's Daniel, meet at 9:30, need $800 by 2026-10-31" → no `NEW_NUMBER_CLAIMS_CIRCLE`.
  - `no circle given → no signal`: called without `ctx.circle`.
  - `unchecked judge → no signal`: judge fails → no `NEW_NUMBER_CLAIMS_CIRCLE`.
- [ ] **Step 3: Failing tests in the service.**
  - `messageService.test.ts`: `check` passes the sender's `circle(senderId)` result into the assessment (a Daniel new-number message ends high).
  - `messageService.int.test.ts`: seeded Margaret → Daniel link with Daniel's phone set; check "Hi Gran it's Daniel, lost my phone, new number +1 (415) 555-0186, need $600 today" with a faked judge (medium, requester Daniel) → stored level `high`; then `linkedMessage(margaret, "+1 (415) 555-0186")` returns the text.
  - A drizzle circle-repo int test: `contactsWithPhones` returns the phone; `contactsOf` results have no `phone` key.
- [ ] **Step 4: Run them and see them fail.**
- [ ] **Step 5: Implement.**
  - `newNumberSignal`: if the requester isn't a person → `null`. Otherwise `matchRequester(requester.name, circle)`, and the member must have a phone. Take the phone identifiers. If any shares a `matchKeys` key with the member's phone → `null`. Otherwise the signal for the first one.
  - In `assessMessage`, compute it only when the judge is ok, and put it **first** in `signals`. After `decide`, if it fired, set `reasons = [detail, ...reasons without detail].slice(0, 3)`.
  - Container: `circle: (id) => circle.contactsWithPhones(id)`.
- [ ] **Step 6: Run all tests.** `npm test`, `npm run test:int`, typecheck, lint: all pass.
- [ ] **Step 7: Commit** `feat: a message claiming to be someone in the circle from a new number is high risk`.

### Task 3: Settings screen and the result on screen

**Files:**
- Modify: `src/app/settings/page.tsx` (new `Section` titled `Your phone number`, after the existing sections, before Safe word)
- Modify: `e2e/onboarding.spec.ts` or a new `e2e/settings.spec.ts`; `e2e/check-message.spec.ts`, `e2e/stubs.ts`
- Test: those e2e files

**Interfaces:**
- Consumes: `PUT /api/me/settings { phone }` and `GET /api/me` `phone` (Task 1).

- [ ] **Step 1: Failing e2e tests.**
  - `Daniel adds his number in settings`: sign in as Daniel, open Settings, fill the field labelled `Your phone number` with `+1 (415) 555-0131`, click `Save number`, and see `Saved.`. Reload: the field still shows the number.
  - `a bad number shows the error`: `call me` → the exact validation copy is visible, and the field keeps the text.
  - `check result leads with the new-number line`: a stubbed check whose `reasons[0]` is `It came from +1 (415) 555-0199, not Daniel's number.` → that text is visible under "What gave it away".
- [ ] **Step 2: Run them and see them fail.** `npm run test:e2e -- settings check-message`.
- [ ] **Step 3: Implement the section.**
  - Fields: the exact helper copy; an `<input type="tel" autocomplete="tel">` labelled `Your phone number`, prefilled from `/api/me`; a `Save number` button.
  - Status line `Saved.` on success, or the server's error message, using the page's existing status and error pattern and styles.
  - Saving an empty field clears the number, with status `Saved.`.
- [ ] **Step 4: Run `npm run test:e2e`** (full) and `npm test`, typecheck and lint: all pass.
- [ ] **Step 5: Commit** `feat: settings lets people add their own phone number`.

### Task 4: Eval cases with a circle, git SHA in results, and `eval:check`

**Files:**
- Modify: `src/eval/cases.ts` (message cases take an optional `circle?: KnownContact[]`; add two cases), `src/eval/runEval.ts` (pass `{ registry: NO_REGISTRY, circle: c.circle }`)
- Create: `src/eval/factsCheck.ts`, `src/eval/factsCheck.test.ts`, `scripts/eval-check.ts`
- Modify: `scripts/eval-live.ts` (the first line of results gains `` at commit `<short sha>` ``, from `git rev-parse --short HEAD`, plus `-dirty` when `git status --porcelain` is non-empty), `package.json` (`"eval:check": "tsx scripts/eval-check.ts"`), `.github/workflows/ci.yml` (an `npm run eval:check` step after the unit tests)
- Test: `src/eval/eval.test.ts`, `factsCheck.test.ts`

**Interfaces:**
- Produces:
  - `parseResults(md: string): { total: number; scams: number; genuine: number; scamsHeld: number; genuineHeld: number }`, read from the results line `on N invented cases (S scams, G genuine)` and the table rows `| Scams held | x of S` and `| Genuine cases held | y of G`;
  - `checkFacts(results: string, docs: Record<string, string>): string[]` (one problem per mismatch; empty when all agree).

- [ ] **Step 1: Failing tests.**
  - `eval.test.ts`: a message case with a circle passes it to the assessment. With a fake judge naming Daniel and the text containing `+1 (415) 555-0186`, the result's signals include `NEW_NUMBER_CLAIMS_CIRCLE`.
  - The cases exist: `m-nn-01` (family, scam) "Hi Gran it's Daniel, I lost my phone so this is my new number +1 (415) 555-0186. I need $600 for rent today, please don't tell mum." and `m-nn-02` (family, genuine) "Hi Gran, it's Daniel. Running late for Sunday lunch, call me on +1 (415) 555-0131 if you need anything." Both have circle `[{ contactId: "eval-daniel", displayName: "Daniel", relationship: "grandson", phone: "+1 (415) 555-0131" }]`.
  - `factsCheck.test.ts`:
    - `parseResults` reads 77/42/35/42/1 from a sample shaped like the current `docs/eval/results.md`.
    - `checkFacts` is empty when the README has `77 invented cases (42 scams, 35 genuine)`, `| Scams held | 42 of 42`, `| Genuine cases held | 1 of 35`, and the submission has `77 labelled cases` and `1 of 35 genuine`.
    - It reports a problem naming the file for a stale `76 labelled cases`, any other `N (invented|labelled|hand-written) cases` with N ≠ total, or a wrong held count.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
  - `scripts/eval-check.ts` reads `docs/eval/results.md`, `README.md` and `docs/submission.md`. It prints each problem and exits 1 if there are any, or prints `eval:check: README and submission match docs/eval/results.md` and exits 0.
  - Don't run `eval:live` in this task (Task 5 does), and don't edit published numbers by hand.
- [ ] **Step 4: Run `npm test`,** typecheck and lint: all pass. Run `npm run eval:check` against the current docs (77 cases): it passes, because the new cases don't change the results file until a re-run.
- [ ] **Step 5: Commit** `feat: eval covers the new-number check; results carry the commit; eval:check guards published numbers`.

### Task 5: Live run, published numbers and copy

**Files:**
- Modify: `docs/eval/results.md` (generated), `README.md`, `docs/submission.md`

- [ ] **Step 1: Run `npm run eval:live`.** It reads `.env.local` through `tsx --env-file`; never open or print that file. It rewrites `docs/eval/results.md` with 79 cases and the commit.
- [ ] **Step 2: Update every number** in `README.md` and `docs/submission.md` from the new `results.md` only, including the rules-only and "AI unavailable" figures if they changed. Then run `npm run eval:check`: it must pass.
- [ ] **Step 3: Copy.**
  - README "What it does" and the submission's **Check a message** bullet get one sentence: *"If a message claims to be someone in the circle but comes from a number that isn't theirs, it says so first: "It came from +1 (415) 555-0199, not Daniel's number.""*
  - Add one row to the README's limits or honest notes: *"The new-number check only works when a number appears in the message or screenshot. A WhatsApp screenshot from a saved contact shows a name, not a number."*
- [ ] **Step 4: Run all checks.** `npm test`, `npm run eval:check`, typecheck, lint.
- [ ] **Step 5: Commit** `docs: eval re-run with the new-number cases; README and submission from the run`.
