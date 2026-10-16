import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySettingsRepo } from "@/settings/settingsRepo";
import { createSettingsService } from "@/settings/settingsService";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const U = "11111111-1111-4111-8111-111111111111";

let container: unknown;
let finish: ReturnType<typeof vi.fn>;
vi.mock("@/server/container", () => ({ getContainer: () => container }));
import { PUT } from "./route";

beforeEach(() => {
  const settings = createSettingsService({
    repo: createMemorySettingsRepo({ [U]: { preset: "family", coolingOffHours: 24, onboardedAt: null } }),
    now: () => new Date("2026-10-16T10:00:00Z"),
  });
  const real = settings.finishOnboarding;
  finish = vi.fn(real);
  container = { settings: { ...settings, finishOnboarding: finish }, env: { SESSION_SECRET: SECRET } };
});

const call = (body: unknown, userId?: string) =>
  PUT(
    new Request("http://x/api/me/settings", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: userId ? { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } : {},
    }),
  );

describe("PUT /api/me/settings", () => {
  it("answers 401 without a session", async () => {
    expect((await call({ preset: "solo" })).status).toBe(401);
  });
  it("answers 400 for a cooling-off outside the choices", async () => {
    const res = await call({ coolingOffHours: 72 }, U);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please choose 12, 24 or 48 hours." });
  });
  it("answers 400 for an unknown preset", async () => {
    const res = await call({ preset: "x" }, U);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please choose Family, Business or Just me." });
  });
  it("answers 400 for a preset that is not a string", async () => {
    const res = await call({ preset: ["family"] }, U);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Please choose Family, Business or Just me." });
  });
  it("answers 200 with the view for a preset", async () => {
    const res = await call({ preset: "solo" }, U);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ preset: "solo", coolingOffHours: 24, circleLimitCents: null, onboarded: false });
  });
  it("applies preset then cooling-off", async () => {
    const res = await call({ preset: "business", coolingOffHours: 48 }, U);
    expect(await res.json()).toMatchObject({ preset: "business", coolingOffHours: 48, circleLimitCents: 250000 });
  });
  it("onboarded: true finishes onboarding", async () => {
    const res = await call({ onboarded: true }, U);
    expect(finish).toHaveBeenCalledWith(U);
    expect(await res.json()).toMatchObject({ onboarded: true });
  });
  it("answers 400 for a malformed body", async () => {
    expect((await call([1], U)).status).toBe(400);
  });
});
