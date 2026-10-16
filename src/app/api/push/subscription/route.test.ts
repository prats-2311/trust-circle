import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryPushRepo, type PushRepo } from "@/push/pushRepo";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const U = "11111111-1111-4111-8111-111111111111";
const V = "22222222-2222-4222-8222-222222222222";
const at = new Date("2026-11-01T10:00:00Z");
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

let push: PushRepo;
let vapid: Record<string, string> = {};
vi.mock("@/server/container", () => ({ getContainer: () => ({ push, env: { SESSION_SECRET: SECRET, ...vapid } }) }));
import { DELETE, POST } from "./route";

beforeEach(() => {
  push = createMemoryPushRepo();
  vapid = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" };
});

const cookie = (userId?: string): Record<string, string> =>
  userId ? { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } : {};
const post = (body: unknown, userId?: string) =>
  POST(new Request("http://x/api/push/subscription", { method: "POST", body: JSON.stringify(body), headers: cookie(userId) }));
const del = (body: unknown, userId?: string) =>
  DELETE(new Request("http://x/api/push/subscription", { method: "DELETE", body: JSON.stringify(body), headers: cookie(userId) }));

describe("/api/push/subscription", () => {
  it("answers 401 when signed out", async () => {
    expect((await post(sub(1))).status).toBe(401);
    expect((await del({ endpoint: sub(1).endpoint })).status).toBe(401);
  });
  it("answers 503 when push is not configured on this server", async () => {
    vapid = {};
    const res = await post(sub(1), U);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Phone alerts aren't set up on this server." });
    expect(await push.countForUser(U)).toBe(0);
  });
  it("answers 409 when another account has the device with different keys, and leaves the owner's row", async () => {
    await push.save(V, sub(1), at);
    const res = await post({ ...sub(1), keys: { p256dh: "other", auth: "other" } }, U);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This device is already set up for alerts on another account." });
    expect(await push.listForUser(V)).toEqual([sub(1)]);
    expect(await push.listForUser(U)).toEqual([]);
  });
  it("moves the device when another account re-subscribes with the same keys", async () => {
    await push.save(V, sub(1), at);
    expect((await post(sub(1), U)).status).toBe(201);
    expect(await push.listForUser(U)).toEqual([sub(1)]);
    expect(await push.listForUser(V)).toEqual([]);
  });
  it("updates the keys when the same user re-saves with new keys", async () => {
    await push.save(U, sub(1), at);
    const next = { ...sub(1), keys: { p256dh: "new", auth: "new" } };
    expect((await post(next, U)).status).toBe(201);
    expect(await push.listForUser(U)).toEqual([next]);
  });
  it("answers 400 for a bad body", async () => {
    expect((await post({ endpoint: "http://x", keys: {} }, U)).status).toBe(400);
    expect((await del({}, U)).status).toBe(400);
  });
  it("saves a subscription with 201", async () => {
    const res = await post(sub(1), U);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(await push.listForUser(U)).toEqual([sub(1)]);
  });
  it("answers 409 at five devices for a new endpoint, but 201 when re-saving one of the five", async () => {
    for (let i = 1; i <= 5; i++) await push.save(U, sub(i), at);
    const res = await post(sub(6), U);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This account already has notifications on 5 devices." });
    expect((await post(sub(3), U)).status).toBe(201);
    expect(await push.countForUser(U)).toBe(5);
  });
  it("DELETE answers 204 and removes only the caller's own endpoint", async () => {
    await push.save(U, sub(1), at);
    await push.save(V, sub(2), at);
    expect((await del({ endpoint: sub(2).endpoint }, U)).status).toBe(204);
    expect(await push.listForUser(V)).toEqual([sub(2)]);
    expect((await del({ endpoint: sub(1).endpoint }, U)).status).toBe(204);
    expect(await push.listForUser(U)).toEqual([]);
  });
});
