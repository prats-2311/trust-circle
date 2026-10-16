import { describe, expect, it, vi } from "vitest";
import { InvalidTransitionError } from "@/domain/paymentStateMachine";
import { ConcurrentUpdateError } from "@/payments/paymentRepo";
import { NotAllowedError, PaymentInputError, PaymentPendingError } from "@/payments/paymentService";
import { PayPalError } from "@/payments/paypalGateway";
import { errorResponse, readJsonObject } from "./http";

vi.spyOn(console, "error").mockImplementation(() => {});

describe("errorResponse", () => {
  it("maps input errors to 400 with the field", async () => {
    const r = errorResponse(new PaymentInputError("payee", "Please enter who to pay."));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Please enter who to pay.", field: "payee" });
  });
  it("maps a pending payment to 202 with calm copy and the payment id", async () => {
    const r = errorResponse(new PaymentPendingError("p1", new PayPalError("x", 429, undefined, "d")));
    expect(r.status).toBe(202);
    const body = await r.json();
    expect(body).toEqual({
      error: "We're finishing this payment for you. You can check its status on your payments page. Please don't send it again.",
      paymentId: "p1",
    });
    expect(body.error).not.toContain("Nothing has been sent");
  });
  it("maps not-allowed to 403", () => {
    expect(errorResponse(new NotAllowedError("No.")).status).toBe(403);
  });
  it("maps concurrency and invalid transitions to 409", () => {
    expect(errorResponse(new ConcurrentUpdateError("p1", "held")).status).toBe(409);
    expect(errorResponse(new InvalidTransitionError("held", "EXPIRE")).status).toBe(409);
  });
  it("maps a definite PayPal failure to 502 saying nothing was sent", async () => {
    const r = errorResponse(new PayPalError("x", 422, "ISSUE", "dbg", false));
    expect(r.status).toBe(502);
    expect((await r.json()).error).toContain("Nothing has been sent");
  });
  it("maps a pre-claim uncertain PayPal outcome to 503 and asks to try again shortly", async () => {
    // Uncertain errors after a claim become PaymentPendingError, so one reaching here happened
    // before any money could move (for example creating the order).
    const r = errorResponse(new PayPalError("x", 500, undefined, "dbg", true));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toBe("PayPal didn't answer in time. Nothing has been sent. Please try again in a moment.");
  });
  it("logs the cause of a pending payment without message text", () => {
    const spy = vi.mocked(console.error);
    spy.mockClear();
    errorResponse(new PaymentPendingError("p1", new PayPalError("secret detail", 500, "ISSUE", "dbg1", true)));
    expect(spy).toHaveBeenCalledWith("payment pending", { paymentId: "p1", cause: "PayPalError", status: 500, debugId: "dbg1" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret detail");
  });
  it("maps unknown errors to 500 without leaking details", async () => {
    const r = errorResponse(new Error("secret detail"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secret detail");
  });
});

describe("readJsonObject", () => {
  const req = (body: string) => new Request("http://x", { method: "POST", body });
  it("parses an object", async () => expect(await readJsonObject(req('{"a":1}'))).toEqual({ a: 1 }));
  it("returns null for malformed json, arrays, null and scalars", async () => {
    for (const b of ["{oops", "[1]", "null", "5", ""]) expect(await readJsonObject(req(b))).toBeNull();
  });
});
