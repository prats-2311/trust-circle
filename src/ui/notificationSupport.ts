export type NotificationState =
  | "unsupported" // no serviceWorker or PushManager
  | "ios_needs_install" // iPhone/iPad and not standalone
  | "server_off" // /api/push/config publicKey null
  | "denied"
  | "ask"
  | "on";

export type NotificationEnv = {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isIos: boolean;
  isStandalone: boolean;
  permission: "default" | "denied" | "granted";
  publicKey: string | null;
  /** True only when the server accepted this device for this account, not merely when the browser holds a subscription. */
  subscribed: boolean;
};

export function notificationState(env: NotificationEnv): NotificationState {
  if (!env.hasServiceWorker || !env.hasPushManager) {
    // iOS only adds PushManager to apps installed to the Home Screen.
    return env.isIos && !env.isStandalone ? "ios_needs_install" : "unsupported";
  }
  if (!env.publicKey) return "server_off";
  if (env.permission === "denied") return "denied";
  if (env.subscribed && env.permission === "granted") return "on";
  return "ask";
}

const STILL_HERE = "You'll still see every alert here in Trust Circle.";

const COPY: Record<NotificationState, { title: string; body: string; action: string | null }> = {
  unsupported: { title: "This browser can't show alerts", body: STILL_HERE, action: null },
  ios_needs_install: {
    title: "Add Trust Circle to your Home Screen first",
    body: "On iPhone, tap the Share button, then \"Add to Home Screen\". Open Trust Circle from there to turn on alerts.",
    action: null,
  },
  server_off: { title: "Phone alerts aren't set up on this server", body: STILL_HERE, action: null },
  denied: {
    title: "Alerts are blocked for this site",
    body: "To turn them on, allow notifications for Trust Circle in your browser settings, then come back.",
    action: null,
  },
  ask: {
    title: "Get an alert when something needs you",
    body: "We'll only alert you about payments and checks in your circle.",
    action: "Turn on alerts",
  },
  on: { title: "Alerts are on for this device", body: "We'll alert you on this device and in Trust Circle.", action: "Turn off alerts" },
};

export function notificationCopy(s: NotificationState): { title: string; body: string; action: string | null } {
  return COPY[s];
}
