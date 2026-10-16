import { formatUsd } from "@/alerts/alertCopy";
import type { ChipTone } from "@/ui/Chip";

export type ChipView = { tone: ChipTone; label: string };
export type PaymentLike = { id: string; payee: string; amountCents: number; state: string; createdAt: string };
export type CheckLike = { id: string; source: "text" | "image"; checked: boolean; level: "low" | "medium" | "high" | null; createdAt: string };
export interface ActivityItem {
  key: string;
  href: string;
  title: string;
  when: string;
  chip: ChipView;
}

export function paymentChip(state: string): ChipView {
  if (state === "paid_out") return { tone: "safe", label: "Sent" };
  if (state === "held") return { tone: "held", label: "On hold" };
  if (state === "blocked" || state === "voided" || state === "expired") return { tone: "neutral", label: "Not sent" };
  if (state === "created") return { tone: "neutral", label: "Not approved" };
  if (state === "refunded") return { tone: "caution", label: "Refunded" };
  if (state === "payout_failed") return { tone: "caution", label: "Being returned" };
  return { tone: "neutral", label: "In progress" };
}

export function checkChip(c: { checked: boolean; level: "low" | "medium" | "high" | null }): ChipView {
  if (!c.checked || c.level === null) return { tone: "neutral", label: "Not checked" };
  if (c.level === "high") return { tone: "blocked", label: "Likely a scam" };
  if (c.level === "medium") return { tone: "caution", label: "Warning signs" };
  return { tone: "safe", label: "No warning signs" };
}

export function recentActivity(payments: PaymentLike[], checks: CheckLike[], limit: number): ActivityItem[] {
  const items: ActivityItem[] = [
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      href: `/payments/${p.id}`,
      title: `${formatUsd(p.amountCents)} to ${p.payee}`,
      when: p.createdAt,
      chip: paymentChip(p.state),
    })),
    ...checks.map((c) => ({
      key: `c-${c.id}`,
      href: `/check?id=${c.id}`,
      title: c.source === "image" ? "Screenshot checked" : "Message checked",
      when: c.createdAt,
      chip: checkChip(c),
    })),
  ];
  return items.sort((a, b) => b.when.localeCompare(a.when)).slice(0, limit);
}
