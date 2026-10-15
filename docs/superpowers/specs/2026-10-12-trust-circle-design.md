# Trust Circle: design spec

Date: 2026-10-12
Status: awaiting review
Entry for: PayPal AI Hackathon on Devpost (`paypalaihackathon`), submissions close 2026-11-12 20:00 UTC

"Trust Circle" is a working name.

## 1. Summary

Scammers succeed by impersonating someone the victim trusts, isolating them, and creating urgency. Trust Circle is a protected way to send money with PayPal that attacks all three: it asks the person being impersonated whether the request is real, brings a trusted contact into the decision, and holds the money while that happens.

One-sentence pitch: scammers pretend to be someone you trust, so we ask the person they are pretending to be.

It is a proof of concept of a protected account mode that PayPal could offer natively. It runs entirely in the PayPal sandbox.

## 2. Goals and non-goals

Goals

- A complete, working flow: check a message, send money, verify the real person, hold, approve or block, with real sandbox money movement.
- Score well on all five judging criteria: Technological Implementation, Design, Potential Impact, Innovation, Presentation.
- Target prizes: Most Impactful, Best Use of PayPal + AI, Best Use of Agentic Commerce, Best Use of AG Grid.
- A judge can experience the whole product in two minutes from a hosted URL.

Non-goals

- Intercepting payments made in PayPal's own app or by any other route.
- Detecting deepfake audio or listening to live phone calls.
- Engaging or baiting scammers.
- Production compliance (holding funds in real life requires a licence; the pitch says so).
- Native mobile apps.

## 3. Users and presets

One product, three presets that change who is in the circle, the thresholds and the wording.

| Preset | Sender | Circle | Role in the demo |
|---|---|---|---|
| Family | A senior | Children, grandchildren | Lead story |
| Business | A freelancer or owner | Accountant, business partner | 15-second second scenario |
| Solo | Anyone | Nobody | Supported, not featured |

Solo mode protection is the AI check, real-person verification where possible, and a self-imposed cooling-off period.

## 4. Features

### 4.1 Message checker

The sender pastes text or adds a screenshot of a suspicious message, email or invoice. The risk engine returns a verdict, a scam type and up to three plain-language reasons. Identifiers found in the message (phone numbers, emails, URLs, payee names) are extracted and remembered against the sender's account, so a later payment to the same party is linked to this check.

### 4.2 Guarded send

1. The sender enters payee (email or phone), amount and an optional note.
2. For a first-time payee or unusual amount, the app asks: "Who asked you to make this payment, and why?"
3. The risk engine assesses the payment. No money has moved yet.
4. Outcome by level:
   - Low: PayPal checkout, authorise, capture, pay out.
   - Medium: a warning the sender must confirm, then as low. The circle is notified.
   - High: the sender may still proceed. PayPal checkout authorises the payment and it is held.

Letting a high-risk payment be authorised and held is deliberate. It removes the urgency (the sender has "done it") without the money leaving, and it stops the sender going off to pay by another route.

### 4.3 Verify the real person

When the sender's answer names someone as the requester, the AI identifies who is being impersonated.

- If that person is in the circle, they get an alert: "Did you just ask [sender] for [amount]?" with "Yes, it was me" and "It wasn't me".
  - "It wasn't me": the payment is voided, the payee is reported, the sender is told calmly.
  - "Yes, it was me": the payment is released.
- If the claimed requester is an organisation (a bank, PayPal support, a government body), the app shows how to reach it through official routes and keeps the payment held.
- If the person is not in the circle or does not respond within 10 minutes, the sender is coached through a challenge:
  - Safe word, if the family set one at onboarding. The sender asks the caller for it and enters what they said; the app checks it.
  - Otherwise a memory question: "Ask something only they would know. Don't give hints. A real grandson answers straight away; any excuse counts as a no."
- The challenge is one-way. A wrong answer or an excuse blocks the payment. A right answer never releases a high-risk payment; it still goes to the trusted contact or the cooling-off period.

### 4.4 Hold, approve, block

- A held payment alerts the trusted contact with the amount, payee, the sender's answer and the AI's reasons.
- Approve captures and pays out. Block voids.
- Cooling-off: after 24 hours (configurable, never more than 72) the sender can release the payment themselves.
- If nobody acts within 72 hours of authorisation, the payment is voided automatically.

### 4.5 Scam registry and reporting

- Every scam verdict the sender reports adds its identifiers to a shared registry as unconfirmed.
- An entry becomes confirmed when a trusted contact blocks a payment to it, a real person answers "It wasn't me", or two independent users report it.
- Confirmed entries make any payment to that identifier high risk for every user. Unconfirmed entries are a signal only.
- One-tap report: the AI drafts a report (message, identifiers, scam type, reasons). With consent it is emailed to `phishing@paypal.com`. The registry never stores victim details or message content.
- Pattern matching (Elastic): for each reported scam the AI writes a short anonymised description of the script (for example, "caller claims to be a grandchild in custody and asks for bail money to be sent urgently and kept secret"). Descriptions are indexed in Elastic and searched by meaning. A new message or payment answer that closely matches a known pattern raises a signal even when every identifier is new, so reworded versions of a known scam are still caught. Only the anonymised description is indexed, never the original message.

### 4.6 Link inspection (phase 2)

For a URL in a checked message, an agent opens the link in a KERNEL sandboxed cloud browser, so the sender never has to, and returns a screenshot and verdict (for example, a page imitating a PayPal login on an unrelated domain). Depends on KERNEL access for participants; see section 13.

### 4.7 Aftercare (thin)

- The agent reviews the sender's PayPal transaction history for patterns the earlier layers missed and alerts the circle.
- For a completed payment later judged a scam, the app assembles a dispute draft from the stored evidence.

### 4.8 Dashboard and trend feed

- Trusted-contact dashboard: payment history, blocked scams, and a "money protected" total (AG Grid).
- Scam trends: the AI clusters registry reports into named scam types with counts over time (AG Grid charts).

### 4.9 Demo mode

The landing page offers "Try as senior" and "Try as trusted contact" with seeded accounts and scenarios. Sandbox logins for the PayPal approval step go in the submission form's testing-instructions field.

## 5. Architecture

One Next.js (TypeScript, App Router) application, installable as a PWA, hosted on Render with Render PostgreSQL.

| Unit | Responsibility | Depends on |
|---|---|---|
| `risk` | Assess a payment or message; return level, scam type, reasons | `registry`, `ai` |
| `ai` | Groq client, prompts, structured-output validation | Groq |
| `payments` | PayPal orders, authorise, capture, void, payout, refund; payment state machine | PayPal |
| `verification` | Real-person check, safe word, memory-question coaching | `alerts` |
| `registry` | Store and look up scam identifiers; confirmation rules; report drafts; pattern search | database, Elastic |
| `alerts` | Web push and email delivery | push service, email provider |
| `agent` | Aftercare and investigation using PayPal's Agent Toolkit | `ai`, PayPal |
| UI | Sender view, trusted-contact view, onboarding, landing | all of the above via server routes |

`risk` knows nothing about PayPal or the UI. `payments` knows nothing about AI. Each is testable alone.

Supporting choices

- Database access: Prisma.
- Sign-in: Auth.js with an emailed one-time code; demo mode uses seeded sessions.
- Email: Resend.
- Push: the `web-push` library with VAPID keys. Email is always sent alongside push.
- Scheduled work (cooling-off expiry, 72-hour auto-void): a Render cron job calling a protected route.
- Pattern search: an Elastic index of scam pattern descriptions, using Elastic's built-in semantic search so no separate embedding provider is needed. PostgreSQL stays the source of truth; the index can be rebuilt from it. If Elastic is unreachable, the signal is skipped and the other rules still apply.

## 6. Risk engine

Input: a payment (payee, amount, note, the sender's answer) or a message (text or image), plus the sender's history and the registry.

Output: `{ level: low | medium | high, scamType, reasons[] }`.

Step 1, signals computed in code

| Signal | Effect |
|---|---|
| Payee is a confirmed registry entry | High, always |
| Payee is linked to a message this sender checked and that was judged a scam | High |
| Payee is an unconfirmed registry entry | At least medium |
| The message or the sender's answer closely matches a known scam pattern | At least medium |
| First-time payee | Contributes |
| Amount well above the sender's normal, or above a limit the circle set | Contributes |
| Several payments in a short time | Contributes |

Step 2, the AI's judgement. The model receives the signals, note, sender's answer and any linked message, and returns scam type, level and reasons in a fixed JSON shape.

Step 3, the decision, in code

- The final level is the higher of the rule level and the AI level. The AI can raise the level, never lower it.
- If the model is unavailable or its output fails validation, any payment with at least one signal is treated as high.

Evaluation: a labelled set of at least 60 cases (scam and genuine, payments and messages, across the three presets) runs in the test suite. Catch rate and false-alarm rate are published in the README.

## 7. AI

- Provider: Groq, through its OpenAI-compatible API, behind a small provider interface so the model or provider is a configuration change.
- Models: one vision-capable model for screenshots and one text model for everything else, chosen from Groq's current list at build time and named in configuration.
- Every call requests structured JSON and is validated against a schema.
- Prompts instruct the model to explain in plain language, without jargon and without blame.

## 8. PayPal integration

Protected transfer

1. Server creates an order (Orders v2) with intent to authorise, payable to the platform's business account.
2. The sender approves in PayPal's window (JavaScript SDK v6).
3. Server authorises the order and stores the authorisation ID.
4. Release: `POST /v2/payments/authorizations/{id}/capture`, then a Payouts API payout to the payee's email or phone.
5. Block or expiry: `POST /v2/payments/authorizations/{id}/void`.
6. If a payout fails or stays unclaimed, the captured payment is refunded to the sender.

Payment states

`created → approved → authorised → released → captured → paid_out`
`authorised → held → released | blocked | expired`
`blocked | expired → voided`
`captured → payout_failed → refunded`

Every transition is written to the audit log. Each PayPal call carries an idempotency key, so a retry cannot move money twice.

Webhooks: the app subscribes to authorisation, capture, void, refund, payout and dispute events, verifies each message, and reconciles its own state against them.

Agent Toolkit (`@paypal/agent-toolkit`): used by the `agent` unit for listing transactions, looking up invoices, refunds and dispute tracking. It has no authorise, capture or void tools, so money movement in the hold flow goes through `payments` only.

Server SDK: `@paypal/paypal-server-sdk`.

## 9. Data model

| Table | Holds |
|---|---|
| `User` | Account, preset, safe-word hash |
| `TrustLink` | Sender, trusted contact, relationship label, status |
| `Payment` | Payee, amount, PayPal order, authorisation, capture and payout IDs, state, cooling-off deadline |
| `RiskAssessment` | Subject (payment or message), signals, AI output, final level |
| `MessageCheck` | Checked text, verdict, extracted identifiers |
| `Verification` | Payment, method (real person, safe word, memory question), outcome |
| `RegistryEntry` | Identifier type and value, scam type, status, report count |
| `ScamPattern` | Anonymised script description, scam type, report count (mirrored to Elastic) |
| `Report` | Registry entry, drafted report, where it was sent |
| `Alert` | Recipient, channel, payload, delivery status |
| `AuditLog` | Actor, action, payment, timestamp |

Privacy

- Screenshots are deleted after analysis unless the user attaches one to a report.
- The safe word is stored only as a hash.
- The shared registry holds scammer identifiers only.

## 10. Screens

Sender view (phone-first, one decision per screen): Home, Check a message, Send money, Verification, On hold, Result.

Trusted-contact view: Alert, Held payment detail, Dashboard, Scam trends.

Shared: Landing with demo mode, Onboarding (connect PayPal, invite a contact, set a safe word, install the app and allow notifications).

Design rules

- Large type, high contrast, big tap targets on every sender screen; WCAG 2.1 AA as the floor.
- Calm tone. Warnings explain and never frighten.
- No blame on any blocked-payment screen.

Design skills: UI/UX Pro Max and `frontend-design` for product screens, the Taste skill (`design-taste-frontend`) for the landing page. Where they conflict, accessibility wins.

### 10.1 Design quality bar

The interface must feel deliberately designed, refined and modern, and must not read as AI-generated.

Banned defaults

- Purple-to-blue gradients, glassmorphism and glowing blobs used as decoration.
- The template landing page: centred hero, three feature cards with icons, testimonial strip.
- Emoji as icons, mixed icon sets, stock illustrations.
- Default framework typography and spacing left untouched.
- Cards nested inside cards; every section boxed.
- Motion that decorates instead of explaining.

Required

- A written design direction and a token file (`DESIGN.md`): type scale, colour, spacing, radius, elevation, motion, before any screen is built.
- A distinctive but calm type pairing chosen for legibility at large sizes.
- One accent colour with a clear meaning; status colours (safe, caution, held, blocked) that also work without colour (icon and label).
- Purposeful motion only: a held payment visibly "pausing", a verification request visibly travelling to the real person. Reduced-motion respected.
- Real copy in every screen, written for the audience; no placeholder text.
- Designed empty, loading and error states.

Design process

1. Direction and tokens with UI/UX Pro Max and the Taste skill, written to `DESIGN.md`.
2. Screen concepts generated in Stitch, or as a Claude Design artifact if Stitch is unavailable, reviewed and approved before code.
3. Build each screen to the approved concept with `frontend-design`.
4. Review gate per screen: screenshot at phone and desktop widths, compare with the concept, run a design critique and an accessibility review, and fix before the screen is accepted.

## 11. Error handling

| Failure | Behaviour |
|---|---|
| AI unavailable or invalid output | Rules decide; any signal means hold |
| PayPal capture fails | Payment stays held; sender and contact are told; retry is safe |
| PayPal void fails | Retried by the cron job; the authorisation expires by itself as a backstop |
| Payout fails or is unclaimed | Captured funds are refunded to the sender |
| Push not delivered | Email is always sent as well |
| Elastic unreachable | Pattern signal skipped; identifier and behaviour rules still apply |
| Webhook missed | Reconciliation on the next cron run reads state from PayPal |
| Trusted contact never responds | Cooling-off release by the sender, then auto-void at 72 hours |

## 12. Sponsor tools

| Sponsor | Use | Prize targeted |
|---|---|---|
| AG Grid | Dashboard tables and trend charts | Yes |
| APIMatic | PayPal context plugin for the coding assistant during the build | Eligible |
| Render | Hosting, database, cron | Eligible |
| KERNEL | Link inspection (phase 2) | No prize offered |
| Elastic | Semantic matching of scam patterns in the registry | No prize offered |

A project can win at most one sponsor prize; AG Grid is the target.

## 13. To verify in a day-one sandbox test

These are checked with a throwaway script before any product code depends on them.

1. An order can be created with authorise intent using JavaScript SDK v6 and authorised server-side.
2. Capture and void behave as documented on a sandbox authorisation.
3. Payouts works on a sandbox business account, and what an unclaimed payout looks like.
4. Refund of a captured payment after a failed payout.
5. A test dispute can be created as a sandbox buyer.
6. The Agent Toolkit's tool list matches section 8.
7. Groq's current vision and text models, structured-output support, and free-tier rate limits.
8. KERNEL's access terms for hackathon participants.
9. Elastic's access terms for participants, and that its built-in semantic search works on the tier we get.

If 3 fails, the fallback is to name the recipient as payee on the order directly; if that also fails, the demo recipient is a second business account.

## 14. Testing

- Test-driven: every task starts with a failing test.
- Unit: `risk` (rules, decision logic, the labelled evaluation set with the AI mocked and, separately, live), `payments` state machine, `registry` confirmation rules, `verification` outcomes.
- Integration: PayPal and Groq mocked at the HTTP boundary, including PayPal's forced-error responses.
- End to end (Playwright): the two demo stories, run against the sandbox.
- Tools: Vitest, Playwright, MSW.

## 15. Build order

1. Day-one sandbox test (section 13).
2. Demo path: guarded send with hold, alert, approve or block, real sandbox calls.
3. Risk engine with the evaluation set; message checker.
4. Verify the real person; safe word; memory-question coaching.
5. Registry, one-tap report, pattern matching with Elastic, dashboard and trend feed.
6. PWA install, push, onboarding, presets.
7. Aftercare, then link inspection if access allows.
8. Accessibility pass, demo mode, README with accuracy figures and architecture diagram, licence.
9. Final week: video and submission form.

Each task is implemented by a Sonnet agent and reviewed against this spec before the next begins.

## 16. Submission deliverables

- Public repository with an OSI licence visible in the About section, setup instructions, and a section on how PayPal and AI are used.
- Hosted demo URL on Render and sandbox test credentials.
- Demo video under three minutes, public on YouTube, with no third-party trademarks or unlicensed music. The fake invoice in the story uses an invented company name.
- Text description and the submission form answers.

Video outline

| Time | Content |
|---|---|
| 0:00–0:20 | One cited statistic, then a fake invoice arriving |
| 0:20–0:35 | What the product is, in one sentence |
| 0:35–1:05 | The message check and plain-language verdict |
| 1:05–1:50 | She tries to pay anyway; the real person is asked; "It wasn't me"; the sandbox shows the payment voided |
| 1:50–2:10 | A genuine payment goes straight through |
| 2:10–2:30 | The freelancer scenario; a second user protected by the registry; the trend feed |
| 2:30–2:50 | Architecture and the PayPal and AI components |
| 2:50–2:58 | Closing line |

Statistics used on the landing page and in the video are checked against the primary FBI, FTC and GASA reports before use.
