import { describe, expect, it } from "vitest";
import { parsePushSub } from "./subscription";

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
  it("rejects a missing or non-base64url key", () => {
    expect(parsePushSub({ ...good, keys: { p256dh: good.keys.p256dh } })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, auth: "has spaces!" } })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, auth: "" } })).toBeNull();
  });
  it("rejects an endpoint over 2048 characters and keys over 256", () => {
    expect(parsePushSub({ ...good, endpoint: `https://x.example/${"a".repeat(2040)}` })).toBeNull();
    expect(parsePushSub({ ...good, keys: { ...good.keys, p256dh: "a".repeat(257) } })).toBeNull();
  });
  it("rejects non-objects and wrong nesting", () => {
    expect(parsePushSub(null)).toBeNull();
    expect(parsePushSub("x")).toBeNull();
    expect(parsePushSub({ endpoint: good.endpoint, keys: "x" })).toBeNull();
    expect(parsePushSub({ endpoint: good.endpoint, keys: { p256dh: { a: 1 }, auth: "a" } })).toBeNull();
  });
});
