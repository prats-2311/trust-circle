import type { Page } from "@playwright/test";

/** Reusable `page.route` stubs for states live data can't easily reach. Shared by the a11y spec and the screenshot scripts. */

export const PAYMENT_ID = "00000000-0000-4000-a000-000000000003";
export const VERIFY_ID = "00000000-0000-4000-a000-0000000000aa";
/** An invented scam payee, the same one the README demo path uses. Stubs never reach PayPal, so it needn't be a sandbox account. */
export const STUB_PAYEE = "daniel.newphone@example.com";
const PAYEE = STUB_PAYEE;
const iso = (hours: number) => new Date(Date.now() + hours * 3600e3).toISOString();

export type PaymentKind =
  | "held" | "waiting" | "challenge_memory" | "challenge_safe_word" | "official_routes" | "stopped_by_person"
  | "sent" | "returning" | "cancelled" | "hold_ended" | "pending";

type Stage = Record<string, unknown>;
const NONE: Stage = { stage: "none" };

const KINDS: Record<PaymentKind, { state: string; outcome: string | null; stage: Stage }> = {
  held: { state: "held", outcome: null, stage: NONE },
  waiting: { state: "held", outcome: null, stage: { stage: "waiting_for_person", contactName: "Daniel", askedAt: iso(-0.1), challengeOpensAt: iso(0.1) } },
  challenge_memory: { state: "held", outcome: null, stage: { stage: "challenge", method: "memory_question", requesterName: "Daniel", guidance: ["Ask something only Daniel would know, like the name of his first pet.", "Don't hint at the answer."] } },
  challenge_safe_word: { state: "held", outcome: null, stage: { stage: "challenge", method: "safe_word", requesterName: "Daniel", guidance: ["Don't say the word first."] } },
  official_routes: { state: "held", outcome: null, stage: { stage: "official_routes", organisation: "your bank", steps: ["Open your bank's app yourself.", "Call the number on the back of your card."] } },
  stopped_by_person: { state: "voided", outcome: null, stage: { stage: "resolved", outcome: "denied", contactName: "Daniel" } },
  sent: { state: "paid_out", outcome: null, stage: NONE },
  returning: { state: "payout_failed", outcome: null, stage: NONE },
  cancelled: { state: "voided", outcome: "sender", stage: NONE },
  hold_ended: { state: "expired", outcome: "expired", stage: NONE },
  pending: { state: "captured", outcome: null, stage: NONE },
};

export const PAYMENT_KINDS = Object.keys(KINDS) as PaymentKind[];

export function paymentBody(state: string, outcome: string | null = null) {
  return {
    id: PAYMENT_ID, payee: PAYEE, amountCents: 80000, state, riskLevel: "high", scamType: "impersonation_family",
    reasons: ["Someone claiming to be family asked for money urgently."],
    coolingOffUntil: iso(23), authorisedAt: iso(-1), outcome,
  };
}

/** The sender's payment screen for one kind. Sign in as margaret first. */
export async function stubPayment(page: Page, kind: PaymentKind) {
  const k = KINDS[kind];
  await page.route(`**/api/payments/${PAYMENT_ID}`, (r) => r.fulfill({ json: paymentBody(k.state, k.outcome) }));
  await page.route(`**/api/payments/${PAYMENT_ID}/verification`, (r) => r.fulfill({ json: k.stage }));
}

/** Circle member's list of held payments and the review screen. Sign in as sarah first. */
export async function stubCircleReview(page: Page, opts: { closed?: boolean } = {}) {
  const held = paymentBody("held");
  const body = opts.closed ? paymentBody("voided", "sender") : held;
  await page.route("**/api/circle/held", (r) =>
    r.fulfill({ json: [{ id: PAYMENT_ID, payee: PAYEE, amountCents: 80000, reasons: held.reasons, authorisedAt: held.authorisedAt, coolingOffUntil: held.coolingOffUntil }] }),
  );
  await page.route(`**/api/circle/payments/${PAYMENT_ID}`, (r) =>
    r.fulfill({ json: { payment: { ...body, senderAnswer: opts.closed ? null : "My grandson called crying, he needs bail money today." }, senderName: "Margaret" } }),
  );
  await page.route(`**/api/payments/${PAYMENT_ID}/verification`, (r) => r.fulfill({ json: NONE }));
}

/** Alerts on Sarah's circle screen. */
export async function stubCircleAlerts(page: Page) {
  const alerts = [
    { id: "a1", kind: "payment_held", title: "Margaret's $800.00 payment is on hold", body: "It looks like a scam. Please take a look.", path: `/circle/payments/${PAYMENT_ID}`, createdAt: iso(-0.5), readAt: null },
    { id: "a2", kind: "payment_update", title: "Margaret stopped a payment", body: "She cancelled the $120.00 payment herself.", path: "/circle", createdAt: iso(-26), readAt: iso(-25) },
  ];
  await page.route("**/api/alerts", (r) => r.fulfill({ json: alerts }));
}

/** The "is this you?" screen a contact sees. Sign in as daniel first. */
export async function stubVerify(page: Page, mode: "ask" | "not_for_you") {
  if (mode === "not_for_you") {
    await page.route(`**/api/verifications/${VERIFY_ID}`, (r) => r.fulfill({ status: 403, json: { error: "Forbidden" } }));
    return;
  }
  await page.route(`**/api/verifications/${VERIFY_ID}`, (r) =>
    r.fulfill({ json: { id: VERIFY_ID, status: "pending", senderName: "Margaret", amountCents: 80000, payee: PAYEE, askedAt: iso(-0.2), paymentOnHold: true } }),
  );
}

/** A check result with no verdict (the AI could not be reached). */
export async function stubNotChecked(page: Page) {
  await page.route("**/api/messages/check", (r) =>
    r.fulfill({ json: { id: "x", source: "text", text: "hi", checked: false, level: null, scamType: "unknown", reasons: [], identifiers: [], impersonatedRequester: null, createdAt: new Date().toISOString() } }),
  );
}

/** A scam verdict, without calling the AI. */
export async function stubScamCheck(page: Page) {
  await page.route("**/api/messages/check", (r) =>
    r.fulfill({
      json: {
        id: "x", source: "text", text: "Hi Grandma it's me, new number. I need $800 in gift cards today.", checked: true, level: "high", scamType: "impersonation_family",
        reasons: ["It claims to be a family member on a new number.", "It asks for gift cards, which can't be traced."], identifiers: [], impersonatedRequester: null, createdAt: new Date().toISOString(),
      },
    }),
  );
}

/** The /send form after the check: a high-risk verdict, without calling the AI. */
export async function stubHighRiskPayment(page: Page) {
  await page.route("**/api/payments", (r) =>
    r.request().method() === "POST"
      ? r.fulfill({ json: { paymentId: PAYMENT_ID, orderId: "STUB-ORDER", risk: { level: "high", reasons: ["Someone claiming to be family asked for money urgently.", "It asks you to keep this secret."] } } })
      : r.continue(),
  );
}

/** Margaret's seeded payments that the stubbed aftercare findings point at (see seedDemoHistory in src/server/demoSeed.ts). */
const SEEDED_VET_PAYMENT = "00000000-0000-4000-a000-000000000008";
const SEEDED_LOTTO_PAYMENT = "00000000-0000-4000-a000-000000000007";

/** A finished aftercare review, without calling Groq or PayPal. Same shape as AftercareReport. Sign in as sarah first. */
export async function stubAftercare(page: Page) {
  await page.route("**/api/circle/aftercare", (r) =>
    r.fulfill({
      json: {
        summary: "Nothing went to an account on the scam list. One recent payment was larger than usual, and one earlier hold ended without anyone deciding.",
        findings: [
          {
            paymentId: SEEDED_VET_PAYMENT, severity: "check", title: "A larger payment than usual",
            detail: "This went through after a warning. If Margaret knows the vet clinic, there's nothing to do.",
          },
          {
            paymentId: SEEDED_LOTTO_PAYMENT, severity: "info", title: "A held prize-fee payment ended on its own",
            detail: "Nobody decided within 72 hours, so the hold ended and the money stayed in Margaret's account.",
          },
        ],
        toolCalls: [{ name: "list_transactions", ok: true }],
        usedPayPal: true,
      },
    }),
  );
}
