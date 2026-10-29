import { NotAllowedError } from "@/payments/paymentService";
import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";
import { paymentOutcome, paypalVoided } from "@/server/paymentOutcome";
import { toSenderView } from "@/server/paymentView";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const { repo } = getContainer();
    const p = await repo.get(id);
    if (!p || p.senderId !== userId) throw new NotAllowedError("Payment not found");
    const audits = await repo.auditFor(p.id);
    return Response.json({ ...toSenderView(p), outcome: paymentOutcome(audits, p.senderId), paypalVoided: paypalVoided(audits) });
  } catch (e) {
    return errorResponse(e);
  }
}
