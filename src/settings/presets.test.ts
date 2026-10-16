import { describe, expect, it } from "vitest";
import { COOLING_OFF_CHOICES, PRESETS, isCoolingOffHours } from "./presets";

describe("presets", () => {
  it("every preset defaults to an allowed cooling-off", () => {
    for (const p of Object.values(PRESETS)) expect(COOLING_OFF_CHOICES).toContain(p.defaultCoolingOffHours);
  });
  it("Just me has no circle limit", () => {
    expect(PRESETS.solo.circleLimitCents).toBeNull();
  });
  it("accepts 12, 24 and 48", () => {
    for (const h of [12, 24, 48]) expect(isCoolingOffHours(h)).toBe(true);
  });
  it("rejects anything else", () => {
    for (const h of [72, 0, "24", 24.5]) expect(isCoolingOffHours(h)).toBe(false);
  });
});
