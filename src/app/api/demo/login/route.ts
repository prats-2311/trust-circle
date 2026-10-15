import { getContainer } from "@/server/container";
import { badBody, errorResponse, readJsonObject } from "@/server/http";
import { signSession } from "@/server/session";

// Demo only: Plan 4 replaces this with Auth.js.
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  if (!body) return badBody();
  const userId = body.userId;
  if (typeof userId !== "string" || !userId) return badBody();
  try {
    if (!(await getContainer().repo.userExists(userId))) {
      return Response.json({ error: "Unknown demo user." }, { status: 404 });
    }
  } catch (e) {
    return errorResponse(e);
  }
  const token = signSession(userId, getContainer().env.SESSION_SECRET);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": `tc_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}` },
  });
}
