# Devpost submission drafts

Draft answers for the PayPal AI Hackathon form (`paypalaihackathon`). Field ids are from Devpost's submission requirements. Fields marked **USER TO FILL** are personal: the controller doesn't answer them. `{{REPO_URL}}`, `{{DEMO_URL}}` and `{{VIDEO_URL}}` are replaced in Plan 5 Tasks 8 and 9.

## Project name and tagline

- **Name:** Trust Circle
- **Tagline:** Scammers pretend to be someone you trust. So we ask that person.

## Project text description

### Inspiration

In 2025, people 60 and over reported losing $7.7 billion to online fraud, in 201,266 complaints to the FBI ([FBI IC3 2025 Internet Crime Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)). Many of these scams work by borrowing someone's trust: a grandchild in trouble, a bank, PayPal itself. They add urgency and secrecy so the victim doesn't check with anyone.

Scam detection alone is an arms race: every new script has to be recognised. We wanted to break the trick itself. A scammer can copy a grandson's voice and story, but can't answer from the real grandson's phone. So we ask him.

### What it does

Trust Circle is a protected way to send money with PayPal. It's a working reference for a setting PayPal could offer on every account, built only on PayPal's public APIs and running in the sandbox.

- **Check a message.** Paste a text or a screenshot. Groq judges it and explains, in plain words, what gave the scam away. Meta's Prompt Guard screens the text for instructions aimed at the AI first.
- **Guarded send.** Each payment is assessed by rules in code and then by the AI. The AI can raise the risk level, never lower it, and if it's unavailable the payment is held. A high-risk payment can still go ahead, but it is only authorised in PayPal and held. The sender feels they've "done it", so the pressure is off, yet the money hasn't left.
- **Ask the real person.** When the sender says "my grandson Daniel asked", the AI identifies who is being impersonated. If Daniel is in the circle, he gets "Did you just ask Margaret for $800?" One tap on **It wasn't me** voids the authorisation. For a claimed bank or PayPal support, the app shows official routes and keeps the hold.
- **Safe word and memory challenge.** If the real person doesn't answer in 10 minutes, the sender is coached to ask the caller for the safe word or a memory question. The challenge is one-way: a wrong answer or an excuse stops the payment, and a right one never releases a high-risk payment by itself.
- **The circle decides.** A trusted contact (Sarah, the daughter) can stop or approve. Approve captures the authorisation and pays the payee out with PayPal Payouts. If nobody decides, the sender can release it after a cooling-off period (24 hours by default), and the hold is voided after 72 hours.
- **A shared scam list that learns.** A payee confirmed as a scam (stopped by a contact, denied by the real person, or reported by two people) is high risk for everyone. The AI writes an anonymised description of each reported script, embedded locally and matched in pgvector, so reworded versions are caught too. Trends are charted with AG Charts.
- **Aftercare.** An agent built on PayPal's Agent Toolkit reviews the sender's recent payments for anything the earlier checks missed. It can only read (`list_transactions` and `get_order`, scoped in code to that sender), and for a completed payment to a now-confirmed scammer it drafts a dispute the family copies and sends. It never moves money.
- **Family, Business and Solo presets**, push alerts, an installable app, and a dashboard in AG Grid showing money protected and scams stopped.

### How we built it

- **Next.js 16** (App Router, TypeScript), installable as a PWA with web push.
- **PayPal:** Orders v2 with `AUTHORIZE` intent, approval in the JavaScript SDK v6, then authorize, capture or void, Payouts, refunds when a payout fails, and webhooks verified online with `verify-webhook-signature` and stored once per event id. Every money-moving PayPal call carries a `PayPal-Request-Id`, so retries can't move money twice. The aftercare agent uses `@paypal/agent-toolkit`, cut down to a read-only allow-list.
- **AI:** Groq for the text and vision judgements, the aftercare tool loop and the pattern descriptions; `meta-llama/llama-prompt-guard-2-86m` on Groq as an injection screen; `all-MiniLM-L6-v2` running inside the server for embeddings, stored in pgvector.
- **Money safety:** a payment state machine (`created → approved → authorised → held → released → captured → paid_out`, with `blocked`, `expired`, `voided`, `payout_failed` and `refunded`). Each decision is claimed in the database before PayPal is called, and a sweep every 5 minutes finishes anything interrupted.
- **Hosting:** Render free web service, Neon free Postgres with pgvector, and GitHub Actions schedules for hold expiry and a daily demo reset.
- **Testing:** Vitest unit and integration tests, Playwright end-to-end stories against the real sandbox, a production smoke test, and a live evaluation on 72 labelled cases, with a rules-only comparison.

### Challenges we ran into

- **Never pay twice.** Between capture, payout and refund there are many ways for a retry to move money twice. We made decisions claim their state first, gave every PayPal call a request id, refused to refund after an uncertain payout, and built a sweep that finishes interrupted payments.
- **Telling the truth on screen.** Early screens said things like "Sarah has been told" before any alert existed. We made a rule that every line must be backed by something that really happened, and added the alerts to make those lines true.
- **AI you can't talk down.** Scam messages can contain instructions aimed at the AI. Rules set a floor the AI can't lower, Prompt Guard flags injected instructions, and the aftercare agent can only call two read-only tools on one person's data.
- **Pattern matching without a paid service.** We first planned Elastic, but a trial would expire before judging, so we moved to pgvector with a local MiniLM model. It catches reworded scams, but it also raised false alarms, which we report.
- **Free-tier hosting.** Render's free service has no cron, so expiry runs from a GitHub Actions schedule that also keeps the service awake.

### Accomplishments that we're proud of

- The whole lead story works end to end on real sandbox money movement: check, send, hold, Daniel says "It wasn't me", the authorisation is voided and the scammer goes on the shared list.
- On 72 hand-written cases, all 38 scams were flagged and held, and 1 of 34 genuine cases was held. The AI earns its place: on the same payments, rules alone hold at best 16 of 22 scams while holding 7 of 20 genuine ones, and miss every scam that uses an everyday amount or a payee already paid. We publish the cost too: 11 of 34 genuine cases got a warning, mostly large first payments to new payees.
- Calm, blame-free screens with large type and big tap targets, checked with an automated accessibility pass.

### What we learned

- Asking the impersonated person is a stronger check than any classifier, and it gets stronger as scams get better.
- Holding an authorisation, rather than refusing a payment, removes the urgency without pushing the victim to another way of paying.
- An AI's job in a money flow is best kept narrow: raise risk, explain it in plain words, read but never act.

### What's next

Trust Circle is meant to become a setting, not another app. A scammer can always tell a victim to pay somewhere else, so protection has to live where people already pay. Everything here runs on PayPal's public APIs (authorise and hold, void, capture, Payouts and webhooks), so PayPal could offer it as a "Trusted Contact" option on any account: name someone you trust, and risky payments wait for them before the money leaves.

The idea has precedent. In US brokerage, firms must make reasonable efforts to collect a trusted contact for each customer ([FINRA Rule 4512](https://www.finra.org/rules-guidance/rulebooks/finra-rules/4512)), and may place a temporary hold on a disbursement when they reasonably believe an adult 65 or older is being financially exploited, telling that trusted contact within two business days ([FINRA Rule 2165](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2165)). Trust Circle brings the same protection to everyday payments, with AI deciding which payments need a second look.

The same engine already runs a Business preset, where a freelancer's accountant reviews risky payments, and it catches the invoice and CEO-fraud cases in our tests. Tailoring it for businesses, such as checking new bank details with a supplier on a known number, is next.

- A real sign-up flow with an emailed one-time code, in place of demo mode.
- Reconciling more "already done" PayPal answers, and a clear path for payments that need a person's attention.
- Link inspection in a sandboxed browser.
- Tuning the scam patterns to cut false alarms on everyday payments.
- Working with PayPal on the native setting, so holds and reviews run under PayPal's own licence and dispute processes.

## Form answers

| ID | Field | Draft |
|---|---|---|
| 28778 | Submitter type | Individual (controller to confirm with the user) |
| 28779 | Country of residence | **USER TO FILL** |
| 28780 | Canada province | **USER TO FILL** |
| 28781 | Organisation | **USER TO FILL** |
| 28782 | New or existing | New |
| 28783 | Existing work | N/A |
| 28784 | Main technology requirement | See below |
| 28786 | Sponsor tools | AG Grid, Render |
| 28788 | Repo URL | `{{REPO_URL}}` |
| 28787 | Demo URL | `{{DEMO_URL}}` |
| 28798 | Testing instructions | See below |
| 28790 | PayPal experience rating | **USER TO FILL** |
| 28791 | Why (rating feedback) | Draft below, for the user to edit |
| 28792 | Contact consent | **USER TO FILL** |
| 28793 | APIMatic experience | N/A (not used) |
| 28799 | AG Grid experience | See below |
| 28794 | Age | **USER TO FILL** (the user must confirm personally) |
| 28795 | Eligible jurisdiction | **USER TO FILL** (the user must confirm personally) |
| 28796 | Not an employee | **USER TO FILL** (the user must confirm personally) |
| 29053 | AI tools used while building | See below |
| 29054 | Level of learning | **USER TO FILL** |
| 29055 | AI value for your career | **USER TO FILL** |

### 28784: Main technology requirement

PayPal tools (all in the sandbox):

- **Orders v2 (`AUTHORIZE` intent):** creates an order for each payment, so the money can be authorised and held instead of sent.
- **JavaScript SDK v6:** the sender approves the payment in PayPal's own window.
- **Payments API (authorize, capture, void, refund):** authorise and hold a risky payment; capture it when the circle or the real person approves; void it when someone says "It wasn't me", a contact stops it, or the 72-hour hold ends; refund the sender if the payout fails.
- **Payouts API:** pays the payee by email or phone after capture.
- **Webhooks:** each event is verified with `verify-webhook-signature` and processed once per event id. A returned, failed, blocked, canceled or refunded payout marks the payment `payout_failed`, and the sender is refunded.
- **Agent Toolkit (`@paypal/agent-toolkit`):** the aftercare agent's only tools, `list_transactions` and `get_order`, read-only and filtered in code to one sender's payments.
- **Server SDK (`@paypal/paypal-server-sdk`):** orders and payments calls.

AI tools:

- **Groq text model (`GROQ_TEXT_MODEL`; the evaluation used `qwen/qwen3.8-27b`):** judges each payment and message, names who is being impersonated, writes anonymised scam-pattern descriptions, and drives the aftercare tool loop. Output is JSON checked against a schema.
- **Groq vision model (`GROQ_VISION_MODEL`):** reads screenshots of suspicious messages.
- **Meta Prompt Guard 2 (`meta-llama/llama-prompt-guard-2-86m`, on Groq):** flags text that tries to instruct the AI, which makes the check high risk.
- **`all-MiniLM-L6-v2` (local, via Transformers.js):** embeds anonymised scam scripts for meaning-based matching in Postgres pgvector, so reworded scams are caught.

The AI can raise a risk level, never lower it, and when it can't run the payment is held.

### 28798: Testing instructions

> Live demo: {{DEMO_URL}}. It runs on a free Render service, so the first load after a quiet spell can take about a minute.
>
> No sign-up: the landing page signs you in as a demo person with one tap.
>
> 1. Tap **Try as Margaret**. Open **Check a message** and paste: "Hi Grandma it's me, I lost my phone so this is my new number. I need $800 in gift cards today. Please don't tell mom. Text me at +1 (415) 555-0199". You'll see why it's a scam.
> 2. Back home, tap **Send money**. Pay `daniel.newphone@example.com` $800. For "Who asked you to make this payment, and why?", write "My grandson Daniel called crying, he's in jail and needs bail money today." Tap **Continue, and let Sarah review it** on the pause screen and approve in the PayPal sandbox window with this sandbox buyer login:
>    - Email: **USER TO FILL (privately, on Devpost only)**
>    - Password: **USER TO FILL (privately, on Devpost only)**
> 3. The payment is held. Sign out, open **Other demo accounts** and choose **Daniel, the grandson**. Open the request and tap **It wasn't me**.
> 4. Sign in as Margaret again: "Payment stopped. Your money is safe."
> 5. Tap **Try as Sarah, her daughter**. See what happened, open **See all payments** (AG Grid dashboard) and **Review recent payments** (the aftercare agent), then **Scam trends** (AG Charts).
>
> Other accounts: Priya (a freelancer, Business preset) and Tom, her accountant; Robert (Just me, no circle).
>
> The shared demo resets every day at 09:00 UTC. Everything runs in the PayPal sandbox; no real money moves. Setup to run it yourself is in the README.

### 28791: Why (rating feedback), draft for the user to edit

> Authorize-then-capture was a natural fit for holding a risky payment, and the sandbox let us test the full lifecycle (authorize, capture, void, payouts, refunds and webhooks) without real money. The JavaScript SDK v6 approval flow was simple to embed. Request ids made retries safe, which mattered a lot for a money-safety product. Friction points: Transaction Search has to be switched on for the app and its sandbox data lags by about 3 hours, so the aftercare agent often fell back to our own records; webhook simulator events can't be verified online, so we verify every real event with PayPal's verify-webhook-signature API; and the Agent Toolkit keeps its access token for the life of the instance, so we rebuild it every hour.

### 28799: AG Grid experience

> AG Grid powers the trusted contact's dashboard: every payment in the circle with its status, amount, scam type and the reasons it was held, with search and sorting. AG Charts draws the scam-trends page as a stacked bar chart of reports by scam type over 12 weeks, with an AG Grid table beside it. The Community editions covered everything we needed. Theming both to our design tokens took the most care, and on phones the grid switches to four columns (status, date, payee, amount) so it stays readable at 390 px without sideways scrolling.

### 29053: AI tools used while building

> Claude Code, with Anthropic's Claude models (Opus and Sonnet), for planning, writing the specification, implementation with test-driven development, and code review. We used Claude Code skills for UI and UX design during the build (UI/UX Pro Max, frontend-design and the Taste skill). Groq's models are part of the product itself (the scam checks and the aftercare agent), not a build tool.
