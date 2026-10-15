import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server, installMsw } from "@/test/msw";
import { createPayPalGateway, PayPalError } from "./paypalGateway";

installMsw();
const BASE = "https://api-m.sandbox.paypal.com";
const gw = createPayPalGateway({ clientId: "cid", clientSecret: "secret" });
const seen: { path: string; requestId: string | null; body: unknown }[] = [];

function token() {
  return http.post(`${BASE}/v1/oauth2/token`, () =>
    HttpResponse.json({ access_token: "tok", token_type: "Bearer", expires_in: 32000 }),
  );
}
function record(path: string, respond: () => Response) {
  return http.post(`${BASE}${path}`, async ({ request }) => {
    const text = await request.text();
    seen.push({ path, requestId: request.headers.get("paypal-request-id"), body: text ? JSON.parse(text) : null });
    return respond();
  });
}

describe("paypal gateway", () => {
  it("creates an AUTHORIZE order for the amount with a deterministic request id", async () => {
    seen.length = 0;
    server.use(token(), record("/v2/checkout/orders", () => HttpResponse.json({ id: "ORDER1", status: "CREATED" }, { status: 201 })));
    const out = await gw.createAuthorizeOrder({ paymentId: "p1", amountCents: 80000 });
    expect(out).toEqual({ orderId: "ORDER1" });
    expect(seen[0]?.requestId).toBe("tc-p1-create");
    expect(seen[0]?.body).toMatchObject({
      intent: "AUTHORIZE",
      purchase_units: [{ reference_id: "p1", amount: { currency_code: "USD", value: "800.00" } }],
    });
  });

  it("sets the PayPal experience context for the approval popup", async () => {
    seen.length = 0;
    server.use(token(), record("/v2/checkout/orders", () => HttpResponse.json({ id: "ORDER1", status: "CREATED" }, { status: 201 })));
    await gw.createAuthorizeOrder({ paymentId: "p1", amountCents: 100 });
    const ctx = (seen[0]?.body as { payment_source: { paypal: { experience_context: Record<string, unknown> } } }).payment_source.paypal
      .experience_context;
    expect(ctx).toMatchObject({ brand_name: "Trust Circle", shipping_preference: "NO_SHIPPING", user_action: "CONTINUE" });
    expect(ctx).not.toHaveProperty("return_url");
    expect(ctx).not.toHaveProperty("cancel_url");
  });

  it("authorises an order and returns the authorization id", async () => {
    seen.length = 0;
    server.use(
      token(),
      record("/v2/checkout/orders/ORDER1/authorize", () =>
        HttpResponse.json(
          { id: "ORDER1", status: "COMPLETED", purchase_units: [{ payments: { authorizations: [{ id: "AUTH1", status: "CREATED" }] } }] },
          { status: 201 },
        ),
      ),
    );
    expect(await gw.authorizeOrder({ paymentId: "p1", orderId: "ORDER1" })).toEqual({ authorizationId: "AUTH1" });
    expect(seen[0]?.requestId).toBe("tc-p1-authorize");
  });

  it("captures and voids with stable request ids so retries are safe", async () => {
    seen.length = 0;
    server.use(
      token(),
      record("/v2/payments/authorizations/AUTH1/capture", () => HttpResponse.json({ id: "CAP1", status: "COMPLETED" }, { status: 201 })),
      record("/v2/payments/authorizations/AUTH2/void", () => new HttpResponse(null, { status: 204 })),
    );
    expect(await gw.captureAuthorization({ paymentId: "p1", authorizationId: "AUTH1" })).toEqual({ captureId: "CAP1" });
    await gw.captureAuthorization({ paymentId: "p1", authorizationId: "AUTH1" });
    await gw.voidAuthorization({ paymentId: "p2", authorizationId: "AUTH2" });
    expect(seen.map((s) => s.requestId)).toEqual(["tc-p1-capture", "tc-p1-capture", "tc-p2-void"]);
  });

  it("sends a payout to an email with the request id as batch id", async () => {
    seen.length = 0;
    server.use(token(), record("/v1/payments/payouts", () => HttpResponse.json({ batch_header: { payout_batch_id: "BATCH1" } }, { status: 201 })));
    expect(await gw.sendPayout({ paymentId: "p1", receiver: "grandson@example.com", amountCents: 80000 })).toEqual({ payoutBatchId: "BATCH1" });
    expect(seen[0]?.requestId).toBe("tc-p1-payout");
    expect(seen[0]?.body).toMatchObject({
      sender_batch_header: { sender_batch_id: "tc-p1-payout" },
      items: [{ recipient_type: "EMAIL", receiver: "grandson@example.com", amount: { value: "800.00", currency: "USD" } }],
    });
  });

  it("refunds a capture", async () => {
    seen.length = 0;
    server.use(token(), record("/v2/payments/captures/CAP1/refund", () => HttpResponse.json({ id: "REF1", status: "COMPLETED" }, { status: 201 })));
    expect(await gw.refundCapture({ paymentId: "p1", captureId: "CAP1" })).toEqual({ refundId: "REF1" });
    expect(seen[0]?.requestId).toBe("tc-p1-refund");
  });

  it("surfaces PayPal errors with issue and debug id", async () => {
    server.use(
      token(),
      record("/v2/payments/authorizations/AUTH9/capture", () =>
        HttpResponse.json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "AUTHORIZATION_VOIDED" }], debug_id: "dbg123" }, { status: 422 }),
      ),
    );
    const err = await gw.captureAuthorization({ paymentId: "p9", authorizationId: "AUTH9" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    const pe = err as PayPalError;
    expect(pe.issue).toBe("AUTHORIZATION_VOIDED");
    expect(pe.debugId).toBe("dbg123");
    expect(pe.status).toBe(422);
  });

  it("surfaces payout errors without leaking the body", async () => {
    server.use(
      token(),
      record("/v1/payments/payouts", () =>
        HttpResponse.json({ name: "USER_BUSINESS_ERROR", details: [{ issue: "INSUFFICIENT_FUNDS" }], debug_id: "dbg9" }, { status: 400 }),
      ),
    );
    const pe = (await gw.sendPayout({ paymentId: "p8", receiver: "a@b.com", amountCents: 100 }).catch((e: unknown) => e)) as PayPalError;
    expect(pe).toBeInstanceOf(PayPalError);
    expect([pe.issue, pe.debugId, pe.status]).toEqual(["INSUFFICIENT_FUNDS", "dbg9", 400]);
  });
});
