import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { decision?: unknown };
    const decision = body.decision;
    if (decision !== "approve" && decision !== "block") return Response.json({ error: "Invalid decision." }, { status: 400 });
    return Response.json(await getContainer().service.contactDecision({ paymentId: id, contactId: userId, decision }));
  } catch (e) {
    return errorResponse(e);
  }
}
