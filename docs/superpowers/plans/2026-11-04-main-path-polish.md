# Main-path polish (walk-through fixes): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a first-time judge plays Margaret → Daniel → Sarah in one browser without setup chores, dead ends or stale screens.

**Source:** Prateek's production walk-through on 2026-11-04 (approved "yes start"), plus the hub session's main-path inventory (Task 4). The judge's click path this plan serves:
1. `/` → Try as Margaret.
2. Check a message → Try an example → the new-number result.
3. Pay from this check → PayPal approval → held.
4. "See what Daniel sees" → It wasn't me.
5. Back to Margaret → voided.
6. Optional: Sarah's dashboard.

**Tech:** Next.js 16.4 (read `node_modules/next/dist/docs` before touching routing, config or headers), React 19, Tailwind, Vitest, Playwright.

## Global Constraints

- **Copy:** calm, plain words, no blame. Exact strings are given below; use them verbatim.
- **Don't break existing e2e stories.** Adapt a test only when the behaviour it pinned is deliberately changed here, and say so in the report.
- **Model:** every subagent runs on Sonnet, and uses graft for code lookups (never `graft build` or `graft init`).
- **Secrets:** never open, print, edit or stage `.env.local`.
- **Never stage** `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- **Commit trailers:**
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```

## Review Focus

1. **The onboarding flow itself must still work** for a person who isn't onboarded. Prateek can demo it from Settings, and its e2e stays green.
2. **Switching person mid-story** must never show another person's payment, and must never leave a frozen screen.
3. **Desktop layout:** the footer actions sit under the content. On phones (under 768 px), actions stay at the bottom of the screen as today.

---

### Task 1: Demo people arrive set up

**Files:**
- Modify: `src/server/demoSeed.ts` (`upsertUser`) and `src/server/demoReset.ts:22`
- Tests: the demo seed/reset tests (find them with graft), and `e2e/onboarding.spec.ts` if it relies on a persona being un-onboarded

**Rules:**
- Seed and reset set `onboardedAt` to the current time for every demo persona, instead of `null`. Reset still clears `safeWordHash` and still sets `coolingOffHours: 24`.
- The safe-word row is removed from home for everyone. Settings keeps the safe word, so home shows only the loop: Check, Send, Recent.
- If `e2e/onboarding.spec.ts` needs an un-onboarded person, it clears that person's `onboardedAt` in its own setup (through an existing test helper or route), rather than relying on the seed.

- [ ] **Step 1: Failing tests.**
  - Unit: after `demoReset`, every persona has non-null `onboardedAt` (memory or int test, whichever the existing reset tests use).
  - e2e in `e2e/smoke.spec.ts`: `test("Margaret's home has no setup card")`. Log in as Margaret and expect `getByTestId("setup-card")` to have count 0.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement. Keep the onboarding e2e green.
- [ ] **Step 4:** Run `npm test`, `npm run test:int`, the touched e2e files, typecheck and lint.
- [ ] **Step 5:** Commit `fix: demo people arrive set up, so the story starts without a setup card`.

### Task 2: Switch demo person from any screen, and no frozen tab after a switch

**Files:**
- Create: `src/ui/SwitchPerson.tsx`, a small link component.
- Modify: `src/ui/Screen.tsx`. Render `SwitchPerson` at the top right of every Screen-based page.
- Modify: `src/app/circle/dashboard/page.tsx` and `src/app/trends/page.tsx` if they don't use `Screen`.
- Modify: `src/app/payments/[id]/page.tsx` (silent-poll 403/404 handling).
- Modify: the landing page, so it shows the demo buttons even when someone is signed in (check what `/` does today for a signed-in user).
- Tests: `e2e/access.spec.ts` or a new `e2e/switch-person.spec.ts`

**Rules:**
- **The link:** text "Switch person", going to the landing page's demo buttons (`/#try`, or whatever anchor the landing has; add `id="try"` to the demo buttons block if needed). Every page that has `SignOutButton` keeps it. The new link goes on the screens that have no sign-out: payments, verify, check, send, settings, dashboard and trends.
- **Context link on the payment page:** while Margaret's payment waits for the impersonated person (the screen that says "We've asked Daniel…"), the page shows a secondary link "See what {name} sees" (name from that screen's data). It logs in as that person via `POST /api/demo/login` and opens their request (`/verify/[id]`, or wherever the existing "Answer" link goes).
  - Find the persona key from the circle member's email through the existing `DEMO_PERSONAS` map. Expose a small helper; never guess.
  - The link is hidden when the person isn't a demo persona.
- **Payment page:** when a silent poll gets a 403 or 404, the page shows a calm notice instead of keeping the stale screen. The copy is exact: title "You've switched to someone else", body "This payment belongs to another person in the demo. Switch back to see it.", and a link "Switch person". The `signedOut` behaviour on 401 is unchanged. Polling **continues** in the switched state. When a later poll succeeds again (the viewer switched back to Margaret in another tab), the screen returns to the live payment on its own, for example showing it as stopped.

- [ ] **Step 1: Failing e2e tests:**
  - `test("a payment screen offers Switch person")`: as Margaret, open an existing payment (seeded) and expect the link "Switch person" to be visible.
  - `test("a payment tab notices a switch instead of freezing")`: as Margaret, open a polled payment (one in a polled state; create one as the existing protected-transfer e2e does, or reuse a seeded held payment), then log in as Daniel via `page.request.post("/api/demo/login", { data: { as: "daniel" } })`. Expect "You've switched to someone else" within 10 s.

  - Extend that test: log back in as Margaret, and expect the switched notice to disappear and the payment screen to return within 10 s.
  - `test("the waiting screen offers See what Daniel sees")`, where a polled payment waits for Daniel.

  If no seeded payment is in a polled state, add the smallest stub the existing e2e helpers allow, and say how in the report.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full e2e suite, `npm test`, typecheck and lint.
- [ ] **Step 5:** Commit `feat: Switch person on every screen; a payment tab notices a switch`.

### Task 3: Desktop footer sits under the content; voice in the home copy; no cached API answers

**Files:**
- Modify: `src/ui/Screen.tsx`. From the `md` breakpoint up, the footer follows the content with the existing `mt-8` gap. Below `md`, keep today's push-to-bottom (`flex-1` / `min-h-dvh`).
- Modify: `src/app/home/page.tsx`. The "Check a message" subtitle becomes exactly: `Paste a text, or add a screenshot or a voice note. We'll tell you if it looks like a scam.`
- Modify: one place that marks every `/api` GET response `Cache-Control: no-store`. Prefer `next.config` `headers()` for `/api/:path*` if Next 16 supports it (check the docs); otherwise use a shared response helper.
- Tests: an e2e at 1280×800 for the send pause screen or any Screen with a footer. Plus a unit or e2e check of the header.

- [ ] **Step 1: Failing tests.**
  - e2e `test("on desktop the actions sit just under the content")`: as Margaret at 1280×800, open a seeded payment screen that has a footer. Expect the footer's top minus the last content block's bottom to be under 120 px.
  - e2e or route test: `GET /api/circle/dashboard/paypal` as Sarah has `cache-control` containing `no-store`.
  - Update the home copy assertion if one exists.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement. Check at 390 px that the existing phone e2e tests still pass.
- [ ] **Step 4:** Run the full e2e suite, `npm test`, typecheck and lint.
- [ ] **Step 5:** Commit `fix: desktop actions follow the content; voice notes in the home copy; API answers are never cached`.

### Task 4: Main path first (from the hub inventory)

**Files:**
- `src/app/DemoButtons.tsx` and the landing page.
- `src/app/circle/page.tsx`, including the Trends link at :153.
- The check page (`src/app/check/CheckForm.tsx` or `page.tsx`).
- Tests: `e2e/smoke.spec.ts`, `e2e/check-message.spec.ts`, and the e2e that covers the circle.

**Rules (copy verbatim):**
- **Landing buttons:** primary buttons in this order: "Try as Margaret", "Try as Daniel, her grandson", "Try as Sarah, her daughter". The `<details>` summary becomes "Also built: business and edge cases" and holds Priya, Tom and Robert.
- **Landing steps:** "How a payment is protected" steps name who to be. Step 1 and Step 2 end with " (as Margaret)", Step 3 with " (as Daniel)". Step 4 stays unchanged.
- **Landing footer:** add a small "Also built" block with a "Scam trends" link to `/trends`.
- **`/circle`:** remove the "Scam trends" link. Keep "See all payments".
  - When the viewer has a "Did you just ask…" request, that card comes **first** in "Needs you", above any "Review the payment" card.
- **`/check`:** a secondary button "Try an example message" fills the text box with exactly: `Hi Grandma it's me, I lost my phone so this is my new number. I need $800 in gift cards today. Please don't tell mom. Text me at +1 (415) 555-0199`. It doesn't submit.

- [ ] **Step 1: Failing e2e tests:**
  - landing shows the three primary buttons in order;
  - `/circle` has no "Scam trends" link;
  - as Daniel, with a pending request, the first card in "Needs you" is "Did you just ask Margaret…";
  - "Try an example message" fills the box with the exact text.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement. Update any e2e test that clicked "Other demo accounts" to the new summary text.
- [ ] **Step 4:** Run the full e2e suite, `npm test`, typecheck and lint.
- [ ] **Step 5:** Commit `feat: the main path comes first; Daniel on the landing; example message; trends under Also built`.
