import type { CircleRepo } from "@/circle/circleRepo";
import type { PushRepo } from "@/push/pushRepo";
import type { PushSender } from "@/push/pushSender";
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
  push?: { repo: PushRepo; send: PushSender };
  /** How long push and email may each take before they are recorded as failed. */
  timeoutMs?: number;
  appUrl: string;
  /** Whether an alert still needs attention (a verify request that can be answered, a hold that is still held). Closed ones are left out of the list. */
  isAlertOpen?: (a: { kind: AlertKind; paymentId: string | null; verificationId: string | null }) => Promise<boolean>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? 5_000;
  const appUrl = deps.appUrl.replace(/\/+$/, "");

  /** Resolves with the work's result, or "failed" when it throws or takes longer than the timeout. */
  async function withTimeout(work: () => Promise<AlertStatus>, onError: (e: unknown) => void): Promise<AlertStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cutOff = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    try {
      const r = await Promise.race([Promise.resolve().then(work), cutOff]);
      if (r === "timeout") {
        onError("timeout");
        return "failed";
      }
      return r;
    } catch (e) {
      onError(e);
      return "failed";
    } finally {
      clearTimeout(timer);
    }
  }

  type Base = Parameters<typeof alertCopy>[0] & { recipientId: string };

  function sendPush(kind: AlertKind, base: Base): Promise<AlertStatus> {
    const push = deps.push;
    if (!push) return Promise.resolve("skipped");
    return withTimeout(
      async () => {
        const subs = await push.repo.listForUser(base.recipientId);
        if (subs.length === 0) return "skipped";
        const copy = alertCopy(base);
        const payload = JSON.stringify({ title: copy.title, body: copy.body, url: copy.path, tag: `${kind}:${base.paymentId ?? base.verificationId}` });
        const results = await Promise.allSettled(
          subs.map(async (sub) => {
            try {
              await push.send(sub, payload);
            } catch (e) {
              const status = (e as { statusCode?: unknown } | null)?.statusCode;
              console.warn("alert push failed", { kind, status: typeof status === "number" ? status : undefined });
              if (status === 404 || status === 410) await push.repo.remove(sub.endpoint).catch(() => {});
              throw e;
            }
          }),
        );
        return results.some((r) => r.status === "fulfilled") ? "sent" : "failed";
      },
      (e) => console.warn("alert push failed", { kind, status: e === "timeout" ? "timeout" : undefined }),
    );
  }

  function sendEmail(kind: AlertKind, base: Base): Promise<AlertStatus> {
    const email = deps.email;
    if (!email) return Promise.resolve("skipped");
    return withTimeout(
      async () => {
        const user = await deps.users.getUser(base.recipientId);
        if (!user) return "skipped";
        const copy = alertCopy(base);
        await email({ to: user.email, subject: copy.title, text: `${copy.body}\n\nOpen Trust Circle: ${appUrl}${copy.path}` });
        return "sent";
      },
      (e) => console.warn("alert email failed", { kind, error: e === "timeout" ? "timeout" : e instanceof Error ? e.message : "unknown" }),
    );
  }

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
      // Push and email go alongside in-app, at the same time. A delivery failure is recorded, never thrown.
      const [pushStatus, emailStatus] = await Promise.all([sendPush(a.kind, base), sendEmail(a.kind, base)]);
      await deps.repo.insert({ ...base, channel: "push", status: pushStatus });
      await deps.repo.insert({ ...base, channel: "email", status: emailStatus });
    },

    async list(recipientId: string): Promise<AlertView[]> {
      const rows = await deps.repo.listForRecipient(recipientId, 50);
      const visible: typeof rows = [];
      for (const r of rows) {
        if ((r.kind === "verify_request" || r.kind === "payment_held") && deps.isAlertOpen && !(await deps.isAlertOpen(r))) continue;
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
