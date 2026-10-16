import { getContainer } from "@/server/container";
import { currentUserId, errorResponse } from "@/server/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { id } = await params;
    return Response.json(await getContainer().reports.reportCheck({ checkId: id, reporterId: userId }));
  } catch (e) {
    const known = errorResponse(e);
    if (known.status !== 500) return known;
    return Response.json({ error: "We couldn't prepare your report right now. Please try again." }, { status: 500 });
  }
}
