import type { PushSub } from "./subscription";

export interface PushRepo {
  /** Upserts by endpoint; an endpoint saved by another user moves to this one. */
  save(userId: string, sub: PushSub, at: Date): Promise<void>;
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
      rows.set(sub.endpoint, { userId, sub: structuredClone(sub) });
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
