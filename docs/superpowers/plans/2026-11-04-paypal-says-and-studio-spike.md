# "PayPal says" column and AG Studio spike: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sarah's dashboard shows PayPal's own status for each payment beside ours (Part A of the spec). A throwaway spike settles how AG Studio and its Agent Framework run in this app (input to Part B's plan).

**Architecture:** two read methods are added to `PayPalGateway`, through the APIMatic-generated `@paypal/paypal-server-sdk`. A small `paypalSays` service in `src/dashboard/` picks the right id per payment, caps and caches the reads, and maps PayPal's word against our dashboard status. A new route serves it, and the dashboard fetches it after the main data.

**Tech Stack:** Next.js 16.4 App Router, TypeScript strict, Vitest + msw, Playwright, `@paypal/paypal-server-sdk` 2.5.

**Spec:** `docs/superpowers/specs/2026-11-04-sponsor-depth-design.md` (Part A, and Part B's spike bullet).

## Global Constraints

- **Sandbox only,** through the existing `createPayPalGateway` client.
- **Never log** payee, PayPal ids, response bodies, prompts or answers. Log only the error class name and HTTP status.
- **A failed or timed-out read shows "Not checked",** never a guess. A payment is never shown as fine when PayPal couldn't be asked.
- **Limits:** at most **20** PayPal reads per request, **4** at a time, each result cached in memory for **10 minutes** per payment.
- **Labels, exact copy:** "Voided", "On hold", "Captured", "Refunded", "Expired", "Not checked", "Doesn't match".
- **Next.js 16:** read `node_modules/next/dist/docs` before writing a route. Route files export only handlers.
- **Model:** every subagent runs on Sonnet.
- **Secrets:** never open, print, edit or stage `.env.local`.
- **Never stage** `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- **Commit trailers:**
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```

## Review Focus

1. **A payment with no PayPal id yet** (not approved, in progress) must show nothing, not "Not checked". Task 2 tests it.
2. **PayPal returns a status we don't know** (`DENIED`, `PARTIALLY_CAPTURED`). Show PayPal's word, title-cased, and never "Doesn't match" on its own. Task 2 tests it.
3. **A refunded payment whose capture still reads `COMPLETED`** (refund not visible yet) must agree, not mismatch. Task 2 tests it.
4. **One read throws or times out.** The other payments still get answers, and that one shows "Not checked". Task 2 tests it.
5. **Phone width.** The 4-column grid keeps Amount fully visible with no sideways scroll. "PayPal says" appears in the details panel only. The existing e2e already covers this, and Task 4 keeps it green.

---

### Task 1: Gateway reads for an authorisation and a capture

**Files:**
- Modify: `src/payments/paypalGateway.ts` (interface plus implementation)
- Test: `src/payments/paypalGateway.test.ts`
- Modify: every `PayPalGateway` fake that stops type-checking (`src/payments/paymentService.test.ts`, `src/verification/verificationService.test.ts`, and any other `npm run typecheck` names). The new methods default to `vi.fn().mockResolvedValue({ status: null })`.

**Interfaces:**
- Produces, on `PayPalGateway`:
  - `getAuthorizationStatus(a: { authorizationId: string }): Promise<{ status: string | null }>`
  - `getCaptureStatus(a: { captureId: string }): Promise<{ status: string | null }>`
  - Each is PayPal's `status` field, or null when the body has none. Failures throw `PayPalError` through the existing `toPayPalError`.

- [ ] **Step 1: Write the failing tests** in `paypalGateway.test.ts`, using the file's msw style with an `http.get` handler:
  - `it("reads an authorisation's status")`: GET `${BASE}/v2/payments/authorizations/AUTH1` → `{ id: "AUTH1", status: "VOIDED" }`. Expect `await gw.getAuthorizationStatus({ authorizationId: "AUTH1" })` toEqual `{ status: "VOIDED" }`.
  - `it("reads a capture's status")`: GET `${BASE}/v2/payments/captures/CAP1` → `{ id: "CAP1", status: "COMPLETED" }`. Expect toEqual `{ status: "COMPLETED" }`.
  - `it("a 404 on a read is a PayPalError with the status")`: GET authorisation → 404 `{ name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }], debug_id: "D1" }`. Expect rejects toBeInstanceOf(PayPalError), with `status` 404 and `issue` "INVALID_RESOURCE_ID".
- [ ] **Step 2: Run** `npx vitest run src/payments/paypalGateway.test.ts`. Expected: FAIL (methods not defined).
- [ ] **Step 3: Implement** both methods with `payments.getAuthorizedPayment({ authorizationId })` and `payments.getCapturedPayment({ captureId })` from the existing `PaymentsController`. Check the exact request shape in `node_modules/@paypal/paypal-server-sdk/src/controllers/paymentsController.ts`. Wrap errors with `toPayPalError(e, "getAuthorizationStatus" | "getCaptureStatus")`. Update the fakes until `npm run typecheck` is clean.
- [ ] **Step 4: Run** `npx vitest run src/payments` and `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat: gateway reads PayPal's status for an authorisation or capture (APIMatic SDK)`.

### Task 2: `paypalSays` mapping and service

**Files:**
- Create: `src/dashboard/paypalSays.ts`
- Test: `src/dashboard/paypalSays.test.ts`

**Interfaces:**
- Consumes:
  - `PayPalGateway.getAuthorizationStatus` and `getCaptureStatus` (Task 1);
  - `PaymentRepo.listForCircle(contactId, limit)` and `blockedPaymentIds(ids)`;
  - `dashboardStatus(state, blocked)` and `DashboardStatus` from `src/dashboard/dashboardService.ts`.
- Produces:
  - `export type PayPalSays = { label: string; matches: boolean | null }`. `matches` is null when not checked or when PayPal's word is unknown.
  - `export function paypalSaysFor(status: DashboardStatus, paypalStatus: string | null): PayPalSays`. Pure.
  - `export function createPayPalSaysService(deps: { gateway: Pick<PayPalGateway, "getAuthorizationStatus" | "getCaptureStatus">; payments: Pick<PaymentRepo, "listForCircle" | "blockedPaymentIds">; now?: () => Date; ttlMs?: number; maxReads?: number; concurrency?: number })`. It returns `{ forCircle(contactId: string): Promise<Record<string, PayPalSays>> }`, keyed by payment id. Defaults: `ttlMs` 600_000, `maxReads` 20, `concurrency` 4.
  - `export type PayPalSaysService = ReturnType<typeof createPayPalSaysService>`.

**Rules:**
- **Which id is read.** Use `captureId` if set (read by capture). Otherwise use `authorizationId` (read by authorisation). Otherwise the payment is **left out** of the result (it never reached PayPal).
- **Labels.** `VOIDED`→"Voided"; `CREATED`/`PENDING`→"On hold"; `CAPTURED`/`COMPLETED`→"Captured"; `REFUNDED`/`PARTIALLY_REFUNDED`→"Refunded"; `EXPIRED`→"Expired". Any other word is title-cased ("DENIED"→"Denied"). A null status or a failed read gives "Not checked".
- **Agreement**, by dashboard status:

  | Our status | PayPal statuses that agree |
  |---|---|
  | `on_hold`, `in_progress` | `CREATED`, `PENDING` (`CAPTURED`, `COMPLETED` also agree for `in_progress`, which covers a capture or payout under way) |
  | `stopped`, `hold_ended` | `VOIDED`, `EXPIRED` |
  | `sent` | `COMPLETED` |
  | `refunded`, `returning` | `REFUNDED`, `PARTIALLY_REFUNDED`, `COMPLETED` |
  | `not_approved` | any |

  A known PayPal word outside its row gives `{ label: "Doesn't match", matches: false }`. An unknown word gives `matches: null` with PayPal's word as the label.

- [ ] **Step 1: Write the failing tests**:
  - `it.each` over `paypalSaysFor`:
    - `("stopped","VOIDED")`→`{label:"Voided",matches:true}`
    - `("stopped","COMPLETED")`→`{label:"Doesn't match",matches:false}`
    - `("on_hold","CREATED")`→`{label:"On hold",matches:true}`
    - `("sent","COMPLETED")`→`{label:"Captured",matches:true}`
    - `("refunded","COMPLETED")`→`{label:"Captured",matches:true}`
    - `("refunded","REFUNDED")`→`{label:"Refunded",matches:true}`
    - `("hold_ended","EXPIRED")`→`{label:"Expired",matches:true}`
    - `("stopped","DENIED")`→`{label:"Denied",matches:null}`
    - `("stopped",null)`→`{label:"Not checked",matches:null}`
  - Service tests use `createMemoryPaymentRepo` (pass `now` as in `paymentService.test.ts`) with rows inserted directly, plus a fake gateway:
    - `it("reads the capture when there is one, else the authorisation, and leaves out payments PayPal never saw")`;
    - `it("reads at most 20 payments, newest first, 4 at a time")`: 25 rows; a gateway that tracks in-flight calls; expect 20 calls and max in-flight 4;
    - `it("caches each answer for 10 minutes")`: a second call within ttl makes no gateway call; after advancing past 600_000 ms it reads again;
    - `it("a failed read shows Not checked and the rest still answer")`: one call rejects `new PayPalError("x", 500, undefined, "d")`;
    - `it("never logs ids or payees")`: spy on `console.warn`; after a failed read the logged args contain no `authorizationId`, `captureId` or payee string, only `{ errorName, status }`.
- [ ] **Step 2: Run** `npx vitest run src/dashboard/paypalSays.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep a simple worker pool of `concurrency` over the first `maxReads` eligible payments, in `listForCircle` order (already newest first). The cache is a `Map` keyed by payment id → `{ at, says }`, created inside the factory. Failed reads aren't cached.
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** `feat: PayPal says, our payment status checked against PayPal's own record`.

### Task 3: Route and container wiring

**Files:**
- Create: `src/app/api/circle/dashboard/paypal/route.ts`, `src/app/api/circle/dashboard/paypal/route.test.ts`
- Modify: `src/server/container.ts`. Add `paypalSays: PayPalSaysService`, built from the container's `gateway` and `repo`.

**Interfaces:**
- Consumes: `PayPalSaysService.forCircle` (Task 2), and `currentUserId` and `errorResponse` from `src/server/http.ts`.
- Produces: `GET /api/circle/dashboard/paypal`. 200 → `{ says: Record<string, PayPalSays> }`; 401 → `{ error: "Please sign in." }`.

- [ ] **Step 1: Write the failing route tests**, in the style of the sibling `src/app/api/circle/dashboard` route tests or other route tests in the repo:
  - signed out → 401;
  - signed in as Sarah → 200 and `says` is the service's result for her id, so the service is called with the caller's id.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the handler (mirror `src/app/api/circle/dashboard/route.ts`) and the container field.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS, clean.
- [ ] **Step 5: Commit** `feat: GET /api/circle/dashboard/paypal`.

### Task 4: Dashboard shows "PayPal says"

**Files:**
- Modify: `src/app/circle/dashboard/page.tsx`. After the dashboard loads, fetch `/api/circle/dashboard/paypal`, ignore failures, and pass `says` to the grid.
- Modify: `src/app/circle/dashboard/DashboardGrid.tsx`. Add a desktop column and a line in the details panel.
- Test: `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: the route from Task 3, and `PayPalSays`.
- Produces:
  - `DashboardGrid` prop `says?: Record<string, PayPalSays>`;
  - desktop column `headerName: "PayPal says"`, placed after Status, width 150;
  - the cell shows the label, with "Doesn't match" in the existing caution chip style and `data-testid="paypal-says-mismatch"`;
  - while loading, or for a payment with no entry, the cell is empty;
  - the details panel gets a "PayPal says" heading and label, on phone and desktop. **Not** a phone column (Review Focus 5).

- [ ] **Step 1: Write the failing e2e tests** in `e2e/dashboard.spec.ts`:
  - `test("desktop grid has a PayPal says column")`: expect `getByRole("columnheader", { name: "PayPal says" })` visible;
  - `test("the details panel shows what PayPal says")`: open a stopped row's details; expect the panel to contain "PayPal says".

  The existing phone test must stay unchanged and green.
- [ ] **Step 2: Run** `npm run test:e2e -- e2e/dashboard.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Seeded demo payments may have ids PayPal doesn't know, so in local e2e the label may be "Not checked". The tests assert only the header and the panel heading.
- [ ] **Step 4: Run** the dashboard e2e file, `npm test`, `npm run typecheck` and `npm run lint`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: dashboard shows what PayPal says about each payment`.

### Task 5: AG Studio spike (throwaway, findings only)

**Files:**
- Spike code lives only in a git worktree on branch `spike/ag-studio`. It is **never merged and never pushed**.
- Create: the findings file at the path the controller gives, in the plan's SDD workspace, not the repo.

**Questions the findings must answer**, each with evidence (a command output or a file:line in `node_modules/ag-studio*`):
1. Does `ag-studio-react@3.1.0` install with `ag-grid-react` moved to ~36.3? Does `npm run build` pass with it rendered client-only (`next/dynamic` with `ssr: false`) on a throwaway page?
2. **The Agent Framework adapter contract**:
   - the exact request and response types the adapter must handle (from the package's `.d.ts`);
   - whether it needs tool calls and streaming;
   - whether Groq's OpenAI-compatible API (`https://api.groq.com/openai/v1/chat/completions`, or `/openai/v1/responses`) can serve it, verified with one real call from a Node script.
   - Load the key with `node --env-file=.env.local`. Never print, open or copy `.env.local`, and never print the key.
3. **Custom widgets:** a minimal widget renders and receives filtered data (`widgetApi.getData`). Note the exact registration API.
4. **Theming:** how to set colours, font and radius to CSS variables (API names).
5. **Layout save and restore:** the API that gets and sets the dashboard state, so it can go to `localStorage`.
6. **Without a licence key:** what appears (a watermark?), and whether the AI module refuses to run.
7. **Mobile:** does it render at 390 px?

- [ ] **Step 1:** Create the worktree (`git worktree add ../paypal-spike -b spike/ag-studio`). Install, and build a throwaway page at `/spike-studio` with sample rows shaped like `DashboardRow`.
- [ ] **Step 2:** Answer questions 1–7. Use `npm run build` and `npm run dev` with a Playwright or curl check where useful. Take screenshots only into the given scratch path.
- [ ] **Step 3:** Write the findings, at most 120 lines: each question → answer → evidence → the effect on Part B. End with a recommended Part B task list.
- [ ] **Step 4:** Leave the worktree in place for the controller to remove. Don't commit to `main`.
