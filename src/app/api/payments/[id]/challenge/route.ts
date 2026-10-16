import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const body = await readJsonObject(req);
    if (!body) return badBody();
    const { verification } = getContainer();
    if (body.method === "safe_word" && typeof body.said === "string") {
      return Response.json(await verification.challenge({ paymentId: id, senderId: userId, method: "safe_word", said: body.said }));
    }
    if (body.method === "memory_question" && (body.outcome === "answered" || body.outcome === "excuse")) {
      return Response.json(await verification.challenge({ paymentId: id, senderId: userId, method: "memory_question", outcome: body.outcome }));
    }
    return badBody();
  } catch (e) {
    return errorResponse(e);
  }
}
