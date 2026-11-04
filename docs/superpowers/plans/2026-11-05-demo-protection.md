# Demo protection: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the public demo stays up and honest until Dec 15, even if many judges hammer it or Groq's quota runs out. AI that can't run never makes a payment look safe.

**Source:** agreed on 2026-11-04 (hub order item 3): a rate limit on message checks, a daily Groq cap that routes to unchecked → hold, and the flaky pwa push test.

**Tech:** Next.js 16.4 (read `node_modules/next/dist/docs` before touching routes), Drizzle and Postgres, Vitest, Playwright.

## Global Constraints

- **Copy:** calm, plain, no blame. Use the exact strings below verbatim.
- **Never log** message text, payees, PayPal ids or keys. Log only the error class or a count.
- **Model:** every subagent runs on Sonnet and uses graft (`graft ask --source`, `graft grep`, `graft skeleton`, `graft callers`; never `graft build` or `graft init`).
- **Secrets:** never open, print, edit or stage `.env.local`.
- **Never stage** `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- **Landing statistic** stays exactly as it is. Don't rerun `npm run eval:live`, which costs Groq quota.
- **Commit trailers:**
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```

## Review Focus

1. **Judges share personas.** Many judges sign in as Margaret at once, so a per-user limit alone would lock them all out together. Limits key on the client IP (first `x-forwarded-for` entry, which Render sets), falling back to the user id.
2. **The cap is shared by every Groq call.** That covers the payment judge, message judge, prompt guard, transcriber, pattern describer and aftercare agent. A call over the cap must make the feature degrade the way a Groq outage already does, never throw a 500.
3. **The counter must not take the app down.** If the usage table can't be read, the call goes ahead (fail open) and a warning with only the error class is logged.
4. **An unchecked payment is held, never low.** This covers a payment whose AI check failed for any reason (cap, timeout, outage).

---

### Task 1: Daily Groq cap, and an unchecked payment is held

**Files:**
- Create: `src/ai/groqBudget.ts`, `drizzle/0012_ai_usage.sql` (+ journal entry), and a Drizzle table `aiUsage` (`day` date primary key, `calls` integer not null default 0) next to the other tables.
- Modify: `src/config/env.ts`, adding `GROQ_DAILY_CAP` (coerced positive int, default `3000`).
- Modify: `src/server/container.ts`, passing one budgeted `fetchImpl` to every Groq factory and to the aftercare agent's chat.
- Modify: `src/payments/paymentService.ts` `start()` (or `src/risk/assess.ts`, whichever keeps `decide()` untouched).
- Modify: `src/eval/rulesOnly.ts` and `docs/eval/results.md`.

**Interfaces:**
- `createGroqBudget(opts: { cap: number; count: (day: string) => Promise<number>; fetchImpl?: typeof fetch; now?: () => Date }): typeof fetch`.
  - `count` atomically increments today's row (UTC `YYYY-MM-DD`) and returns the new total: `INSERT … ON CONFLICT (day) DO UPDATE SET calls = ai_usage.calls + 1 RETURNING calls`.
  - When the total is over `cap`, the returned fetch **throws** `GroqBudgetError` (name `"GroqBudgetError"`) without calling the network. The existing `groqChat`/transcriber catch blocks then return `{ ok: false }`.
  - Only URLs on `api.groq.com` are counted. Anything else passes through.
  - If `count` rejects, the call goes ahead and `console.warn("ai usage unavailable", { error: e.name })` is logged.

**Rules:**
- **Unchecked payment:** when the payment's AI check failed (`decision.aiUsed === false`), the stored level is `"high"`, so the payment is held, whatever the rules said. If the reasons are empty, they become exactly `["We couldn't run our scam check just now, so we're holding this payment until someone you trust confirms it."]`. Rule reasons that are already present are kept.
- **Eval fallback row:** `rulesOnlyComparison`'s `aiUnavailable` becomes `"high"` for every payment, matching the product. In `docs/eval/results.md` line 46, change only the "AI unavailable (fallback)" row to `23 of 23 | 23 of 23 | 20 of 20 | 20 of 20`. Change the same formula in `scripts/eval-live.ts` if it duplicates it. No other number changes.
- Messages are unchanged: they already show "unchecked", never safe.

- [ ] **Step 1: Failing tests.**
  - `src/ai/groqBudget.test.ts`:
    - under the cap, it passes the call through;
    - over the cap, it throws `GroqBudgetError` and the inner fetch isn't called;
    - non-Groq URLs aren't counted;
    - when `count` rejects, it still calls through;
    - the day key is the UTC date.
  - Payment service test: with a judge that returns `{ok:false}` and no rule signals, the payment's `riskLevel` is `"high"` and its reasons equal the exact string above.
  - `rulesOnly.test.ts`: `aiUnavailable` holds every payment.
  - Integration test (`npm run test:int`): the counter increments atomically under 10 concurrent calls and ends at 10.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, `npm run test:int`, the full `npm run test:e2e`, typecheck and lint. Adapt any e2e test whose stubbed judge fails on purpose and now sees a hold, and name each one in the report.
- [ ] **Step 5:** Commit `feat: a daily cap on AI calls; a payment the AI couldn't check is held`.

### Task 2: Rate limit on message checks

**Files:**
- Create: `src/server/rateLimit.ts`.
- Modify: `src/app/api/messages/check/route.ts`.
- Tests: `src/server/rateLimit.test.ts`, plus a route test next to the route.

**Interfaces:**
- `createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): { take(key: string): boolean }`. It keeps a rolling window in memory (one Render instance) and drops old timestamps on each take. It returns `false` when over the limit.
- `clientKey(req: Request, userId: string): string`. This is the first trimmed `x-forwarded-for` entry when present, otherwise `user:${userId}`.

**Rules:**
- **Limit:** 20 checks per 10 minutes per client key, for every check kind: text, image and voice. The voice-per-hour limit stays as it is.
- **Order:** the limiter runs after the 401 check and before parsing the body. Over the limit, it returns 429 with exactly `{ "error": "You've checked a lot of messages in the last few minutes. Please wait a little and try again." }`. `/check` already shows a 429's `error`; confirm it does.
- **Placement:** one limiter instance lives at module scope in the route file. Route files export only handlers, so keep `const` non-exported.

- [ ] **Step 1: Failing tests.**
  - The limiter:
    - the 21st take inside the window is false;
    - after the window passes it is true again;
    - keys are independent.
  - `clientKey`: it uses the first XFF entry and falls back to the user.
  - Route: the 21st POST returns 429 with the exact copy, and the judge isn't called for it.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, the full e2e suite (make sure the e2e suite itself doesn't do more than 20 checks per 10 minutes from one key; if it does, give the limiter's limit an env override `MESSAGE_CHECKS_PER_10_MIN` that is used only by the e2e web server config, and say so), typecheck and lint.
- [ ] **Step 5:** Commit `feat: message checks are rate limited per visitor`.

### Task 3: Stabilise the pwa push e2e test

**Files:** `e2e/pwa.spec.ts:33` ("a push shows a notification, even when its url points elsewhere"), plus whatever the root cause touches.

**Rules:**
- Find the root cause using superpowers:systematic-debugging. Fails about 2 runs in 3, on main as well. No retries, no longer fixed sleeps. Wait on a real condition, such as the service worker being `activated` and controlling the page, or the notification promise.
- Prove it: run that file 10 times in a row (`npx playwright test e2e/pwa.spec.ts --repeat-each=10`), and get 10 out of 10 green.

- [ ] **Step 1:** Reproduce it and write the cause into the report.
- [ ] **Step 2:** Fix it.
- [ ] **Step 3:** Run the 10× proof and the full e2e suite.
- [ ] **Step 4:** Commit `test: the push notification e2e waits for the service worker it needs`.
