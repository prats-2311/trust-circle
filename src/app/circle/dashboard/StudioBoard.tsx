"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { AgReportState } from "ag-studio";
import type { DashboardRow } from "@/dashboard/dashboardService";
import type { PayPalSays } from "@/dashboard/paypalSays";
import { toStudioRows } from "@/dashboard/studioSource";
import { studioWidgets } from "./studioWidgets";
import { STUDIO_SOURCE_ID, studioPreset } from "./studioPreset";
import { theme } from "./studioTheme";
import { clearLayout, loadLayout, saveLayout } from "./studioLayout";

// No Filters side panel: the filters sit on the canvas instead.
const panels = { view: { left: [], right: [] } };

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function StudioBoard({ rows, says, forcePreset = false }: { rows: DashboardRow[]; says?: Record<string, PayPalSays>; forcePreset?: boolean }) {
  const data = useMemo(
    () =>
      ({
        sources: [
          {
            id: STUDIO_SOURCE_ID,
            name: "Payments",
            data: toStudioRows(rows, says),
            fields: [
              { id: "date", name: "Date", format: "dateFormat" },
              { id: "week", name: "Week of", format: "textFormat" },
              { id: "sender", name: "Sender", format: "textFormat" },
              { id: "payee", name: "Payee", format: "textFormat" },
              { id: "amount", name: "Amount", format: "currencyFormat" },
              { id: "status", name: "Status", format: "textFormat" },
              { id: "risk", name: "Risk", format: "textFormat" },
              { id: "scamType", name: "Scam type", format: "textFormat" },
              { id: "paypalSays", name: "PayPal says", format: "textFormat" },
              { id: "paypalCheck", name: "PayPal check", format: "textFormat" },
              { id: "stopped", name: "Stopped", format: "currencyFormat" },
              { id: "reasons", name: "Reasons", format: "textFormat" },
            ],
          },
        ],
      }) as never,
    [rows, says],
  );
  const [editing, setEditing] = useState(false);
  // A saved layout wins over the preset; a bad one is dropped by the error handler below.
  const [initial, setInitial] = useState<AgReportState>(() => (forcePreset ? null : (loadLayout(store()) as AgReportState | null)) ?? studioPreset);
  const [instance, setInstance] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The newest state seen while customising, not yet written to storage.
  const pending = useRef<AgReportState | null>(null);
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) saveLayout(store(), pending.current);
    pending.current = null;
  }, []);
  // Leaving the page keeps what was customised.
  useEffect(() => flush, [flush]);

  const restorePreset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    clearLayout(store());
    setInitial(studioPreset);
    setInstance((n) => n + 1);
  }, []);

  const btn =
    "min-h-11 rounded-full border border-line-strong bg-surface px-5 text-[17px] font-bold text-ink hover:bg-neutral-tint";
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        <button type="button" className={btn} onClick={() => {
            if (editing) flush();
            setEditing((e) => !e);
          }}>
          {editing ? "Done" : "Customise"}
        </button>
        {editing && (
          <button type="button" className={btn} onClick={restorePreset}>
            Reset layout
          </button>
        )}
      </div>
      <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
        <div style={{ height: 700 }} data-testid="studio-board">
          <AgStudio
            key={instance}
            data={data}
            widgets={studioWidgets}
            initialState={initial}
            theme={theme}
            mode={editing ? "edit" : "view"}
            panels={editing ? undefined : panels}
            onStateUpdated={(e) => {
              // Only what you customise is remembered, never a filter pick made in view mode.
              if (!e.durable || !editingRef.current) return;
              pending.current = e.state;
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(flush, 500);
            }}
            onErrorRaised={(e) => {
              // A saved layout Studio can't load: fall back to the preset and forget it.
              if (e.fatal && initial !== studioPreset) restorePreset();
            }}
          />
        </div>
      </AgStudioProvider>
    </div>
  );
}
