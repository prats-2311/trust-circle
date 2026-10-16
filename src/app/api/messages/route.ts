import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { toMessageCheckView } from "@/server/messageView";

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    return Response.json((await getContainer().messages.history(userId)).map((c) => toMessageCheckView(c)));
  } catch (e) {
    return errorResponse(e);
  }
}
