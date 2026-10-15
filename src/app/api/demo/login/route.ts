import { getContainer } from "@/server/container";
import { signSession } from "@/server/session";

// Demo only: Plan 4 replaces this with Auth.js.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  if (typeof body.userId !== "string" || !body.userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }
  const token = signSession(body.userId, getContainer().env.SESSION_SECRET);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": `tc_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}` },
  });
}
