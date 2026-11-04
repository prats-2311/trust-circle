import { describe, expect, it, vi } from "vitest";
import { createMemoryPaymentRepo } from "@/payments/memoryPaymentRepo";
import type { NewPayment } from "@/payments/paymentRepo";
import { PayPalError } from "@/payments/paypalGateway";
import { createPayPalSaysService, paypalSaysFor } from "./paypalSays";
import type { DashboardStatus } from "./dashboardService";

const SENDER = "00000000-0000-4000-8000-000000000001";
const CONTACT = "00000000-0000-4000-8000-000000000002";

describe("paypalSaysFor", () => {
  it.each<[DashboardStatus, string | null, { label: string; matches: boolean | null }]>([
    ["stopped", "VOIDED", { label: "Voided", matches: true }],
    ["stopped", "COMPLETED", { label: "Doesn't match", matches: false }],
    ["on_hold", "CREATED", { label: "On hold", matches: true }],
    ["sent", "COMPLETED", { label: "Captured", matches: true }],
    ["refunded", "COMPLETED", { label: "Captured", matches: true }],
    ["refunded", "REFUNDED", { label: "Refunded", matches: true }],
    ["hold_ended", "EXPIRED", { label: "Expired", matches: true }],
    ["stopped", "DENIED", { label: "Denied", matches: null }],
    ["stopped", "PARTIALLY_CAPTURED", { label: "Partially Captured", matches: null }],
    ["stopped", null, { label: "Not checked", matches: null }],
    ["sent", "PARTIALLY_CAPTURED", { label: "Partially Captured", matches: null }],
    ["in_progress", "CAPTURED", { label: "Captured", matches: true }],
    ["not_approved", "VOIDED", { label: "Voided", matches: true }],
  ])("%s with PayPal %s", (status, paypal, expected) => {
    expect(paypalSaysFor(status, paypal)).toEqual(expected);
  });
});

function payment(id: string, over: Partial<NewPayment> = {}): NewPayment {
  return {
    id, senderId: SENDER, payee: "secret.payee@example.com", amountCents: 1000, note: null, senderAnswer: null,
    state: "held", riskLevel: "high", scamType: "none", reasons: [], impersonatedRequester: null,
    paypalOrderId: null, authorizationId: null, captureId: null, payoutBatchId: null, refundId: null,
    authorisedAt: null, coolingOffUntil: null, ...over,
  };
}

function setup() {
  let clock = new Date("2026-11-01T10:00:00Z");
  const repo = createMemoryPaymentRepo({ trustLinks: [{ senderId: SENDER, contactId: CONTACT }], now: () => clock });
  const gateway = {
    getAuthorizationStatus: vi.fn().mockResolvedValue({ status: "CREATED" }),
    getCaptureStatus: vi.fn().mockResolvedValue({ status: "COMPLETED" }),
  };
  const service = createPayPalSaysService({ gateway, payments: repo, now: () => clock, deadlineMs: 50 });
  // Each insert gets its own createdAt so "newest first" is well defined.
  const add = async (p: NewPayment) => { clock = new Date(clock.getTime() + 1000); return repo.insert(p); };
  return { repo, gateway, service, add, advance: (ms: number) => (clock = new Date(clock.getTime() + ms)) };
}

describe("createPayPalSaysService", () => {
  it("reads the capture when there is one, else the authorisation, and leaves out payments PayPal never saw", async () => {
    const { gateway, service, add } = setup();
    await add(payment("none"));
    await add(payment("auth", { authorizationId: "AUTH-1" }));
    await add(payment("cap", { state: "paid_out", authorizationId: "AUTH-2", captureId: "CAP-2" }));
    const result = await service.forCircle(CONTACT);
    expect(Object.keys(result).sort()).toEqual(["auth", "cap"]);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(1);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledWith({ authorizationId: "AUTH-1" });
    expect(gateway.getCaptureStatus).toHaveBeenCalledTimes(1);
    expect(gateway.getCaptureStatus).toHaveBeenCalledWith({ captureId: "CAP-2" });
    expect(result.auth).toEqual({ label: "On hold", matches: true });
    expect(result.none).toBeUndefined();
  });

  it("agrees when a refunded payment's capture still reads COMPLETED", async () => {
    const { service, add } = setup();
    await add(payment("r", { state: "refunded", authorizationId: "A", captureId: "C" }));
    expect((await service.forCircle(CONTACT)).r).toEqual({ label: "Captured", matches: true });
  });

  it("shows PayPal's own word for a status we don't know, without a mismatch", async () => {
    const { gateway, service, add } = setup();
    gateway.getAuthorizationStatus.mockResolvedValue({ status: "DENIED" });
    await add(payment("d", { authorizationId: "A" }));
    expect((await service.forCircle(CONTACT)).d).toEqual({ label: "Denied", matches: null });
  });

  it("reads at most 20 payments, newest first, 4 at a time", async () => {
    const { gateway, service, add } = setup();
    for (let i = 0; i < 25; i++) await add(payment(`p${i}`, { authorizationId: `A${i}` }));
    let inFlight = 0, max = 0;
    gateway.getAuthorizationStatus.mockImplementation(async () => {
      inFlight++; max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { status: "CREATED" };
    });
    const result = await service.forCircle(CONTACT);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(20);
    expect(max).toBe(4);
    expect(Object.keys(result)).toHaveLength(20);
    expect(result.p24).toBeDefined();
    expect(result.p5).toBeDefined();
    expect(result.p4).toBeUndefined();
  });

  it("caches each answer for 10 minutes", async () => {
    const { gateway, service, add, advance } = setup();
    await add(payment("c", { authorizationId: "A" }));
    await service.forCircle(CONTACT);
    advance(599_000);
    await service.forCircle(CONTACT);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(1);
    advance(2_000);
    await service.forCircle(CONTACT);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(2);
  });

  it("a failed read shows Not checked and the rest still answer", async () => {
    const { gateway, service, add } = setup();
    await add(payment("ok", { authorizationId: "A1" }));
    await add(payment("bad", { authorizationId: "A2" }));
    gateway.getAuthorizationStatus.mockImplementation(async ({ authorizationId }: { authorizationId: string }) => {
      if (authorizationId === "A2") throw new PayPalError("x", 500, undefined, "d");
      return { status: "CREATED" };
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await service.forCircle(CONTACT);
    expect(result.bad).toEqual({ label: "Not checked", matches: null });
    expect(result.ok).toEqual({ label: "On hold", matches: true });
    // Failed reads are not cached: the next call asks again.
    await service.forCircle(CONTACT);
    expect(gateway.getAuthorizationStatus.mock.calls.filter(([a]) => a.authorizationId === "A2")).toHaveLength(2);
  });

  it("never logs ids or payees", async () => {
    const { gateway, service, add } = setup();
    await add(payment("bad", { authorizationId: "AUTH-SECRET", captureId: "CAP-SECRET" }));
    gateway.getCaptureStatus.mockRejectedValue(new PayPalError("x", 500, undefined, "d"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await service.forCircle(CONTACT);
    expect(warn).toHaveBeenCalled();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("AUTH-SECRET");
    expect(logged).not.toContain("CAP-SECRET");
    expect(logged).not.toContain("secret.payee");
    expect(warn.mock.calls[0]).toContainEqual({ errorName: "PayPalError", status: 500 });
  });

  it("a payment whose state changed is read again, not served from the cache", async () => {
    const { gateway, service, add, repo } = setup();
    await add(payment("s", { authorizationId: "A" }));
    expect((await service.forCircle(CONTACT)).s).toEqual({ label: "On hold", matches: true });
    await repo.transition("s", "held", { state: "voided" });
    gateway.getAuthorizationStatus.mockResolvedValue({ status: "VOIDED" });
    const again = await service.forCircle(CONTACT);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(2);
    expect(again.s).toEqual({ label: "Voided", matches: true });
  });

  it("returns within the deadline with Not checked for slow reads", async () => {
    const { gateway, service, add } = setup();
    await add(payment("fast", { authorizationId: "A1" }));
    await add(payment("slow", { authorizationId: "A2" }));
    gateway.getAuthorizationStatus.mockImplementation(({ authorizationId }: { authorizationId: string }) =>
      authorizationId === "A2" ? new Promise(() => {}) : Promise.resolve({ status: "CREATED" }));
    const result = await service.forCircle(CONTACT);
    expect(result.slow).toEqual({ label: "Not checked", matches: null });
    expect(result.fast).toEqual({ label: "On hold", matches: true });
  });

  it("two calls at once for the same contact share one set of reads", async () => {
    const { gateway, service, add } = setup();
    await add(payment("a", { authorizationId: "A" }));
    const [x, y] = await Promise.all([service.forCircle(CONTACT), service.forCircle(CONTACT)]);
    expect(gateway.getAuthorizationStatus).toHaveBeenCalledTimes(1);
    expect(x).toEqual(y);
  });
});
