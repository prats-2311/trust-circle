import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { trustLinks, users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleCircleRepo } from "./drizzleCircleRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let margaretId: string;
let danielId: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [m] = await handle.db.insert(users).values({ email: "m@example.com", displayName: "Margaret" }).returning();
  const [d] = await handle.db.insert(users).values({ email: "d@example.com", displayName: "Daniel" }).returning();
  margaretId = m!.id;
  danielId = d!.id;
  await handle.db.insert(trustLinks).values({ senderId: margaretId, contactId: danielId, relationship: "grandson" });
});
afterAll(async () => handle?.close());

describe("drizzle circle repo", () => {
  it("lists contacts with display names", async () => {
    const repo = createDrizzleCircleRepo(handle.db);
    expect(await repo.contactsOf(margaretId)).toEqual([{ contactId: danielId, displayName: "Daniel", relationship: "grandson" }]);
  });
  it("reads and updates a user's safe-word hash", async () => {
    const repo = createDrizzleCircleRepo(handle.db);
    expect((await repo.getUser(margaretId))!.safeWordHash).toBeNull();
    await repo.setSafeWordHash(margaretId, "scrypt$x$y");
    expect(await repo.getUser(margaretId)).toEqual({ id: margaretId, email: "m@example.com", displayName: "Margaret", safeWordHash: "scrypt$x$y" });
  });
  it("returns null for unknown and non-uuid ids", async () => {
    const repo = createDrizzleCircleRepo(handle.db);
    expect(await repo.getUser(randomUUID())).toBeNull();
    expect(await repo.getUser("not-a-uuid")).toBeNull();
  });
  it("finds a user by email, ignoring case", async () => {
    const repo = createDrizzleCircleRepo(handle.db);
    expect((await repo.getUserByEmail("M@Example.com"))?.id).toBe(margaretId);
    expect(await repo.getUserByEmail("nobody@example.com")).toBeNull();
  });
  it("lists who a contact looks after", async () => {
    const repo = createDrizzleCircleRepo(handle.db);
    expect(await repo.sendersOf(danielId)).toEqual([{ senderId: margaretId, displayName: "Margaret", relationship: "grandson" }]);
    expect(await repo.sendersOf(margaretId)).toEqual([]);
    expect(await repo.sendersOf("not-a-uuid")).toEqual([]);
  });
});
