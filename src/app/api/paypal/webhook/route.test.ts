import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
const handle = vi.fn();
const markFailed = vi.fn();
const claim = vi.fn();
let webhookId: string | undefined = "WID1";
vi.mock("@/server/container", () => ({
  getContainer: () => ({
    env: { PAYPAL_WEBHOOK_ID: webhookId },
    gateway: { verifyWebhookSignature: verify },
    webhooks: { handle },
    webhookRepo: { markFailed, claim },
  }),
}));
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
  handle.mockResolvedValue("processed");
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
    expect(claim).not.toHaveBeenCalled();
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

  it("answers 200 and marks the event failed when handling throws", async () => {
    class Boom extends Error { constructor() { super("secret receiver a@b.com"); this.name = "Boom"; } }
    handle.mockRejectedValue(new Boom());
    const res = await post();
    expect(res.status).toBe(200);
    expect(markFailed).toHaveBeenCalledWith("WH-1", expect.any(Date), "Boom");
    const logged = JSON.stringify((console.warn as ReturnType<typeof vi.fn>).mock.calls);
    expect(logged).not.toContain("a@b.com");
  });

  it("answers 413 for a body over 256 KB without verifying", async () => {
    const res = await post("x".repeat(256 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
  });

  it("answers 400 for a verified body that is not an event", async () => {
    const res = await post("[1,2]");
    expect(res.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });
});
