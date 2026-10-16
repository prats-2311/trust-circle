import { describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import { createMemoryAlertRepo } from "./alertRepo";
import { createAlertService } from "./alertService";

const SARAH = "00000000-0000-4000-8000-000000000002";
const users = createMemoryCircleRepo({ users: [{ id: SARAH, email: "sarah@example.com", displayName: "Sarah", safeWordHash: null }] });
const payload = { senderName: "Margaret", amountCents: 80000, payee: "x@example.com" };
const at = new Date("2026-11-01T10:00:00Z");

describe("alert service", () => {
  it("stores an in-app alert and emails the recipient with a link", async () => {
    const repo = createMemoryAlertRepo();
    const email = vi.fn().mockResolvedValue(undefined);
    const alerts = createAlertService({ repo, users, email, appUrl: "https://tc.example/", now: () => at });
    await alerts.notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p1", payload });
    expect(email).toHaveBeenCalledWith({
      to: "sarah@example.com",
      subject: "Margaret's payment of $800 is on hold",
      text: expect.stringContaining("https://tc.example/circle/payments/p1"),
    });
    const list = await alerts.list(SARAH);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "payment_held", title: "Margaret's payment of $800 is on hold", path: "/circle/payments/p1", readAt: null });
  });

  it("records email as skipped when no email provider is configured", async () => {
    const repo = createMemoryAlertRepo();
    const insert = vi.spyOn(repo, "insert");
    await createAlertService({ repo, users, appUrl: "http://localhost:3000" }).notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p1", payload });
    expect(insert.mock.calls.map((c) => [c[0].channel, c[0].status])).toEqual([["in_app", "sent"], ["email", "skipped"]]);
  });

  it("records a failed email without throwing", async () => {
    const repo = createMemoryAlertRepo();
    const insert = vi.spyOn(repo, "insert");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const email = vi.fn().mockRejectedValue(new Error("resend http 500"));
    await createAlertService({ repo, users, email, appUrl: "http://x" }).notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p1", payload });
    expect(insert.mock.calls.map((c) => c[0].status)).toEqual(["sent", "failed"]);
  });

  it("hides a verify request once its verification or its payment is no longer open", async () => {
    const repo = createMemoryAlertRepo();
    const open = new Set(["v-open"]);
    const alerts = createAlertService({
      repo, users, appUrl: "http://x",
      isAlertOpen: async ({ kind, verificationId }) => kind !== "verify_request" || (verificationId !== null && open.has(verificationId)),
    });
    await alerts.notify({ recipientId: SARAH, kind: "verify_request", paymentId: "p1", verificationId: "v-open", payload });
    await alerts.notify({ recipientId: SARAH, kind: "verify_request", paymentId: "p2", verificationId: "v-done", payload });
    await alerts.notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p2", payload });
    const list = await alerts.list(SARAH);
    expect(list.map((a) => [a.kind, a.verificationId])).toEqual(
      expect.arrayContaining([["verify_request", "v-open"], ["payment_held", null]]),
    );
    expect(list.some((a) => a.verificationId === "v-done")).toBe(false);
    expect(list).toHaveLength(2);
  });

  it("drops a payment_held row once the payment is no longer open, and keeps it while it is", async () => {
    const repo = createMemoryAlertRepo();
    const openPayments = new Set(["p-open"]);
    const alerts = createAlertService({
      repo, users, appUrl: "http://x",
      isAlertOpen: async ({ kind, paymentId }) => kind !== "payment_held" || (paymentId !== null && openPayments.has(paymentId)),
    });
    await alerts.notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p-open", payload });
    await alerts.notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p-closed", payload });
    await alerts.notify({ recipientId: SARAH, kind: "payment_update", paymentId: "p-closed", payload: { ...payload, reason: "cancelled" } });
    const list = await alerts.list(SARAH);
    expect(list.map((a) => [a.kind, a.paymentId])).toEqual(
      expect.arrayContaining([["payment_held", "p-open"], ["payment_update", "p-closed"]]),
    );
    expect(list).toHaveLength(2);
  });

  it("marks only the recipient's own alerts as read", async () => {
    const repo = createMemoryAlertRepo();
    const alerts = createAlertService({ repo, users, appUrl: "http://x", now: () => at });
    await alerts.notify({ recipientId: SARAH, kind: "payment_held", paymentId: "p1", payload });
    const [a] = await alerts.list(SARAH);
    expect(await alerts.markRead(a!.id, "00000000-0000-4000-8000-000000000009")).toBe(false);
    expect(await alerts.markRead(a!.id, SARAH)).toBe(true);
    expect((await alerts.list(SARAH))[0]!.readAt).toEqual(at);
  });
});
