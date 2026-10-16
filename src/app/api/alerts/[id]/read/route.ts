import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const ok = await getContainer().alerts.markRead(id, userId);
    return ok ? Response.json({ ok: true }) : Response.json({ error: "Alert not found." }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
