import { describe, expect, it } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import type { PaymentRecord } from "@/payments/paymentRepo";
import { createDashboardService, dashboardStatus, STATUS_LABELS } from "./dashboardService";

const MARGARET = "00000000-0000-4000-8000-000000000001";
const pay = (id: string, state: PaymentRecord["state"], amountCents: number, createdAt: string): PaymentRecord =>
  ({
    id, senderId: MARGARET, payee: `${id}@example.com`, amountCents, note: null, senderAnswer: null, state,
    riskLevel: "high", scamType: "impersonation_family", reasons: ["r"], impersonatedRequester: null,
    paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null,
    authorisedAt: null, coolingOffUntil: null, version: 0, createdAt: new Date(createdAt), updatedAt: new Date(createdAt),
  }) as PaymentRecord;

const circle = createMemoryCircleRepo({ users: [{ id: MARGARET, email: "m@example.com", displayName: "Margaret", safeWordHash: null }] });

describe("dashboardStatus", () => {
  it.each([
    ["paid_out", false, "sent"],
    ["held", false, "on_hold"],
    ["blocked", false, "stopped"],
    ["voided", true, "stopped"],
    ["voided", false, "hold_ended"],
    ["expired", false, "hold_ended"],
    ["refunded", false, "refunded"],
    ["payout_failed", false, "returning"],
    ["created", false, "not_approved"],
    ["captured", false, "in_progress"],
  ] as const)("%s (blocked=%s) is %s", (state, blocked, status) => {
    expect(dashboardStatus(state, blocked)).toBe(status);
  });
});

describe("STATUS_LABELS", () => {
  it("calls a failed payout 'Being returned' and a finished refund 'Refunded'", () => {
    expect(STATUS_LABELS.returning).toBe("Being returned");
    expect(STATUS_LABELS.refunded).toBe("Refunded");
  });
});

describe("circle dashboard", () => {
  it("summarises protected money and lists rows newest first with sender names", async () => {
    const rows = [
      pay("p3", "held", 30000, "2026-10-15T10:00:00Z"),
      pay("p2", "voided", 80000, "2026-10-10T10:00:00Z"),
      pay("p1", "voided", 5000, "2026-10-05T10:00:00Z"),
      pay("p0", "paid_out", 2500, "2026-10-01T10:00:00Z"),
    ];
    const service = createDashboardService({
      payments: { listForCircle: async () => rows, blockedPaymentIds: async () => ["p2"] },
      circle,
      registry: { weeklyCounts: async () => [] },
    });
    const d = await service.circleDashboard("sarah");
    expect(d).toMatchObject({ moneyProtectedCents: 80000, scamsStopped: 1, onHold: 1 });
    expect(d.rows.map((r) => [r.id, r.status, r.statusLabel])).toEqual([
      ["p3", "on_hold", "On hold"],
      ["p2", "stopped", "Stopped"],
      ["p1", "hold_ended", "Hold ended"],
      ["p0", "sent", "Sent"],
    ]);
    expect(d.rows[0]).toMatchObject({ senderName: "Margaret", scamTypeLabel: "Family member in trouble" });
  });
});

describe("trends", () => {
  it("fills every week, drops not-a-scam types and sorts series by total", async () => {
    const service = createDashboardService({
      payments: { listForCircle: async () => [], blockedPaymentIds: async () => [] },
      circle,
      registry: {
        weeklyCounts: async () => [
          { week: "2026-10-05", scamType: "invoice", count: 1 },
          { week: "2026-10-12", scamType: "impersonation_family", count: 3 },
          { week: "2026-10-12", scamType: "invoice", count: 1 },
          { week: "2026-10-12", scamType: "none", count: 9 },
        ],
      },
      now: () => new Date("2026-10-16T12:00:00Z"),
    });
    const t = await service.trends(3);
    expect(t.weeks).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(t.series).toEqual([
      { scamType: "impersonation_family", label: "Family member in trouble", counts: [0, 0, 3], total: 3 },
      { scamType: "invoice", label: "Fake or changed invoice", counts: [0, 1, 1], total: 2 },
    ]);
    expect(t.total).toBe(5);
  });
});
