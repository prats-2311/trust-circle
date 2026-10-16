import webpush from "web-push";
import { isAllowedPushEndpoint, type PushSub } from "./subscription";

export type PushSender = (sub: PushSub, payload: string) => Promise<void>;

export const MAX_SUBSCRIPTIONS_PER_USER = 5;

/** Node runtime only. VAPID details go with each call, so importing this needs no keys. */
export function createWebPushSender(v: { publicKey: string; privateKey: string; subject: string }): PushSender {
  return async (sub, payload) => {
    // A stored row that fails today's check is treated as gone: 410 makes the caller delete it.
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      throw Object.assign(new Error("Push endpoint is not on the allow-list"), { statusCode: 410 });
    }
    await webpush.sendNotification(sub, payload, {
      vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey },
      TTL: 3600,
      urgency: "high",
    });
  };
}
