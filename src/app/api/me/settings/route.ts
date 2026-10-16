import type { Preset } from "@/domain/types";
import { getContainer } from "@/server/container";
import { badBody, currentUserId, errorResponse, readJsonObject } from "@/server/http";

export async function PUT(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await readJsonObject(req);
    if (!body) return badBody();
    const { settings } = getContainer();
    if (body.preset !== undefined) await settings.choosePreset(userId, body.preset as Preset);
    if (body.coolingOffHours !== undefined) await settings.setCoolingOff(userId, body.coolingOffHours as number);
    if (body.onboarded === true) await settings.finishOnboarding(userId);
    const s = await settings.get(userId);
    return Response.json({ ...s, onboarded: s.onboardedAt !== null });
  } catch (e) {
    return errorResponse(e);
  }
}
