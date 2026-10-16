"use client";
import { AllCommunityModule, ModuleRegistry, type CellKeyDownEvent, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { DashboardRow, DashboardStatus } from "@/dashboard/dashboardService";
import { gridTheme } from "../../gridTheme";
import { useElementWidth } from "../../useElementWidth";

ModuleRegistry.registerModules([AllCommunityModule]);

const NARROW_PX = 700;

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
    <span style={{ ...style, borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 16 }} data-testid={`status-${p.data.status}`}>
      {p.data.statusLabel}
    </span>
  );
}

const shortDate = (v: unknown) => new Date(v as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function DashboardGrid({ rows }: { rows: DashboardRow[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DashboardRow | null>(null);
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const narrow = width !== null && width < NARROW_PX;
  const oneSender = rows.every((r) => r.senderName === rows[0]?.senderName);

  const columns = useMemo<ColDef<DashboardRow>[]>(() => {
    const cols: ColDef<DashboardRow>[] = [
      { headerName: "Status", field: "statusLabel", width: 150, pinned: "left", cellRenderer: StatusChip },
      { headerName: "When", field: "createdAt", width: 110, sort: "desc", valueFormatter: (p) => shortDate(p.value) },
    ];
    if (!oneSender && !narrow) cols.push({ headerName: "From", field: "senderName", width: 130 });
    cols.push(
      { headerName: "To", field: "payee", flex: 1, minWidth: narrow ? 180 : 220 },
      { headerName: "Amount", field: "amountCents", width: 120, type: "rightAligned", valueFormatter: (p) => formatUsd(p.value as number) },
    );
    if (!narrow) {
      cols.push(
        { headerName: "Type", field: "scamTypeLabel", width: 220 },
        {
          headerName: "Why",
          field: "reasons",
          width: 360,
          valueGetter: (p) => p.data?.reasons[0] ?? "",
          tooltipValueGetter: (p) => p.data?.reasons.join(" ") ?? "",
        },
      );
    }
    return cols;
  }, [narrow, oneSender]);

  const onKey = (e: CellKeyDownEvent<DashboardRow>) => {
    const ke = e.event as KeyboardEvent | null;
    if (ke?.key === "Enter" && e.data) setSelected(e.data);
  };

  return (
    <section aria-label="Payments in your circle">
      <label htmlFor="grid-search" style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
        Search payments
      </label>
      <input
        id="grid-search"
        className="tc-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ height: 48, fontSize: 16, padding: "0 14px", borderRadius: 14, border: "2px solid #D9DFDB", width: "100%", maxWidth: 420, marginBottom: 16, boxSizing: "border-box" }}
      />
      <div ref={ref}>
        <AgGridReact<DashboardRow>
          theme={gridTheme}
          rowData={rows}
          columnDefs={columns}
          quickFilterText={search}
          domLayout="autoHeight"
          getRowId={(p) => p.data.id}
          tooltipShowDelay={300}
          onRowClicked={(e) => e.data && setSelected(e.data)}
          onCellKeyDown={onKey}
        />
      </div>
      {selected && (
        <div role="region" aria-label="Payment details" data-testid="payment-details" style={{ marginTop: 16, padding: 20, background: "#FFFFFF", border: "1px solid #D9DFDB", borderRadius: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 12px" }}>Payment details</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", margin: 0, fontSize: 16 }}>
            <dt style={{ fontWeight: 700 }}>From</dt>
            <dd style={{ margin: 0 }}>{selected.senderName}</dd>
            <dt style={{ fontWeight: 700 }}>To</dt>
            <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{selected.payee}</dd>
            <dt style={{ fontWeight: 700 }}>Amount</dt>
            <dd style={{ margin: 0 }}>{formatUsd(selected.amountCents)}</dd>
            <dt style={{ fontWeight: 700 }}>Status</dt>
            <dd style={{ margin: 0 }}>{selected.statusLabel}</dd>
            <dt style={{ fontWeight: 700 }}>Type</dt>
            <dd style={{ margin: 0 }}>{selected.scamTypeLabel}</dd>
          </dl>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "16px 0 6px" }}>Why</h3>
          {selected.reasons.length === 0 ? (
            <p style={{ margin: 0 }}>No warning signs were found.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {selected.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ marginTop: 16, minHeight: 44, minWidth: 44, padding: "0 20px", fontSize: 16, fontWeight: 700, borderRadius: 14, border: "2px solid #1E5A47", background: "#FFFFFF", color: "#1E5A47", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
