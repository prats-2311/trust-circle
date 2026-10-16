"use client";
import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { DashboardRow, DashboardStatus } from "@/dashboard/dashboardService";
import { gridTheme } from "../../gridTheme";

ModuleRegistry.registerModules([AllCommunityModule]);

const STATUS_STYLE: Record<DashboardStatus, { background: string; color: string }> = {
  sent: { background: "#E3EDE8", color: "#14402F" },
  on_hold: { background: "#E6EEF7", color: "#24456B" },
  stopped: { background: "#F8E5E3", color: "#8A231E" },
  hold_ended: { background: "#EEF1EF", color: "#3F4B46" },
  refunded: { background: "#FBF0DC", color: "#6E4300" },
  in_progress: { background: "#EEF1EF", color: "#3F4B46" },
};

function StatusChip(p: ICellRendererParams<DashboardRow>) {
  if (!p.data) return null;
  const style = STATUS_STYLE[p.data.status];
  return (
    <span style={{ ...style, borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 15 }} data-testid={`status-${p.data.status}`}>
      {p.data.statusLabel}
    </span>
  );
}

export function DashboardGrid({ rows }: { rows: DashboardRow[] }) {
  const [search, setSearch] = useState("");
  const columns = useMemo<ColDef<DashboardRow>[]>(
    () => [
      {
        headerName: "When",
        field: "createdAt",
        width: 140,
        sort: "desc",
        valueFormatter: (p) => new Date(p.value as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      },
      { headerName: "From", field: "senderName", width: 130 },
      { headerName: "To", field: "payee", flex: 1, minWidth: 200 },
      { headerName: "Amount", field: "amountCents", width: 130, type: "rightAligned", valueFormatter: (p) => formatUsd(p.value as number) },
      { headerName: "Status", field: "statusLabel", width: 150, cellRenderer: StatusChip },
      { headerName: "Type", field: "scamTypeLabel", width: 220 },
      { headerName: "Why", field: "reasons", flex: 2, minWidth: 260, wrapText: true, autoHeight: true, valueFormatter: (p) => (p.value as string[]).join(" ") },
    ],
    [],
  );
  return (
    <section aria-label="Payments in your circle">
      <label htmlFor="grid-search" style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
        Search payments
      </label>
      <input
        id="grid-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ height: 48, fontSize: 16, padding: "0 14px", borderRadius: 14, border: "2px solid #D9DFDB", width: "100%", maxWidth: 420, marginBottom: 16 }}
      />
      <AgGridReact<DashboardRow>
        theme={gridTheme}
        rowData={rows}
        columnDefs={columns}
        quickFilterText={search}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
      />
    </section>
  );
}
