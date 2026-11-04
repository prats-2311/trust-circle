# Sponsor depth: "PayPal says" column (APIMatic) and AG Studio dashboard: design

Status: draft 2026-11-04. Scope and order chosen by Prateek ("Both"). Builder's calls are marked **[my call]**.

## Why

Only one sponsor prize can be won, and our current use of each sponsor is thin.

- **AG Grid.** The prize asks for AG Studio: "custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own", and to try the Studio Agent Framework. Today Sarah's dashboard is a plain AG Grid table.
- **APIMatic.** The prize asks for the Context Plugin used to build the PayPal integration. We qualify already. A visible feature built with it, on the PayPal SDK that APIMatic generates, makes the answer concrete and strengthens Technological Implementation.

Both land on one screen Sarah already has: **Your circle's payments** (`/circle/dashboard`). No new pages or nav items, so the main path stays one loop.

## Part A: "PayPal says" (APIMatic, built first)

For each payment on Sarah's dashboard, the app asks PayPal for its own record of the money and shows it beside ours.

- **Calls:** `PaymentsController.getAuthorizedPayment` (held, voided or expired payments, by `authorizationId`) and `PaymentsController.getCapturedPayment` (captured or paid-out payments, by `captureId`), from `@paypal/paypal-server-sdk`. Both are real-time reads, unlike Transaction Search, which lags about 3 hours. **[my call]** Transaction Search is a non-goal here.
- **Built with the APIMatic Context Plugin** (per-operation contract, error arms). The submission's APIMatic answer names this feature and its files.
- **Values shown** (PayPal's word mapped to plain English): "Voided", "On hold", "Captured", "Refunded", "Expired", "Not checked". Payments that never reached PayPal (not approved, still in progress) show nothing.
- **Which id is read** **[my call]**: a payment with a `captureId` (captured, paid out, payout failed, refunded; payouts always follow a capture) is read by capture; otherwise one with an `authorizationId` (held, released, blocked, voided, expired) is read by authorisation; anything else shows nothing.
- **Status table** **[my call]**, our status → PayPal statuses that agree:
  - on hold / in progress (authorised, not captured): `CREATED`, `PENDING`;
  - stopped / hold ended: `VOIDED`, `EXPIRED`;
  - sent: `COMPLETED`;
  - refunded / being returned: `REFUNDED`, `PARTIALLY_REFUNDED`, `COMPLETED` (a refund may not show yet);
  - anything else, or a PayPal status we don't know: shown as PayPal's word, never "Doesn't match" on its own.
- **Mismatch:** when PayPal's status contradicts ours (for example we say stopped and PayPal says captured), the row shows **"Doesn't match"** with caution styling. No automatic action. **[my call]**
- **Loading:** a separate endpoint `GET /api/circle/dashboard/paypal` (signed-in contact only, same circle scope as the dashboard). The dashboard renders first and the column fills in.
- **Cost limits:** at most 20 PayPal reads per request, 4 at a time, each result cached in memory for 10 minutes per payment. A failed or timed-out read shows "Not checked", never a guess. **[my call]**
- **Never logged:** payee, PayPal ids or response bodies. Only the error class and HTTP status.
- **Sandbox only,** through the existing sandbox-only client. The two reads are added to the existing `PayPalGateway` interface and use its `PayPalError` wrapper, which keeps only status, issue and debug id.

## Part B: AG Studio dashboard (AG Grid prize)

On desktop and tablet widths, the payments table on `/circle/dashboard` becomes an **AG Studio** dashboard (`ag-studio-react` 3.1, React 19 peer OK). The three summary tiles and the aftercare card stay as they are.

- **Data source:** the dashboard rows plus Part A's "PayPal says", as one flat source: date, week, sender, payee, amount (dollars), status, risk, scam type, PayPal says, matches PayPal (yes/no), reasons (joined).
- **Preset layout, view mode** (Sarah doesn't have to build anything):
  1. filters: status, sender, scam type;
  2. **custom widget "Money protected"**: the sum of stopped payments in the current filter, in our tile style, with cross-filtering;
  3. **custom widget "PayPal check"**: confirmed vs not matching vs not checked, from Part A, with cross-filtering;
  4. bar chart: payments by scam type;
  5. line or column chart: amount held per week;
  6. table: the payments, with "PayPal says".
- **Theming:** our design tokens, light and dark mode, the app font, our radii. No default AG look.
- **Customise:** a "Customise" toggle switches to edit mode. The layout is saved per viewer in `localStorage` (wrapped in try/catch; the preset is used when storage is missing). **[my call]**
- **Studio Agent Framework: "Ask about your circle's payments".** Sarah types a question such as "which payments were held this month?". The agent answers and can add or change widgets.
  - The adapter in the browser calls **our** endpoint `POST /api/circle/studio-ai`, never Groq directly, so no key reaches the browser.
  - The endpoint is for a signed-in contact only. It forwards to Groq with the model, max tokens and tools fixed server-side, and returns the reply in the shape the adapter expects.
  - The adapter is ours, copied from AG's OpenAI example (AG ships none) and pointed at Groq's OpenAI-compatible API through our endpoint. **First task is a spike** that confirms the request/response shape, whether tool calls and streaming are needed, Next 16 client-only rendering (`dynamic(..., { ssr: false })`), and the layout save/restore API. If the spike shows the Agent Framework can't run against Groq, Part B ships without "Ask" and the spec is revisited.
  - Limits: 10 requests a minute per user (in memory; Render runs one instance) and a daily request cap for the whole app, counted in a Postgres table so a restart doesn't reset it. **[my call]** Over either limit, the agent says "Please try again later". **[my call]** This is the same limiter planned for demo protection, built here first.
  - Prompts and answers are never logged or stored.
- **Licence:** `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` (trial requested by Prateek on 2026-11-04, 45 days, must include AI). Without it the page still works with AG's watermark.
- **Phones (under 640 px):** keep today's 4-column AG Grid table with the "PayPal says" column added. **[my call]** AG Studio's layout tools aren't meant for 390 px, and the prize demo is on desktop.

## Non-goals

- Transaction Search, an API portal or SDK for Trust Circle's own API.
- AG Studio on any other page. Trends stays as it is.
- Editing payments from the dashboard.

## Anti-goals

- Any PayPal or Groq key in the browser.
- Showing a payment as fine when PayPal couldn't be asked.
- Logging prompts, answers, payees or PayPal ids.
- A dashboard that only works with the licence key.

## Tests

- **Unit:**
  - status mapping and mismatch rules for "PayPal says";
  - the 20-read cap, 4 at a time and the cache;
  - a failed read gives "Not checked";
  - the AI endpoint: 401 when signed out, 429 at each limit, the model and tools fixed server-side, nothing logged;
  - the adapter translates requests and replies both ways.
- **Integration:** the PayPal endpoint returns only the caller's circle.
- **e2e:**
  - desktop dashboard shows the Studio widgets with stubbed data;
  - the phone width shows the table;
  - "PayPal says" fills in from a stubbed gateway;
  - asking the agent with a stubbed Groq shows an answer;
  - the existing dashboard and smoke tests are updated, not deleted.
- **Live check on prod as Sarah:** after the demo story runs, "PayPal says: Voided" appears on the stopped payment.

## Docs

The README and submission get:
- AG Grid answer 28799 rewritten for AG Studio;
- APIMatic answer 28793 names the "PayPal says" feature;
- an APIMatic mention in "Built with";
- new screenshots after the build.
