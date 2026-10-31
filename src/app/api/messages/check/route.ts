import { getContainer } from "@/server/container";
import { parseCheckRequest, tooLargeMessage } from "@/server/checkRequest";
import { badBody, currentUserId, errorResponse } from "@/server/http";
import { toMessageCheckView } from "@/server/messageView";

export async function POST(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
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
