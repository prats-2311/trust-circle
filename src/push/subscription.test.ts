import { parse as legacyParse } from "node:url";
import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, parsePushSub } from "./subscription";

const good = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};

describe("parsePushSub", () => {
  it("accepts a realistic subscription", () => {
    expect(parsePushSub(good)).toEqual(good);
  });
  it("drops unknown fields such as expirationTime", () => {
    expect(parsePushSub({ ...good, expirationTime: null })).toEqual(good);
  });
  it("rejects a non-https endpoint", () => {
    expect(parsePushSub({ ...good, endpoint: "http://fcm.googleapis.com/x" })).toBeNull();
    expect(parsePushSub({ ...good, endpoint: "not a url" })).toBeNull();
  });
  it.each([
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/x",
    "https://api.push.apple.com/x",
    "https://wns2-par02p.notify.windows.com/x",
  ])("accepts the push service %s", (endpoint) => {
    expect(parsePushSub({ ...good, endpoint })).toEqual({ ...good, endpoint });
  });
  it.each([
    "https://evil.example/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilpush.apple.com.example/x",
    "https://notnotify.windows.com/x",
    "https://localhost/x",
    "https://10.0.0.1/x",
  ])("rejects the unknown host %s", (endpoint) => {
    expect(parsePushSub({ ...good, endpoint })).toBeNull();
  });
  it("rejects a missing or non-base64url key", () => {
    expect(parsePushSub({ ...good, keys: { p256dh: good.keys.p256dh } })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, auth: "has spaces!" } })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, auth: "" } })).toBeNull();
  });
  it("rejects an endpoint over 2048 characters and keys over 256", () => {
    expect(parsePushSub({ ...good, endpoint: `https://fcm.googleapis.com/${"a".repeat(2040)}` })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, p256dh: "a".repeat(257) } })).toBeNull();
  });
  it("rejects non-objects and wrong nesting", () => {
    expect(parsePushSub(null)).toBeNull();
    expect(parsePushSub("x")).toBeNull();
    expect(parsePushSub({ endpoint: good.endpoint, keys: "x" })).toBeNull();
    expect(parsePushSub({ endpoint: good.endpoint, keys: { p256dh: { a: 1 }, auth: "a" } })).toBeNull();
  });

  const ACCEPTED = [
    "https://fcm.googleapis.com/fcm/send/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://web.push.apple.com/x",
    "https://api.push.apple.com/x",
    "https://wns2-par02p.notify.windows.com/x",
  ];
  it.each([
    // Parser differentials: WHATWG URL and the legacy url.parse that web-push uses see different hosts.
    "https://evil.example;.push.apple.com/x",
    "https://evil.example%E3%80%82push.apple.com/x",
    "https://10.0.0.1;.push.apple.com/x",
    "https://localhost%E3%80%82push.apple.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user@fcm.googleapis.com/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://FCM.googleapis.com/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example\\.push.apple.com/x",
    "https://evil.example\t.push.apple.com/x",
    "https://evil.example\n.push.apple.com/x",
    "https://fcm.googleapis.com", // not canonical: href adds a trailing slash
  ])("rejects the non-canonical or spoofed endpoint %j", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    expect(parsePushSub({ ...good, endpoint })).toBeNull();
  });
  it.each(ACCEPTED)("both URL parsers agree on the host of %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    expect(legacyParse(endpoint).hostname).toBe(new URL(endpoint).hostname);
  });
});
