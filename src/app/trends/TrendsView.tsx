"use client";
import { AllCommunityModule as GridModules, ModuleRegistry as GridRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule as ChartModules, ModuleRegistry as ChartRegistry, type AgCartesianChartOptions } from "ag-charts-community";
import { toChartRows, toTotalsRows } from "@/dashboard/chartData";
import type { Trends } from "@/dashboard/dashboardService";
import { gridTheme } from "../gridTheme";
import { useElementWidth } from "../useElementWidth";

GridRegistry.registerModules([GridModules]);
ChartRegistry.registerModules(ChartModules);

// Distinct hues; names are always shown in text too.
const FILLS = ["#1E5A47", "#2C5C8F", "#C27C0E", "#A2302A", "#6A4C93", "#3E8FB0", "#7A5C3A", "#6B6B6B"];
const LEGEND_MIN_PX = 640;

type TotalsRow = ReturnType<typeof toTotalsRows>[number] & { fill: string };

function LabelWithSwatch(p: ICellRendererParams<TotalsRow>) {
  if (!p.data) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, background: p.data.fill, flex: "none" }} />
      {p.data.label}
    </span>
  );
}

export function TrendsView({ trends }: { trends: Trends }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const showLegend = width === null || width >= LEGEND_MIN_PX;
  const options: AgCartesianChartOptions = {
    data: toChartRows(trends),
    background: { fill: "#FFFFFF" },
    series: trends.series.map((s, i) => ({ type: "bar", xKey: "week", yKey: s.scamType, yName: s.label, stacked: true, fill: FILLS[i % FILLS.length] })),
    legend: { enabled: showLegend, position: "bottom" },
    axes: {
      x: { type: "category", position: "bottom" },
      y: { type: "number", position: "left", title: { text: "Reports" } },
    },
  };
  const rows: TotalsRow[] = toTotalsRows(trends).map((r, i) => ({ ...r, fill: FILLS[i % FILLS.length]! }));
  const columns: ColDef<TotalsRow>[] = [
    { headerName: "Scam type", field: "label", flex: 2, minWidth: 220, cellRenderer: LabelWithSwatch },
    { headerName: "Last 4 weeks", field: "lastFourWeeks", flex: 1, minWidth: 150, type: "rightAligned", sort: "desc" },
    { headerName: "Last 12 weeks", field: "total", flex: 1, minWidth: 150, type: "rightAligned" },
  ];
  const top = [...trends.series].sort((a, b) => b.total - a.total)[0];
  const summary = `Bar chart of scam reports per week for the last 12 weeks.${top ? ` Most reported: ${top.label}, ${top.total} reports.` : ""}`;
  return (
    <>
      <div ref={ref} data-testid="trends-chart" role="img" aria-label={summary} style={{ height: 420, borderRadius: 20, overflow: "hidden", background: "#FFFFFF" }}>
        <AgCharts options={options} style={{ height: "100%", width: "100%" }} />
      </div>
      <div style={{ marginTop: 24 }}>
        <AgGridReact theme={gridTheme} rowData={rows} columnDefs={columns} domLayout="autoHeight" />
      </div>
    </>
  );
}
