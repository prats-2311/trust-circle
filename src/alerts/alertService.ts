import type { CircleRepo } from "@/circle/circleRepo";
import { alertCopy } from "./alertCopy";
import type { AlertKind, AlertPayload, AlertRepo, AlertStatus } from "./alertRepo";
import type { EmailSender } from "./emailSender";

export interface AlertView {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  path: string;
  paymentId: string | null;
  verificationId: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export function createAlertService(deps: {
  repo: AlertRepo;
  users: Pick<CircleRepo, "getUser">;
  email?: EmailSender;
  appUrl: string;
  /** Whether a verify request can still be answered. Closed ones are left out of the list. */
  isVerifyRequestOpen?: (a: { paymentId: string | null; verificationId: string | null }) => Promise<boolean>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const appUrl = deps.appUrl.replace(/\/+$/, "");

  return {
    async notify(a: { recipientId: string; kind: AlertKind; paymentId?: string; verificationId?: string; payload: AlertPayload }): Promise<void> {
      const base = {
        recipientId: a.recipientId,
        kind: a.kind,
        paymentId: a.paymentId ?? null,
        verificationId: a.verificationId ?? null,
        payload: a.payload,
      };
      await deps.repo.insert({ ...base, channel: "in_app", status: "sent" });
      // Email always goes alongside in-app (push joins in Plan 4). A delivery failure is recorded, never thrown.
      let status: AlertStatus = "skipped";
      const user = deps.email ? await deps.users.getUser(a.recipientId) : null;
      if (deps.email && user) {
        const copy = alertCopy(base);
        try {
          await deps.email({ to: user.email, subject: copy.title, text: `${copy.body}\n\nOpen Trust Circle: ${appUrl}${copy.path}` });
          status = "sent";
        } catch (e) {
          status = "failed";
          console.warn("alert email failed", { kind: a.kind, error: e instanceof Error ? e.message : "unknown" });
        }
      }
      await deps.repo.insert({ ...base, channel: "email", status });
    },

    async list(recipientId: string): Promise<AlertView[]> {
      const rows = await deps.repo.listForRecipient(recipientId, 50);
      const visible: typeof rows = [];
      for (const r of rows) {
        if (r.kind === "verify_request" && deps.isVerifyRequestOpen && !(await deps.isVerifyRequestOpen(r))) continue;
        visible.push(r);
      }
      return visible.map((r) => ({
        id: r.id,
        kind: r.kind,
        ...alertCopy(r),
        paymentId: r.paymentId,
        verificationId: r.verificationId,
        createdAt: r.createdAt,
        readAt: r.readAt,
      }));
    },

    markRead(id: string, recipientId: string): Promise<boolean> {
      return deps.repo.markRead(id, recipientId, now());
    },
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
