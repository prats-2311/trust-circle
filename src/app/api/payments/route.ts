import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = (await req.json()) as { payee: string; amountCents: number; note?: string; senderAnswer?: string };
    const { payment, decision } = await getContainer().service.start({
      senderId: userId,
      payee: body.payee,
      amountCents: body.amountCents,
      note: body.note,
      senderAnswer: body.senderAnswer,
    });
    return Response.json({
      paymentId: payment.id,
      orderId: payment.paypalOrderId,
      risk: { level: decision.level, scamType: decision.scamType, reasons: decision.reasons },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    return Response.json(await getContainer().repo.listBySender(userId));
  } catch (e) {
    return errorResponse(e);
  }
}
