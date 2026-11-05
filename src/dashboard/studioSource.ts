import type { DashboardRow } from "./dashboardService";
import type { PayPalSays } from "./paypalSays";
import { mondayOf } from "@/domain/week";

export type StudioRow = {
  date: string;
  week: string;
  sender: string;
  payee: string;
  amount: number;
  status: string;
  risk: string;
  scamType: string;
  paypalSays: string;
  paypalCheck: "Matches" | "Doesn't match" | "Not checked" | "Not at PayPal";
  stopped: number;
  reasons: string;
};

export function toStudioRows(rows: DashboardRow[], says?: Record<string, PayPalSays>): StudioRow[] {
  // Oldest first, so a chart grouped by week reads left to right in time.
  const ordered = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return ordered.map((r) => {
    const s = says?.[r.id];
    // Over the wire createdAt is an ISO string, whatever the type says.
    const at = new Date(r.createdAt);
    const amount = r.amountCents / 100;
    return {
      date: at.toISOString(),
      week: mondayOf(at),
      sender: r.senderName,
      payee: r.payee,
      amount,
      status: r.statusLabel,
      risk: r.riskLevel,
      scamType: r.scamTypeLabel,
      paypalSays: s ? s.label : says ? "" : "Not checked",
      paypalCheck: s ? (s.matches === true ? "Matches" : s.matches === false ? "Doesn't match" : "Not checked") : says ? "Not at PayPal" : "Not checked",
      stopped: r.status === "stopped" ? amount : 0,
      reasons: r.reasons.join("; "),
    };
  });
}
