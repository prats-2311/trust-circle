import { describe, expect, it } from "vitest";
import { notificationCopy, notificationState, type NotificationState } from "./notificationSupport";

const base = {
  hasServiceWorker: true,
  hasPushManager: true,
  isIos: false,
  isStandalone: false,
  permission: "default" as const,
  publicKey: "KEY" as string | null,
  subscribed: false,
};

describe("notificationState", () => {
  it("is unsupported without a service worker", () => {
    expect(notificationState({ ...base, hasServiceWorker: false })).toBe("unsupported");
  });
  it("is unsupported without PushManager", () => {
    expect(notificationState({ ...base, hasPushManager: false })).toBe("unsupported");
  });
  it("asks an uninstalled iPhone to add to the Home Screen", () => {
    expect(notificationState({ ...base, isIos: true, hasPushManager: false })).toBe("ios_needs_install");
  });
  it("lets an installed iPhone with PushManager through to ask", () => {
    expect(notificationState({ ...base, isIos: true, isStandalone: true })).toBe("ask");
  });
  it("is server_off when there is no public key", () => {
    expect(notificationState({ ...base, publicKey: null })).toBe("server_off");
  });
  it("is denied when permission is denied", () => {
    expect(notificationState({ ...base, permission: "denied" })).toBe("denied");
  });
  it("is on when subscribed and granted", () => {
    expect(notificationState({ ...base, permission: "granted", subscribed: true })).toBe("on");
  });
  it("is ask when granted but not subscribed", () => {
    expect(notificationState({ ...base, permission: "granted" })).toBe("ask");
  });
  it("is ask by default", () => {
    expect(notificationState(base)).toBe("ask");
  });
});

describe("notificationCopy", () => {
  const rows: [NotificationState, string, string, string | null][] = [
    ["unsupported", "This browser can't show alerts", "You'll still see every alert here in Trust Circle.", null],
    ["ios_needs_install", "Add Trust Circle to your Home Screen first", "On iPhone, tap the Share button, then \"Add to Home Screen\". Open Trust Circle from there to turn on alerts.", null],
    ["server_off", "Phone alerts aren't set up on this server", "You'll still see every alert here in Trust Circle.", null],
    ["denied", "Alerts are blocked for this site", "To turn them on, allow notifications for Trust Circle in your browser settings, then come back.", null],
    ["ask", "Get an alert when something needs you", "We'll only alert you about payments and checks in your circle.", "Turn on alerts"],
    ["on", "Alerts are on for this device", "We'll alert you on this device and in Trust Circle.", "Turn off alerts"],
  ];
  it.each(rows)("%s", (state, title, body, action) => {
    expect(notificationCopy(state)).toEqual({ title, body, action });
  });
});
