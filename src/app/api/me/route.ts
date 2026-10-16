import { getContainer } from "@/server/container";
import { personaForEmail } from "@/server/demo";
import { currentUserId, errorResponse } from "@/server/http";

export async function GET(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const { circle } = getContainer();
    const me = await circle.getUser(userId);
    if (!me) return Response.json({ error: "Please sign in." }, { status: 401 });
    const [contacts, senders] = await Promise.all([circle.contactsOf(userId), circle.sendersOf(userId)]);
    return Response.json({
      id: me.id,
      displayName: me.displayName,
      persona: personaForEmail(me.email),
      circle: contacts.map((c) => ({ displayName: c.displayName, relationship: c.relationship })),
      lookingAfter: senders.map((s) => ({ displayName: s.displayName, relationship: s.relationship })),
      safeWordSet: me.safeWordHash !== null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
