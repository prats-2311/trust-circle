import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
const handle = vi.fn();
let webhookId: string | undefined = "WID1";
vi.mock("@/server/container", () => ({
  getContainer: () => ({
    env: { PAYPAL_WEBHOOK_ID: webhookId },
    gateway: { verifyWebhookSignature: verify },
    webhooks: { handle },
  }),
}));
import { WebhookFailedError } from "@/webhooks/webhookService";
import { POST } from "./route";

const goodHeaders = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.paypal.com/cert",
  "paypal-transmission-id": "tid",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-10-16T10:00:00Z",
};
const body = JSON.stringify({ id: "WH-1", event_type: "PAYMENT.PAYOUTS-ITEM.RETURNED", resource: {} });
const post = (b = body, headers: Record<string, string> = goodHeaders) =>
  POST(new Request("http://x/api/paypal/webhook", { method: "POST", headers, body: b }));

beforeEach(() => {
  vi.clearAllMocks();
  webhookId = "WID1";
  verify.mockResolvedValue(true);
  handle.mockResolvedValue({ result: "processed", attempts: 1 });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/paypal/webhook", () => {
  it("answers 503 when webhooks are not set up", async () => {
    webhookId = undefined;
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Webhooks aren't set up." });
    expect(verify).not.toHaveBeenCalled();
  });

  it("answers 400 and stores nothing when the verifier says no", async () => {
    verify.mockResolvedValue(false);
    const res = await post();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid signature." });
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 400 when verification throws", async () => {
    verify.mockRejectedValue(new Error("network"));
    expect((await post()).status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 400 without verifying when signature headers are missing", async () => {
    const partial: Record<string, string> = { ...goodHeaders };
    delete partial["paypal-transmission-sig"];
    const res = await post(body, partial);
    expect(res.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it("passes the raw body, headers and webhook id to the verifier", async () => {
    await post();
    expect(verify).toHaveBeenCalledWith({
      headers: {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.paypal.com/cert",
        "paypal-transmission-id": "tid",
        "paypal-transmission-sig": "sig",
        "paypal-transmission-time": "2026-10-16T10:00:00Z",
      },
      rawBody: body,
      webhookId: "WID1",
    });
  });

  it("answers 200 with the result on success and logs only type, id and result", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "processed" });
    expect(handle).toHaveBeenCalledWith({ id: "WH-1", event_type: "PAYMENT.PAYOUTS-ITEM.RETURNED", resource: {} });
    expect(console.info).toHaveBeenCalledWith("paypal webhook", { type: "PAYMENT.PAYOUTS-ITEM.RETURNED", id: "WH-1", result: "processed" });
  });

  it("answers 500 when handling fails below the attempt cap, so PayPal redelivers", async () => {
    handle.mockRejectedValue(new WebhookFailedError(1, "Boom"));
    expect((await post()).status).toBe(500);
    handle.mockRejectedValue(new WebhookFailedError(4, "Boom"));
    expect((await post()).status).toBe(500);
  });

  it("answers 200 on the fifth failure so a poisoned event stops", async () => {
    handle.mockRejectedValue(new WebhookFailedError(5, "Boom"));
    expect((await post()).status).toBe(200);
  });

  it("answers 500 when the store itself fails before the claim", async () => {
    handle.mockRejectedValue(new Error("db down"));
    expect((await post()).status).toBe(500);
  });

  it("answers 500 for a deferred outcome at any attempt count", async () => {
    handle.mockResolvedValue({ result: "deferred", attempts: 2 });
    expect((await post()).status).toBe(500);
    handle.mockResolvedValue({ result: "deferred", attempts: 5 });
    expect((await post()).status).toBe(500);
  });

  it("answers 200 for a duplicate", async () => {
    handle.mockResolvedValue({ result: "duplicate", attempts: 0 });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "duplicate" });
  });

  it("never logs the error message or body when handling fails", async () => {
    handle.mockRejectedValue(new WebhookFailedError(1, "Boom"));
    await post();
    const logged = JSON.stringify([...(console.warn as ReturnType<typeof vi.fn>).mock.calls, ...(console.info as ReturnType<typeof vi.fn>).mock.calls]);
    expect(logged).not.toContain("resource");
    expect(logged).not.toContain("someone@example.com");
  });

  it("answers 413 for a body over 256 KB without verifying", async () => {
    const res = await post("x".repeat(256 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
  });

  it("answers 413 for a chunked body with no content-length, and stops reading once past the cap", async () => {
    const chunk = new Uint8Array(64 * 1024).fill(120);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(chunk);
      },
    });
    const req = new Request("http://x/api/paypal/webhook", { method: "POST", headers: goodHeaders, body: stream, duplex: "half" } as RequestInit);
    expect(req.headers.get("content-length")).toBeNull();
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(10);
    expect(verify).not.toHaveBeenCalled();
  });

  it("still reads a normal chunked body", async () => {
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, 10));
        c.enqueue(bytes.slice(10));
        c.close();
      },
    });
    const res = await POST(new Request("http://x/api/paypal/webhook", { method: "POST", headers: goodHeaders, body: stream, duplex: "half" } as RequestInit));
    expect(res.status).toBe(200);
    expect(verify.mock.calls[0]![0].rawBody).toBe(body);
  });

  it("answers 200 ignored for a verified body that is not an event", async () => {
    const res = await post("[1,2]");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "ignored" });
    expect(handle).not.toHaveBeenCalled();
  });
});
