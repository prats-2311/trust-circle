# Scam feed: design

Date: 2026-10-17. Status: approved in conversation, awaiting written-spec review.
Parent spec: `docs/superpowers/specs/2026-10-12-trust-circle-design.md`.

## Purpose

People who meet a scam can warn other Trust Circle users what is going around. Sharing is opt-in, and only an
AI-written, anonymised one-sentence summary is ever shown: no names, numbers, links, amounts, dates or company
names. Shared summaries also feed the existing pattern matcher, so a phone-call story told today helps catch a scam
text with the same script tomorrow.

Success: a signed-in user can share a summary from a checked scam message or from their own written story, see it
in the feed with a count of different people, and remove their share; nothing identifying is ever stored or shown.

## Decisions (from the conversation)

| Topic | Decision |
|---|---|
| Post sources | Both: "Warn others" on a checked scam message, and a "Tell others about a scam" story form for calls and anything else. |
| Audience | Signed-in users only. A "What's going around" card on home, and the full feed on the existing trends page. No public feed. |
| Storage | Approach 1: summaries stay in `scam_patterns`; a new `feed_shares` table records who chose to show each one. |
| Consent | Separate from reporting to PayPal. The person sees the exact summary and confirms before anything is shared. |
| Moderation | None beyond the safeguards below. Named as a limit in the README. |

## User experience

### Warn others, from a checked message

- Shown on a message check result when `checked` is true and `level` is not `low` (the same rule as reporting).
  Independent of "Report this to PayPal": either, both or neither.
- Tapping **Warn others** asks the server for a draft summary, then shows a preview:
  "This is what others will see:" followed by the summary in quotes, then "No names, numbers or links are shared."
  Buttons: **Share it** and **Don't share**.
- After sharing: "Shared. Thank you for warning others." with a link to the feed.
- If this check is already shared by this person, the button reads **Shared in the feed** and is disabled.

### Tell others about a scam

- A **Tell others about a scam** button on the feed page opens a form.
- Label: "What happened?" Help text: "You don't need to leave out names or numbers. We remove them before anything is
  shared." Maximum 1,000 characters, minimum 20.
- The story is checked like a message (below). Then the same preview and confirm step as above.

### Reading the feed

- **Home**: a "What's going around" card with the latest 3 summaries. Each shows the summary, its scam-type label,
  and "Reported by N people" (or "Reported by 1 person") with the latest date in relative words ("today",
  "2 days ago"). A "See all" link goes to the feed. If there are no summaries, or loading fails, the card is not shown.
- **Feed**: at the top of the existing "Scams people are reporting" page (`/trends`), above the chart: heading
  "What's going around", the **Tell others about a scam** button, and the list (up to 20).
  Summaries the viewer shared show "You shared this" and a **Remove my share** link.
  Empty state: "Nothing shared yet. If you meet a scam, tell others about it here."
- The existing line "Includes example reports created for this demo." covers seeded shares.

## Server design

### Data

New table `feed_shares`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `pattern_id` | uuid, FK `scam_patterns.id`, not null | |
| `sharer_id` | uuid, FK `users.id`, not null | |
| `source` | enum `feed_share_source`: `message`, `story` | |
| `message_check_id` | uuid, FK `message_checks.id`, nullable | Set for `message` shares, so the check result can show "Shared in the feed". Never shown in the feed. |
| `created_at` | timestamptz, default now | |

Unique index on (`pattern_id`, `sharer_id`). No other schema change. One Drizzle migration.

### Draft token

- `signDraft({ userId, description, scamType, source, messageCheckId? }, secret, now)` returns a token: base64url
  JSON payload plus an HMAC-SHA256 over it with `SESSION_SECRET`, as `src/server/session.ts` signs sessions.
  The payload includes `exp` = now + 15 minutes.
- `verifyDraft(token, userId, secret, now)` returns the payload or `null` when the signature is wrong, it has expired,
  or the user differs. Comparison is constant-time.
- The token holds only the anonymised summary, never the story or message text.

### Feed service (`src/feed/feedService.ts`)

Dependencies are injected, as in the other services: messages repo, `assessMessage` dependencies (judge, guard,
patterns, registry), the pattern describer, the pattern service, the feed repo, the story rate limiter, the secret
and a clock.

- `draftFromCheck({ userId, messageCheckId })`
  - Loads the check. If it is missing or not this user's: `NotAllowedError` (404).
  - If `!checked` or `level === "low"`: `FeedError("not_a_scam")`.
  - Describes the stored text with the describer. `null` or `!isAnonymous` gives `FeedError("not_anonymous")`.
  - Returns `{ description, scamType, token }`.
- `sharedChecks(userId)` returns the ids of this user's checks they have shared. The check result uses it to show
  **Shared in the feed**.
- `draftFromStory({ userId, story })`
  - Trims the story. Fewer than 20 or more than 1,000 characters gives an input error (400).
  - The rate limiter allows 10 story checks per user per rolling hour, in memory. Over the limit: `FeedError("rate_limited")`
    (429).
  - Runs `assessMessage({ kind: "text", text: story }, …)`. The result is not written to `message_checks`.
  - Unchecked gives `FeedError("unchecked")`. Low gives `FeedError("not_a_scam")`.
  - Otherwise it describes as above.
- `share({ userId, token })`
  - `verifyDraft`; `null` gives `FeedError("expired")` (400).
  - Runs `isAnonymous` again.
  - Finds or creates the pattern (merge rule below), then inserts the share, idempotently on (pattern, sharer).
  - When a new share merges into an existing pattern, calls `incrementReports` on it so the matcher's count matches.
  - Returns `{ patternId }`.
- `unshare({ userId, patternId })` deletes this user's row only. Deleting a share that doesn't exist does nothing.
  The pattern itself stays in the matcher.
- `list({ userId, limit })` returns items `{ patternId, description, scamType, people, lastSharedAt, sharedByMe }`.
  These are patterns with at least one share in the last 12 weeks. `people` is the count of distinct sharers in that
  window, and `lastSharedAt` is the latest share. Ordered by `lastSharedAt` descending, `limit` capped at 20.

### Merging near-duplicates

`patternService.findOrAdd({ description, scamType })` embeds the description and looks up the nearest pattern. If its
similarity is at least **0.8**, it returns that pattern. Otherwise it inserts a new one (which stays idempotent on
the exact description). The threshold is a starting value. A unit test over the seeded summaries, run with the real
local embedder, must keep different scam scripts apart and merge rewordings of the same script. If that test can't
pass at 0.8, the threshold changes and the change is recorded in the plan ledger. The report flow keeps using `add`
unchanged.

### Routes

All require a session; no session gives 401. Errors go through the existing `errorResponse` in `src/server/http.ts`, which gains a `FeedError` case.

| Route | Body | Success |
|---|---|---|
| `POST /api/feed/drafts` | `{ messageCheckId }` or `{ story }` (exactly one) | 200 `{ description, scamType, token }` |
| `POST /api/feed/shares` | `{ token }` | 201 `{ patternId }` |
| `DELETE /api/feed/shares/[patternId]` | | 204 |
| `GET /api/feed?limit=n` | | 200 `{ items }` |

`FeedError` codes map to these statuses and messages:

| Code | Status | Message |
|---|---|---|
| `unchecked` | 503 | "We can't check this right now. Nothing was posted. Please try again later." |
| `not_a_scam` | 422 | "This doesn't sound like a scam, so it won't be posted." |
| `not_anonymous` | 422 | "We couldn't write this up without personal details, so nothing was shared." |
| `expired` | 400 | "This preview has expired. Please try again." |
| `rate_limited` | 429 | "You've shared a lot in the last hour. Please try again later." |

### Demo seed

`deploy:seed` and the demo reset add shares from the demo users to a few of the seeded patterns, so the feed and
home card are not empty. Reset leaves seeded shares in place and removes the others, like the other demo data.

## Safety

- **Four layers of anonymity:** the describer prompt; `isAnonymous` (checked at draft and again at share); the person
  confirms the exact text; the sharer can remove their share.
- **Never stored or logged:** story text; the message text inside a token; who shared which summary (logs carry
  only error names and counts). The feed never shows sharers, only counts.
- **Untrusted input:** stories go through Prompt Guard and `neutralise`, as messages do. Whatever the input, the
  output must still pass `isAnonymous` and the person's confirmation.
- **Fail closed:** if the AI is unavailable, nothing is posted.
- **Known limit:** no moderation queue or "flag this". This goes in the README's "Limits and honest notes".

## Testing

- **Unit:**
  - draft token: round trip, expiry, tampered payload, wrong user;
  - feed service with fakes: every `FeedError` path, not your check, merge, distinct-people count, idempotent share,
    unshare;
  - rate limiter: the 11th story in an hour is refused, and one more is allowed after the hour;
  - routes: 401, 404, 400, 422, 429, 503 and the success bodies;
  - the merge threshold test with the real embedder.
- **Integration:** Drizzle feed repo: unique share, 12-week window, distinct counts, `sharedByMe`, ordering, limit.
- **E2E, Groq stubbed as in `e2e/stubs.ts`:**
  - share from a checked scam message, then see it on home and in the feed with "You shared this";
  - tell a phone-call story, preview it and share it;
  - remove a share;
  - a low-risk story is not posted;
  - the feed and home card are added to `e2e/a11y.spec.ts`.
- **Docs:** README feature section and limits, Devpost draft, one line in the video script. No figures we haven't measured.

## Out of scope

A public feed, moderation and flagging, comments or reactions, push alerts for new feed items, and sharing from held
payments.
