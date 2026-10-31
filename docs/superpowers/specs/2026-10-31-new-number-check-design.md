# New-number check: design

Status: approved 2026-10-31 with option B (people add their own number). Builder's calls are marked **[my call]**.

## Purpose

The most common family scam opens with "it's me, I lost my phone, this is my new number". Today the AI usually catches it, but the result can only say why in general terms. We know something the scammer can't fake: the number Daniel really uses. When a message claims to be someone in Margaret's circle and the only phone numbers in it aren't that person's, the app says so plainly and treats the message as very likely a scam.

Pitch line (already agreed): *"AI can clone Daniel's voice. It can't answer from Daniel's phone."*

## Goals

- A circle member can have a known phone number.
- A message check (typed text, screenshot or voice note) raises a new signal `NEW_NUMBER_CLAIMS_CIRCLE` when all of these hold:
  1. the AI judged it ok (`checked`) and named a person as `impersonatedRequester`;
  2. that person matches **exactly one** member of the sender's circle, by display name or by relationship ("Daniel", "grandson"), case-insensitive, after `cleanRequesterName`;
  3. that member has a known number;
  4. the message contains at least one phone number, and none of them match the member's number (compared with `matchKeys`, so formatting and country prefixes don't matter).
- The signal raises the message to **high**, like `LINKED_SCAM_MESSAGE` does for payments.
- Its line is always the **first** reason shown, even when the AI already said high: *"It came from +1 (415) 555-0199, not Daniel's number."* (the first number that didn't match, as written in the message).
- No new payment work: a high message already feeds `flaggedPayees`, so a later payment to that number is linked and held.

## Non-goals

- Reading the sender number from phone metadata or the WhatsApp share sheet (share target is a separate feature).
- Calling or texting anyone.
- Treating a message from Daniel's **known** number as safe. Numbers can be spoofed, so a match only means this signal doesn't fire. **[my call]**

## Anti-goals

- Logging any phone number, the known number or the message text.
- Firing on an ambiguous claim ("your grandson" when there are two grandsons): no signal, the AI's result stands. **[my call]**
- Showing Daniel's real number anywhere on Margaret's result screen. The line names the *message's* number, never the known one. **[my call]**

## Data

- Migration: nullable `phone text` on `users`, holding the number as the person entered it. Comparison always goes through `matchKeys`. **[my call]** On `users` rather than per circle link, as agreed earlier: it is Daniel's own number.
- Demo seed: Daniel `+1 (415) 555-0131`, Sarah `+1 (415) 555-0135`, Tom `+1 (415) 555-0147`. All `555-01xx`, the range reserved for fiction. The existing demo message's `+1 (415) 555-0199` is not in the circle, so the demo story fires.
- **Adding a number (option B, the user's decision).** Settings gets a section **"Your phone number"** for every user, since anyone can be in someone's circle. One optional field and a Save button.
  - Helper copy: *"If someone messages your circle claiming to be you from a different number, they'll be warned. Your number is never shown to anyone else."*
  - Valid when it has 7 to 15 digits (the same rule `extractIdentifiers` uses for phones). An empty field clears it. Error copy: *"Please enter a phone number with 7 to 15 digits, or leave it empty."*
  - Saved through the existing `PUT /api/me/settings` as `phone` (string, or `null` to clear), stored trimmed as written, at most 32 characters. **[my call]**
  - The number is returned only to its owner (`/api/me` and the settings response). No other endpoint or screen returns it.

## Where it runs

- In `assessMessage`, after the judge, beside the other signals. It needs a new context input: the sender's circle members as `{ name, relationship, phone }`, loaded in `messageService.check` from the existing circle tables. **[my call]**
- Unchecked (AI failed) messages don't get it, since there is no claimed person. They are already never shown as safe.

## Tests

- **Unit:** the matcher: fires; doesn't fire when the number matches in another format (`4155550131` vs `+1 (415) 555-0131`); doesn't fire with no number, no claimed person, an organisation, an unknown name, an ambiguous relationship, or a member with no known number. Plus: the level becomes high from medium, and the line is the first reason when the AI already said high.
- **Integration:** a seeded circle, a "Daniel, new number" message → high, the line comes first, then a later payment to that number is linked (`linkedMessage`).
- **e2e:** the existing check-message test with a stubbed AI shows the line.
- **Eval:** two labelled cases: a scam from a new number, and a genuine message from Daniel quoting his known number (must not fire). The harness needs a demo circle with numbers. Re-run `eval:live` and update README figures only from its output.
