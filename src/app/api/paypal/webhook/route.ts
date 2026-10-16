import { getContainer } from "@/server/container";

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
  const { env, gateway, webhooks, webhookRepo } = getContainer();
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Bad event." }, { status: 400 });
  }
  const event = parsed as { id?: unknown; event_type?: unknown; resource?: unknown } | null;
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.id !== "string" || typeof event.event_type !== "string") {
    return Response.json({ error: "Bad event." }, { status: 400 });
  }
  const { id, event_type: type } = event;

  try {
    const result = await webhooks.handle({ id, event_type: type, resource: event.resource });
    console.info("paypal webhook", { type, id, result });
    return Response.json({ result });
  } catch (e) {
    // Answer 200 anyway so PayPal doesn't retry a poisoned event for days; the event stays unprocessed.
    const errorName = e instanceof Error ? e.name : "unknown";
    console.warn("paypal webhook failed", { type, id, errorName });
    try {
      await webhookRepo.markFailed(id, new Date(), errorName);
    } catch {
      // Recording the failure must never turn into a retry storm.
    }
    return Response.json({ result: "failed" });
  }
}
