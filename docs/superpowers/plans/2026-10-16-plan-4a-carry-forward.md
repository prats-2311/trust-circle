# Plan 4A carry-forward

Plan 4A is complete on branch `plan-4a-screens`. It covers:
- the design system;
- demo mode;
- every designed screen;
- the live end-to-end story.

This note records two things:
- decisions that changed or sharpened the plan;
- the open items for Plans 4B and 5.

Commits and tests are the source of truth for behaviour.

## Decisions

| Decision | Why | Cost if wrong |
|---|---|---|
| A payment that is held and has a real-person "no" (`resolved`/`denied`) shows "Payment stopped". | The plan's table left this case out. Showing the held screen would tell Margaret her circle is still looking, even after the real person said no. | One table row |
| After PayPal approval, a failure with status 0 or 5xx never shows the server's text. It shows fixed copy instead: "…it may already be in progress. Check your payments before you try again." The same rule applies to: cancel (its own copy), Sarah's decision and Daniel's answer. | The server's 5xx copy says "Nothing has been sent", which is false once money may have moved. | A specific server message is hidden |
| A 401 after approval adds "Your payment may already be in progress. Check your payments before you send it again." | Stops a second payment after signing in again | One sentence |
| Every name comes from the right source. | The plan's fallback to the first circle member named the wrong person. | A small change to the server's stage type |
| No screen says someone "has been told" unless an alert is really sent. | Two facts drive this: a contact's block alerts nobody, and a real person's "no" alerts only the sender and the registry. The Stopped screen's "Sarah has been told" line and the "We've told them" in Sarah's block result were removed. | The concept's lines are missing until the circle is alerted (4B candidate) |
| When Sarah opens a closed payment, she sees what actually happened: a failed check, a "no" from the real person, already gone through, or stopped. "Someone else answered" appears only after her own tap gets a 409. | The plan's fixed copy was often false | Copy only |
| After an uncertain decision failure, Sarah gets one "Refresh" button instead of Stop and Approve. | A second tap could report her own first tap as someone else's answer | One extra tap |
| Daniel's "Waiting for you" verify request is dropped by the server once it is answered or the payment is no longer held. | It never cleared otherwise | Two reads per verify alert |
| Payment labels follow the state machine: `created` is "Not approved", and `payout_failed` is "Being returned" (its own payment screen). | "In progress" never ended, and "Refunded" was claimed before the refund happened | Labels only |
| The real person's answer copy ("already answered", "We stopped it" on 202, "We're sending" on 200) stays as planned. | The server confirms each of these: a real-person verification only closes as confirmed or denied, the BLOCK claim comes before the void, and "me" returns 200 only after the settlement | Copy overstates a void that is still finishing |
| End-to-end runs with one worker. `demo:reset` runs once in `globalSetup`, and it refuses unless the database is local or `E2E_ALLOW_RESET=1` is set. The low-risk "sent" story runs before the scam story. | A per-test reset raced the other spec files. Running the scam story first puts the shared sandbox payee on the scam list. | Slower runs (about 1 minute) |
| `--color-line-strong` is `#7d8a84`, which gives 3.6:1 on white. | Input borders need 3:1 | None |
| One shared cleaner for the requester's name: it strips "my" or "your", then a relationship word before a capitalised name. | "grandson Daniel" read badly in titles | An unusual phrasing passes through unchanged |
| A dev-server reload loop was reported twice. It was not reproduced: there is one reload after the first compile, and the end-to-end suite is stable on `next dev`. | — | If it returns, try `adjustFontFallback: false` |

## Open: first items for Plan 4B

- **Sarah's dashboard** still labels `payout_failed` as "Refunded" (`src/dashboard/dashboardService.ts`). Match Margaret's "Being returned".
- **`closedCopy`** (`src/app/circle/reviewCopy.ts`) falls back to "It was stopped, and the money stayed…" for `refunded`, `payout_failed`, `created`, `approved` and `authorised`. Give these states truthful lines.
- **The landing page** sentence "Older adults lose billions…" has no source. Replace it with the verified FBI, FTC or GASA figure and its source.

## Follow-ups

### Plan 4B: onboarding, PWA and push, accessibility pass

**Copy**
- The hold copy ("It isn't sent until Sarah approves it", "Nothing is sent unless it's approved") leaves out that Margaret can release the payment after 24 hours, and that the real person's "Yes" releases it.
- Telling the circle when the real person says no, or when Margaret cancels, would bring back the concept's "Sarah has been told" line. It would also clear Sarah's "Needs you" card when the payment is cancelled.

**Accessibility**
- The DemoButtons have no "Signing you in…" text.
- `/home` has no h1 while loading or on an error.
- The HoldRing label is read alongside the centre text.
- `Field` doesn't wire `aria-describedby` itself.
- Live regions mount together with their content.
- The post-approval 401 line is a bare `<p>`.

**Behaviour**
- A stale poll response can briefly undo the result of an action on the payment screen. Add a request sequence number.
- The held screen names only the first circle member.
- Sarah's verification note can name Sarah herself.
- If a file and text are both given, the text is silently ignored.
- The report button can be tapped again after the email draft opens.
- The checking preview's object URL is never revoked.

**Consistency**
- Dates mix en-GB and en-US formats.
- The search box on the dashboard grid still uses inline colours.
- The skeleton colour is a raw hex value.
- The landing card's shadow is a raw value.

### Plan 5: deploy and README

- The e2e reset guard already blocks a hosted database. Keep `E2E_ALLOW_RESET` unset on Render.
- Run a live check of the real PayPal button height, and of the approving and approval-error screens.

### Hardening, any time

- Drop `CASCADE` from `demo:reset` before more tables reference the truncated ones.
- `DemoButtons` declares its own copy of the `Persona` union.
- Demo login is open to CSRF, which matters little in demo mode.
- `SignOutButton` navigates even when the logout call fails.
- The alerts open-check makes two reads per verify alert.
- In `matchKeys`, cutting at a backslash also shortens paths, and a scheme-less `x?@paypal.com` takes the email branch.
- No page-level tests cover polling, the Refresh flow or the verify states. The end-to-end story covers the main path.
