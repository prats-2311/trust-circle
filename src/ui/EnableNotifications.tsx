"use client";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { fetchJson, jsonBody } from "./fetchJson";
import { BellIcon, InfoIcon } from "./icons";
import { Notice } from "./Notice";
import { SignedOut } from "./SignedOut";
import { notificationCopy, notificationState, type NotificationEnv, type NotificationState } from "./notificationSupport";
import { useOnce } from "./useOnce";

const TURN_ON_FAILED = "We couldn't turn on alerts on this device. You'll still get them here and by email.";
const TURN_OFF_FAILED = "We couldn't turn off alerts on this device. Please try again.";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const READY_TIMEOUT_MS = 5000;

/** `navigator.serviceWorker.ready` never settles when no worker can install, so it is raced against a timeout. */
function swReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("service worker not ready")), READY_TIMEOUT_MS)),
  ]);
}

type Loaded = { kind: "ok"; env: NotificationEnv; notice: string | null; conflict: boolean } | { kind: "config_error" } | { kind: "signed_out" };

async function readEnv(): Promise<Loaded> {
  const config = await fetchJson<{ publicKey: string | null }>("/api/push/config");
  if (!config.ok) return config.signedOut ? { kind: "signed_out" } : { kind: "config_error" };
  let publicKey = config.data.publicKey;

  let hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  let subscribed = false;
  let notice: string | null = null;
  let conflict = false;
  if (hasServiceWorker && hasPushManager) {
    try {
      const sub = await (await swReady()).pushManager.getSubscription();
      if (sub && publicKey) {
        // "On" means the server accepted this device for this account, not just that the browser has a subscription.
        const res = await fetchJson("/api/push/subscription", jsonBody(JSON.parse(JSON.stringify(sub))));
        if (res.ok) subscribed = res.status === 201;
        else if (res.signedOut) return { kind: "signed_out" };
        else if (res.status === 503) publicKey = null;
        else if (res.status === 409) {
          notice = res.error;
          conflict = true;
        } else return { kind: "config_error" };
      }
    } catch {
      hasServiceWorker = false;
    }
  }
  return {
    kind: "ok",
    notice,
    conflict,
    env: {
      hasServiceWorker,
      hasPushManager,
      isIos: /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
      isStandalone: window.matchMedia("(display-mode: standalone)").matches,
      permission: typeof Notification === "undefined" ? "default" : Notification.permission,
      publicKey,
      subscribed,
    },
  };
}

export function EnableNotifications({ onDone }: { onDone?: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [env, setEnv] = useState<NotificationEnv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { busy, run } = useOnce();

  useEffect(() => {
    let live = true;
    readEnv().then((l) => {
      if (!live) return;
      setLoaded(l);
      if (l.kind === "ok") {
        setEnv(l.env);
        setError(l.notice);
        setConflict(l.conflict);
      }
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  if (loaded?.kind === "signed_out") return <SignedOut />;
  if (loaded?.kind === "config_error") {
    return (
      <Card>
        <div data-testid="notifications" data-state="config_error" className="space-y-4">
          <Notice tone="error">We couldn&apos;t check alerts just now.</Notice>
          <Button
            data-testid="notifications-retry"
            variant="secondary"
            onClick={() => {
              setLoaded(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  if (!env) {
    return (
      <Card>
        <div data-testid="notifications" data-state="loading" aria-busy="true" className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-ground motion-reduce:animate-none" />
          <div className="h-5 w-full animate-pulse rounded bg-ground motion-reduce:animate-none" />
        </div>
      </Card>
    );
  }

  const state: NotificationState = notificationState(env);
  const copy = notificationCopy(state);
  const Icon = state === "ask" || state === "on" ? BellIcon : InfoIcon;

  const turnOn = () =>
    run(async () => {
      setError(null);
      try {
        const reg = await swReady();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(env.publicKey!),
        });
        const res = await fetchJson("/api/push/subscription", jsonBody(JSON.parse(JSON.stringify(sub))));
        if (!res.ok) {
          if (res.status === 409) {
            // The subscription may belong to another account on this device, so it is left alone.
            setError(res.error);
            setConflict(true);
            return;
          }
          // Don't keep a browser subscription the server refused.
          await sub.unsubscribe().catch(() => {});
          if (res.status === 503) setEnv({ ...env, publicKey: null });
          else setError(TURN_ON_FAILED);
          return;
        }
        setEnv({ ...env, permission: "granted", subscribed: true });
        onDone?.();
      } catch {
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          setEnv({ ...env, permission: "denied" });
        } else {
          setError(TURN_ON_FAILED);
        }
      }
    });

  const turnOff = () =>
    run(async () => {
      setError(null);
      try {
        const sub = await (await swReady()).pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await fetchJson("/api/push/subscription", { ...jsonBody({ endpoint }), method: "DELETE" });
        }
        setEnv({ ...env, subscribed: false });
      } catch {
        setError(TURN_OFF_FAILED);
      }
    });

  return (
    <Card>
      <div data-testid="notifications" data-state={state} className="space-y-4">
        <div className="flex items-start gap-3">
          <Icon aria-hidden="true" size={28} weight="bold" className="mt-0.5 flex-none text-evergreen" />
          <div className="space-y-1">
            <h3 className="text-[20px] font-bold leading-snug text-ink">{copy.title}</h3>
            <p className="text-[17px] leading-snug text-ink-2">{copy.body}</p>
          </div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {copy.action && !conflict && (
          <Button
            data-testid="notifications-action"
            variant={state === "on" ? "secondary" : "primary"}
            disabled={busy}
            onClick={state === "on" ? turnOff : turnOn}
          >
            {copy.action}
          </Button>
        )}
      </div>
    </Card>
  );
}
