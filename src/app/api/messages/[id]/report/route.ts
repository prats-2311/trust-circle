import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    return Response.json(await getContainer().reports.reportCheck({ checkId: id, reporterId: userId }));
  } catch (e) {
    return errorResponse(e);
  }
}
