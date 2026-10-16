import { isUuid } from "@/domain/ids";
import { NotAllowedError } from "@/payments/paymentService";
import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { toContactView } from "@/server/paymentView";

/** One payment, for a person in the sender's circle only. Anyone else (or a bad id) gets the same 403. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new NotAllowedError("Payment not found");
    const { repo, circle } = getContainer();
    const p = await repo.get(id);
    if (!p || !(await repo.isContactFor(userId, p.senderId))) throw new NotAllowedError("Payment not found");
    const sender = await circle.getUser(p.senderId);
    return Response.json({ payment: toContactView(p), senderName: sender?.displayName ?? "Someone in your circle" });
  } catch (e) {
    return errorResponse(e);
  }
}
