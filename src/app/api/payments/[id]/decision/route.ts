import { getContainer } from "@/server/container";
import { toContactView } from "@/server/paymentView";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const body = await readJsonObject(req);
    if (!body) return badBody();
    const decision = body.decision;
    if (decision !== "approve" && decision !== "block") return Response.json({ error: "Invalid decision." }, { status: 400 });
    return Response.json(
      toContactView(await getContainer().service.contactDecision({ paymentId: id, contactId: userId, decision })),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
