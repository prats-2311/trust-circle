import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

import { createWebPushSender } from "./pushSender";

const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const send = createWebPushSender({ publicKey: "pub", privateKey: "priv", subject: "mailto:a@example.com" });

describe("createWebPushSender", () => {
  beforeEach(() => sendNotification.mockReset().mockResolvedValue(undefined));

  it.each([
    "https://evil.example;.push.apple.com/x",
    "https://localhost%E3%80%82push.apple.com/x",
    "https://evil.example/x",
    `https://${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(49)}.push.apple.com/x`, // 256-char host
  ])(
    "refuses the disallowed stored endpoint %s with a 410 and never sends",
    async (endpoint) => {
      await expect(send({ endpoint, keys }, "{}")).rejects.toMatchObject({ statusCode: 410 });
      expect(sendNotification).not.toHaveBeenCalled();
    },
  );

  it("sends to an allowed endpoint", async () => {
    await send({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys }, "{}");
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
