import type { PushSub } from "./subscription";

export interface PushRepo {
  /**
   * Upserts by endpoint. An endpoint owned by another user moves only when the keys are exactly the stored ones
   * (the same browser signing in as someone else); otherwise nothing changes and the result is "conflict".
   */
  save(userId: string, sub: PushSub, at: Date): Promise<"saved" | "conflict">;
  listForUser(userId: string): Promise<PushSub[]>;
  remove(endpoint: string): Promise<void>;
  /** False when the endpoint is not this user's. */
  removeForUser(userId: string, endpoint: string): Promise<boolean>;
  countForUser(userId: string): Promise<number>;
}

export function createMemoryPushRepo(): PushRepo {
  const rows = new Map<string, { userId: string; sub: PushSub }>();
  return {
    async save(userId, sub) {
      const cur = rows.get(sub.endpoint);
      if (cur && cur.userId !== userId && (cur.sub.keys.p256dh !== sub.keys.p256dh || cur.sub.keys.auth !== sub.keys.auth)) return "conflict";
      rows.set(sub.endpoint, { userId, sub: structuredClone(sub) });
      return "saved";
    },
    async listForUser(userId) {
      return [...rows.values()].filter((r) => r.userId === userId).map((r) => structuredClone(r.sub));
    },
    async remove(endpoint) {
      rows.delete(endpoint);
    },
    async removeForUser(userId, endpoint) {
      if (rows.get(endpoint)?.userId !== userId) return false;
      rows.delete(endpoint);
      return true;
    },
    async countForUser(userId) {
      return [...rows.values()].filter((r) => r.userId === userId).length;
    },
  };
}
