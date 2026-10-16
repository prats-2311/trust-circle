import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function PUT(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body || typeof body.safeWord !== "string") return badBody();
    await getContainer().verification.setSafeWord({ userId, safeWord: body.safeWord });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
