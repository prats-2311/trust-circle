import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import { createMemoryPaymentRepo } from "@/payments/memoryPaymentRepo";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const MARGARET = "11111111-1111-4111-8111-111111111111";
const SARAH = "22222222-2222-4222-8222-222222222222";
const ROBERT = "33333333-3333-4333-8333-333333333333";
const PAYMENT = "44444444-4444-4444-8444-444444444444";

let container: unknown;
vi.mock("@/server/container", () => ({ getContainer: () => container }));
import { GET } from "./route";

const user = (id: string, displayName: string) => ({ id, email: `${displayName}@x.test`, displayName, safeWordHash: null });

beforeEach(async () => {
  const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: MARGARET, contactId: SARAH }] });
  await repo.insert({
    id: PAYMENT, senderId: MARGARET, payee: "dhill.urgent@outlook.com", amountCents: 80000, note: null,
    senderAnswer: "He lost his phone", state: "held", riskLevel: "high", scamType: "impersonation_family",
    reasons: ["Asked for secrecy"], impersonatedRequester: null, paypalOrderId: null, authorizationId: null,
    captureId: null, payoutBatchId: null, refundId: null, authorisedAt: new Date(), coolingOffUntil: new Date(),
  });
  const circle = createMemoryCircleRepo({
    users: [user(MARGARET, "Margaret"), user(SARAH, "Sarah"), user(ROBERT, "Robert")],
    links: [{ senderId: MARGARET, contactId: SARAH, relationship: "daughter" }],
  });
  container = { repo, circle, env: { SESSION_SECRET: SECRET } };
});

const call = (id: string, userId?: string) =>
  GET(new Request(`http://x/api/circle/payments/${id}`, userId ? { headers: { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } } : {}), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/circle/payments/:id", () => {
  it("shows a circle member the payment with the sender's name and answer", async () => {
    const res = await call(PAYMENT, SARAH);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.senderName).toBe("Margaret");
    expect(body.payment).toMatchObject({ id: PAYMENT, senderAnswer: "He lost his phone", amountCents: 80000 });
  });

  it("answers 403 with no data for someone outside the sender's circle", async () => {
    const res = await call(PAYMENT, ROBERT);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Payment not found" });
  });

  it("answers 403 for the sender themselves and for a payment that does not exist", async () => {
    expect((await call(PAYMENT, MARGARET)).status).toBe(403);
    expect((await call("55555555-5555-4555-8555-555555555555", SARAH)).status).toBe(403);
  });

  it("answers 403 for an id that is not a uuid", async () => {
    const res = await call("not-a-uuid", SARAH);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Payment not found" });
  });

  it("answers 401 with no session", async () => {
    expect((await call(PAYMENT)).status).toBe(401);
  });
});
