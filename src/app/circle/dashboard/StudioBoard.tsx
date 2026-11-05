"use client";
import { useMemo } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { studioTheme } from "ag-studio";
import type { DashboardRow } from "@/dashboard/dashboardService";
import type { PayPalSays } from "@/dashboard/paypalSays";
import { toStudioRows } from "@/dashboard/studioSource";
import { STUDIO_SOURCE_ID, studioPreset } from "./studioPreset";

const theme = studioTheme.withParams({
  accentColor: "var(--color-evergreen, #1e5a47)",
  backgroundColor: "var(--color-surface, #ffffff)",
  foregroundColor: "var(--color-ink, #14211b)",
  fontFamily: "inherit",
  borderRadius: 12,
} as never);

// No Filters side panel: the filters sit on the canvas instead.
const panels = { view: { left: [], right: [] } };

export default function StudioBoard({ rows, says }: { rows: DashboardRow[]; says?: Record<string, PayPalSays> }) {
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
  return (
    <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY}>
      <div style={{ height: 700 }}>
        <AgStudio data={data} initialState={studioPreset} theme={theme} mode="view" panels={panels} />
      </div>
    </AgStudioProvider>
  );
}
