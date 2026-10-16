import { describe, expect, it } from "vitest";
import { toChartRows, toTotalsRows, weekLabel } from "./chartData";

const trends = {
  weeks: ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"],
  series: [
    { scamType: "impersonation_family" as const, label: "Family member in trouble", counts: [1, 0, 2, 3], total: 6 },
    { scamType: "invoice" as const, label: "Fake or changed invoice", counts: [2, 1, 0, 0], total: 3 },
  ],
  total: 9,
};

describe("chart data", () => {
  it("labels weeks by day and short month", () => {
    expect(weekLabel("2026-10-12")).toBe("Oct 12");
  });
  it("builds one row per week keyed by scam type", () => {
    expect(toChartRows(trends)[3]).toEqual({ week: "Oct 12", impersonation_family: 3, invoice: 0 });
  });
  it("totals each scam type with the last four weeks", () => {
    expect(toTotalsRows(trends)).toEqual([
      { label: "Family member in trouble", total: 6, lastFourWeeks: 6 },
      { label: "Fake or changed invoice", total: 3, lastFourWeeks: 3 },
    ]);
  });
});
