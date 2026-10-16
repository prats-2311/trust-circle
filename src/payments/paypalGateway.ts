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
  /** True only when PayPal itself says the signature is valid. Any other answer or failure is false. */
  verifyWebhookSignature(a: { headers: Record<string, string | null>; rawBody: string; webhookId: string }): Promise<boolean>;
}

/**
 * uncertain = money may or may not have moved; retry with the same request id,
 * never compensate (refund/void) on an uncertain error.
 */
export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issue: string | undefined,
    readonly debugId: string | undefined,
    readonly uncertain: boolean = false,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const TIMEOUT_MS = 15000;

function assertSandboxBase(baseUrl: string): string {
  let origin: string | undefined;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    origin = undefined;
  }
  if (origin !== SANDBOX_BASE) throw new Error(`baseUrl must be the PayPal sandbox origin ${SANDBOX_BASE}`);
  return origin;
}

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
    return new PayPalError(`${op} failed`, e.statusCode, body?.details?.[0]?.issue, body?.debug_id, e.statusCode >= 500);
  }
  return new PayPalError(`${op} failed`, 0, undefined, undefined, true);
}

export function createPayPalGateway(opts: { clientId: string; clientSecret: string; baseUrl?: string }): PayPalGateway {
  const base = opts.baseUrl === undefined ? SANDBOX_BASE : assertSandboxBase(opts.baseUrl);
  const client = new Client({
    clientCredentialsAuthCredentials: { oAuthClientId: opts.clientId, oAuthClientSecret: opts.clientSecret },
    environment: Environment.Sandbox,
    timeout: TIMEOUT_MS,
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);

  let cached: { token: string; expiresAt: number } | undefined;
  async function restToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    let res: Response;
    try {
      res = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new PayPalError("token failed", 0, undefined, undefined);
    }
    if (!res.ok) throw new PayPalError("token failed", res.status, undefined, undefined);
    const json = (await res.json().catch(() => undefined)) as { access_token?: unknown; expires_in?: unknown } | undefined;
    if (typeof json?.access_token !== "string" || typeof json.expires_in !== "number") {
      throw new PayPalError("token response malformed", res.status, undefined, undefined);
    }
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
            purchaseUnits: [{ referenceId: paymentId, customId: paymentId, amount: { currencyCode: "USD", value: centsToPayPalValue(amountCents) } }],
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
        if (!id) throw new PayPalError("authorize returned no authorization id", 0, undefined, undefined, true);
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
        if (!result.id) throw new PayPalError("capture returned no id", 0, undefined, undefined, true);
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
      const body = JSON.stringify({
        sender_batch_header: { sender_batch_id: id, email_subject: "You have received money via Trust Circle" },
        items: [
          {
            recipient_type: receiver.includes("@") ? "EMAIL" : "PHONE",
            receiver,
            amount: { value: centsToPayPalValue(amountCents), currency: "USD" },
            sender_item_id: paymentId,
          },
        ],
      });
      const post = async (): Promise<Response> => {
        const token = await restToken();
        try {
          return await fetch(`${base}/v1/payments/payouts`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": id },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch {
          throw new PayPalError("sendPayout failed", 0, undefined, undefined, true);
        }
      };
      let res = await post();
      if (res.status === 401) {
        cached = undefined;
        res = await post();
      }
      const json = (await res.json().catch(() => ({}))) as ErrorBody & { batch_header?: { payout_batch_id?: string } };
      const batchId = json.batch_header?.payout_batch_id;
      if (res.ok && batchId) return { payoutBatchId: batchId };
      throw new PayPalError("sendPayout failed", res.status, json.details?.[0]?.issue, json.debug_id, res.ok || res.status >= 500);
    },

    async verifyWebhookSignature({ headers, rawBody, webhookId }) {
      const header = (name: string) => headers[name] ?? null;
      const fields = ["auth-algo", "cert-url", "transmission-id", "transmission-sig", "transmission-time"].map((n) => header(`paypal-${n}`));
      if (fields.some((f) => !f)) return false;
      const [authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime] = fields;
      // The raw body is spliced in as the event: re-serialising it can change the bytes PayPal signed.
      const body =
        `{"auth_algo":${JSON.stringify(authAlgo)},"cert_url":${JSON.stringify(certUrl)},` +
        `"transmission_id":${JSON.stringify(transmissionId)},"transmission_sig":${JSON.stringify(transmissionSig)},` +
        `"transmission_time":${JSON.stringify(transmissionTime)},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody}}`;
      const post = async (): Promise<Response> => {
        const token = await restToken();
        return fetch(`${base}/v1/notifications/verify-webhook-signature`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      };
      try {
        let res = await post();
        if (res.status === 401) {
          cached = undefined;
          res = await post();
        }
        if (!res.ok) return false;
        const json = (await res.json().catch(() => undefined)) as { verification_status?: unknown } | undefined;
        return json?.verification_status === "SUCCESS";
      } catch {
        return false;
      }
    },

    async refundCapture({ paymentId, captureId }) {
      try {
        const { result } = await payments.refundCapturedPayment({ captureId, paypalRequestId: requestId(paymentId, "refund") });
        if (!result.id) throw new PayPalError("refund returned no id", 0, undefined, undefined, true);
        return { refundId: result.id };
      } catch (e) {
        throw toPayPalError(e, "refundCapture");
      }
    },
  };
}
