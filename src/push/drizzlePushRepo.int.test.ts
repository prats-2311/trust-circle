import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzlePushRepo } from "./drizzlePushRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let a: string;
let b: string;
const at = new Date("2026-11-01T10:00:00Z");
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const rows = await handle.db.insert(users).values([
    { email: "a@example.com", displayName: "A" },
    { email: "b@example.com", displayName: "B" },
  ]).returning();
  a = rows[0]!.id;
  b = rows[1]!.id;
});
afterAll(async () => handle?.close());

describe("drizzle push repo", () => {
  it("saves and lists a subscription", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    expect(await repo.listForUser(a)).toEqual([sub(1)]);
    expect(await repo.listForUser(b)).toEqual([]);
  });
  it("refuses to move an endpoint to another user with different keys", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    expect(await repo.save(a, sub(1), at)).toBe("saved");
    expect(await repo.save(b, { ...sub(1), keys: { p256dh: "new", auth: "new" } }, at)).toBe("conflict");
    expect(await repo.listForUser(a)).toEqual([sub(1)]);
    expect(await repo.listForUser(b)).toEqual([]);
  });
  it("lets the same user update their own keys", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    expect(await repo.save(a, { ...sub(1), keys: { p256dh: "new", auth: "new" } }, at)).toBe("saved");
    expect(await repo.listForUser(a)).toEqual([{ ...sub(1), keys: { p256dh: "new", auth: "new" } }]);
  });
  it("moves an endpoint to another user only when the keys are identical", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    expect(await repo.save(b, sub(1), at)).toBe("saved");
    expect(await repo.listForUser(a)).toEqual([]);
    expect(await repo.listForUser(b)).toEqual([sub(1)]);
  });
  it("removes by endpoint", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    await repo.remove(sub(1).endpoint);
    expect(await repo.listForUser(a)).toEqual([]);
  });
  it("removeForUser refuses someone else's endpoint", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    expect(await repo.removeForUser(b, sub(1).endpoint)).toBe(false);
    expect(await repo.listForUser(a)).toHaveLength(1);
    expect(await repo.removeForUser(a, sub(1).endpoint)).toBe(true);
    expect(await repo.listForUser(a)).toEqual([]);
  });
  it("counts a user's subscriptions", async () => {
    const repo = createDrizzlePushRepo(handle.db);
    await repo.save(a, sub(1), at);
    await repo.save(a, sub(2), at);
    await repo.save(b, sub(3), at);
    expect(await repo.countForUser(a)).toBe(2);
    expect(await repo.countForUser(b)).toBe(1);
  });
});
