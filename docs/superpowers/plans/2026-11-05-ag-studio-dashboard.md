# AG Studio dashboard (spec Part B, without "Ask"): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** On desktop and tablet, Sarah's `/circle/dashboard` gains an AG Studio insights board: filters, two custom widgets, two charts, our theme, and a Customise mode whose layout is remembered. Phones keep today's page.

**Spec:** `docs/superpowers/specs/2026-11-04-sponsor-depth-design.md` § Part B, as amended by the spike: **no Studio Agent Framework / "Ask"** (spike: 32 Groq calls, ~88k tokens and a wrong answer for one question). Spike findings are summarised in the Interfaces blocks below. The spike code is at `/Users/prateeksrivastava/Documents/paypal-spike` (`src/app/spike-studio/`) and may be read for reference but never copied wholesale. Use the `ag-studio-react` types under `node_modules/ag-studio-react/dist/types` as the API authority.

**Deadline:** finished by Nov 8, 12:00.

**Tech:** Next.js 16.4 (client-only rendering via `next/dynamic(..., { ssr:false })` inside a client wrapper; read `node_modules/next/dist/docs`), React 19.3, `ag-studio-react@3.1.0`, AG Grid `~36.3.0`, Tailwind tokens, Vitest, Playwright.

## Global Constraints

- **Placement [ruling]:** the Studio board sits **between the three summary tiles and the existing payments table**, under the heading "Explore your circle's payments". The existing `DashboardGrid`, with its details panel, "PayPal says" column and every testid, stays on all widths. The aftercare cards and tiles are unchanged. *Why:* this keeps the accessible details panel and all dashboard e2e tests. Studio's own value here is filters, widgets, charts and layout tools.
- **Widths:** Studio mounts only at `min-width: 640px` (`matchMedia`, re-checked on change). Below that, nothing Studio-related renders or loads.
- **Licence:** `<AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>`. It must work with the key unset. Never claim a watermark either way.
- **Copy:** calm, plain. Exact strings are below; use them verbatim.
- **Model:** every subagent runs on Sonnet and uses graft (`graft ask --source`, `graft grep`, `graft skeleton`, `graft callers`; never `graft build` or `graft init`).
- **Secrets:** never open, print, edit or stage `.env.local`.
- **Never stage** `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- **Dev server:** Playwright reuses a server on :3000. Kill any dev server that started before your changes before running e2e.
- **Commit trailers:**
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```

## Review Focus

1. **Bad saved layout.** A saved layout that's corrupt, from an older version or rejected by Studio must fall back to the preset, never a blank board or a "Fatal error".
2. **Storage blocked** (private window, or a throwing `localStorage`): the board still renders the preset, and Customise still works for the session.
3. **"PayPal says" arrives late or fails.** The board renders first and the "PayPal check" widget shows "Not checked" counts until it arrives. The board never blocks on it.
4. **Resizing across 640 px** mounts and unmounts cleanly, with no hydration error and no horizontal page scroll at 390.
5. **Dark mode.** The board follows the app's tokens in both modes, with no default AG look.

---

### Task 1: Dependencies, data source and a client-only Studio board

**Files:**
- `package.json`: `ag-studio-react@3.1.0`; bump `ag-grid-community` and `ag-grid-react` to `~36.3.0`.
- Create: `src/dashboard/studioSource.ts`, a pure mapper, with `src/dashboard/studioSource.test.ts`.
- Create: `src/app/circle/dashboard/StudioBoard.tsx` (the client component using Studio), `StudioBoardLazy.tsx` (a client wrapper with `next/dynamic(..., { ssr:false })` plus the 640 px `matchMedia` gate) and `studioPreset.ts` (the preset `initialState`).
- Modify: `src/app/circle/dashboard/page.tsx` to place `<StudioBoardLazy rows={data.rows} says={says} />` per Global Constraints, with the heading "Explore your circle's payments".

**Interfaces:**
- `toStudioRows(rows: DashboardRow[], says?: Record<string, PayPalSays>): StudioRow[]`, where `StudioRow = { date: string /* ISO */; week: string /* ISO date of that week's Monday, UTC */; sender: string; payee: string; amount: number /* dollars */; status: string /* statusLabel */; risk: string; scamType: string; paypalSays: string /* label, or "Not checked" when absent */; paypalCheck: "Matches" | "Doesn't match" | "Not checked"; stopped: number /* amount when status is stopped, else 0 */; reasons: string /* joined "; " */ }`.
  - `paypalCheck`: `matches === true` gives "Matches", `false` gives "Doesn't match", null or absent gives "Not checked".
- **Studio data source:** one flat source with id `payments`. Field ids are namespaced in state (`payments.amount`), so use the namespaced id everywhere in the preset. Use currency format for `amount` and `stopped`.
- **Preset (`studioPreset.ts`)**, one page in view mode:
  1. filters on status, sender and scam type;
  2. a bar chart, "Payments by scam type" (count by `scamType`);
  3. a column chart, "Amount held per week" (sum of `amount` by `week`, filtered to status "On hold" or "Stopped"; if a per-widget filter isn't supported, chart `stopped` by `week` and title it "Money stopped per week").
  The two custom widgets come in Task 2.
- **View mode** by default. Studio's unrequested Filters side panel must not cover the canvas: arrange it via the `panels` config, or put filters on the canvas.

- [ ] **Step 1: Failing tests.**
  - `studioSource.test.ts`:
    - dollars from cents;
    - Monday-UTC week;
    - all three `paypalCheck` values;
    - `stopped` is 0 unless the payment is stopped;
    - reasons are joined;
    - a missing `says` gives "Not checked".
  - e2e in `e2e/dashboard.spec.ts`:
    - `test("on desktop the dashboard has an explore board")`: as Sarah at 1280x900, expect the heading "Explore your circle's payments", the text "Payments by scam type", and `getByTestId("dashboard-grid")` (or the existing grid's testid) still visible below.
    - `test("on a phone the explore board isn't loaded")`: at 390x844, expect that heading to have count 0, and `document.documentElement.scrollWidth <= 390`.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement. Run the existing grid tests after the AG Grid bump.
- [ ] **Step 4:** Run `npm test`, the full `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint` and `npx next build`. The build must pass with no env vars added.
- [ ] **Step 5:** Commit `feat: an AG Studio explore board on Sarah's dashboard (desktop)`.

### Task 2: Custom widgets "Money protected" and "PayPal check"

**Files:** create `src/app/circle/dashboard/studioWidgets.tsx`; modify `StudioBoard.tsx` and `studioPreset.ts`.

**Interfaces (from the spike):**
- `createWidgets({ additionalTypes: [...], menu: [{ label: "Trust Circle", widgetIds: [...] }] })`, passed as `<AgStudio widgets={widgets}>`.
- Each type has `{ id, label, dataMapping, form: p => p.createDefaults({ dataMappingItems }), comp, defaultSize, minSize }`.
- Inside `comp`, call `use(widgetApi.getData({ kind: "flat", fields: dataMapping.<key> }))`, which returns `res.results.rows` already filtered by the board's filters.

**Rules (copy verbatim):**
- **"Money protected"** (id `money-protected`, mapped field `payments.stopped`): shows the sum as USD in our tile style, with a big number and the label "Money protected". The small note under it reads "In the current filter".
- **"PayPal check"** (id `paypal-check`, mapped field `payments.paypalCheck`): three counts, "Matches PayPal", "Doesn't match" and "Not checked". "Doesn't match" uses caution styling when above 0.
- Both widgets go in the preset's top row.
- **Cross-filtering:** test whether a filter change updates both custom widgets. It must. Whether clicking a chart bar filters them is best effort: record the result in the report, and don't build a workaround.
- Each widget root gets a `data-testid`: `studio-money-protected` and `studio-paypal-check`.

- [ ] **Step 1: Failing e2e test.** `test("the explore board's widgets follow the filters")`: as Sarah at 1280x900, read the text of `studio-money-protected`. Pick a status filter value that excludes the stopped payments (choose it from the seeded data), and expect the amount to change. Also expect `studio-paypal-check` to contain "Matches PayPal".
- [ ] **Step 2:** Run it and see it fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full e2e suite, `npm test`, typecheck and lint.
- [ ] **Step 5:** Commit `feat: Money protected and PayPal check widgets on the explore board`.

### Task 3: Our theme, Customise, a remembered layout, and docs

**Files:**
- Create: `src/app/circle/dashboard/studioTheme.ts` and `src/app/circle/dashboard/studioLayout.ts`, with `studioLayout.test.ts`.
- Modify: `StudioBoard.tsx`, `README.md`, and `docs/submission.md` (the AG Grid answer, form question 28799).

**Interfaces:**
- **Theme:** `studioTheme.withParams({...})` with shared params (`accentColor`, `backgroundColor`, `foregroundColor`, `fontFamily`, `borderRadius`) set to our CSS variables (`var(--surface)`, `var(--ink)` and so on; read `src/app/globals.css` for the real token names), plus the `chart*` series params so the charts use our palette. Dark mode follows our existing mechanism by setting `data-ag-theme-mode` from it.
- **Layout:**
  - `loadLayout(storage: Pick<Storage,"getItem"> | null): unknown | null`;
  - `saveLayout(storage: Pick<Storage,"setItem"> | null, state: unknown): void`.
  - The key is `"tc.studio.layout.v1"`. Store `{ v: 1, state }`. Return null on missing storage, a throw, bad JSON or a wrong `v`.
  - Save on `onStateUpdated` when the update is durable, debounced by 500 ms.
  - Start from the saved state when present. If Studio rejects it (wrap with try/catch, plus its error event if one exists), use the preset and clear the key.

**Rules (copy verbatim):**
- A button "Customise" switches the board to edit mode. In edit mode it reads "Done". A secondary button "Reset layout" (only in edit mode) restores the preset and clears the key.
- There is no AI panel and no AI module.
- **README:** in the "PayPal says"/dashboard row, mention the AG Studio explore board with its custom widgets, theme and saved layout, desktop only. In the sponsor section, name AG Studio (`ag-studio-react`) with the custom widgets, theming and layout tools, and say plainly that the Studio Agent Framework was tried and not shipped because it was too slow and inaccurate on our model.
- **`docs/submission.md` 28799:** say the same things. Name the files.

- [ ] **Step 1: Failing tests.**
  - `studioLayout.test.ts`:
    - round trip;
    - a throwing storage gives null and no throw;
    - bad JSON gives null;
    - a wrong version gives null;
    - null storage;
    - saving to a throwing storage doesn't throw.
  - e2e `test("Customise is remembered")`: at 1280x900 as Sarah, click "Customise", remove or resize one widget (the simplest reliable action Studio offers), click "Done" and reload. Expect the change to persist. Then Customise, then "Reset layout", and expect the preset back.
  - e2e `test("a broken saved layout falls back to the preset")`: before loading the page, set `localStorage["tc.studio.layout.v1"] = "{not json"` via `addInitScript`. Expect "Payments by scam type" to be visible and no page error.
  - e2e dark mode: emulate `colorScheme: "dark"` and expect the board's background computed colour to equal the page's surface token colour.
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full e2e suite, `npm test`, typecheck, lint and `npx next build`. Save light and dark screenshots of the board at 1280 to `/private/tmp/claude-501/-Users-prateeksrivastava-Documents-paypal/e9a957f5-ceeb-482a-b6bd-bd3f036da4eb/scratchpad/studio-{light,dark}.png`. Never put them in the repo.
- [ ] **Step 5:** Commit `feat: the explore board wears our theme and remembers your layout; docs`.
