import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { toMessageCheckView } from "@/server/messageView";

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    const history = await getContainer().messages.history(userId);
    if (id) {
      const one = history.find((c) => c.id === id);
      return one ? Response.json(toMessageCheckView(one)) : Response.json({ error: "We couldn't find that check." }, { status: 404 });
    }
    return Response.json(history.map((c) => toMessageCheckView(c)));
  } catch (e) {
    return errorResponse(e);
  }
}
