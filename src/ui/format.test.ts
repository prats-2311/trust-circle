import { beforeAll, describe, expect, it } from "vitest";
import { formatDay, formatDayTime, formatTime, formatWhen } from "./format";

const AT = "2026-10-16T13:59:00Z";

describe("format", () => {
  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  it("formats a day", () => expect(formatDay(AT)).toBe("Friday, Oct 16"));
  it("formats a time", () => expect(formatTime(AT)).toBe("1:59 PM"));
  it("formats a day and time", () => expect(formatDayTime(new Date(AT))).toBe("Friday, Oct 16 at 1:59 PM"));
  it("says Today for the same day", () => expect(formatWhen(AT, new Date("2026-10-16T20:00:00Z"))).toBe("Today at 1:59 PM"));
  it("says Yesterday for the day before", () => expect(formatWhen(AT, new Date("2026-10-17T08:00:00Z"))).toBe("Yesterday at 1:59 PM"));
  it("falls back to the full day after that", () => expect(formatWhen(AT, new Date("2026-10-21T08:00:00Z"))).toBe("Friday, Oct 16 at 1:59 PM"));
});
