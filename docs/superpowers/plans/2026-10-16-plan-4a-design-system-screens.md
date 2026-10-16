# Plan 4A: Design System, Demo Mode and the Designed Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare Plan 1 to Plan 3 pages with the approved designs:
- a token-based design system;
- demo-mode sign-in with expiring sessions;
- Margaret's home, check-a-message, send and payment-status screens (including the challenge and official-routes screens);
- Sarah's circle and review screens;
- Daniel's "Did you just ask…" screen;
- end-to-end tests of the whole story.

**Architecture:**
- **Styling:** Tailwind v4 tokens from `DESIGN.md`.
- **Shared kit:** a small UI kit in `src/ui` (layout, buttons, chips, fields, hold ring, a typed `fetchJson`) shared by all screens. Screens are client components that call the existing API routes.
- **Server additions:** a few small routes and service methods:
  - get one payment;
  - get one payment for a contact;
  - the sender cancelling a held payment;
  - `/api/me`;
  - demo login by persona;
  - logout.
- **Testing:** logic that decides what a screen shows lives in pure functions with unit tests. Screens are checked by Playwright end-to-end tests and by screenshots compared against the concepts.

**Tech Stack:** As Plans 1 to 3, plus `@phosphor-icons/react` (icons) and `next/font/google` (`Atkinson_Hyperlegible_Next`).

**Spec:** `docs/superpowers/specs/2026-10-12-trust-circle-design.md`, sections 3, 4.9, 10 and 10.1. Earlier follow-ups:
- `docs/superpowers/plans/2026-10-16-plan-2-carry-forward.md`
- `docs/superpowers/plans/2026-10-16-plan-3-carry-forward.md`

**Approved screen concepts:** https://claude.ai/artifact/Wt5VxNPn48YmVmEZBo2rPv. Round 1 was approved on 2026-10-16 and round 2 was published the same day for review. Task 2 copies the concept files into `docs/design/concepts/`, so implementers can open them without access to the artifact.

## Plan series update

Plan 4 is split in two:
- **4A (this plan):** the design system, demo mode and every working screen.
- **4B:** the installable app (PWA) and web push, onboarding (presets and safe word), the final landing page with the verified statistic, and the accessibility and design review pass.

## Scope rulings (user decisions on 2026-10-16, and plan rulings)

| Ruling | Why | Cost if wrong |
|---|---|---|
| Demo mode only: no Auth.js. Personas are fixed demo accounts chosen by name. Sessions expire after 12 hours. | User decision. Real email sign-in needs a verified email domain. | Judges cannot create their own accounts |
| Light theme only | The concepts are light. Older eyes read high-contrast dark ink on a light ground best. | No dark mode |
| Component behaviour is tested through pure helpers and Playwright, not a DOM unit-test setup | Avoids a second test environment. The screens are thin. | A rendering bug is caught later, in e2e |
| The message-check result has no "Check with the real Daniel" button. Real-person verification exists only for a held payment. | That is what the backend supports (Plan 2 ruling) | One fewer action on that screen |
| Round 1's Verify concept invented a saved number and a specific memory question. The built screen uses real data: the matched circle member and the general guidance from `CHALLENGE_GUIDANCE`. | No invented facts in the UI | None |
| The sender can cancel a held payment (a new `senderCancel`, which blocks and voids) | The "Cancel this payment" button in the concepts needs it | None |

## Global Constraints

- Everything in Plans 1 to 3's Global Constraints still applies:
  - strict TypeScript;
  - integer cents;
  - sandbox only;
  - the AI may raise a level, never lower it;
  - secrets only in `.env.local`;
  - calm copy that never blames the sender;
  - `isUuid` guards ids;
  - nothing private is logged.
- **Design rules (spec 10 and 10.1, `DESIGN.md`):**
  - Body text at least 16 px; primary actions at least 56 px tall; every tap target at least 44 × 44 px.
  - WCAG 2.1 AA contrast; focus visible on every control.
  - Status is always shown as a word plus an icon, never colour alone.
  - One accent (evergreen) for safe and primary actions; held blue only for holds; blocked red only for stopping actions.
  - No gradients, glassmorphism, emoji or stock illustrations. Icons come only from `@phosphor-icons/react`.
  - Motion only to explain (the hold ring filling, a verification travelling), and none under `prefers-reduced-motion`.
  - No browser dialogs (`alert`, `confirm`, `prompt`).
  - Every screen has designed loading, empty and error states, written in the interface's voice.
- **Copy:** use the words from the concepts. Payment results say exactly what happened ("Payment stopped. Your money is safe."). Never "Nothing has been sent" after money may have moved; a 202 response shows the pending copy.
- Pages work at 390 px and at 1280 px wide, with no horizontal page scroll.
- Never stage `.env.local`, `.superpowers/`, `.claude/`, `.agents/`, `agent/`, `graft/`, `.mcp.json`, `.ignore` or `skills-lock.json`.
- `next dev` may rewrite `AGENTS.md`. Restore it with `git checkout -- AGENTS.md` and never commit it.
- Commit after every task with a Conventional Commits message ending in:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XCmCYpfCuLqyKrCLNuw6fP
  ```
  Subagents use their own model name.
- **Commands:**
  - Unit tests: `npm test`.
  - Integration tests: `npm run test:int`.
  - Types: `npm run typecheck`.
  - Lint: `npm run lint`.
  - End-to-end: `npx playwright test <file>`. Playwright starts `npm run dev` itself.
- **Screen review gate (spec 10.1, step 4):** every task that builds a screen ends with screenshots at 390 × 844 and 1280 × 800, saved in the scratchpad. The implementer looks at them against the concept file and lists any differences in the report. The controller looks at them before accepting the task.

## Review Focus

1. **Money copy after a 202 or a claim.** A screen must never say "Nothing has been sent" once a payment is pending, being finished or held. (Pinned in Tasks 6 and 7, through `screenFor` and the approval-error copy tests.)
2. **An unchecked message check.** `level: null` must show the "We couldn't check this message right now" screen, never a reassuring one. (Pinned in Task 5 by `checkResultKind`.)
3. **Someone else's payment or verification.** Opening another user's payment, review or verification link must show a calm "not found" or "not for you" screen, with no data from the API. (Pinned in Tasks 7, 8 and 9 with server tests and e2e.)
4. **Session expiry mid-flow.** Every screen must handle a 401 by offering a way back to the landing page, keeping the user's typed text where possible. (Pinned in Task 2 by `fetchJson` and in every screen's error state.)
5. **Double taps on decisive buttons.** Block, approve, "It wasn't me", the challenge answers and cancel must not fire twice. (Pinned by the `useOnce` helper test in Task 2 and the server's 409 handling.)

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/domain/matchKeys.ts` | Cut `?#\` before userinfo | 1 |
| `DESIGN.md`, `docs/design/concepts/*.html` | Design direction, tokens, concepts | 2 |
| `src/app/globals.css`, `src/app/layout.tsx` | Tokens, font, base styles | 2 |
| `src/ui/*` | Screen, TopBar, Button, Chip, Card, Field, Notice, HoldRing, Skeleton, icons, `fetchJson`, `useOnce`, `holdProgress` | 2 |
| `src/server/session.ts`, `src/server/demo.ts`, `src/circle/*`, demo and me routes, `scripts/demo-reset.ts`, `src/app/page.tsx` | Sessions, personas, landing | 3 |
| `src/app/home/*` | Margaret's home | 4 |
| `src/app/check/*` | Check a message | 5 |
| `src/app/send/*` | Send flow | 6 |
| `src/app/payments/[id]/*`, payment routes, `paymentService.senderCancel` | Payment status, challenge, official routes, outcomes | 7 |
| `src/app/circle/*`, `src/app/api/circle/payments/[id]` | Sarah's circle, review, dashboard and trends styling | 8 |
| `src/app/verify/[id]/*` | Daniel's answer | 9 |
| `e2e/*.spec.ts` | The demo story end to end | 10 |

---

### Task 1: Close the registry look-alike link gap

**Files:**
- Modify: `src/domain/matchKeys.ts`
- Test: `src/domain/matchKeys.test.ts`, `src/reports/reportService.test.ts`

**Interfaces:**
- Produces: `matchKeys` cuts any query, fragment or backslash tail (`[?#\\].*`) **before** stripping userinfo, so `https://evil.example?@paypal.com` gets the key `evil.example`.

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/matchKeys.test.ts`:

```ts
  it("keys a link by the host a browser would really open", () => {
    expect(matchKeys("https://evil.example?@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("https://evil.example#@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("https://evil.example\\@paypal.com")).toEqual(["evil.example"]);
    expect(matchKeys("http://paypal.com@evil.example/x")).toEqual(["evil.example/x"]);
  });
```

Add to `src/reports/reportService.test.ts`, inside its main `describe`, reusing the file's setup helper. Pass a check whose identifiers include `{ type: "url", value: "https://evil.example?@paypal.com" }`, and assert that `registry.record` receives that identifier, because it is not a trusted domain. Follow the shape of the existing "bare paypal.com dropped" test in that file.

Run: `npm test -- src/domain src/reports` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `matchKeys`, in the link branch, apply the query, fragment and backslash cut first. The branch becomes:

```ts
    return [
      v
        .replace(/[?#\\].*$/, "")
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .replace(/^[^/@]*@/, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, ""),
    ];
```

Keep every other branch unchanged.

- [ ] **Step 3: Run all tests and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS. Every earlier `matchKeys` test passes unchanged.

```bash
git add src/domain/matchKeys.ts src/domain/matchKeys.test.ts src/reports/reportService.test.ts
git commit -m "fix: key look-alike links by the host a browser opens"
```

---

### Task 2: Design tokens, typeface and the UI kit

**Files:**
- Create: `DESIGN.md`, `docs/design/concepts/` (copy of the 17 concept `.dc.html` files and `canvas.json`)
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `package.json` (add `@phosphor-icons/react`)
- Create: `src/ui/Screen.tsx`, `src/ui/Button.tsx`, `src/ui/Chip.tsx`, `src/ui/Card.tsx`, `src/ui/Field.tsx`, `src/ui/Notice.tsx`, `src/ui/HoldRing.tsx`, `src/ui/Skeleton.tsx`, `src/ui/icons.ts`, `src/ui/fetchJson.ts`, `src/ui/useOnce.ts`, `src/ui/holdProgress.ts`, `src/ui/SignedOut.tsx`
- Delete: `src/app/Skeleton.tsx`, `src/app/SessionNotice.tsx`. Move their users to `src/ui`.
- Test: `src/ui/fetchJson.test.ts`, `src/ui/holdProgress.test.ts`, `src/ui/useOnce.test.ts`

**Interfaces:**
- Produces:
  - Tailwind tokens (`bg-ground`, `bg-surface`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`, `border-line-strong`, `bg-evergreen`, `text-evergreen`, `bg-evergreen-tint`, `bg-held`, `text-held`, `text-held-ink`, `bg-held-tint`, `bg-caution-tint`, `text-caution-ink`, `bg-blocked`, `text-blocked-ink`, `bg-blocked-tint`, `bg-neutral-tint`, `rounded-control` (14 px), `rounded-panel` (20 px)).
  - `fetchJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>>`, where `type FetchResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; signedOut: boolean }`.
  - `useOnce()`: `{ busy: boolean; run(fn: () => Promise<void>): Promise<void> }`. A second `run` while one is in flight is ignored.
  - `holdProgress(a: { authorisedAt: string | null; coolingOffUntil: string | null; now: Date }): { fractionUsed: number; msLeft: number; releaseAt: Date | null }` and `timeLeftText(ms: number): string`.
  - Components:
    - `Screen({ title?, backHref?, chip?, children, footer? })`
    - `Button({ variant: "primary" | "secondary" | "danger" | "quiet", ...ButtonHTMLAttributes })`
    - `ButtonLink({ href, variant, children })`
    - `Chip({ tone: "held" | "caution" | "blocked" | "safe" | "neutral", children })` (it adds the matching icon)
    - `Card({ children, className? })`
    - `Field({ id, label, hint?, error?, children })`
    - `Notice({ tone: "info" | "error" | "pending", children })` (role `alert` for error, `status` otherwise)
    - `HoldRing({ fractionUsed, amountCents, label })`
    - `Skeleton({ blocks: number[] })`
    - `SignedOut()`

- [ ] **Step 1: Copy the concepts and write `DESIGN.md`**

Run:

```bash
mkdir -p docs/design/concepts && cp /private/tmp/claude-501/-Users-prateeksrivastava-Documents-paypal/e9a957f5-ceeb-482a-b6bd-bd3f036da4eb/scratchpad/tc-design/project/*.dc.html /private/tmp/claude-501/-Users-prateeksrivastava-Documents-paypal/e9a957f5-ceeb-482a-b6bd-bd3f036da4eb/scratchpad/tc-design/project/canvas.json docs/design/concepts/
```

`DESIGN.md`:

````markdown
# Trust Circle design

## Direction

Calm, plain and trustworthy, for an older person under pressure and the family helping them. One decision per screen. Large type, high contrast, generous spacing. The product slows a scam down; the interface should feel unhurried.

Reading: a trust-first consumer finance app for older adults and their families. Variance 4, motion 3, density 3.

## Type

Atkinson Hyperlegible Next (Braille Institute, designed for low-vision readers), weights 400, 500, 700, 800.

| Role | Size / line height | Weight |
|---|---|---|
| Display (landing) | clamp(40px, 5.2vw, 68px) / 1.04 | 800 |
| Screen title (h1) | 30 to 32px / 1.15 | 800 |
| Section (h2) | 19 to 20px / 1.3 | 700 |
| Body large | 18 to 19px / 1.45 | 400 |
| Body | 17px / 1.4 | 400 |
| Small (never below) | 16px / 1.4 | 400 |
| Amounts | tabular numerals, 800 |

## Colour

| Token | Hex | Use |
|---|---|---|
| ground | #F4F6F4 | page background |
| surface | #FFFFFF | cards, inputs |
| ink | #14201B | text, secondary button borders |
| ink-2 | #3F4B46 | supporting text |
| ink-3 | #4A5651 | captions, hints |
| line / line-strong | #D9DFDB / #B9C4BE | dividers / input borders |
| evergreen (accent) | #1E5A47, dark #14402F, tint #E3EDE8 | primary actions, safe outcomes |
| held | #2C5C8F, ink #24456B, tint #E6EEF7, track #DCE3EC | anything on hold |
| caution | tint #FBF0DC, ink #6E4300 | warnings that ask for a pause |
| blocked | #A2302A, ink #8A231E, tint #F8E5E3 | stopping actions, scam verdicts |
| neutral tint | #EEF1EF | not checked, hold ended |

Status is always a word plus an icon. Colour is never the only signal.

## Shape, spacing, elevation

- Radius: 14px for controls (buttons, inputs, notices); 20px for panels (cards); 999px for chips and avatars.
- Spacing: a 4px grid. Screens use 24px side padding, with 16 to 28px between groups.
- Elevation: none on screens (cards sit on the ground colour). One soft shadow only on the landing phone mock.
- Buttons: primary 58px tall, secondary 58px with a 2px ink border, danger filled blocked red, quiet as an underlined text link of at least 44px.

## Motion

- The hold ring fills to its used fraction once on load (1.4s ease-out).
- The verification envelope travels between avatars while waiting.
- An outcome icon settles in (0.7s).
- Nothing loops except "waiting" indicators, and nothing moves under `prefers-reduced-motion`.

## Icons

Phosphor, regular weight in content and bold in chips, 20 to 28px, always with `aria-hidden` next to a visible label.

## Voice

Plain words, short sentences, no jargon, no blame. Say what happened and what happens next. After a check: "Checking first was the right thing to do." Never "Nothing has been sent" once money may have moved.

## Concepts

`docs/design/concepts/` holds the approved concept screens (round 1 and round 2). Build each screen to its concept. Differences need a reason in the task report.
````

- [ ] **Step 2: Write the failing helper tests**

`src/ui/fetchJson.test.ts`:

```ts
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { installMsw, server } from "@/test/msw";
import { fetchJson, NETWORK_ERROR, SIGNED_OUT } from "./fetchJson";

installMsw();
const URL = "http://localhost/api/thing";

describe("fetchJson", () => {
  it("returns data on success", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ a: 1 })));
    expect(await fetchJson<{ a: number }>(URL)).toEqual({ ok: true, status: 200, data: { a: 1 } });
  });
  it("returns the server's error copy", async () => {
    server.use(http.post(URL, () => HttpResponse.json({ error: "Please check the details." }, { status: 400 })));
    expect(await fetchJson(URL, { method: "POST" })).toEqual({ ok: false, status: 400, error: "Please check the details.", signedOut: false });
  });
  it("treats 202 as success, so pending copy reaches the screen", async () => {
    server.use(http.post(URL, () => HttpResponse.json({ error: "We're finishing this payment for you.", paymentId: "p1" }, { status: 202 })));
    const r = await fetchJson<{ error: string; paymentId: string }>(URL, { method: "POST" });
    expect(r).toEqual({ ok: true, status: 202, data: { error: "We're finishing this payment for you.", paymentId: "p1" } });
  });
  it("flags a signed-out user", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: "Please sign in." }, { status: 401 })));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 401, error: SIGNED_OUT, signedOut: true });
  });
  it("gives calm copy for network failures and non-JSON errors", async () => {
    server.use(http.get(URL, () => HttpResponse.error()));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 0, error: NETWORK_ERROR, signedOut: false });
    server.use(http.get(URL, () => new HttpResponse("oops", { status: 500 })));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 500, error: NETWORK_ERROR, signedOut: false });
  });
});
```

`src/ui/holdProgress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { holdProgress, timeLeftText } from "./holdProgress";

const at = (h: number) => new Date(Date.UTC(2026, 10, 1, h)).toISOString();

describe("holdProgress", () => {
  it("reports the fraction of the cooling-off period used and time left", () => {
    const p = holdProgress({ authorisedAt: at(0), coolingOffUntil: at(24), now: new Date(at(3)) });
    expect(p.fractionUsed).toBeCloseTo(3 / 24);
    expect(p.msLeft).toBe(21 * 3_600_000);
    expect(p.releaseAt?.toISOString()).toBe(at(24));
  });
  it("clamps after the release time and copes with missing dates", () => {
    expect(holdProgress({ authorisedAt: at(0), coolingOffUntil: at(24), now: new Date(at(30)) })).toMatchObject({ fractionUsed: 1, msLeft: 0 });
    expect(holdProgress({ authorisedAt: null, coolingOffUntil: null, now: new Date(at(1)) })).toEqual({ fractionUsed: 0, msLeft: 0, releaseAt: null });
  });
});

describe("timeLeftText", () => {
  it.each([
    [21 * 3_600_000, "21 hours left"],
    [3_600_000, "1 hour left"],
    [45 * 60_000, "45 minutes left"],
    [60_000, "1 minute left"],
    [0, "Ready to release"],
  ])("%d ms → %s", (ms, text) => expect(timeLeftText(ms)).toBe(text));
});
```

`src/ui/useOnce.test.ts` (tests the plain-function core, so it needs no DOM):

```ts
import { describe, expect, it } from "vitest";
import { createOnce } from "./useOnce";

describe("createOnce", () => {
  it("ignores a second run while the first is in flight, then allows another", async () => {
    const once = createOnce(() => {});
    let calls = 0;
    let release!: () => void;
    const first = once.run(() => new Promise<void>((r) => { calls += 1; release = r; }));
    await once.run(async () => { calls += 1; });
    expect(calls).toBe(1);
    release();
    await first;
    await once.run(async () => { calls += 1; });
    expect(calls).toBe(2);
  });
  it("frees itself after a failure", async () => {
    const once = createOnce(() => {});
    await once.run(async () => { throw new Error("x"); }).catch(() => {});
    let ran = false;
    await once.run(async () => { ran = true; });
    expect(ran).toBe(true);
  });
});
```

Run: `npm test -- src/ui` — Expected: FAIL.

- [ ] **Step 3: Implement the helpers**

`src/ui/fetchJson.ts`:

```ts
export const SIGNED_OUT = "Your session has ended. Please choose a demo account again.";
export const NETWORK_ERROR = "We couldn't reach Trust Circle. Please check your connection and try again.";

export type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; signedOut: boolean };

/** Every screen talks to the API through this, so 401s, network errors and 202s are handled the same way. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR, signedOut: false };
  }
  if (res.status === 401) return { ok: false, status: 401, error: SIGNED_OUT, signedOut: true };
  const body: unknown = await res.json().catch(() => undefined);
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  const error = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : NETWORK_ERROR;
  return { ok: false, status: res.status, error, signedOut: false };
}

export const jsonBody = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});
```

`src/ui/holdProgress.ts`:

```ts
export function holdProgress(a: { authorisedAt: string | null; coolingOffUntil: string | null; now: Date }) {
  if (!a.authorisedAt || !a.coolingOffUntil) return { fractionUsed: 0, msLeft: 0, releaseAt: null };
  const start = new Date(a.authorisedAt).getTime();
  const end = new Date(a.coolingOffUntil).getTime();
  const span = Math.max(1, end - start);
  const used = Math.min(span, Math.max(0, a.now.getTime() - start));
  return { fractionUsed: used / span, msLeft: Math.max(0, end - a.now.getTime()), releaseAt: new Date(end) };
}

export function timeLeftText(ms: number): string {
  if (ms <= 0) return "Ready to release";
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
}
```

`src/ui/useOnce.ts`:

```ts
"use client";
import { useMemo, useState } from "react";

/** Runs one async action at a time; extra taps while it runs are ignored. */
export function createOnce(onBusy: (busy: boolean) => void) {
  let inFlight = false;
  return {
    async run(fn: () => Promise<void>): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      onBusy(true);
      try {
        await fn();
      } finally {
        inFlight = false;
        onBusy(false);
      }
    },
  };
}

export function useOnce() {
  const [busy, setBusy] = useState(false);
  const once = useMemo(() => createOnce(setBusy), []);
  return { busy, run: once.run };
}
```

Run: `npm test -- src/ui` — Expected: PASS.

- [ ] **Step 4: Tokens, typeface and base styles**

Run: `npm install @phosphor-icons/react@2.1.10`

`src/app/globals.css` (replace the whole file):

```css
@import "tailwindcss";

@theme {
  --color-ground: #f4f6f4;
  --color-surface: #ffffff;
  --color-ink: #14201b;
  --color-ink-2: #3f4b46;
  --color-ink-3: #4a5651;
  --color-line: #d9dfdb;
  --color-line-strong: #b9c4be;
  --color-evergreen: #1e5a47;
  --color-evergreen-dark: #14402f;
  --color-evergreen-tint: #e3ede8;
  --color-held: #2c5c8f;
  --color-held-ink: #24456b;
  --color-held-tint: #e6eef7;
  --color-held-track: #dce3ec;
  --color-caution-tint: #fbf0dc;
  --color-caution-ink: #6e4300;
  --color-blocked: #a2302a;
  --color-blocked-ink: #8a231e;
  --color-blocked-tint: #f8e5e3;
  --color-neutral-tint: #eef1ef;
  --radius-control: 14px;
  --radius-panel: 20px;
  --font-sans: var(--font-atkinson), system-ui, sans-serif;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--color-ground);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 1.4;
}

:focus-visible {
  outline: 3px solid var(--color-held);
  outline-offset: 3px;
}

.tc-skeleton {
  background: #e4e9e6;
  border-radius: var(--radius-panel);
}

@media (prefers-reduced-motion: no-preference) {
  .tc-ring-fill {
    animation: tc-ring 1.4s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .tc-settle {
    animation: tc-settle 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .tc-travel {
    animation: tc-travel 2.4s cubic-bezier(0.45, 0, 0.2, 1) infinite;
  }
}

@keyframes tc-ring {
  from {
    stroke-dashoffset: var(--tc-ring-length);
  }
}
@keyframes tc-settle {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
@keyframes tc-travel {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
  100% {
    transform: translateX(150px);
    opacity: 0;
  }
}
```

Keep `.tc-search:focus-visible` behaviour by giving the dashboard search input Tailwind focus classes in Task 8; the global `:focus-visible` rule already covers it.

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trust Circle",
  description: "Scammers pretend to be someone you trust. So we ask that person.",
};

export const viewport: Viewport = { themeColor: "#f4f6f4" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={atkinson.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

If `next/font/google` in this Next version rejects a `weight` array for this family (it is variable), remove `weight`. Check the font's entry in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`.

- [ ] **Step 5: The UI kit**

`src/ui/icons.ts`. Import only from the SSR-safe entry; check each name against `node_modules/@phosphor-icons/react/dist/ssr/index.d.ts` and use the exported name if one differs:

```ts
export {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  CheckIcon,
  InfoIcon,
  LockSimpleIcon,
  PauseIcon,
  ShieldCheckIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
```

`src/ui/Button.tsx`:

```tsx
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

const BASE = "inline-flex w-full items-center justify-center gap-2 rounded-control text-[19px] font-bold transition-transform active:scale-[0.98] disabled:opacity-60";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "min-h-[58px] bg-evergreen px-5 text-white hover:bg-evergreen-dark",
  secondary: "min-h-[58px] border-2 border-ink bg-transparent px-5 text-ink hover:bg-surface",
  danger: "min-h-[58px] bg-blocked px-5 text-white hover:brightness-95",
  quiet: "min-h-[44px] bg-transparent px-3 text-[18px] font-medium text-ink-2 underline underline-offset-4",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`} />;
}

export function ButtonLink({ href, variant = "primary", children, className = "" }: { href: string; variant?: ButtonVariant; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} no-underline ${className}`}>
      {children}
    </Link>
  );
}
```

`src/ui/Chip.tsx`:

```tsx
import type { ReactNode } from "react";
import { CheckCircleIcon, InfoIcon, PauseIcon, WarningIcon, XCircleIcon } from "./icons";

export type ChipTone = "held" | "caution" | "blocked" | "safe" | "neutral";

const TONES: Record<ChipTone, { cls: string; Icon: typeof PauseIcon }> = {
  held: { cls: "bg-held-tint text-held-ink", Icon: PauseIcon },
  caution: { cls: "bg-caution-tint text-caution-ink", Icon: WarningIcon },
  blocked: { cls: "bg-blocked-tint text-blocked-ink", Icon: XCircleIcon },
  safe: { cls: "bg-evergreen-tint text-evergreen-dark", Icon: CheckCircleIcon },
  neutral: { cls: "bg-neutral-tint text-ink-2", Icon: InfoIcon },
};

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const { cls, Icon } = TONES[tone];
  return (
    <span className={`inline-flex min-h-[34px] items-center gap-2 self-start rounded-full py-1 pl-2.5 pr-3.5 text-[16px] font-bold ${cls}`}>
      <Icon aria-hidden="true" size={20} weight="bold" />
      {children}
    </span>
  );
}
```

`src/ui/Card.tsx`:

```tsx
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-panel bg-surface p-5 ${className}`}>{children}</div>;
}
```

`src/ui/Field.tsx`:

```tsx
import type { ReactNode } from "react";

/** Label above, hint and error below; children is the input, which must use `id` and `aria-describedby`. */
export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[18px] font-bold">
        {label}
      </label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-[16px] leading-snug text-ink-3">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-[16px] font-bold text-blocked-ink">
          {error}
        </span>
      )}
    </div>
  );
}

export const INPUT = "min-h-[56px] w-full rounded-control border-2 border-line-strong bg-surface px-4 text-[18px] text-ink";

export function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
```

`src/ui/Notice.tsx`:

```tsx
import type { ReactNode } from "react";
import { InfoIcon, PauseIcon, WarningIcon } from "./icons";

const TONES = {
  info: { cls: "bg-surface text-ink-2", Icon: InfoIcon, role: "status" as const },
  pending: { cls: "bg-held-tint text-held-ink", Icon: PauseIcon, role: "status" as const },
  error: { cls: "bg-blocked-tint text-blocked-ink", Icon: WarningIcon, role: "alert" as const },
};

export function Notice({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const { cls, Icon, role } = TONES[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-control px-4 py-3.5 text-[17px] leading-snug ${cls}`}>
      <Icon aria-hidden="true" size={22} weight="bold" className="mt-0.5 flex-none" />
      <span>{children}</span>
    </div>
  );
}
```

`src/ui/Screen.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";

/** One decision per screen: a narrow column on every device, with actions pinned to the bottom. */
export function Screen({ title, backHref, chip, children, footer }: { title?: string; backHref?: string; chip?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-4">
      {(backHref || title || chip) && (
        <div className="flex min-h-[48px] items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link href={backHref} aria-label="Back" className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-xl text-ink">
                <ArrowLeftIcon aria-hidden="true" size={24} />
              </Link>
            )}
            {title && <span className="truncate text-[18px] font-bold">{title}</span>}
          </div>
          {chip}
        </div>
      )}
      <div className="flex flex-1 flex-col">{children}</div>
      {footer && <div className="mt-8 flex flex-col gap-2.5">{footer}</div>}
    </main>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="mt-5 text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]">{children}</h1>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[18px] leading-relaxed text-ink-2">{children}</p>;
}

export function FinePrint({ children }: { children: ReactNode }) {
  return <p className="text-center text-[16px] leading-snug text-ink-3">{children}</p>;
}
```

`src/ui/HoldRing.tsx`:

```tsx
import { formatUsd } from "@/alerts/alertCopy";
import { PauseIcon } from "./icons";

const R = 96;
const LENGTH = Math.round(2 * Math.PI * R);

export function HoldRing({ fractionUsed, amountCents, label }: { fractionUsed: number; amountCents: number; label: string }) {
  const offset = Math.round(LENGTH * (1 - Math.min(1, Math.max(0, fractionUsed))));
  return (
    <div className="relative mx-auto h-[228px] w-[228px]">
      <svg role="img" aria-label={label} width="228" height="228" viewBox="0 0 228 228" className="-rotate-90">
        <circle cx="114" cy="114" r={R} fill="none" stroke="var(--color-held-track)" strokeWidth="12" />
        <circle
          className="tc-ring-fill"
          cx="114"
          cy="114"
          r={R}
          fill="none"
          stroke="var(--color-held)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={offset}
          style={{ ["--tc-ring-length" as string]: LENGTH }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <PauseIcon aria-hidden="true" size={26} weight="fill" className="text-held" />
        <span className="text-[44px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{formatUsd(amountCents)}</span>
        <span className="text-[17px] font-bold text-held">On hold</span>
      </div>
    </div>
  );
}
```

`src/ui/Skeleton.tsx`:

```tsx
/** Grey blocks in the shape of the final layout, with no animation. */
export function Skeleton({ blocks }: { blocks: number[] }) {
  return (
    <div aria-hidden="true" className="mt-6 grid gap-4">
      {blocks.map((h, i) => (
        <div key={i} className="tc-skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}
```

`src/ui/SignedOut.tsx`:

```tsx
import { ButtonLink } from "./Button";
import { SIGNED_OUT } from "./fetchJson";
import { Notice } from "./Notice";

export function SignedOut() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Notice tone="info">{SIGNED_OUT}</Notice>
      <ButtonLink href="/" variant="secondary">
        Choose a demo account
      </ButtonLink>
    </div>
  );
}
```

Delete `src/app/Skeleton.tsx` and `src/app/SessionNotice.tsx`. Update every import to `@/ui/Skeleton`, and replace `SessionNotice` and `SIGN_IN_AGAIN` with `SignedOut` and `SIGNED_OUT`. `graft grep "SessionNotice"` and `graft grep "Skeleton"` list the users. Pages rebuilt in later tasks may keep their old markup until then, but they must compile.

- [ ] **Step 6: Run the checks and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.
Run: `npx playwright test e2e/dashboard.spec.ts` — Expected: 4 passed. The dashboard still renders with the new font and base styles.

```bash
git add DESIGN.md docs/design src/ui src/app package.json package-lock.json
git commit -m "feat: add the design tokens, Atkinson Hyperlegible Next and the shared UI kit"
```

---

### Task 3: Demo personas, expiring sessions and the landing page

**Files:**
- Modify: `src/server/session.ts`, `src/server/session.test.ts`, `src/server/http.ts` (`currentUserId` passes the current time), `src/circle/circleRepo.ts`, `src/circle/drizzleCircleRepo.ts`, `src/circle/*.test.ts`
- Create: `src/server/demo.ts`, `src/server/demo.test.ts`, `src/app/api/demo/logout/route.ts`, `src/app/api/me/route.ts`, `scripts/demo-reset.ts`
- Modify: `src/app/api/demo/login/route.ts`, `src/app/page.tsx` (the landing page), `src/app/demo/page.tsx` (redirect to `/`), `package.json` (script `demo:reset`)
- Modify: `src/server/container.ts` (expose `circle`)

**Interfaces:**
- Produces:
  - `signSession(userId: string, secret: string, now?: Date, ttlMs?: number): string`. The token is `userId.expiresAtMs.mac`. The default time-to-live is `SESSION_TTL_MS = 12 * 3_600_000`.
  - `verifySession(token: string | undefined, secret: string, now?: Date): string | null`. It returns null when the token is expired, malformed, tampered with, or in the old two-part form.
  - `src/server/demo.ts`: `DEMO_PERSONAS = { margaret, sarah, daniel, robert }` mapped to their seeded emails, `type Persona`, `isPersona(x)`, and `homeFor(persona)` (`/home` for margaret and robert, `/circle` for sarah and daniel).
  - `CircleRepo` gains `getUserByEmail(email: string): Promise<UserRecord | null>` and `sendersOf(contactId: string): Promise<{ senderId: string; displayName: string; relationship: string }[]>`.
  - `POST /api/demo/login` with body `{ as: Persona }` returns 200 `{ home: string }` and sets the cookie with `Max-Age` equal to the time-to-live. An unknown persona gets 400. A persona whose account is missing gets 404 "The demo accounts aren't set up yet."
  - `POST /api/demo/logout` returns 204 and clears the cookie.
  - `GET /api/me` returns `{ id, displayName, persona: Persona | null, circle: { displayName, relationship }[], lookingAfter: { displayName, relationship }[], safeWordSet: boolean }`.
  - `npm run demo:reset` empties payments, checks, verifications, alerts, reports and registry rows. It keeps users, trust links and scam patterns, clears the demo users' safe words, then reruns the history seed.
  - `/` is the landing page with "Try as Margaret" and "Try as Sarah, her daughter", plus a small "Other demo accounts" disclosure for Daniel and Robert. `/demo` redirects to `/`.

- [ ] **Step 1: Write the failing tests**

Replace `src/server/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, signSession, verifySession } from "./session";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-11-01T10:00:00Z");

describe("session", () => {
  it("round-trips a user id before it expires", () => {
    const t = signSession("u1", SECRET, NOW);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + SESSION_TTL_MS - 1000))).toBe("u1");
  });
  it("rejects an expired token", () => {
    const t = signSession("u1", SECRET, NOW, 60_000);
    expect(verifySession(t, SECRET, new Date(NOW.getTime() + 60_001))).toBeNull();
  });
  it("rejects tampering with the user or the expiry", () => {
    const t = signSession("u1", SECRET, NOW);
    expect(verifySession(t.replace("u1", "u2"), SECRET, NOW)).toBeNull();
    const [id, , mac] = t.split(".");
    expect(verifySession(`${id}.${NOW.getTime() + 10 * SESSION_TTL_MS}.${mac}`, SECRET, NOW)).toBeNull();
  });
  it("rejects another secret, old two-part tokens and garbage", () => {
    expect(verifySession(signSession("u1", "x".repeat(32), NOW), SECRET, NOW)).toBeNull();
    expect(verifySession("u1.abc", SECRET, NOW)).toBeNull();
    expect(verifySession(undefined, SECRET, NOW)).toBeNull();
    expect(verifySession("garbage", SECRET, NOW)).toBeNull();
  });
});
```

`src/server/demo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS, homeFor, isPersona } from "./demo";

describe("demo personas", () => {
  it("knows the four seeded accounts", () => {
    expect(Object.keys(DEMO_PERSONAS)).toEqual(["margaret", "sarah", "daniel", "robert"]);
    expect(DEMO_PERSONAS.margaret).toBe("margaret.demo@trustcircle.example");
  });
  it("accepts only persona names", () => {
    expect(isPersona("sarah")).toBe(true);
    expect(isPersona("00000000-0000-4000-8000-000000000001")).toBe(false);
    expect(isPersona(undefined)).toBe(false);
  });
  it("sends senders home and contacts to their circle", () => {
    expect(homeFor("margaret")).toBe("/home");
    expect(homeFor("robert")).toBe("/home");
    expect(homeFor("sarah")).toBe("/circle");
    expect(homeFor("daniel")).toBe("/circle");
  });
});
```

Add to `src/circle/circleRepo.test.ts` (memory) and `src/circle/drizzleCircleRepo.int.test.ts` (Postgres), using each file's existing fixtures. Assert that:
- `getUserByEmail` finds Margaret, returns null for an unknown email, and is case-insensitive;
- `sendersOf(SARAH)` returns `[{ senderId: MARGARET, displayName: "Margaret", relationship: "daughter" }]`;
- `sendersOf` for someone with no senders returns `[]`.

Run: `npm test -- src/server src/circle && npm run test:int` — Expected: FAIL.

- [ ] **Step 2: Implement sessions, personas and the repo methods**

`src/server/session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 12 * 3_600_000;

function mac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSession(userId: string, secret: string, now: Date = new Date(), ttlMs: number = SESSION_TTL_MS): string {
  const payload = `${userId}.${now.getTime() + ttlMs}`;
  return `${payload}.${mac(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now: Date = new Date()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, given] = parts as [string, string, string];
  if (!userId || !/^\d+$/.test(expires)) return null;
  const expected = Buffer.from(mac(`${userId}.${expires}`, secret));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return Number(expires) > now.getTime() ? userId : null;
}
```

Seeded user ids are UUIDs and contain no `.`, so the three-part split is unambiguous.

`src/server/demo.ts`:

```ts
// The seeded demo accounts. Logging in picks one by name; ids never reach the browser.
export const DEMO_PERSONAS = {
  margaret: "margaret.demo@trustcircle.example",
  sarah: "sarah.demo@trustcircle.example",
  daniel: "daniel.demo@trustcircle.example",
  robert: "robert.demo@trustcircle.example",
} as const;

export type Persona = keyof typeof DEMO_PERSONAS;

export function isPersona(x: unknown): x is Persona {
  return typeof x === "string" && Object.hasOwn(DEMO_PERSONAS, x);
}

export function homeFor(p: Persona): string {
  return p === "margaret" || p === "robert" ? "/home" : "/circle";
}

export function personaForEmail(email: string): Persona | null {
  const hit = (Object.entries(DEMO_PERSONAS) as [Persona, string][]).find(([, e]) => e === email.toLowerCase());
  return hit ? hit[0] : null;
}
```

`src/circle/circleRepo.ts`: add the two methods to the interface and the memory repo.
- `getUserByEmail`: a case-insensitive find over `users`.
- `sendersOf`: `links.filter((l) => l.contactId === contactId)`, mapped to the sender's `displayName` and the link's `relationship`.

`src/circle/drizzleCircleRepo.ts`:
- `getUserByEmail`: select where `lower(users.email) = lower(email)`, using `sql` or `eq(sql\`lower(${users.email})\`, email.toLowerCase())`.
- `sendersOf(contactId)`: `isUuid` guard, then `trustLinks` inner-joined to `users` on `users.id = trustLinks.senderId` where `trustLinks.contactId = contactId`, selecting `senderId`, `displayName` and `relationship`.

`src/server/container.ts`: add `circle` (the drizzle circle repo instance) to the `Container` type and the returned object.

- [ ] **Step 3: Routes**

`src/app/api/demo/login/route.ts`:

```ts
import { getContainer } from "@/server/container";
import { DEMO_PERSONAS, homeFor, isPersona } from "@/server/demo";
import { badBody, errorResponse, readJsonObject } from "@/server/http";
import { SESSION_TTL_MS, signSession } from "@/server/session";

// Demo mode: pick one of the seeded accounts by name. There is no other way to sign in.
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  if (!body || !isPersona(body.as)) return badBody();
  try {
    const user = await getContainer().circle.getUserByEmail(DEMO_PERSONAS[body.as]);
    if (!user) return Response.json({ error: "The demo accounts aren't set up yet." }, { status: 404 });
    const token = signSession(user.id, getContainer().env.SESSION_SECRET);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return Response.json(
      { home: homeFor(body.as) },
      {
        headers: {
          "Set-Cookie": `tc_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/api/demo/logout/route.ts`:

```ts
export async function POST() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": "tc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" } });
}
```

`src/app/api/me/route.ts`:

```ts
import { getContainer } from "@/server/container";
import { personaForEmail } from "@/server/demo";
import { currentUserId, errorResponse } from "@/server/http";

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { circle } = getContainer();
    const me = await circle.getUser(userId);
    if (!me) return Response.json({ error: "Please sign in." }, { status: 401 });
    const [contacts, senders] = await Promise.all([circle.contactsOf(userId), circle.sendersOf(userId)]);
    return Response.json({
      id: me.id,
      displayName: me.displayName,
      persona: personaForEmail(me.email),
      circle: contacts.map((c) => ({ displayName: c.displayName, relationship: c.relationship })),
      lookingAfter: senders.map((s) => ({ displayName: s.displayName, relationship: s.relationship })),
      safeWordSet: me.safeWordHash !== null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/demo/page.tsx` becomes a server redirect:

```tsx
import { redirect } from "next/navigation";

export default function DemoPage() {
  redirect("/");
}
```

- [ ] **Step 4: The demo reset script**

`scripts/demo-reset.ts` (relative imports):

```ts
import { execSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { DEMO_PERSONAS } from "../src/server/demo";

// Puts the demo back to a clean story: users, circles and known scam patterns stay; everything that happened goes.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    await db.execute(
      sql`TRUNCATE scam_reports, registry_reports, registry_entries, alerts, verifications, message_checks, audit_log, payments CASCADE`,
    );
    await db.execute(sql`UPDATE users SET safe_word_hash = NULL WHERE email = ANY(${Object.values(DEMO_PERSONAS)})`);
  } finally {
    await close();
  }
  execSync("npm run seed:history", { stdio: "inherit" });
  console.log("Demo reset: clean history, patterns kept");
}

main().catch((e) => {
  console.error("demo:reset failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
```

`package.json` scripts: add `"demo:reset": "tsx --env-file=.env.local scripts/demo-reset.ts"`.

If postgres-js does not bind a JS array to `ANY(...)` here, use `IN (${a}, ${b}, ${c}, ${d})` with the four emails.

- [ ] **Step 5: The landing page, built to `docs/design/concepts/Landing.dc.html`**

`src/app/page.tsx` (a server component) renders the static landing page, built to the concept:
- header;
- hero: left text, right phone card with `HoldRing` at `fractionUsed` 0.125 and 80000 cents, label "Payment on hold, 3 of 24 hours used";
- "How a payment is protected", four steps;
- the statistic band;
- footer.

The two "Try as" buttons are a client component, `src/app/DemoButtons.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { Notice } from "@/ui/Notice";
import { useOnce } from "@/ui/useOnce";

type Persona = "margaret" | "sarah" | "daniel" | "robert";

export function DemoButtons() {
  const { busy, run } = useOnce();
  const [error, setError] = useState<string | null>(null);
  const go = (as: Persona) =>
    run(async () => {
      setError(null);
      const r = await fetchJson<{ home: string }>("/api/demo/login", jsonBody({ as }));
      if (r.ok) window.location.assign(r.data.home);
      else setError(r.error);
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button className="w-auto px-7" disabled={busy} onClick={() => go("margaret")} data-testid="try-margaret">
          Try as Margaret
        </Button>
        <Button variant="secondary" className="w-auto px-7" disabled={busy} onClick={() => go("sarah")} data-testid="try-sarah">
          Try as Sarah, her daughter
        </Button>
      </div>
      <details className="text-[16px] text-ink-2">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold">Other demo accounts</summary>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="quiet" className="w-auto" disabled={busy} onClick={() => go("daniel")} data-testid="try-daniel">
            Daniel, her grandson
          </Button>
          <Button variant="quiet" className="w-auto" disabled={busy} onClick={() => go("robert")} data-testid="try-robert">
            Robert, another PayPal user
          </Button>
        </div>
      </details>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
```

In `page.tsx`, use the concept's copy word for word. For the statistic band, show the sentence "Older adults lose billions of dollars to scams every year." with no figure. Plan 4B swaps in the verified figure and its source. Use the Tailwind tokens. The hero uses `grid gap-14 md:grid-cols-2` with text on the left.

- [ ] **Step 6: Checks, screenshots and commit**

Run: `npm test && npm run test:int && npm run typecheck && npm run lint` — Expected: PASS.
Run: `npm run demo:reset` — Expected: "Demo reset: clean history, patterns kept".
`e2e/protected-transfer.spec.ts` still uses the old `/demo` page and is rewritten in Task 10; don't run it until then. Update `e2e/dashboard.spec.ts`'s `beforeEach` to log in with `{ data: { as: "sarah" } }`. Then run `npx playwright test e2e/dashboard.spec.ts` — Expected: PASS.

Take screenshots of `/` at 390 × 844 and 1280 × 800 into the scratchpad. View them against `docs/design/concepts/Landing.dc.html` and note any differences in the report.

```bash
git add src/server src/circle src/app scripts/demo-reset.ts package.json e2e/dashboard.spec.ts
git commit -m "feat: sign in to demo personas with expiring sessions, and add the landing page"
```

---
### Task 4: Margaret's home

**Files:**
- Create: `src/app/home/page.tsx`, `src/app/home/activity.ts`, `src/app/home/activity.test.ts`, `src/app/SignOutButton.tsx`

**Interfaces:**
- Consumes: `GET /api/me`, `GET /api/payments` (sender views), `GET /api/messages` (message-check views, where `level` is null when unchecked); the UI kit (Task 2).
- Produces:
  - `src/app/home/activity.ts`:
    ```ts
    export type ChipView = { tone: ChipTone; label: string };
    export function paymentChip(state: string): ChipView;
    export function checkChip(c: { checked: boolean; level: "low" | "medium" | "high" | null }): ChipView;
    export interface ActivityItem { key: string; href: string; title: string; when: string /* ISO */; chip: ChipView }
    export function recentActivity(payments: PaymentLike[], checks: CheckLike[], limit: number): ActivityItem[]; // newest first
    ```
  - `SignOutButton`: posts to `/api/demo/logout`, then goes to `/`.

Chip rules:

| Input | Chip |
|---|---|
| Payment `paid_out` | safe "Sent" |
| Payment `held` | held "On hold" |
| Payment `blocked`, `voided` or `expired` | neutral "Not sent" |
| Payment `refunded` or `payout_failed` | caution "Refunded" |
| Payment, any other state | neutral "In progress" |
| Check with `checked:false` or `level:null` | neutral "Not checked" |
| Check `high` | blocked "Likely a scam" |
| Check `medium` | caution "Warning signs" |
| Check `low` | safe "No warning signs" |

Activity titles:
- payments: "$320 to vet.clinic@example.com", linking to `/payments/{id}`;
- checks: "Message checked", or "Screenshot checked" for an image, linking to `/check?id={id}`.

- [ ] **Step 1: Write the failing test**

`src/app/home/activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkChip, paymentChip, recentActivity } from "./activity";

describe("chips", () => {
  it.each([
    ["paid_out", "safe", "Sent"],
    ["held", "held", "On hold"],
    ["voided", "neutral", "Not sent"],
    ["blocked", "neutral", "Not sent"],
    ["expired", "neutral", "Not sent"],
    ["refunded", "caution", "Refunded"],
    ["captured", "neutral", "In progress"],
  ])("payment %s → %s %s", (state, tone, label) => expect(paymentChip(state)).toEqual({ tone, label }));

  it("never shows an unchecked message as safe", () => {
    expect(checkChip({ checked: false, level: "low" })).toEqual({ tone: "neutral", label: "Not checked" });
    expect(checkChip({ checked: true, level: null })).toEqual({ tone: "neutral", label: "Not checked" });
    expect(checkChip({ checked: true, level: "high" })).toEqual({ tone: "blocked", label: "Likely a scam" });
    expect(checkChip({ checked: true, level: "low" })).toEqual({ tone: "safe", label: "No warning signs" });
  });
});

describe("recentActivity", () => {
  it("merges payments and checks newest first, up to the limit", () => {
    const items = recentActivity(
      [{ id: "p1", payee: "vet.clinic@example.com", amountCents: 32000, state: "paid_out", createdAt: "2026-10-14T10:00:00Z" }],
      [
        { id: "c1", source: "text", checked: true, level: "high", createdAt: "2026-10-16T10:00:00Z" },
        { id: "c2", source: "image", checked: true, level: "low", createdAt: "2026-10-10T10:00:00Z" },
      ],
      2,
    );
    expect(items.map((i) => [i.title, i.href])).toEqual([
      ["Message checked", "/check?id=c1"],
      ["$320 to vet.clinic@example.com", "/payments/p1"],
    ]);
  });
});
```

Run: `npm test -- src/app/home` — Expected: FAIL.

- [ ] **Step 2: Implement the helper**

`src/app/home/activity.ts`:

```ts
import { formatUsd } from "@/alerts/alertCopy";
import type { ChipTone } from "@/ui/Chip";

export type ChipView = { tone: ChipTone; label: string };
export type PaymentLike = { id: string; payee: string; amountCents: number; state: string; createdAt: string };
export type CheckLike = { id: string; source: "text" | "image"; checked: boolean; level: "low" | "medium" | "high" | null; createdAt: string };
export interface ActivityItem {
  key: string;
  href: string;
  title: string;
  when: string;
  chip: ChipView;
}

export function paymentChip(state: string): ChipView {
  if (state === "paid_out") return { tone: "safe", label: "Sent" };
  if (state === "held") return { tone: "held", label: "On hold" };
  if (state === "blocked" || state === "voided" || state === "expired") return { tone: "neutral", label: "Not sent" };
  if (state === "refunded" || state === "payout_failed") return { tone: "caution", label: "Refunded" };
  return { tone: "neutral", label: "In progress" };
}

export function checkChip(c: { checked: boolean; level: "low" | "medium" | "high" | null }): ChipView {
  if (!c.checked || c.level === null) return { tone: "neutral", label: "Not checked" };
  if (c.level === "high") return { tone: "blocked", label: "Likely a scam" };
  if (c.level === "medium") return { tone: "caution", label: "Warning signs" };
  return { tone: "safe", label: "No warning signs" };
}

export function recentActivity(payments: PaymentLike[], checks: CheckLike[], limit: number): ActivityItem[] {
  const items: ActivityItem[] = [
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      href: `/payments/${p.id}`,
      title: `${formatUsd(p.amountCents)} to ${p.payee}`,
      when: p.createdAt,
      chip: paymentChip(p.state),
    })),
    ...checks.map((c) => ({
      key: `c-${c.id}`,
      href: `/check?id=${c.id}`,
      title: c.source === "image" ? "Screenshot checked" : "Message checked",
      when: c.createdAt,
      chip: checkChip(c),
    })),
  ];
  return items.sort((a, b) => b.when.localeCompare(a.when)).slice(0, limit);
}
```

- [ ] **Step 3: The screen, built to `docs/design/concepts/Home.dc.html`**

`src/app/SignOutButton.tsx`:

```tsx
"use client";
import { Button } from "@/ui/Button";

export function SignOutButton() {
  return (
    <Button
      variant="quiet"
      className="w-auto"
      onClick={async () => {
        await fetch("/api/demo/logout", { method: "POST" }).catch(() => undefined);
        window.location.assign("/");
      }}
    >
      Sign out
    </Button>
  );
}
```

`src/app/home/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { fetchJson } from "@/ui/fetchJson";
import { ArrowRightIcon, ChatCircleTextIcon, LockSimpleIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { SignOutButton } from "../SignOutButton";
import { recentActivity, type ActivityItem, type CheckLike, type PaymentLike } from "./activity";

type Me = { displayName: string; circle: { displayName: string; relationship: string }[]; safeWordSet: boolean };
type State = { kind: "loading" } | { kind: "signedOut" } | { kind: "error"; message: string } | { kind: "ready"; me: Me; items: ActivityItem[] };

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [me, payments, checks] = await Promise.all([
        fetchJson<Me>("/api/me"),
        fetchJson<PaymentLike[]>("/api/payments"),
        fetchJson<CheckLike[]>("/api/messages"),
      ]);
      if (cancelled) return;
      if ([me, payments, checks].some((r) => !r.ok && r.signedOut)) return setState({ kind: "signedOut" });
      if (!me.ok || !payments.ok || !checks.ok) {
        return setState({ kind: "error", message: "We couldn't load your home screen. Please refresh." });
      }
      setState({ kind: "ready", me: me.data, items: recentActivity(payments.data, checks.data, 5) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-6">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-bold text-evergreen">Trust Circle</span>
        <SignOutButton />
      </div>
      {state.kind === "loading" && (
        <>
          <p role="status" className="sr-only">
            Loading your home screen…
          </p>
          <Skeleton blocks={[40, 96, 96, 140]} />
        </>
      )}
      {state.kind === "signedOut" && <SignedOut />}
      {state.kind === "error" && (
        <div className="mt-6">
          <Notice tone="error">{state.message}</Notice>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <h1 className="mt-5 text-[32px] font-extrabold leading-tight tracking-[-0.01em]">Hello, {state.me.displayName}</h1>
          <div className="mt-3 flex items-center gap-2.5">
            {state.me.circle.length > 0 ? (
              <>
                <div className="flex" aria-hidden="true">
                  {state.me.circle.slice(0, 3).map((c, i) => (
                    <span
                      key={c.displayName}
                      className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-ground text-[14px] font-extrabold ${i === 0 ? "bg-evergreen-tint text-evergreen" : "-ml-2 bg-held-tint text-held"}`}
                    >
                      {initials(c.displayName)}
                    </span>
                  ))}
                </div>
                <span className="text-[17px] text-ink-2">
                  {state.me.circle.map((c) => c.displayName).join(" and ")} {state.me.circle.length === 1 ? "is" : "are"} in your circle
                </span>
              </>
            ) : (
              <span className="text-[17px] text-ink-2">No one is in your circle yet.</span>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            <Link href="/check" className="flex items-start gap-4 rounded-panel bg-evergreen p-5 text-white no-underline" data-testid="home-check">
              <ChatCircleTextIcon aria-hidden="true" size={28} className="mt-0.5 flex-none" />
              <span className="flex flex-col gap-1">
                <span className="text-[22px] font-extrabold">Check a message</span>
                <span className="text-[17px] leading-snug opacity-95">Paste a text or add a screenshot. We&apos;ll tell you if it looks like a scam.</span>
              </span>
            </Link>
            <Link href="/send" className="flex items-start gap-4 rounded-panel border-2 border-ink bg-surface p-5 text-ink no-underline" data-testid="home-send">
              <ArrowRightIcon aria-hidden="true" size={28} className="mt-0.5 flex-none" />
              <span className="flex flex-col gap-1">
                <span className="text-[22px] font-extrabold">Send money</span>
                <span className="text-[17px] leading-snug text-ink-2">We look at every payment before it goes.</span>
              </span>
            </Link>
          </div>

          <h2 className="mt-8 text-[19px] font-bold" id="recent">
            Recent
          </h2>
          {state.items.length === 0 ? (
            <p className="mt-2 text-[17px] text-ink-2">Nothing yet. When you check a message or send money, it shows here.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {state.items.map((item) => (
                <li key={item.key} className="border-b border-line">
                  <Link href={item.href} className="flex min-h-[64px] items-center justify-between gap-3 py-3 text-ink no-underline">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[17px] font-bold">{item.title}</span>
                      <span className="text-[16px] text-ink-3">{day(item.when)}</span>
                    </span>
                    <Chip tone={item.chip.tone}>{item.chip.label}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-8">
            <div className="flex items-center gap-3 rounded-control bg-surface px-4 py-3.5 text-[16px] text-ink-2">
              <LockSimpleIcon aria-hidden="true" size={22} className="flex-none text-evergreen" />
              <span>{state.me.safeWordSet ? "Your family safe word is set." : "You haven't set a family safe word yet."}</span>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
```

`ButtonLink` is not needed here: the two big actions are links styled as cards, as in the concept. Remove the unused import if lint flags it.

- [ ] **Step 4: Checks, screenshots and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.
Run `npm run demo:reset`. Then use Playwright (a scratchpad script, or `npx playwright` with `page.request.post("/api/demo/login", { data: { as: "margaret" } })`) to screenshot `/home` at 390 × 844 and 1280 × 800. Compare it with `docs/design/concepts/Home.dc.html` and note any differences.

```bash
git add src/app/home src/app/SignOutButton.tsx
git commit -m "feat: add Margaret's home screen with recent activity"
```

---

### Task 5: Check a message

**Files:**
- Create: `src/app/check/page.tsx`, `src/app/check/CheckForm.tsx`, `src/app/check/CheckResult.tsx`, `src/app/check/resultCopy.ts`, `src/app/check/resultCopy.test.ts`
- Modify: `src/app/api/messages/route.ts` (support `?id=` to return one check)

**Interfaces:**
- Consumes:
  - `POST /api/messages/check`: JSON `{ text }` or multipart with `image`, returning the check view: `{ id, source, text, checked, level: "low" | "medium" | "high" | null, scamType, reasons, identifiers, impersonatedRequester, createdAt }`.
  - `POST /api/messages/:id/report`: `{ reportId, subject, body, mailtoUrl, alreadyReported }`.
  - `SCAM_TYPE_LABELS` (`@/domain/scamTypeLabels`).
- Produces:
  - `GET /api/messages?id=<id>` returns one check view for its owner, or 404 `{ error: "We couldn't find that check." }`. Without `id`, it keeps returning the list.
  - `src/app/check/resultCopy.ts`:
    ```ts
    export type ResultKind = "scam" | "warning" | "clear" | "not_checked";
    export function resultKind(v: { checked: boolean; level: "low" | "medium" | "high" | null }): ResultKind;
    export function resultCopy(v: CheckView): { kind: ResultKind; chipTone: ChipTone; chip: string; title: string; lead: string; canReport: boolean };
    ```

Copy by kind:

| Kind | Chip | Title | Lead | Report? |
|---|---|---|---|---|
| scam | blocked "Very likely a scam" | `Someone is pretending to be ${name}` when the requester is a person or an organisation, otherwise "This message is very likely a scam" | `${SCAM_TYPE_LABELS[scamType]}. Don't reply, click links or send money.` | yes |
| warning | caution "Warning signs" | "Be careful with this message" | "Some things in it are often seen in scams. Check with someone you trust before you reply or pay." | yes |
| clear | safe "No warning signs" | "We didn't find warning signs" | "If something still feels wrong, trust that feeling and ask someone in your circle." | no |
| not_checked | neutral "Not checked yet" | "We couldn't check this message right now" | "That isn't the same as safe. Please don't reply, click a link or pay until it has been checked." | no |

`name` is the requester's name as the AI gave it, with a leading "my " or "your " removed.

- [ ] **Step 1: Write the failing test**

`src/app/check/resultCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resultCopy, resultKind } from "./resultCopy";

const base = { checked: true, level: "high" as const, scamType: "impersonation_family" as const, reasons: ["Asks for gift cards."], impersonatedRequester: { kind: "person" as const, name: "grandson Daniel" } };

describe("resultKind", () => {
  it("never treats an unchecked result as clear", () => {
    expect(resultKind({ checked: false, level: "low" })).toBe("not_checked");
    expect(resultKind({ checked: true, level: null })).toBe("not_checked");
    expect(resultKind({ checked: true, level: "medium" })).toBe("warning");
    expect(resultKind({ checked: true, level: "low" })).toBe("clear");
  });
});

describe("resultCopy", () => {
  it("names who the scam pretends to be", () => {
    expect(resultCopy(base)).toMatchObject({
      kind: "scam", chipTone: "blocked", chip: "Very likely a scam",
      title: "Someone is pretending to be grandson Daniel",
      lead: "Family member in trouble. Don't reply, click links or send money.", canReport: true,
    });
    expect(resultCopy({ ...base, impersonatedRequester: { kind: "person", name: "your grandson" } }).title).toBe("Someone is pretending to be grandson");
    expect(resultCopy({ ...base, impersonatedRequester: null }).title).toBe("This message is very likely a scam");
  });
  it("tells the person an unchecked message is not safe", () => {
    const c = resultCopy({ ...base, checked: false, level: null });
    expect(c).toMatchObject({ kind: "not_checked", chipTone: "neutral", canReport: false });
    expect(c.lead).toContain("isn't the same as safe");
  });
});
```

Run: `npm test -- src/app/check` — Expected: FAIL.

- [ ] **Step 2: Implement the helper and the single-check route**

`src/app/check/resultCopy.ts`:

```ts
import { SCAM_TYPE_LABELS } from "@/domain/scamTypeLabels";
import type { Requester, ScamType } from "@/domain/types";
import type { ChipTone } from "@/ui/Chip";

export type ResultKind = "scam" | "warning" | "clear" | "not_checked";
export type CheckView = {
  checked: boolean;
  level: "low" | "medium" | "high" | null;
  scamType: ScamType;
  reasons: string[];
  impersonatedRequester: Requester | null;
};

export function resultKind(v: { checked: boolean; level: "low" | "medium" | "high" | null }): ResultKind {
  if (!v.checked || v.level === null) return "not_checked";
  return v.level === "high" ? "scam" : v.level === "medium" ? "warning" : "clear";
}

const who = (r: Requester | null) => (r ? r.name.replace(/^(my|your)\s+/i, "").trim() : null);

export function resultCopy(v: CheckView) {
  const kind = resultKind(v);
  switch (kind) {
    case "scam": {
      const name = who(v.impersonatedRequester);
      return {
        kind, chipTone: "blocked" as ChipTone, chip: "Very likely a scam",
        title: name ? `Someone is pretending to be ${name}` : "This message is very likely a scam",
        lead: `${SCAM_TYPE_LABELS[v.scamType]}. Don't reply, click links or send money.`, canReport: true,
      };
    }
    case "warning":
      return {
        kind, chipTone: "caution" as ChipTone, chip: "Warning signs", title: "Be careful with this message",
        lead: "Some things in it are often seen in scams. Check with someone you trust before you reply or pay.", canReport: true,
      };
    case "clear":
      return {
        kind, chipTone: "safe" as ChipTone, chip: "No warning signs", title: "We didn't find warning signs",
        lead: "If something still feels wrong, trust that feeling and ask someone in your circle.", canReport: false,
      };
    default:
      return {
        kind, chipTone: "neutral" as ChipTone, chip: "Not checked yet", title: "We couldn't check this message right now",
        lead: "That isn't the same as safe. Please don't reply, click a link or pay until it has been checked.", canReport: false,
      };
  }
}
```

In `src/app/api/messages/route.ts` `GET`:

```ts
    const id = new URL(req.url).searchParams.get("id");
    const history = await getContainer().messages.history(userId);
    if (id) {
      const one = history.find((c) => c.id === id);
      return one ? Response.json(toMessageCheckView(one)) : Response.json({ error: "We couldn't find that check." }, { status: 404 });
    }
    return Response.json(history.map((c) => toMessageCheckView(c)));
```

- [ ] **Step 3: The screens, built to `MessageCheck.dc.html`, `Checking.dc.html` and `NotChecked.dc.html`**

`src/app/check/page.tsx` is a client component that holds the screen state:

```ts
type Phase =
  | { kind: "input"; error?: string }
  | { kind: "checking"; preview: string | null }
  | { kind: "result"; check: CheckResponse; preview: string | null }
  | { kind: "signedOut" };
```

- **Input:** if the URL has `?id=`, it loads that check with `fetchJson<CheckResponse>("/api/messages?id=…")` and shows the result straight away (opened from home). The result keeps the user's last submission (text, or `File` plus an object URL), so "Try again" resends it.
- **Submit:** for text, `fetchJson(url, jsonBody({ text }))`. For an image, a `FormData` holding `image`, posted as `{ method: "POST", body: form }`.
  - A 400 or 413 returns to the input with the error shown in the field.
  - A 401 goes to signed out, keeping the typed text in state.
  - Any other failure returns to the input with the network copy.

`src/app/check/CheckForm.tsx` (input phase):
- `Screen title="Check a message" backHref="/home"`.
- `Title`: "Paste the message, or add a screenshot".
- A `Field` with id "message" and label "The message", holding a `<textarea>` (rows 6, `INPUT` styles plus `py-3.5`), hint "You can paste a text, an email or part of an invoice."
- A screenshot picker:
  - `<label>` "Or add a screenshot" wrapping a visually styled 56 px secondary button and an `input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"`;
  - once chosen, a 92 px rounded preview with the file name and a "Remove" quiet button.
- Footer: primary "Check this message" (disabled until there is text or a file, and while busy via `useOnce`), plus `FinePrint` "Screenshots are read and then deleted. We keep only the words."

Checking phase (`Checking.dc.html`):
- a `<p role="status">` "Reading your message…";
- the 92 px preview tile (the screenshot, or grey lines for text);
- the lead "This takes a few seconds. We look for the tricks scammers use and check the contact details against reports from other families.";
- `Skeleton blocks={[30, 18, 18, 18, 18]}`.

`src/app/check/CheckResult.tsx` (result phase) uses `resultCopy`:
- `Screen title="Check a message" backHref="/home"`;
- the top row: the preview tile (if any) plus `Chip` and "Checked just now", or the check's time when opened from history;
- `Title` and `Lead` from the copy;
- for kinds scam and warning, with reasons: an h2 "What gave it away" and the reasons as a list (17 px, 12 px gap);
- when `identifiers` exist and the kind is scam or warning: an h2 "Contact details in the message" listing each identifier, with the label Phone number, Email address or Link;
- the footer:
  - **When `canReport`:** primary "Report this to PayPal", which runs once: `fetchJson<ReportResult>("/api/messages/{id}/report", { method: "POST" })`.
    - On success, show `Notice tone="info"`: "Thanks. These contact details are now on the shared scam list. Your email app will open with a report for PayPal." (or "You've already reported this message." when `alreadyReported`), then `window.location.href = mailtoUrl`.
    - On failure, show `Notice tone="error"` with the error copy.
    - Below it, `FinePrint`: "The report opens in your own email so you can read it before you send it."
  - **Kind not_checked:** primary "Try again", which resubmits the last input. Without one (opened from history), it returns to input.
  - **Always:** secondary `ButtonLink href="/home"` "Back to home".

Use `data-testid` on the result root (`check-result-{kind}`), the report button (`report`) and the submit button (`check-submit`).

- [ ] **Step 4: Checks, screenshots and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.
Screenshot these states at 390 × 844 and 1280 × 800, signed in as Margaret:
- input;
- checking: capture before the response, or simulate it by routing the request through Playwright `page.route` with a delay;
- scam result: check the text "Hi Grandma it's me, I lost my phone. I need $800 in gift cards today. Don't tell mom. Text +1 (415) 555-0199";
- not checked: route `/api/messages/check` to return `{ ...view, checked: false, level: null }`.

Compare them with the three concepts.

```bash
git add src/app/check src/app/api/messages/route.ts
git commit -m "feat: add the check-a-message screens with report to PayPal"
```

---

### Task 6: Send money

**Files:**
- Modify: `src/app/send/page.tsx`, `src/app/send/PayPalApprove.tsx` (styles only)
- Create: `src/app/send/riskScreen.ts`, `src/app/send/riskScreen.test.ts`, `src/app/send/amount.ts`, `src/app/send/amount.test.ts`

**Interfaces:**
- Consumes: `POST /api/payments` (`{ paymentId, orderId, risk: { level, scamType, reasons } }`), `POST /api/payments/:id/approved`, `GET /api/me`.
- Produces:
  - `parseAmountCents(input: string): number | null`. It accepts "800", "$1,200.50" and " 20 ". It returns null for "", "abc", "0", "-5", "12.345" and anything over 10,000 dollars.
  - `riskScreen(level, opts: { circleName: string | null }): { chipTone; chip; title; lead; continueLabel; holdNote: string | null }`.
  - `approvalErrorCopy(status: number, error: string): { message: string; canRetry: boolean }`:
    - a 202 is never an error: the caller navigates to the payment page;
    - a 409 gives `{ message: "This payment has already been dealt with.", canRetry: false }`;
    - anything else gives the server's message with `canRetry: true`.

`riskScreen` copy:

| Level | Chip | Title | Lead | Continue label |
|---|---|---|---|---|
| low | safe "No warning signs" | "This payment looks fine" | "Approve it in PayPal to send it." | "Continue to PayPal" |
| medium | caution "Paused for a check" | "Let's pause before this goes" | "Nothing has been sent. Here is what made us stop." | "I understand, continue to PayPal" |
| high | held "We'll hold this payment" | "Let's pause before this goes" | "Nothing has been sent. Here is what made us stop." | `Continue, and let ${circleName} review it`, or "Continue, and hold it for 24 hours" with no circle |

High-level hold note: `If you continue, PayPal holds the money. It isn't sent until ${circleName ?? "the waiting time is over and you release it"} ${circleName ? "approves it" : ""}.` Trim the double space when there is no circle.

- [ ] **Step 1: Write the failing tests**

`src/app/send/amount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAmountCents } from "./amount";

describe("parseAmountCents", () => {
  it.each([
    ["800", 80000],
    ["$1,200.50", 120050],
    [" 20 ", 2000],
    ["0.01", 1],
    ["10000", 1_000_000],
  ])("%s → %d", (input, cents) => expect(parseAmountCents(input)).toBe(cents));
  it.each(["", "abc", "0", "-5", "12.345", "10000.01", "1e3"])("rejects %s", (input) => expect(parseAmountCents(input)).toBeNull());
});
```

`src/app/send/riskScreen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { approvalErrorCopy, riskScreen } from "./riskScreen";

describe("riskScreen", () => {
  it("explains a hold in terms of the circle", () => {
    expect(riskScreen("high", { circleName: "Sarah" })).toMatchObject({
      chipTone: "held", title: "Let's pause before this goes", continueLabel: "Continue, and let Sarah review it",
      holdNote: "If you continue, PayPal holds the money. It isn't sent until Sarah approves it.",
    });
    expect(riskScreen("high", { circleName: null }).continueLabel).toBe("Continue, and hold it for 24 hours");
    expect(riskScreen("high", { circleName: null }).holdNote).toBe(
      "If you continue, PayPal holds the money. It isn't sent until the waiting time is over and you release it.",
    );
  });
  it("asks for a pause on medium and stays plain on low", () => {
    expect(riskScreen("medium", { circleName: "Sarah" })).toMatchObject({ chipTone: "caution", continueLabel: "I understand, continue to PayPal", holdNote: null });
    expect(riskScreen("low", { circleName: "Sarah" })).toMatchObject({ chipTone: "safe", title: "This payment looks fine", holdNote: null });
  });
});

describe("approvalErrorCopy", () => {
  it("does not offer a retry when the payment was already decided", () => {
    expect(approvalErrorCopy(409, "This payment has already been dealt with.")).toEqual({ message: "This payment has already been dealt with.", canRetry: false });
  });
  it("offers a retry otherwise, keeping the server's calm message", () => {
    expect(approvalErrorCopy(503, "PayPal didn't answer in time. Nothing has been sent. Please try again in a moment.")).toEqual({
      message: "PayPal didn't answer in time. Nothing has been sent. Please try again in a moment.", canRetry: true,
    });
  });
});
```

Run: `npm test -- src/app/send` — Expected: FAIL.

- [ ] **Step 2: Implement the helpers**

`src/app/send/amount.ts`:

```ts
const MAX_CENTS = 1_000_000;

export function parseAmountCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents >= 1 && cents <= MAX_CENTS ? cents : null;
}
```

`src/app/send/riskScreen.ts`:

```ts
import type { ChipTone } from "@/ui/Chip";

export function riskScreen(level: "low" | "medium" | "high", opts: { circleName: string | null }) {
  if (level === "low") {
    return { chipTone: "safe" as ChipTone, chip: "No warning signs", title: "This payment looks fine", lead: "Approve it in PayPal to send it.", continueLabel: "Continue to PayPal", holdNote: null };
  }
  const paused = { title: "Let's pause before this goes", lead: "Nothing has been sent. Here is what made us stop." };
  if (level === "medium") {
    return { chipTone: "caution" as ChipTone, chip: "Paused for a check", ...paused, continueLabel: "I understand, continue to PayPal", holdNote: null };
  }
  const who = opts.circleName;
  return {
    chipTone: "held" as ChipTone,
    chip: "We'll hold this payment",
    ...paused,
    continueLabel: who ? `Continue, and let ${who} review it` : "Continue, and hold it for 24 hours",
    holdNote: who
      ? `If you continue, PayPal holds the money. It isn't sent until ${who} approves it.`
      : "If you continue, PayPal holds the money. It isn't sent until the waiting time is over and you release it.",
  };
}

export function approvalErrorCopy(status: number, error: string): { message: string; canRetry: boolean } {
  if (status === 409) return { message: "This payment has already been dealt with.", canRetry: false };
  return { message: error, canRetry: true };
}
```

- [ ] **Step 3: The screens, built to `Send.dc.html` and `Main.dc.html`**

Rewrite `src/app/send/page.tsx` as a client component with phases `form | checking | risk | approving | error | signedOut`. It keeps everything Plan 1 got right:
- the `approvedFor` ref guard;
- one approval per payment;
- the PayPal flow through `PayPalApprove`.

- **Form (`Send.dc.html`):** `Screen title="Send money" backHref="/home"`. Three `Field`s:
  - "Who are you paying?" (id `payee`, hint "Their email address or mobile number", `autoComplete="off"`);
  - "How much?" (id `amount`: a 64 px bordered box with a "$" prefix and a 30 px, weight-800 input, `inputMode="decimal"`, `aria-describedby` to the error);
  - "Who asked you to make this payment, and why?" (id `answer`, textarea rows 3, hint "Your answer helps us spot scams. Only you and your circle can see it.").

  Add an optional "Note" field below them (id `note`, label "Note (optional)"). The footer has primary "Check this payment" (`data-testid="check"`) and `FinePrint` "Nothing is sent until you approve it in PayPal."
  - Client validation: an empty payee gives the field error "Please enter their email address or mobile number."; `parseAmountCents` null gives "Please enter an amount between $0.01 and $10,000."
  - Server 400 errors with a `field` go on that field; other errors go in a `Notice tone="error"` above the footer.
  - The typed values stay in state through every error and the signed-out notice.
- **Checking:** `role="status"` "Checking this payment…" and a skeleton.
- **Risk (`Main.dc.html`):** `Screen title="Send money"` with `chip` (the caution or held chip at the top right is fine; the concept places it under the header).
  - `Title` and `Lead` from `riskScreen(level, { circleName })`, where `circleName` is the first `/api/me` circle member's display name, or null.
  - A `Card` with "To", the payee and the formatted amount (34 px, weight 800).
  - The reasons as a list, each with a `WarningIcon` (22 px, colour `text-caution-ink`), and the `holdNote` in a `Notice tone="pending"` when it is set.
  - Footer:
    - `PayPalApprove` restyled: wrap the `paypal-button` in a container with `min-h-[58px]`, and add a label above it, `<p className="text-[17px] font-bold">{continueLabel}</p>`;
    - for medium, the PayPal button is shown only after a first primary button "I understand, continue" (`data-testid="confirm-medium"`) is pressed, as in Plan 1;
    - quiet "Cancel this payment" linking to `/home`.

  Keep `data-testid="risk-{level}"` on the risk root and `data-testid="paypal-button"` on the PayPal element.
- **Approving:** once `onApproved` fires, show `role="status"` "Finishing your payment…" and call `/api/payments/{id}/approved` with `fetchJson`:
  - `ok` (200 or 202): `router.push("/payments/{id}")`;
  - not ok: show `approvalErrorCopy(status, error)` in a `Notice tone="error"`.
    - When `canRetry`, show primary "Try again", which calls `/approved` again without reopening PayPal (the order is already approved), plus quiet "Go to my payments" linking to `/home#recent`.
    - Reset `approvedFor` only when retrying.

`PayPalApprove.tsx`: keep the logic. Replace the bare `<div>` and `<p role="alert">` with the kit's styling (`Notice tone="error"`). Keep the `data-testid`.

- [ ] **Step 4: Checks, screenshots and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.
Screenshot these at 390 × 844 and 1280 × 800, signed in as Margaret:
- the form, filled with the concept's values;
- the high-risk risk screen: submit "dhill.urgent@outlook.example", $800, "My grandson Daniel called. He's in jail and needs bail today.". This creates one sandbox order, which is expected; don't open PayPal.

Compare them with `Send.dc.html` and `Main.dc.html`.

```bash
git add src/app/send
git commit -m "feat: add the designed send flow with a calm pause before risky payments"
```

---
### Task 7: Payment status, the challenge and the outcomes

**Files:**
- Modify: `src/payments/paymentService.ts` (`senderCancel`), `src/payments/paymentService.test.ts`
- Create: `src/server/paymentOutcome.ts`, `src/server/paymentOutcome.test.ts`, `src/app/api/payments/[id]/route.ts` (GET one), `src/app/api/payments/[id]/cancel/route.ts`
- Create: `src/app/payments/[id]/screen.ts`, `src/app/payments/[id]/screen.test.ts`, `src/app/payments/[id]/PaymentScreens.tsx`
- Modify: `src/app/payments/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/payments/:id/verification` (`VerificationStage`);
  - `POST /api/payments/:id/challenge`;
  - `POST /api/payments/:id/release`;
  - `GET /api/me`;
  - `holdProgress`, `timeLeftText`, `HoldRing` and the kit.
- Produces:
  - `paymentService.senderCancel(a: { paymentId: string; senderId: string }): Promise<PaymentRecord>`. Only the sender may cancel (`NotAllowedError("Only the sender can cancel this payment.")`). It works only while the payment is held (`ConcurrentUpdateError` otherwise). It blocks and voids, with the sender as actor.
  - `paymentOutcome(audits: { action: string; actorId: string | null }[], senderId: string): "circle" | "sender" | "expired" | null`. The last `BLOCK` gives `"sender"` when the actor is the sender, otherwise `"circle"`. An `EXPIRE` gives `"expired"`. Anything else gives null.
  - `GET /api/payments/:id` returns `{ ...toSenderView(p), outcome }` to the sender only. Anyone else gets 403 `Payment not found`; a bad id gets 403 through `NotAllowedError`.
  - `POST /api/payments/:id/cancel` returns the sender view. A 409 means it was already dealt with, and a 202 means it is pending.
  - `src/app/payments/[id]/screen.ts`:
    ```ts
    export type ScreenKind = "not_approved" | "pending" | "waiting" | "challenge_memory" | "challenge_safe_word" | "official_routes" | "held" | "sent" | "refunded" | "stopped_by_person" | "stopped_by_check" | "stopped_by_circle" | "cancelled" | "hold_ended";
    export function screenFor(p: { state: string; outcome: Outcome }, stage: VerificationStage | null): ScreenKind;
    export function screenCopy(kind: ScreenKind, d: { amount: string; payee: string; contactName: string | null }): { chipTone: ChipTone; chip: string; title: string; lead: string };
    ```

`screenFor` rules:

| Input | Screen |
|---|---|
| `created` | not_approved |
| `approved`, `authorised`, `released` or `captured` | pending |
| `paid_out` | sent |
| `refunded` or `payout_failed` | refunded |
| `held` + stage `waiting_for_person` | waiting |
| `held` + stage `challenge` | challenge_memory or challenge_safe_word, by method |
| `held` + stage `official_routes` | official_routes |
| `held` + stage `resolved` with outcome `failed` | stopped_by_check (the block is finishing) |
| `held` + any other stage, or no stage | held |
| `blocked`, `voided` or `expired` + stage `resolved` | stopped_by_person when the outcome is `denied`; stopped_by_check when it is `failed` |
| `blocked`, `voided` or `expired`, otherwise | from the payment outcome: `circle` → stopped_by_circle, `sender` → cancelled, `expired` or null → hold_ended |

`screenCopy` (the `amount` value is already formatted):

| Kind | Chip | Title | Lead |
|---|---|---|---|
| not_approved | neutral "Not approved yet" | "This payment hasn't been approved in PayPal" | "Nothing has been sent. You can start again from home." |
| pending | held "Finishing" | "We're finishing this payment" | "It's on its way through PayPal. Please don't send it again." |
| waiting | held "On hold" | `We've asked ${contactName ?? "the real person"} if it was really them` | "Someone pretending to be them can't answer from there." |
| challenge_memory | held "On hold" | `Ask the caller something only ${contactName ?? "they"} would know` | "Let's check another way while we wait." |
| challenge_safe_word | held "On hold" | "Ask the caller for your family's safe word" | "Don't say it first or give any hints. Type exactly what they say." |
| official_routes | held "On hold" | "Check with them yourself" | "Reach them through their official app or website, never through the message." |
| held | held "On hold" | "Your money hasn't left your account" | `${contactName ?? "Your circle"} is looking at this payment. Nothing is sent unless it's approved.` |
| sent | safe "Sent" | `${amount} sent to ${payee}` | "The payment went through PayPal." |
| refunded | caution "Refunded" | "This payment came back to you" | "It couldn't be delivered, so PayPal returned the money to your account." |
| stopped_by_person | safe "Stopped" | "Payment stopped. Your money is safe." | `${contactName ?? "The real person"} told us they didn't ask for this money. The ${amount} was never sent.` |
| stopped_by_check | safe "Stopped" | "Payment stopped. Your money is safe." | `The check didn't match, so we stopped it. The ${amount} was never sent.` |
| stopped_by_circle | safe "Stopped" | "Payment stopped. Your money is safe." | `Your circle stopped it before anything moved. The ${amount} was never sent.` |
| cancelled | neutral "Cancelled" | "You cancelled this payment" | `The ${amount} was never sent.` |
| hold_ended | neutral "Hold ended" | "The hold ended" | "Nobody decided within 3 days, so the payment was not sent. The money stayed in your account." |

- [ ] **Step 1: Write the failing tests**

Add to `src/payments/paymentService.test.ts`:

```ts
describe("senderCancel", () => {
  it("lets the sender stop a held payment, voiding it", async () => {
    const { service, gateway } = setup({ level: "high" });
    const { payment } = await service.start(send);
    await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    const done = await service.senderCancel({ paymentId: payment.id, senderId: SENDER });
    expect(done.state).toBe("voided");
    expect(gateway.voidAuthorization).toHaveBeenCalledTimes(1);
  });
  it("refuses anyone else and payments that are not held", async () => {
    const { service } = setup({ level: "high" });
    const { payment } = await service.start(send);
    await expect(service.senderCancel({ paymentId: payment.id, senderId: SENDER })).rejects.toBeInstanceOf(ConcurrentUpdateError);
    await service.completeApproval({ paymentId: payment.id, senderId: SENDER });
    await expect(service.senderCancel({ paymentId: payment.id, senderId: CONTACT })).rejects.toBeInstanceOf(NotAllowedError);
  });
});
```

`src/server/paymentOutcome.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paymentOutcome } from "./paymentOutcome";

const S = "sender";
describe("paymentOutcome", () => {
  it.each([
    [[{ action: "BLOCK", actorId: "sarah" }], "circle"],
    [[{ action: "BLOCK", actorId: S }], "sender"],
    [[{ action: "EXPIRE", actorId: null }], "expired"],
    [[{ action: "PAY_OUT", actorId: S }], null],
    [[], null],
  ] as const)("%j → %s", (audits, outcome) => expect(paymentOutcome([...audits], S)).toBe(outcome));
});
```

`src/app/payments/[id]/screen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { screenCopy, screenFor, type ScreenKind } from "./screen";

const held = { state: "held", outcome: null };
describe("screenFor", () => {
  it.each([
    [{ state: "created", outcome: null }, null, "not_approved"],
    [{ state: "captured", outcome: null }, null, "pending"],
    [{ state: "paid_out", outcome: null }, null, "sent"],
    [{ state: "refunded", outcome: null }, null, "refunded"],
    [held, { stage: "waiting_for_person", contactName: "Daniel", askedAt: "x", challengeOpensAt: "y" }, "waiting"],
    [held, { stage: "challenge", method: "memory_question", requesterName: "grandson", guidance: [] }, "challenge_memory"],
    [held, { stage: "challenge", method: "safe_word", requesterName: "grandson", guidance: [] }, "challenge_safe_word"],
    [held, { stage: "official_routes", organisation: "PayPal", steps: [] }, "official_routes"],
    [held, { stage: "resolved", outcome: "failed" }, "stopped_by_check"],
    [held, { stage: "challenge_passed" }, "held"],
    [held, null, "held"],
    [{ state: "voided", outcome: null }, { stage: "resolved", outcome: "denied" }, "stopped_by_person"],
    [{ state: "voided", outcome: "circle" }, { stage: "none" }, "stopped_by_circle"],
    [{ state: "voided", outcome: "sender" }, { stage: "none" }, "cancelled"],
    [{ state: "voided", outcome: "expired" }, { stage: "none" }, "hold_ended"],
  ] as const)("%j + %j → %s", (p, stage, kind) => expect(screenFor(p, stage as never)).toBe(kind));
});

describe("screenCopy", () => {
  const d = { amount: "$800", payee: "dhill@x.example", contactName: "Daniel" };
  const ALL: ScreenKind[] = [
    "not_approved", "pending", "waiting", "challenge_memory", "challenge_safe_word", "official_routes", "held", "sent", "refunded",
    "stopped_by_person", "stopped_by_check", "stopped_by_circle", "cancelled", "hold_ended",
  ];
  it("only says 'Nothing has been sent' when no money can have moved", () => {
    for (const k of ALL) {
      const text = `${screenCopy(k, d).title} ${screenCopy(k, d).lead}`;
      if (k === "not_approved") expect(text).toContain("Nothing has been sent");
      else expect(text).not.toContain("Nothing has been sent");
    }
  });
  it("names the real person when stopped by them", () => {
    expect(screenCopy("stopped_by_person", d)).toMatchObject({
      title: "Payment stopped. Your money is safe.",
      lead: "Daniel told us they didn't ask for this money. The $800 was never sent.",
    });
  });
});
```

Run: `npm test -- src/payments src/server src/app/payments` — Expected: FAIL.

- [ ] **Step 2: Implement the server side**

`paymentService.senderCancel`, next to `senderRelease`:

```ts
    async senderCancel(a: { paymentId: string; senderId: string }) {
      const p = await mustGet(a.paymentId);
      if (p.senderId !== a.senderId) throw new NotAllowedError("Only the sender can cancel this payment.");
      return blockHeld({ paymentId: p.id, actorId: a.senderId });
    },
```

`src/server/paymentOutcome.ts`:

```ts
export type Outcome = "circle" | "sender" | "expired" | null;

/** Why a payment stopped, from its audit trail; message text never enters the trail. */
export function paymentOutcome(audits: { action: string; actorId: string | null }[], senderId: string): Outcome {
  const last = [...audits].reverse().find((a) => a.action === "BLOCK" || a.action === "EXPIRE");
  if (!last) return null;
  if (last.action === "EXPIRE") return "expired";
  return last.actorId === senderId ? "sender" : "circle";
}
```

`src/app/api/payments/[id]/route.ts`:

```ts
import { NotAllowedError } from "@/payments/paymentService";
import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { paymentOutcome } from "@/server/paymentOutcome";
import { toSenderView } from "@/server/paymentView";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const { repo } = getContainer();
    const p = await repo.get(id);
    if (!p || p.senderId !== userId) throw new NotAllowedError("Payment not found");
    return Response.json({ ...toSenderView(p), outcome: paymentOutcome(await repo.auditFor(p.id), p.senderId) });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/api/payments/[id]/cancel/route.ts` follows the shape of the release route: `POST` → `toSenderView(await getContainer().service.senderCancel({ paymentId: id, senderId: userId }))`.

- [ ] **Step 3: Implement the screen helper**

`src/app/payments/[id]/screen.ts`: implement `screenFor` and `screenCopy` exactly as the tables above say, typed with:

```ts
import type { ChipTone } from "@/ui/Chip";
import type { Outcome } from "@/server/paymentOutcome";

export type Stage =
  | { stage: "none" }
  | { stage: "waiting_for_person"; contactName: string; askedAt: string; challengeOpensAt: string }
  | { stage: "official_routes"; organisation: string; steps: string[] }
  | { stage: "challenge"; method: "safe_word" | "memory_question"; requesterName: string; guidance: string[] }
  | { stage: "challenge_passed" }
  | { stage: "resolved"; outcome: "confirmed" | "denied" | "failed" };
```

`screenFor(p, stage)` takes `stage: Stage | null`. The types use the JSON shapes, with dates as strings. Importing a type from `@/server/paymentOutcome` is fine in a client file because it is type-only.

- [ ] **Step 4: The screens, built to the concepts**

`src/app/payments/[id]/page.tsx` is a client component that:
- loads `fetchJson("/api/payments/{id}")`, `fetchJson("/api/payments/{id}/verification")` and `fetchJson("/api/me")`;
- polls the first two every 5 seconds while the screen is `pending`, `waiting`, `held`, `challenge_*` or `official_routes`, and stops on unmount or when the tab is hidden (`document.visibilityState`);
- computes `screenFor`, then renders `PaymentScreens`.

`contactName` is the waiting stage's `contactName` when there is one, otherwise the first `/api/me` circle member.

States:
- loading: `role="status"` plus a skeleton;
- 403 or 404: `Screen backHref="/home"` with Title "We couldn't find this payment" and a "Back to home" link;
- signed out: `SignedOut`.

`src/app/payments/[id]/PaymentScreens.tsx` renders one component per kind:

- **held** (`OnHold.dc.html`):
  - `HoldRing` with `fractionUsed` from `holdProgress` and the label `Hold time used: ${hours used} of 24 hours`;
  - centred `Title` and `Lead` from `screenCopy`;
  - an ordered timeline (`<ol>` with dot markers, as in the concept):
    1. "Held in PayPal", with `authorisedAt` shown as a weekday and time;
    2. "{contactName ?? "Your circle"} has been asked: they can approve or stop it";
    3. "If no one decides by {authorisedAt plus 72 hours, as a weekday and time}: the hold ends and the money stays yours".
  - Footer:
    - when `msLeft` is 0, primary "Release the payment" (`data-testid="release"`), posting `/release` and handling 202 and 409 with the copy from `approvalErrorCopy`;
    - always secondary "Cancel this payment" (`data-testid="cancel"`), posting `/cancel`;
    - `FinePrint`: "You can cancel any time. Releasing it yourself opens {releaseAt as weekday and time}." until release opens.
- **waiting** (`Verify.dc.html`, using real data):
  - `Title` and `Lead`;
  - a `Card` with two initials avatars ("You" in evergreen tint, the contact's initials in held tint) joined by a dashed line, with the `tc-travel` envelope `ChatCircleTextIcon` moving between them, all `aria-hidden`;
  - the contact's name;
  - `role="status"`: "Asked at {askedAt time}. Waiting for {contactName} to reply.";
  - an h2 "While you wait", then "If they don't answer by {challengeOpensAt time}, we'll help you check another way.";
  - footer: secondary "Cancel this payment".
- **challenge_memory** (`MemoryQuestion.dc.html`):
  - the guidance strings as a numbered list;
  - h2 "What happened?";
  - footer: danger "They made an excuse" (`data-testid="excuse"`), posting `{ method: "memory_question", outcome: "excuse" }`, then secondary "They answered straight away" (`data-testid="answered"`), posting `{ method: "memory_question", outcome: "answered" }`;
  - FinePrint: "An excuse stops the payment. A good answer doesn't send it: {contactName ?? "your circle"} still decides."
- **challenge_safe_word** (`SafeWord.dc.html`):
  - a lock icon tile;
  - a `Field` with id "said" and label "What the caller said";
  - primary "Check the safe word" (disabled when empty);
  - a quiet danger-coloured "They couldn't tell me", which posts `{ method: "safe_word", said: "(no answer)" }`. That never matches a stored safe word, so it records a failed check, and the comment says so;
  - FinePrint: "If it doesn't match, we stop the payment. The money stays in your account."
- **official_routes** (`OfficialRoutes.dc.html`):
  - the title with the organisation's name, `Check with ${organisation} yourself`;
  - the steps: every step except the last as a numbered list, and the last as a caution `Notice`;
  - footer: secondary "Cancel this payment";
  - FinePrint: "Until then, the payment stays on hold. Nothing is sent."
- **sent, refunded, stopped_by_*, cancelled, hold_ended** (`Stopped.dc.html`):
  - an 88 px round icon (a `ShieldCheckIcon` on evergreen tint for safe outcomes, a `CheckCircleIcon` for sent, an `InfoIcon` on neutral tint otherwise) with `tc-settle`;
  - `Title` and `Lead`.
  - For stopped_by_person and stopped_by_check, a `Card` "What happens next" with check items:
    - "{contactName ?? "Your circle"} has been told." (stopped_by_person only)
    - "This account is on the shared scam list now, so other families are warned." (stopped_by_person only)
    - "The payment won't be sent." (stopped_by_check)
  - Footer: secondary "Back to home". For stopped kinds, add FinePrint "Checking first was the right thing to do."
- **pending:** `Notice tone="pending"` with the lead, and "Back to home".
- **not_approved:** "Back to home" and a quiet "Start again" linking to `/send`.

Every decisive button uses `useOnce` and disables while busy. A challenge or cancel response reloads the payment and stage straight away. A 409 shows `Notice tone="info"` "This payment has already been dealt with." and reloads.

Add a `data-testid="payment-screen-{kind}"` on each screen's root.

- [ ] **Step 5: Checks, screenshots and commit**

Run: `npm test && npm run test:int && npm run typecheck && npm run lint` — Expected: PASS.

Screenshots at 390 × 844 and 1280 × 800:
- held, waiting, challenge_memory and stopped_by_person, using Playwright `page.route` to return those shapes from the two GET routes (no PayPal needed);
- sent and hold_ended, from the seeded history payments (ids `00000000-0000-4000-a000-000000000001` and `…07`) signed in as Margaret.

Compare them with `OnHold`, `Verify`, `MemoryQuestion`, `SafeWord`, `OfficialRoutes` and `Stopped`.

```bash
git add src/payments src/server/paymentOutcome.ts src/server/paymentOutcome.test.ts src/app/api/payments src/app/payments
git commit -m "feat: add the payment status, challenge and outcome screens with sender cancel"
```

---

### Task 8: Sarah's circle and the review screen

**Files:**
- Create: `src/app/api/circle/payments/[id]/route.ts`, `src/app/api/circle/payments/[id]/route.test.ts`
- Modify: `src/app/circle/page.tsx` (rebuilt), `src/app/circle/dashboard/page.tsx` and `src/app/trends/page.tsx` (tokens and back link only)
- Create: `src/app/circle/payments/[id]/page.tsx`, `src/app/circle/reviewCopy.ts`, `src/app/circle/reviewCopy.test.ts`

**Interfaces:**
- Consumes:
  - `GET /api/me` (`lookingAfter`);
  - `GET /api/circle/held` (contact views);
  - `GET /api/alerts` (`AlertView[]`: `{ id, kind, title, body, path, createdAt, readAt }`);
  - `POST /api/alerts/:id/read`;
  - `POST /api/payments/:id/decision` (`{ decision }`);
  - `GET /api/payments/:id/verification` (the stage).
- Produces:
  - `GET /api/circle/payments/:id` returns `{ payment: toContactView(p), senderName: string }` only when the signed-in user is in the sender's circle. Otherwise it returns 403 `Payment not found`, and a bad id also gets 403.
  - `src/app/circle/reviewCopy.ts`: `decisionResultCopy(decision: "approve" | "block", status: number, senderName: string): { tone: "safe" | "pending" | "info"; title: string; lead: string }`.

`decisionResultCopy` rules:

| Decision and status | Tone | Title | Lead |
|---|---|---|---|
| block, 200 | safe | "You stopped the payment" | `${senderName}'s money is safe. We've told them, and this account is on the shared scam list now.` |
| approve, 200 | safe | "Payment approved" | `It's on its way to the person ${senderName} wanted to pay.` |
| either, 202 | pending | "We're finishing this for you" | "It's being completed through PayPal. Please don't decide again." |
| 409 | info | "This payment has already been dealt with" | "Someone else in the circle, or the real person, has already answered." |

- [ ] **Step 1: Write the failing tests**

`src/app/circle/reviewCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decisionResultCopy } from "./reviewCopy";

describe("decisionResultCopy", () => {
  it.each([
    ["block", 200, "safe", "You stopped the payment"],
    ["approve", 200, "safe", "Payment approved"],
    ["block", 202, "pending", "We're finishing this for you"],
    ["approve", 409, "info", "This payment has already been dealt with"],
  ] as const)("%s %d → %s", (decision, status, tone, title) => {
    expect(decisionResultCopy(decision, status, "Margaret")).toMatchObject({ tone, title });
  });
});
```

`src/app/api/circle/payments/[id]/route.test.ts`: mock `@/server/container` with `vi.mock`, returning a memory payment repo, a memory circle repo and the `env` secret. Build requests with a `tc_session` cookie from `signSession`. Assert that:
- Sarah (in Margaret's circle) gets 200 with `senderName: "Margaret"` and `senderAnswer`;
- Robert gets 403;
- a non-uuid id gets 403;
- no cookie gets 401.

Follow the existing route-test pattern in `src/app/api/messages/[id]/report/route.test.ts`.

Run: `npm test -- src/app/circle src/app/api/circle` — Expected: FAIL.

- [ ] **Step 2: Implement the route and the helper**

`src/app/api/circle/payments/[id]/route.ts`:

```ts
import { NotAllowedError } from "@/payments/paymentService";
import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { toContactView } from "@/server/paymentView";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const { repo, circle } = getContainer();
    const p = await repo.get(id);
    if (!p || !(await repo.isContactFor(userId, p.senderId))) throw new NotAllowedError("Payment not found");
    const sender = await circle.getUser(p.senderId);
    return Response.json({ payment: toContactView(p), senderName: sender?.displayName ?? "Someone in your circle" });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`src/app/circle/reviewCopy.ts`: implement `decisionResultCopy` from the table.

- [ ] **Step 3: The screens**

`src/app/circle/page.tsx` (`SarahAlerts.dc.html`) is a client component:
- Header "Trust Circle" with `SignOutButton`.
- `Title` "Your circle", and the lead `You look out for ${lookingAfter names joined with "and"}.` When `lookingAfter` is empty: "Nobody has added you to their circle yet."
- **"Needs you":**
  - each held payment as a `Card`: held chip `On hold, ${timeLeftText(...)}`, title `${senderName}'s payment of ${amount} is on hold`, the first reason as the lead, and primary `ButtonLink` "Review the payment" to `/circle/payments/{id}` (`data-testid="review"`);
  - then each unread `verify_request` alert as a `Card`: held chip "Waiting for you", title = the alert title, primary `ButtonLink` "Answer" to `alert.path` (`data-testid="answer-verification"`).

  The sender's name for a held payment comes from `GET /api/circle/payments/{id}` per card, or more cheaply from `lookingAfter`. Keep `GET /api/circle/held` and use the first `lookingAfter` name when there is exactly one sender; otherwise fetch per card.

  When nothing needs them: `Notice tone="info"` "Nothing needs you right now."
- **"Earlier":** the other alerts (newest 10) as rows: title, body in 16 px `text-ink-3`, and the date. Each row is a link to `alert.path` that marks the alert read on click (fire and forget).
- Footer: secondary `ButtonLink` "See all payments" to `/circle/dashboard`, and quiet "Scam trends" to `/trends`.
- Loading skeleton, signed-out and error states as in the earlier tasks.

`src/app/circle/payments/[id]/page.tsx` (`ContactReview.dc.html`):
- Load the payment and the stage.
- Header: `backHref="/circle"`, with the chip `On hold, ${timeLeftText}` when held.
- `Title`: `${senderName} wants to send ${amount} to someone new`.
- A `Card` with the payee (17 px, `overflow-wrap:anywhere`) and the amount. When `senderAnswer` is set, add a divider, "{senderName} told us", and the answer in quotes.
- h2 "Why it was held", then the reasons list.
- A verification `Notice tone="pending"` taken from the stage:
  - waiting_for_person: "We asked {contactName} at {time}. No reply yet."
  - challenge_passed: "{senderName} checked with the caller, and they answered. It's still your decision."
  - resolved failed: "The caller couldn't pass the check, so the payment is being stopped."
  - otherwise none.
- Footer:
  - danger "Stop this payment" (`data-testid="block"`);
  - secondary "Approve this payment" (`data-testid="approve"`);
  - each posts `/api/payments/{id}/decision` once via `useOnce`, then shows the `decisionResultCopy` result in place of the buttons (an icon tile, title and lead), plus "Back to your circle".

  Note the wording: "Stop this payment" replaces the concept's "Block this payment". Margaret's screens say "stopped", and the same verb is used throughout.
- When the payment isn't held, show the result copy for 409 with "Back to your circle".
- 403: "We couldn't find this payment" with the back link.

Dashboard and trends: replace inline font and colour styles with tokens (`text-ink`, `bg-ground`, the heading classes from `Title`). Add a back link to `/circle` at the top (`ArrowLeftIcon` plus "Your circle", 44 px). Remove `.tc-search` usages; the global focus style covers them. The grids and charts stay as they are.

- [ ] **Step 4: Checks, screenshots and commit**

Run: `npm test && npm run typecheck && npm run lint && npx playwright test e2e/dashboard.spec.ts` — Expected: PASS.
Screenshot `/circle` as Sarah and `/circle/payments/<held id>` at 390 × 844 and 1280 × 800. For the held id, use Playwright `page.route` to stub the GET routes with a held payment shape. Compare them with `SarahAlerts.dc.html` and `ContactReview.dc.html`.

```bash
git add src/app/circle src/app/trends src/app/api/circle
git commit -m "feat: add Sarah's circle and the held-payment review screen"
```

---

### Task 9: Daniel's answer

**Files:**
- Create: `src/app/verify/[id]/page.tsx`, `src/app/verify/answerCopy.ts`, `src/app/verify/answerCopy.test.ts`

**Interfaces:**
- Consumes:
  - `GET /api/verifications/:id` (`{ id, status, senderName, amountCents, payee, askedAt, paymentOnHold }`; 403 when it isn't for the viewer);
  - `POST /api/verifications/:id/respond` with `{ answer: "me" | "not_me" }` (`{ status, paymentState }`; 409 when already answered or already decided; 202 when pending);
  - `GET /api/me` (`displayName`).
- Produces: `answerCopy(a: { answer: "me" | "not_me"; status: number; viewerName: string; senderName: string; payee: string; amount: string }): { title: string; lead: string }`.

`answerCopy` rules:

| Answer and status | Title | Lead |
|---|---|---|
| not_me, 200 or 202 | `Thank you, ${viewerName}. We stopped it.` | `${senderName}'s money is safe, and other families are now warned about this account.` |
| me, 200 or 202 | "Thanks. The payment is going ahead." | `We're sending ${amount} to ${payee}.` |
| 409 | "This has already been answered" | "Nothing more is needed from you." |

- [ ] **Step 1: Write the failing test**

`src/app/verify/answerCopy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { answerCopy } from "./answerCopy";

const base = { viewerName: "Daniel", senderName: "Margaret", payee: "dhill@x.example", amount: "$800" };
describe("answerCopy", () => {
  it("thanks the real person by name when they stop it", () => {
    expect(answerCopy({ ...base, answer: "not_me", status: 200 })).toEqual({
      title: "Thank you, Daniel. We stopped it.",
      lead: "Margaret's money is safe, and other families are now warned about this account.",
    });
  });
  it("confirms a genuine request", () => {
    expect(answerCopy({ ...base, answer: "me", status: 202 }).title).toBe("Thanks. The payment is going ahead.");
  });
  it("handles a second answer calmly", () => {
    expect(answerCopy({ ...base, answer: "not_me", status: 409 }).title).toBe("This has already been answered");
  });
});
```

Run: `npm test -- src/app/verify` — Expected: FAIL.

- [ ] **Step 2: Implement the copy and the screen, built to `DanielAsk.dc.html`**

Implement `answerCopy` from the table. The screen (`src/app/verify/[id]/page.tsx`, client):
- Header: "Trust Circle" plus `Chip tone="held"` "Waiting for you" while pending.
- `Title` (34 px): `Did you just ask ${senderName} for ${amount}?`
- `Lead`: "Someone asked them to send it and said they were you. The money is on hold until you answer."
- A `Card` with "Would go to", the payee, the amount and "Asked {today/date} at {time}".
- Footer:
  - danger "It wasn't me" (64 px, `data-testid="not-me"`);
  - secondary "Yes, it was me" (`data-testid="it-was-me"`);
  - FinePrint "If it wasn't you, we stop the payment and warn other families about this account."
- After answering: an outcome view with a settle icon and the `answerCopy` text, plus secondary "Go to your circle" linking to `/circle`.

Other states:
- status not pending on load: the 409 copy;
- `paymentOnHold:false` while pending: "This payment has already been dealt with" with the lead "Nothing more is needed from you.";
- 403: Title "This request isn't for you" with "Go to your circle";
- loading, signed out and errors as in the earlier tasks.

- [ ] **Step 3: Checks, screenshots and commit**

Run: `npm test && npm run typecheck && npm run lint` — Expected: PASS.
Screenshot the pending view (stub the GET with `page.route`) and the stopped outcome at 390 × 844 and 1280 × 800. Compare them with `DanielAsk.dc.html`.

```bash
git add src/app/verify
git commit -m "feat: add the real person's 'Did you just ask' screen"
```

---

### Task 10: The demo story end to end

**Files:**
- Rewrite: `e2e/protected-transfer.spec.ts`
- Create: `e2e/check-message.spec.ts`, `e2e/access.spec.ts`, `e2e/helpers.ts`

**Interfaces:**
- Consumes: every screen above, the sandbox credentials in `.env.local` (`SANDBOX_SENIOR_EMAIL`, `SANDBOX_SENIOR_PASSWORD`, `SANDBOX_GRANDSON_EMAIL`), and `npm run demo:reset`.

- [ ] **Step 1: Shared helpers**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from "@playwright/test";

export async function signInAs(page: Page, as: "margaret" | "sarah" | "daniel" | "robert") {
  const r = await page.request.post("/api/demo/login", { data: { as } });
  expect(r.ok()).toBe(true);
}

export async function approveInPayPal(page: Page) {
  const email = process.env.SANDBOX_SENIOR_EMAIL!;
  const password = process.env.SANDBOX_SENIOR_PASSWORD!;
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("paypal-button").click();
  const popup = await popupPromise;
  await popup.getByRole("textbox", { name: /email or mobile number/i }).fill(email);
  await popup.getByRole("button", { name: /^next$/i }).click();
  await popup.locator("#password").fill(password);
  await popup.getByRole("button", { name: /log in/i }).click();
  await popup.getByRole("button", { name: /(complete purchase|continue)/i }).click();
  await popup.waitForEvent("close");
}
```

- [ ] **Step 2: The live PayPal story**

`e2e/protected-transfer.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { approveInPayPal, signInAs } from "./helpers";

const GRANDSON = process.env.SANDBOX_GRANDSON_EMAIL!;
test.skip(!process.env.SANDBOX_SENIOR_EMAIL || !process.env.SANDBOX_SENIOR_PASSWORD || !GRANDSON, "sandbox credentials not set");

test("a grandson scam is held, the real Daniel says it wasn't him, and the money is safe", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByTestId("try-margaret").click();
  await page.waitForURL("**/home");
  await page.getByTestId("home-send").click();
  await page.getByLabel("Who are you paying?").fill(GRANDSON);
  await page.getByLabel("How much?").fill("800");
  await page.getByLabel("Who asked you to make this payment, and why?").fill(
    "My grandson Daniel called crying, he's in jail and needs bail money today. He said not to tell his mum.",
  );
  await page.getByTestId("check").click();
  await expect(page.getByTestId("risk-high")).toBeVisible();
  await approveInPayPal(page);
  await page.waitForURL("**/payments/**");
  await expect(page.locator("[data-testid=payment-screen-waiting], [data-testid=payment-screen-held]")).toBeVisible();

  const daniel = await browser.newPage();
  await signInAs(daniel, "daniel");
  await daniel.goto("/circle");
  await daniel.getByTestId("answer-verification").first().click();
  await daniel.getByTestId("not-me").click();
  await expect(daniel.getByRole("heading", { name: /We stopped it/ })).toBeVisible();

  await expect(page.getByTestId("payment-screen-stopped_by_person")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Payment stopped. Your money is safe." })).toBeVisible();
});

test("a small payment to someone new is confirmed and paid out", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/send");
  await page.getByLabel("Who are you paying?").fill(GRANDSON);
  await page.getByLabel("How much?").fill("20");
  await page.getByTestId("check").click();
  const medium = page.getByTestId("confirm-medium");
  if (await medium.isVisible().catch(() => false)) await medium.click();
  await approveInPayPal(page);
  await page.waitForURL("**/payments/**");
  await expect(page.getByTestId("payment-screen-sent")).toBeVisible({ timeout: 30_000 });
});
```

The first test needs the AI to name the grandson as the requester, so that Daniel is asked. If a run comes back held with no verification (the stage is `none`), record it in the report. Do not loosen the assertion.

- [ ] **Step 3: The message check and the access checks**

`e2e/check-message.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("a grandson text is flagged, explained and can be reported", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/check");
  await page.getByLabel("The message").fill(
    "Hi Grandma it's me, I lost my phone so this is my new number. I need $800 in gift cards today. Please don't tell mom. Text me at +1 (415) 555-0199",
  );
  await page.getByTestId("check-submit").click();
  await expect(page.getByTestId("check-result-scam")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "What gave it away" })).toBeVisible();
  await page.route("mailto:*", (route) => route.abort());
  await page.getByTestId("report").click();
  await expect(page.getByText(/shared scam list/)).toBeVisible();
});

test("an unchecked result is never shown as safe", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.route("**/api/messages/check", (route) =>
    route.fulfill({
      json: { id: "x", source: "text", text: "hi", checked: false, level: null, scamType: "unknown", reasons: [], identifiers: [], impersonatedRequester: null, createdAt: new Date().toISOString() },
    }),
  );
  await page.goto("/check");
  await page.getByLabel("The message").fill("hi");
  await page.getByTestId("check-submit").click();
  await expect(page.getByTestId("check-result-not_checked")).toBeVisible();
  await expect(page.getByText("That isn't the same as safe.", { exact: false })).toBeVisible();
});
```

`e2e/access.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const MARGARETS_PAYMENT = "00000000-0000-4000-a000-000000000003"; // from npm run seed:history

test("someone else's payment shows a calm not-found screen", async ({ page }) => {
  await signInAs(page, "robert");
  await page.goto(`/payments/${MARGARETS_PAYMENT}`);
  await expect(page.getByRole("heading", { name: "We couldn't find this payment" })).toBeVisible();
  await page.goto(`/circle/payments/${MARGARETS_PAYMENT}`);
  await expect(page.getByRole("heading", { name: "We couldn't find this payment" })).toBeVisible();
});

test("a signed-out visitor is offered the demo accounts", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Choose a demo account" })).toBeVisible();
});
```

- [ ] **Step 4: Run, screenshot every screen and commit**

Run: `npm run demo:reset && npx playwright test e2e/check-message.spec.ts e2e/access.spec.ts e2e/dashboard.spec.ts`
Expected: all pass.

Run: `npx playwright test e2e/protected-transfer.spec.ts` (the live sandbox, a few minutes)
Expected: 2 passed. Record any flaky step and its cause, with no secrets.

Using one scratchpad script, take a final screenshot set of every screen at 390 × 844 and 1280 × 800. Use `npm run demo:reset` first, and Playwright `page.route` stubs where a state needs data:
- landing;
- home;
- check (input, checking, scam, not checked);
- send (form, risk high);
- payment (held, waiting, memory question, safe word, official routes, stopped, sent, hold ended);
- circle;
- review;
- verify (pending, stopped);
- dashboard;
- trends.

List the paths in the report so the controller can review them.

```bash
git add e2e
git commit -m "test: cover the full demo story through the designed screens"
```

---

## Self-review notes (completed by the plan author)

**Spec coverage**

| Spec | Where |
|---|---|
| 4.9 demo mode with "Try as senior" and "Try as trusted contact" | Task 3 (landing, personas, reset) |
| 10 sender screens: Home, Check a message, Send money, Verification, On hold, Result | Tasks 4, 5, 6, 7 |
| 10 trusted-contact screens: Alert, Held payment detail, Dashboard, Scam trends | Task 8 (dashboard and trends restyled; built in Plan 3) |
| 10 shared Landing | Task 3, functional; final in 4B |
| 10 shared Onboarding | Plan 4B |
| 10.1 written direction and tokens (`DESIGN.md`) before screens | Task 2 |
| 10.1 type pairing, one accent, status colours that work without colour | Task 2 tokens and `Chip` |
| 10.1 purposeful motion only, reduced motion respected | Task 2 CSS; the ring, travel and settle animations |
| 10.1 real copy | Every screen task gives its copy |
| 10.1 designed empty, loading and error states | Every screen task |
| 10.1 review gate per screen | Global Constraints plus screenshot steps; a11y and design critique in 4B |
| 3 presets | Plan 4B (onboarding) |
| Plan 2 carry-forward: screens handle 202 and `VerificationStage`; "Try again" after an approval failure | Tasks 6 and 7 |
| Plan 3 carry-forward: report button; the look-alike link fix | Tasks 5 and 1 |

**Placeholder scan:** no TBD. The UI tasks fix behaviour, copy, test ids and data flow exactly, with helper code and tests in full. Visual markup follows the named concept file, which is the exact source. Conditional instructions name their fallback:
- the font weight array;
- Phosphor export names;
- the postgres `ANY` binding;
- a held run without a verification.

**Type consistency:** these names are checked across tasks:
- `fetchJson`, `FetchResult`, `jsonBody` (Task 2 → 3 to 9)
- `Persona`, `homeFor` (Task 3 → 10)
- `screenFor`, `Stage`, `Outcome` (Task 7)
- `paymentOutcome` (Task 7 → the GET route)
- `ChipTone` (Task 2 → 4 to 9)
- `useOnce` (Task 2 → 5 to 9)

**Review Focus:** each line has a test:
1. `screenCopy` "Nothing has been sent" test (Task 7) and `approvalErrorCopy` (Task 6).
2. `resultKind` and the e2e unchecked test (Tasks 5 and 10).
3. The circle payment route test (Task 8), `GET /api/payments/:id` 403 (Task 7) and the e2e access test (Task 10).
4. `fetchJson` 401 (Task 2) and the e2e signed-out test (Task 10).
5. The `createOnce` test (Task 2) and the server's 409 handling, which already exists.
