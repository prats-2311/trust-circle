"use client";
import { AllCommunityModule as GridModules, ModuleRegistry as GridRegistry, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule as ChartModules, ModuleRegistry as ChartRegistry, type AgCartesianChartOptions } from "ag-charts-community";
import { toChartRows, toTotalsRows } from "@/dashboard/chartData";
import type { Trends } from "@/dashboard/dashboardService";
import { gridTheme } from "../gridTheme";

GridRegistry.registerModules([GridModules]);
ChartRegistry.registerModules(ChartModules);

// One calm, colour-blind-safe palette; the legend and table carry the names.
const FILLS = ["#1E5A47", "#2C5C8F", "#B07A1E", "#A2302A", "#5E4B8B", "#3F4B46", "#7A8F3A", "#2F7F86"];

export function TrendsView({ trends }: { trends: Trends }) {
  const options: AgCartesianChartOptions = {
    data: toChartRows(trends),
    background: { fill: "#FFFFFF" },
    series: trends.series.map((s, i) => ({ type: "bar", xKey: "week", yKey: s.scamType, yName: s.label, stacked: true, fill: FILLS[i % FILLS.length] })),
    legend: { position: "bottom" },
    axes: {
      x: { type: "category", position: "bottom" },
      y: { type: "number", position: "left", title: { text: "Reports" } },
    },
  };
  const columns: ColDef<ReturnType<typeof toTotalsRows>[number]>[] = [
    { headerName: "Scam type", field: "label", flex: 2, minWidth: 220 },
    { headerName: "Last 4 weeks", field: "lastFourWeeks", flex: 1, minWidth: 150, type: "rightAligned", sort: "desc" },
    { headerName: "Last 12 weeks", field: "total", flex: 1, minWidth: 150, type: "rightAligned" },
  ];
  return (
    <>
      <div data-testid="trends-chart" style={{ height: 420, borderRadius: 20, overflow: "hidden", background: "#FFFFFF" }}>
        <AgCharts options={options} />
      </div>
      <div style={{ marginTop: 24 }}>
        <AgGridReact theme={gridTheme} rowData={toTotalsRows(trends)} columnDefs={columns} domLayout="autoHeight" />
      </div>
    </>
  );
}
