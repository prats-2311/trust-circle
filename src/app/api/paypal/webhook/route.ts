import { getContainer } from "@/server/container";
import { WebhookFailedError } from "@/webhooks/webhookService";

const MAX_ATTEMPTS = 5;

const MAX_BODY_BYTES = 256 * 1024;
const SIGNATURE_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

/** Reads the body in chunks and gives up as soon as it passes the cap, whatever the headers claim. Null means too large. */
async function readCapped(req: Request): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const invalid = () => Response.json({ error: "Invalid signature." }, { status: 400 });

export async function POST(req: Request) {
  const { env, gateway, webhooks } = getContainer();
  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return Response.json({ error: "Webhooks aren't set up." }, { status: 503 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });
  const rawBody = await readCapped(req);
  if (rawBody === null) return Response.json({ error: "Too large." }, { status: 413 });

  const headers: Record<string, string | null> = {};
  for (const name of SIGNATURE_HEADERS) headers[name] = req.headers.get(name);
  if (SIGNATURE_HEADERS.some((name) => !headers[name])) return invalid();

  let verified = false;
  try {
    verified = await gateway.verifyWebhookSignature({ headers, rawBody, webhookId });
  } catch {
    verified = false;
  }
  if (!verified) return invalid();

  const ignored = () => Response.json({ result: "ignored" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return ignored();
  }
  const event = parsed as { id?: unknown; event_type?: unknown; resource?: unknown } | null;
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.id !== "string" || typeof event.event_type !== "string") {
    return ignored();
  }
  const { id, event_type: type } = event;

  // Below the cap a failure answers 500 so PayPal redelivers; at the cap it answers 200 so a poisoned event stops.
  const retryOrGiveUp = (attempts: number, errorName: string) => {
    console.warn("paypal webhook failed", { type, id, errorName, attempts });
    return attempts < MAX_ATTEMPTS ? Response.json({ error: "Try again." }, { status: 500 }) : Response.json({ result: "failed" });
  };
  try {
    const { result, attempts } = await webhooks.handle({ id, event_type: type, resource: event.resource });
    if (result === "deferred") {
      // A deferral only waits for the sweep to settle the payout, so it is always redelivered (PayPal caps retries at 25 over 3 days).
      console.info("paypal webhook", { type, id, result, attempts });
      return Response.json({ error: "Try again." }, { status: 500 });
    }
    console.info("paypal webhook", { type, id, result });
    return Response.json({ result });
  } catch (e) {
    if (e instanceof WebhookFailedError) return retryOrGiveUp(e.attempts, e.errorName);
    // A plain error: the claim or the processed-mark failed in the store. The event is not marked processed, so a redelivery is safe.
    console.warn("paypal webhook failed", { type, id, errorName: e instanceof Error ? e.name : "unknown" });
    return Response.json({ error: "Try again." }, { status: 500 });
  }
}
