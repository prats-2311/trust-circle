import { getContainer } from "@/server/container";
import { toSenderView } from "@/server/paymentView";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function POST(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body) return badBody();
    const { payee, amountCents, note, senderAnswer } = body;
    if (
      typeof payee !== "string" ||
      typeof amountCents !== "number" ||
      (note !== undefined && typeof note !== "string") ||
      (senderAnswer !== undefined && typeof senderAnswer !== "string")
    ) {
      return badBody();
    }
    const { payment, decision } = await getContainer().service.start({
      senderId: userId,
      payee,
      amountCents,
      note,
      senderAnswer,
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
    return Response.json((await getContainer().repo.listBySender(userId)).map(toSenderView));
  } catch (e) {
    return errorResponse(e);
  }
}
