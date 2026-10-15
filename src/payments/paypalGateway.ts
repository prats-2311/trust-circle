import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import { centsToPayPalValue, requestId } from "./money";

export interface PayPalGateway {
  createAuthorizeOrder(a: { paymentId: string; amountCents: number }): Promise<{ orderId: string }>;
  authorizeOrder(a: { paymentId: string; orderId: string }): Promise<{ authorizationId: string }>;
  captureAuthorization(a: { paymentId: string; authorizationId: string }): Promise<{ captureId: string }>;
  voidAuthorization(a: { paymentId: string; authorizationId: string }): Promise<void>;
  sendPayout(a: { paymentId: string; receiver: string; amountCents: number }): Promise<{ payoutBatchId: string }>;
  refundCapture(a: { paymentId: string; captureId: string }): Promise<{ refundId: string }>;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issue: string | undefined,
    readonly debugId: string | undefined,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

interface ErrorBody {
  details?: { issue?: string }[];
  debug_id?: string;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toPayPalError(e: unknown, op: string): PayPalError {
  if (e instanceof PayPalError) return e;
  if (e instanceof ApiError) {
    const raw: unknown = typeof e.body === "string" ? safeJson(e.body) : e.body;
    const body = (raw && typeof raw === "object" ? raw : undefined) as ErrorBody | undefined;
    return new PayPalError(`${op} failed`, e.statusCode, body?.details?.[0]?.issue, body?.debug_id);
  }
  return new PayPalError(`${op} failed`, 0, undefined, undefined);
}

export function createPayPalGateway(opts: { clientId: string; clientSecret: string; baseUrl?: string }): PayPalGateway {
  const base = opts.baseUrl ?? SANDBOX_BASE;
  const client = new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: opts.clientId, oAuthClientSecret: opts.clientSecret },
    environment: base.includes("sandbox") ? Environment.Sandbox : Environment.Production,
    timeout: 15000,
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);

  let cached: { token: string; expiresAt: number } | undefined;
  async function restToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new PayPalError("token failed", res.status, undefined, undefined);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return cached.token;
  }

  return {
    async createAuthorizeOrder({ paymentId, amountCents }) {
      try {
        const { result } = await orders.createOrder({
          paypalRequestId: requestId(paymentId, "create"),
          body: {
            intent: CheckoutPaymentIntent.Authorize,
            purchaseUnits: [{ referenceId: paymentId, amount: { currencyCode: "USD", value: centsToPayPalValue(amountCents) } }],
            paymentSource: {
              paypal: {
                experienceContext: {
                  brandName: "Trust Circle",
                  shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
                  userAction: PaypalExperienceUserAction.Continue,
                },
              },
            },
          },
        });
        if (!result.id) throw new PayPalError("create order returned no id", 0, undefined, undefined);
        return { orderId: result.id };
      } catch (e) {
        throw toPayPalError(e, "createAuthorizeOrder");
      }
    },

    async authorizeOrder({ paymentId, orderId }) {
      try {
        const { result } = await orders.authorizeOrder({ id: orderId, paypalRequestId: requestId(paymentId, "authorize") });
        const id = result.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;
        if (!id) throw new PayPalError("authorize returned no authorization id", 0, undefined, undefined);
        return { authorizationId: id };
      } catch (e) {
        throw toPayPalError(e, "authorizeOrder");
      }
    },

    async captureAuthorization({ paymentId, authorizationId }) {
      try {
        const { result } = await payments.captureAuthorizedPayment({
          authorizationId,
          paypalRequestId: requestId(paymentId, "capture"),
          body: { finalCapture: true },
        });
        if (!result.id) throw new PayPalError("capture returned no id", 0, undefined, undefined);
        return { captureId: result.id };
      } catch (e) {
        throw toPayPalError(e, "captureAuthorization");
      }
    },

    async voidAuthorization({ paymentId, authorizationId }) {
      try {
        await payments.voidPayment({ authorizationId, paypalRequestId: requestId(paymentId, "void") });
      } catch (e) {
        throw toPayPalError(e, "voidAuthorization");
      }
    },

    async sendPayout({ paymentId, receiver, amountCents }) {
      const id = requestId(paymentId, "payout");
      let res: Response;
      try {
        res = await fetch(`${base}/v1/payments/payouts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await restToken()}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": id,
          },
          body: JSON.stringify({
            sender_batch_header: { sender_batch_id: id, email_subject: "You have received money via Trust Circle" },
            items: [
              {
                recipient_type: receiver.includes("@") ? "EMAIL" : "PHONE",
                receiver,
                amount: { value: centsToPayPalValue(amountCents), currency: "USD" },
                sender_item_id: paymentId,
              },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        throw toPayPalError(e, "sendPayout");
      }
      const json = (await res.json().catch(() => ({}))) as ErrorBody & { batch_header?: { payout_batch_id?: string } };
      if (!res.ok || !json.batch_header?.payout_batch_id) {
        throw new PayPalError("sendPayout failed", res.status, json.details?.[0]?.issue, json.debug_id);
      }
      return { payoutBatchId: json.batch_header.payout_batch_id };
    },

    async refundCapture({ paymentId, captureId }) {
      try {
        const { result } = await payments.refundCapturedPayment({ captureId, paypalRequestId: requestId(paymentId, "refund") });
        if (!result.id) throw new PayPalError("refund returned no id", 0, undefined, undefined);
        return { refundId: result.id };
      } catch (e) {
        throw toPayPalError(e, "refundCapture");
      }
    },
  };
}
