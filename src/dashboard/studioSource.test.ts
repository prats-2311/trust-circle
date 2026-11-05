import { describe, expect, it } from "vitest";
import type { DashboardRow } from "./dashboardService";
import { toStudioRows } from "./studioSource";

function row(over: Partial<DashboardRow> = {}): DashboardRow {
  return {
    id: "p1",
    createdAt: new Date("2026-11-05T15:30:00Z"), // a Thursday
    senderId: "s1",
    senderName: "Margaret",
    payee: "Gift Co",
    amountCents: 12_550,
    status: "on_hold",
    statusLabel: "On hold",
    riskLevel: "high",
    scamTypeLabel: "Gift cards",
    reasons: ["New payee", "Asked for gift cards"],
    ...over,
  };
}

describe("toStudioRows", () => {
  it("turns cents into dollars", () => {
    expect(toStudioRows([row()])[0]!.amount).toBe(125.5);
  });

  it("gives the Monday (UTC) of the payment's week", () => {
    const r = toStudioRows([row(), row({ createdAt: new Date("2026-11-08T23:59:00Z") }), row({ createdAt: new Date("2026-11-09T00:00:00Z") })]);
    expect(r.map((x) => x.week)).toEqual(["2026-11-02", "2026-11-02", "2026-11-09"]);
    expect(r[0]!.date).toBe("2026-11-05T15:30:00.000Z");
  });

  it("puts the payments in date order, oldest first", () => {
    const r = toStudioRows([row({ createdAt: new Date("2026-11-09T00:00:00Z") }), row({ createdAt: new Date("2026-10-05T00:00:00Z") })]);
    expect(r.map((x) => x.week)).toEqual(["2026-10-05", "2026-11-09"]);
  });

  it("maps all three PayPal check values", () => {
    const says = { a: { label: "Voided", matches: true }, b: { label: "Captured", matches: false }, c: { label: "Not checked", matches: null } };
    const r = toStudioRows([row({ id: "a" }), row({ id: "b" }), row({ id: "c" }), row({ id: "d" })], says);
    expect(r.map((x) => x.paypalCheck)).toEqual(["Matches", "Doesn't match", "Not checked", "Not at PayPal"]);
    expect(r.map((x) => x.paypalSays)).toEqual(["Voided", "Captured", "Not checked", ""]);
  });

  it("only counts stopped money as stopped", () => {
    const r = toStudioRows([row(), row({ status: "stopped", statusLabel: "Stopped" })]);
    expect(r.map((x) => x.stopped)).toEqual([0, 125.5]);
  });

  it("joins the reasons", () => {
    expect(toStudioRows([row()])[0]!.reasons).toBe("New payee; Asked for gift cards");
  });

  it("says Not checked when there are no PayPal answers at all", () => {
    const r = toStudioRows([row()])[0]!;
    expect(r.paypalSays).toBe("Not checked");
    expect(r.paypalCheck).toBe("Not checked");
  });

  it("says Not at PayPal for a payment with no entry once answers are in", () => {
    const r = toStudioRows([row({ id: "x" })], { other: { label: "Voided", matches: true } })[0]!;
    expect(r.paypalSays).toBe("");
    expect(r.paypalCheck).toBe("Not at PayPal");
  });

  it("says Not checked for an entry whose read failed (matches null)", () => {
    const r = toStudioRows([row({ id: "x" })], { x: { label: "Not checked", matches: null } })[0]!;
    expect(r.paypalSays).toBe("Not checked");
    expect(r.paypalCheck).toBe("Not checked");
  });

  it("accepts createdAt as an ISO string, as it arrives over JSON", () => {
    const r = toStudioRows([row({ createdAt: "2026-11-05T15:30:00.000Z" as unknown as Date })])[0]!;
    expect(r.week).toBe("2026-11-02");
  });

  it("carries the plain fields across", () => {
    expect(toStudioRows([row()])[0]).toMatchObject({ sender: "Margaret", payee: "Gift Co", status: "On hold", risk: "high", scamType: "Gift cards" });
  });
});
