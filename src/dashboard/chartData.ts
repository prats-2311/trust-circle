import { formatShortDay } from "@/ui/format";
import type { Trends } from "./dashboardService";

export function weekLabel(isoMonday: string): string {
  return formatShortDay(`${isoMonday}T00:00:00Z`, "UTC");
}

export function toChartRows(t: Trends): Record<string, string | number>[] {
  return t.weeks.map((week, i) => {
    const row: Record<string, string | number> = { week: weekLabel(week) };
    for (const s of t.series) row[s.scamType] = s.counts[i] ?? 0;
    return row;
  });
}

export function toTotalsRows(t: Trends): { label: string; total: number; lastFourWeeks: number }[] {
  return t.series.map((s) => ({ label: s.label, total: s.total, lastFourWeeks: s.counts.slice(-4).reduce((a, b) => a + b, 0) }));
}
