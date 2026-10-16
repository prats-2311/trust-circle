import { randomUUID } from "node:crypto";

export type AlertKind = "payment_held" | "medium_payment_sent" | "verify_request" | "payment_stopped" | "payment_confirmed" | "payment_update";
export type AlertChannel = "in_app" | "push" | "email";
export type AlertStatus = "sent" | "skipped" | "failed";

export interface AlertPayload {
  senderName: string;
  amountCents: number;
  payee: string;
  requesterName?: string;
  reason?: "denied" | "cancelled" | "check_failed" | "stopped_by_circle";
  actorName?: string;
}

export interface AlertRecord {
  id: string;
  recipientId: string;
  kind: AlertKind;
  paymentId: string | null;
  verificationId: string | null;
  channel: AlertChannel;
  status: AlertStatus;
  payload: AlertPayload;
  createdAt: Date;
  readAt: Date | null;
}

export type NewAlert = Omit<AlertRecord, "id" | "createdAt" | "readAt">;

export interface AlertRepo {
  insert(a: NewAlert): Promise<AlertRecord>;
  /** In-app alerts only, newest first. */
  listForRecipient(recipientId: string, limit: number): Promise<AlertRecord[]>;
  /** False when no such alert exists for this recipient. */
  markRead(id: string, recipientId: string, at: Date): Promise<boolean>;
}

export function createMemoryAlertRepo(): AlertRepo {
  const rows: AlertRecord[] = [];
  return {
    async insert(a) {
      const row = { ...structuredClone(a), id: randomUUID(), createdAt: new Date(), readAt: null };
      rows.push(row);
      return structuredClone(row);
    },
    async listForRecipient(recipientId, limit) {
      return rows
        .filter((r) => r.recipientId === recipientId && r.channel === "in_app")
        .reverse()
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },
    async markRead(id, recipientId, at) {
      const r = rows.find((x) => x.id === id && x.recipientId === recipientId);
      if (!r) return false;
      r.readAt ??= at;
      return true;
    },
  };
}
