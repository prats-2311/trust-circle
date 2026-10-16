import { randomUUID } from "node:crypto";

export type VerificationMethod = "real_person" | "official_routes" | "safe_word" | "memory_question";
export type VerificationStatus = "pending" | "confirmed" | "denied" | "passed" | "failed";

export interface VerificationRecord {
  id: string;
  paymentId: string;
  method: VerificationMethod;
  status: VerificationStatus;
  targetContactId: string | null;
  requesterName: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export type NewVerification = Omit<VerificationRecord, "id">;

export interface VerificationRepo {
  insert(v: NewVerification): Promise<VerificationRecord>;
  get(id: string): Promise<VerificationRecord | null>;
  /** Oldest first. */
  listForPayment(paymentId: string): Promise<VerificationRecord[]>;
  /** Moves a pending verification to its outcome; false if it was no longer pending. */
  resolve(id: string, to: Exclude<VerificationStatus, "pending">, at: Date): Promise<boolean>;
}

export function createMemoryVerificationRepo(): VerificationRepo {
  const rows: VerificationRecord[] = [];
  return {
    async insert(v) {
      const row = { ...structuredClone(v), id: randomUUID() };
      rows.push(row);
      return structuredClone(row);
    },
    async get(id) {
      const r = rows.find((x) => x.id === id);
      return r ? structuredClone(r) : null;
    },
    async listForPayment(paymentId) {
      return rows
        .filter((r) => r.paymentId === paymentId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((r) => structuredClone(r));
    },
    async resolve(id, to, at) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.status !== "pending") return false;
      r.status = to;
      r.resolvedAt = at;
      return true;
    },
  };
}
