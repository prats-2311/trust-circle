import { isUuid } from "@/domain/ids";
import { NotAllowedError } from "@/payments/paymentService";
import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

const MIN_GAP_MS = 60_000;
// One review per person per minute. In memory: a restart resets it, which is fine for a courtesy limit.
const lastRun = new Map<string, number>();

export async function POST(req: Request) {
  const contactId = currentUserId(req);
  if (!contactId) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = await readJsonObject(req);
  const senderId = body?.senderId;
  if (typeof senderId !== "string" || !isUuid(senderId)) return badBody();

  const now = Date.now();
  const last = lastRun.get(contactId);
  if (last !== undefined && now - last < MIN_GAP_MS) {
    return Response.json({ error: "Please wait a minute before running another review." }, { status: 429 });
  }
  lastRun.set(contactId, now);
  try {
    return Response.json(await getContainer().aftercare.review({ contactId, senderId }));
  } catch (e) {
    // A refused attempt did nothing, so it doesn't use up the minute.
    if (e instanceof NotAllowedError) lastRun.delete(contactId);
    return errorResponse(e);
  }
}
