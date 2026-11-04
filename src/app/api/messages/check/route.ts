import { getContainer } from "@/server/container";
import { parseCheckRequest, tooLargeMessage } from "@/server/checkRequest";
import { badBody, currentUserId, errorResponse } from "@/server/http";
import { toMessageCheckView } from "@/server/messageView";
import { clientKey, createRateLimiter } from "@/server/rateLimit";

// 20 checks per 10 minutes per visitor, so many judges on the public demo cannot use up the AI.
const limiter = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export async function POST(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!limiter.take(clientKey(req, userId))) {
    return Response.json(
      { error: "You've checked a lot of messages in the last few minutes. Please wait a little and try again." },
      { status: 429 },
    );
  }
  try {
    const parsed = await parseCheckRequest(req);
    if ("error" in parsed) {
      return parsed.error === "too_large"
        ? Response.json({ error: tooLargeMessage(parsed.field), field: parsed.field }, { status: 413 })
        : badBody();
    }
    return Response.json(toMessageCheckView(await getContainer().messages.check({ senderId: userId, ...parsed })));
  } catch (e) {
    return errorResponse(e);
  }
}
