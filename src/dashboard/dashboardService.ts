import type { CircleRepo } from "@/circle/circleRepo";
import { SCAM_TYPE_LABELS } from "@/domain/scamTypeLabels";
import type { PaymentState, RiskLevel, ScamType } from "@/domain/types";
import type { PaymentRepo } from "@/payments/paymentRepo";
import { mondayOf, type RegistryRepo } from "@/registry/registryRepo";

export type DashboardStatus = "sent" | "on_hold" | "stopped" | "hold_ended" | "refunded" | "returning" | "in_progress" | "not_approved";

export const STATUS_LABELS: Record<DashboardStatus, string> = {
  sent: "Sent",
  on_hold: "On hold",
  stopped: "Stopped",
  hold_ended: "Hold ended",
  refunded: "Refunded",
  returning: "Being returned",
  in_progress: "In progress",
  not_approved: "Not approved",
};

export function dashboardStatus(state: PaymentState, blocked: boolean): DashboardStatus {
  if (state === "paid_out") return "sent";
  if (state === "held") return "on_hold";
  if (state === "blocked") return "stopped";
  if (state === "voided" || state === "expired") return blocked ? "stopped" : "hold_ended";
  if (state === "refunded") return "refunded";
  if (state === "payout_failed") return "returning";
  if (state === "created") return "not_approved";
  return "in_progress";
}

export interface DashboardRow {
  id: string;
  createdAt: Date;
  senderId: string;
  senderName: string;
  payee: string;
  amountCents: number;
  status: DashboardStatus;
  statusLabel: string;
  riskLevel: RiskLevel;
  scamTypeLabel: string;
  reasons: string[];
}

export interface CircleDashboard {
  moneyProtectedCents: number;
  scamsStopped: number;
  onHold: number;
  rows: DashboardRow[];
}

export interface Trends {
  weeks: string[];
  series: { scamType: ScamType; label: string; counts: number[]; total: number }[];
  total: number;
}

const ROW_LIMIT = 200;
const WEEK_MS = 7 * 86_400_000;
const NOT_A_SCAM: ScamType[] = ["none", "unknown"];

export function createDashboardService(deps: {
  payments: Pick<PaymentRepo, "listForCircle" | "blockedPaymentIds">;
  circle: Pick<CircleRepo, "getUser">;
  registry: Pick<RegistryRepo, "weeklyCounts">;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return {
    async circleDashboard(contactId: string): Promise<CircleDashboard> {
      const list = await deps.payments.listForCircle(contactId, ROW_LIMIT);
      const blocked = new Set(await deps.payments.blockedPaymentIds(list.map((p) => p.id)));
      const names = new Map<string, string>();
      for (const senderId of new Set(list.map((p) => p.senderId))) {
        names.set(senderId, (await deps.circle.getUser(senderId))?.displayName ?? "Someone in your circle");
      }
      const rows = list.map((p): DashboardRow => {
        const status = dashboardStatus(p.state, blocked.has(p.id));
        return {
          id: p.id,
          createdAt: p.createdAt,
          senderId: p.senderId,
          senderName: names.get(p.senderId)!,
          payee: p.payee,
          amountCents: p.amountCents,
          status,
          statusLabel: STATUS_LABELS[status],
          riskLevel: p.riskLevel,
          scamTypeLabel: SCAM_TYPE_LABELS[p.scamType],
          reasons: p.reasons,
        };
      });
      const stopped = rows.filter((r) => r.status === "stopped");
      return {
        moneyProtectedCents: stopped.reduce((sum, r) => sum + r.amountCents, 0),
        scamsStopped: stopped.length,
        onHold: rows.filter((r) => r.status === "on_hold").length,
        rows,
      };
    },

    async trends(weeks = 12): Promise<Trends> {
      const thisMonday = new Date(`${mondayOf(now())}T00:00:00Z`);
      const weekList = Array.from({ length: weeks }, (_, i) => mondayOf(new Date(thisMonday.getTime() - (weeks - 1 - i) * WEEK_MS)));
      const counts = await deps.registry.weeklyCounts(new Date(`${weekList[0]}T00:00:00Z`));
      const byType = new Map<ScamType, number[]>();
      for (const c of counts) {
        if (NOT_A_SCAM.includes(c.scamType)) continue;
        const i = weekList.indexOf(c.week);
        if (i < 0) continue;
        const series = byType.get(c.scamType) ?? weekList.map(() => 0);
        series[i]! += c.count;
        byType.set(c.scamType, series);
      }
      const series = [...byType.entries()]
        .map(([scamType, c]) => ({ scamType, label: SCAM_TYPE_LABELS[scamType], counts: c, total: c.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.total - a.total);
      return { weeks: weekList, series, total: series.reduce((a, s) => a + s.total, 0) };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
