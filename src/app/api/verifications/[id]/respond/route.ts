import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    const body = await readJsonObject(req);
    if (!body || (body.answer !== "me" && body.answer !== "not_me")) return badBody();
    return Response.json(await getContainer().verification.respond({ verificationId: id, responderId: userId, answer: body.answer }));
  } catch (e) {
    return errorResponse(e);
  }
}
