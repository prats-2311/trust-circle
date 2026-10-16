"use client";
import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { fetchJson, jsonBody } from "./fetchJson";
import { BellIcon, InfoIcon } from "./icons";
import { Notice } from "./Notice";
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

async function readEnv(): Promise<NotificationEnv> {
  const config = await fetchJson<{ publicKey: string | null }>("/api/push/config");
  const publicKey = config.ok ? config.data.publicKey : null;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  let subscribed = false;
  if (hasServiceWorker && hasPushManager) {
    try {
      subscribed = Boolean(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
    } catch {
      subscribed = false;
    }
  }
  return {
    hasServiceWorker,
    hasPushManager,
    isIos: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isStandalone: window.matchMedia("(display-mode: standalone)").matches,
    permission: typeof Notification === "undefined" ? "default" : Notification.permission,
    publicKey,
    subscribed,
  };
}

export function EnableNotifications({ onDone }: { onDone?: () => void }) {
  const [env, setEnv] = useState<NotificationEnv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useOnce();

  useEffect(() => {
    let live = true;
    readEnv().then((e) => {
      if (live) setEnv(e);
    });
    return () => {
      live = false;
    };
  }, []);

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
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(env.publicKey!),
        });
        const res = await fetchJson("/api/push/subscription", jsonBody(JSON.parse(JSON.stringify(sub))));
        if (!res.ok) {
          // Don't keep a browser subscription the server refused.
          await sub.unsubscribe().catch(() => {});
          setError(res.status === 409 || res.status === 503 ? res.error : TURN_ON_FAILED);
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
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
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
        {copy.action && (
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
