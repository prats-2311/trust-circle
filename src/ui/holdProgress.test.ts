import { describe, expect, it } from "vitest";
import { holdProgress, timeLeftText } from "./holdProgress";

const at = (h: number) => new Date(Date.UTC(2026, 10, 1, h)).toISOString();

describe("holdProgress", () => {
  it("reports the fraction of the cooling-off period used and time left", () => {
    const p = holdProgress({ authorisedAt: at(0), coolingOffUntil: at(24), now: new Date(at(3)) });
    expect(p.fractionUsed).toBeCloseTo(3 / 24);
    expect(p.msLeft).toBe(21 * 3_600_000);
    expect(p.releaseAt?.toISOString()).toBe(at(24));
  });
  it("clamps after the release time and copes with missing dates", () => {
    expect(holdProgress({ authorisedAt: at(0), coolingOffUntil: at(24), now: new Date(at(30)) })).toMatchObject({ fractionUsed: 1, msLeft: 0 });
    expect(holdProgress({ authorisedAt: null, coolingOffUntil: null, now: new Date(at(1)) })).toEqual({ fractionUsed: 0, msLeft: 0, releaseAt: null });
  });
});

describe("timeLeftText", () => {
  it.each([
    [21 * 3_600_000, "21 hours left"],
    [3_600_000, "1 hour left"],
    [45 * 60_000, "45 minutes left"],
    [60_000, "1 minute left"],
    [0, "Ready to release"],
  ])("%d ms → %s", (ms, text) => expect(timeLeftText(ms)).toBe(text));
});
