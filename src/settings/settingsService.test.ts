import { describe, expect, it } from "vitest";
import { createMemorySettingsRepo, type UserSettings } from "./settingsRepo";
import { SettingsInputError, createSettingsService } from "./settingsService";

const make = (s: Partial<UserSettings> = {}) => {
  const repo = createMemorySettingsRepo({ u1: { preset: "family", coolingOffHours: 24, onboardedAt: null, ...s } });
  return createSettingsService({ repo, now: () => new Date("2026-10-16T10:00:00Z") });
};

describe("settingsService", () => {
  it("choosing a different preset applies its defaults", async () => {
    const svc = make({ coolingOffHours: 48 });
    const s = await svc.choosePreset("u1", "business");
    expect(s).toMatchObject({ preset: "business", coolingOffHours: 24 });
  });
  it("choosing the same preset again keeps a changed cooling-off", async () => {
    const svc = make({ coolingOffHours: 48 });
    expect((await svc.choosePreset("u1", "family")).coolingOffHours).toBe(48);
  });
  it("rejects an unknown preset", async () => {
    await expect(make().choosePreset("u1", "x" as never)).rejects.toThrow("Please choose Family, Business or Just me.");
  });
  it("rejects a cooling-off outside the choices", async () => {
    await expect(make().setCoolingOff("u1", 72)).rejects.toThrow(SettingsInputError);
    await expect(make().setCoolingOff("u1", 72)).rejects.toThrow("Please choose 12, 24 or 48 hours.");
  });
  it("sets a valid cooling-off", async () => {
    expect((await make().setCoolingOff("u1", 12)).coolingOffHours).toBe(12);
  });
  it("finishOnboarding sets the time once", async () => {
    const svc = make();
    const first = await svc.finishOnboarding("u1");
    const second = await svc.finishOnboarding("u1");
    expect(first.onboardedAt).toEqual(new Date("2026-10-16T10:00:00Z"));
    expect(second.onboardedAt).toEqual(first.onboardedAt);
  });
  it("coolingOffMs and circleLimitCents follow the settings", async () => {
    const svc = make({ preset: "business", coolingOffHours: 12 });
    expect(await svc.coolingOffMs("u1")).toBe(12 * 3_600_000);
    expect(await svc.circleLimitCents("u1")).toBe(250_000);
  });
  it("get includes the circle limit", async () => {
    expect(await make({ preset: "solo" }).get("u1")).toMatchObject({ preset: "solo", circleLimitCents: null });
  });
  it("an unknown user falls back to the defaults", async () => {
    const svc = make();
    expect(await svc.coolingOffMs("nobody")).toBe(24 * 3_600_000);
    expect(await svc.circleLimitCents("nobody")).toBe(50_000);
    expect(await svc.get("nobody")).toMatchObject({ preset: "family", coolingOffHours: 24, onboardedAt: null });
  });
});
