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

  it("sets custom_id to the payment id so Transaction Search and webhooks can match it", async () => {
    seen.length = 0;
    server.use(token(), record("/v2/checkout/orders", () => HttpResponse.json({ id: "ORDER1", status: "CREATED" }, { status: 201 })));
    await gw.createAuthorizeOrder({ paymentId: "p1", amountCents: 100 });
    expect(seen[0]?.body).toMatchObject({ purchase_units: [{ reference_id: "p1", custom_id: "p1" }] });
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

  it("asks PayPal to return the voided authorisation and reports its status", async () => {
    let prefer: string | null = null;
    server.use(
      token(),
      http.post(`${BASE}/v2/payments/authorizations/AUTH3/void`, ({ request }) => {
        prefer = request.headers.get("prefer");
        return HttpResponse.json({ id: "AUTH3", status: "VOIDED" }, { status: 200 });
      }),
    );
    expect(await gw.voidAuthorization({ paymentId: "p3", authorizationId: "AUTH3" })).toEqual({ status: "VOIDED" });
    expect(prefer).toBe("return=representation");
  });

  it("reports no status when PayPal answers a void with no body", async () => {
    server.use(token(), http.post(`${BASE}/v2/payments/authorizations/AUTH4/void`, () => new HttpResponse(null, { status: 204 })));
    expect(await gw.voidAuthorization({ paymentId: "p4", authorizationId: "AUTH4" })).toEqual({ status: null });
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

  it("fails with PayPalError when no authorization id comes back", async () => {
    server.use(token(), record("/v2/checkout/orders/ORDERX/authorize", () => HttpResponse.json({ id: "ORDERX", status: "COMPLETED" }, { status: 201 })));
    const err = await gw.authorizeOrder({ paymentId: "px", orderId: "ORDERX" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
  });

  describe("baseUrl", () => {
    it("accepts only the sandbox origin", () => {
      const mk = (baseUrl?: string) => () => createPayPalGateway({ clientId: "c", clientSecret: "s", baseUrl });
      expect(mk()).not.toThrow();
      expect(mk(BASE)).not.toThrow();
      expect(mk(BASE + "/")).not.toThrow();
      expect(mk("https://api-m.paypal.com")).toThrow();
      expect(mk("")).toThrow();
      expect(mk("garbage")).toThrow();
      expect(mk("https://sandbox.evil.com")).toThrow();
    });
  });

  describe("uncertain outcomes", () => {
    const pay = async (): Promise<PayPalError> => {
      const r = await gw.sendPayout({ paymentId: "pu", receiver: "a@b.com", amountCents: 100 }).catch((e: unknown) => e);
      return r as PayPalError;
    };
    it("network error is uncertain", async () => {
      server.use(token(), http.post(`${BASE}/v1/payments/payouts`, () => HttpResponse.error()));
      const e = await pay();
      expect(e).toBeInstanceOf(PayPalError);
      expect(e.uncertain).toBe(true);
    });
    it("5xx is uncertain", async () => {
      server.use(token(), record("/v1/payments/payouts", () => HttpResponse.json({}, { status: 500 })));
      expect((await pay()).uncertain).toBe(true);
    });
    it("422 is definite", async () => {
      server.use(token(), record("/v1/payments/payouts", () => HttpResponse.json({ details: [{ issue: "X" }] }, { status: 422 })));
      expect((await pay()).uncertain).toBe(false);
    });
    it("2xx without batch id is uncertain", async () => {
      server.use(token(), record("/v1/payments/payouts", () => HttpResponse.json({}, { status: 201 })));
      expect((await pay()).uncertain).toBe(true);
    });
    it("a 2xx without an id is uncertain for authorize, capture and refund", async () => {
      server.use(token(), record("/v2/checkout/orders/O9/authorize", () => HttpResponse.json({}, { status: 201 })));
      const a = (await gw.authorizeOrder({ paymentId: "pa", orderId: "O9" }).catch((e: unknown) => e)) as PayPalError;
      expect(a).toBeInstanceOf(PayPalError);
      expect(a.uncertain).toBe(true);
      server.use(token(), record("/v2/payments/authorizations/A9/capture", () => HttpResponse.json({}, { status: 201 })));
      const c = (await gw.captureAuthorization({ paymentId: "pc", authorizationId: "A9" }).catch((e: unknown) => e)) as PayPalError;
      expect(c).toBeInstanceOf(PayPalError);
      expect(c.uncertain).toBe(true);
      server.use(token(), record("/v2/payments/captures/C9/refund", () => HttpResponse.json({}, { status: 201 })));
      const r = (await gw.refundCapture({ paymentId: "pr9", captureId: "C9" }).catch((e: unknown) => e)) as PayPalError;
      expect(r).toBeInstanceOf(PayPalError);
      expect(r.uncertain).toBe(true);
    });
    it("SDK 5xx is uncertain, SDK 422 is not", async () => {
      server.use(token(), record("/v2/payments/authorizations/A5/capture", () => HttpResponse.json({}, { status: 503 })));
      const e5 = (await gw.captureAuthorization({ paymentId: "p5", authorizationId: "A5" }).catch((e: unknown) => e)) as PayPalError;
      expect(e5.uncertain).toBe(true);
      server.use(token(), record("/v2/payments/authorizations/A4/capture", () => HttpResponse.json({}, { status: 422 })));
      const e4 = (await gw.captureAuthorization({ paymentId: "p4", authorizationId: "A4" }).catch((e: unknown) => e)) as PayPalError;
      expect(e4.uncertain).toBe(false);
    });
  });

  describe("payout token handling", () => {
    it("retries once with a fresh token after a 401", async () => {
      const g = createPayPalGateway({ clientId: "c", clientSecret: "s" });
      let tokens = 0;
      const ids: (string | null)[] = [];
      let calls = 0;
      server.use(
        http.post(`${BASE}/v1/oauth2/token`, () => {
          tokens++;
          return HttpResponse.json({ access_token: "tok" + tokens, token_type: "Bearer", expires_in: 32000 });
        }),
        http.post(`${BASE}/v1/payments/payouts`, ({ request }) => {
          ids.push(request.headers.get("paypal-request-id"));
          return ++calls === 1
            ? HttpResponse.json({}, { status: 401 })
            : HttpResponse.json({ batch_header: { payout_batch_id: "B2" } }, { status: 201 });
        }),
      );
      expect(await g.sendPayout({ paymentId: "pr", receiver: "a@b.com", amountCents: 100 })).toEqual({ payoutBatchId: "B2" });
      expect(tokens).toBe(2);
      expect(ids).toEqual(["tc-pr-payout", "tc-pr-payout"]);
    });
    it("rejects a malformed token response", async () => {
      const g = createPayPalGateway({ clientId: "c", clientSecret: "s" });
      server.use(http.post(`${BASE}/v1/oauth2/token`, () => HttpResponse.json({ nope: 1 })));
      const e = await g.sendPayout({ paymentId: "pm", receiver: "a@b.com", amountCents: 100 }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(PayPalError);
    });
  });

  describe("verifyWebhookSignature", () => {
    const headers = {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT-1",
      "paypal-transmission-id": "tid-1",
      "paypal-transmission-sig": "sig+/=",
      "paypal-transmission-time": "2026-10-16T10:00:00Z",
    };
    // Spacing and key order that JSON.stringify would not reproduce.
    const rawBody = '{ "id":"WH-1",  "event_type":"PAYMENT.PAYOUTS-ITEM.RETURNED", "resource":{"amount":1.10} }';
    let sent = "";
    let auth: string | null = null;
    const verifyReply = (status: string | null, httpStatus = 200) =>
      http.post(`${BASE}/v1/notifications/verify-webhook-signature`, async ({ request }) => {
        sent = await request.text();
        auth = request.headers.get("authorization");
        return status === null ? new HttpResponse("nope", { status: httpStatus }) : HttpResponse.json({ verification_status: status }, { status: httpStatus });
      });

    it("splices the raw body in byte for byte and is true only on SUCCESS", async () => {
      server.use(token(), verifyReply("SUCCESS"));
      expect(await gw.verifyWebhookSignature({ headers, rawBody, webhookId: "WID1" })).toBe(true);
      expect(sent.endsWith(`,"webhook_event":${rawBody}}`)).toBe(true);
      expect(auth).toBe("Bearer tok");
      expect(JSON.parse(sent)).toEqual({
        auth_algo: "SHA256withRSA",
        cert_url: headers["paypal-cert-url"],
        transmission_id: "tid-1",
        transmission_sig: "sig+/=",
        transmission_time: "2026-10-16T10:00:00Z",
        webhook_id: "WID1",
        webhook_event: JSON.parse(rawBody),
      });
    });

    it("is false on FAILURE, any other status, or a non-2xx answer", async () => {
      server.use(token(), verifyReply("FAILURE"));
      expect(await gw.verifyWebhookSignature({ headers, rawBody, webhookId: "WID1" })).toBe(false);
      server.use(verifyReply("PENDING"));
      expect(await gw.verifyWebhookSignature({ headers, rawBody, webhookId: "WID1" })).toBe(false);
      server.use(verifyReply(null, 500));
      expect(await gw.verifyWebhookSignature({ headers, rawBody, webhookId: "WID1" })).toBe(false);
    });

    it("is false without calling PayPal when a signature header is missing", async () => {
      sent = "";
      server.use(token(), verifyReply("SUCCESS"));
      expect(await gw.verifyWebhookSignature({ headers: { ...headers, "paypal-transmission-sig": null }, rawBody, webhookId: "WID1" })).toBe(false);
      expect(sent).toBe("");
    });
  });
});
