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

const invalid = () => Response.json({ error: "Invalid signature." }, { status: 400 });

export async function POST(req: Request) {
  const { env, gateway, webhooks } = getContainer();
  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return Response.json({ error: "Webhooks aren't set up." }, { status: 503 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return Response.json({ error: "Too large." }, { status: 413 });

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
    if (result === "deferred") return retryOrGiveUp(attempts, "Deferred");
    console.info("paypal webhook", { type, id, result });
    return Response.json({ result });
  } catch (e) {
    if (e instanceof WebhookFailedError) return retryOrGiveUp(e.attempts, e.errorName);
    // Nothing was claimed (the store itself failed), so a redelivery is safe.
    console.warn("paypal webhook failed", { type, id, errorName: e instanceof Error ? e.name : "unknown" });
    return Response.json({ error: "Try again." }, { status: 500 });
  }
}
