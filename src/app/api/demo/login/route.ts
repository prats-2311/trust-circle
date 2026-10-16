import { getContainer } from "@/server/container";
import { DEMO_PERSONAS, homeFor, isPersona } from "@/server/demo";
import { badBody, errorResponse, readJsonObject } from "@/server/http";
import { SESSION_TTL_MS, signSession } from "@/server/session";

// Demo mode: pick one of the seeded accounts by name. There is no other way to sign in.
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  if (!body || !isPersona(body.as)) return badBody();
  try {
    const user = await getContainer().circle.getUserByEmail(DEMO_PERSONAS[body.as]);
    if (!user) return Response.json({ error: "The demo accounts aren't set up yet." }, { status: 404 });
    const token = signSession(user.id, getContainer().env.SESSION_SECRET);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return Response.json(
      { home: homeFor(body.as) },
      {
        headers: {
          "Set-Cookie": `tc_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
