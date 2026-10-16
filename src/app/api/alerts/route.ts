import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    return Response.json(await getContainer().alerts.list(userId));
  } catch (e) {
    return errorResponse(e);
  }
}
