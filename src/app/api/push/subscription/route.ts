import { MAX_SUBSCRIPTIONS_PER_USER } from "@/push/pushSender";
import { parsePushSub } from "@/push/subscription";
import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function POST(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { push, env } = getContainer();
    if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
      return Response.json({ error: "Phone alerts aren't set up on this server." }, { status: 503 });
    }
    const sub = parsePushSub(await readJsonObject(req));
    if (!sub) return badBody();
    const own = await push.listForUser(userId);
    if (own.length >= MAX_SUBSCRIPTIONS_PER_USER && !own.some((s) => s.endpoint === sub.endpoint)) {
      return Response.json({ error: `This account already has notifications on ${MAX_SUBSCRIPTIONS_PER_USER} devices.` }, { status: 409 });
    }
    if ((await push.save(userId, sub, new Date())) === "conflict") {
      return Response.json({ error: "This device is already set up for alerts on another account." }, { status: 409 });
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body || typeof body.endpoint !== "string" || body.endpoint.length > 2048) return badBody();
    await getContainer().push.removeForUser(userId, body.endpoint);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
