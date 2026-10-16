import webpush from "web-push";
import type { PushSub } from "./subscription";

export type PushSender = (sub: PushSub, payload: string) => Promise<void>;

export const MAX_SUBSCRIPTIONS_PER_USER = 5;

/** Node runtime only. VAPID details go with each call, so importing this needs no keys. */
export function createWebPushSender(v: { publicKey: string; privateKey: string; subject: string }): PushSender {
  return async (sub, payload) => {
    await webpush.sendNotification(sub, payload, {
      vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey },
      TTL: 3600,
      urgency: "high",
    });
  };
}
