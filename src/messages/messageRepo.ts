import { randomUUID } from "node:crypto";
import type { Identifier, RiskLevel, ScamType } from "@/domain/types";

export interface MessageCheckRecord {
  id: string;
  senderId: string;
  source: "text" | "image" | "voice";
  text: string;
  checked: boolean;
  level: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  identifiers: Identifier[];
  createdAt: Date;
}

export type NewMessageCheck = Omit<MessageCheckRecord, "id" | "createdAt">;

export interface MessageRepo {
  insert(c: NewMessageCheck): Promise<MessageCheckRecord>;
  get(id: string): Promise<MessageCheckRecord | null>;
  /** Newest first. */
  listBySender(senderId: string, limit: number): Promise<MessageCheckRecord[]>;
}

export function createMemoryMessageRepo(): MessageRepo {
  const rows: MessageCheckRecord[] = [];
  return {
    async insert(c) {
      const row = { ...structuredClone(c), id: randomUUID(), createdAt: new Date() };
      rows.push(row);
      return structuredClone(row);
    },
    async get(id) {
      const r = rows.find((x) => x.id === id);
      return r ? structuredClone(r) : null;
    },
    async listBySender(senderId, limit) {
      return rows
        .filter((r) => r.senderId === senderId)
        .reverse()
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },
  };
}
