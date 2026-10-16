import { getContainer } from "@/server/container";
import { toSenderView } from "@/server/paymentView";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    return Response.json(toSenderView(await getContainer().service.senderCancel({ paymentId: id, senderId: userId })));
  } catch (e) {
    return errorResponse(e);
  }
}
