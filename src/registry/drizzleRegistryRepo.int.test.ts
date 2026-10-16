import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleRegistryRepo } from "./drizzleRegistryRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let a: string;
let b: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [ua] = await handle.db.insert(users).values({ email: "a@example.com", displayName: "A" }).returning();
  const [ub] = await handle.db.insert(users).values({ email: "b@example.com", displayName: "B" }).returning();
  a = ua!.id;
  b = ub!.id;
});
afterAll(async () => handle?.close());

describe("drizzle registry repo", () => {
  it("upserts by key, keeps the first scam type, and refuses duplicate reports", async () => {
    const repo = createDrizzleRegistryRepo(handle.db);
    const e1 = await repo.upsertEntry({ identifierType: "phone", key: "4155550199", scamType: "invoice" });
    const e2 = await repo.upsertEntry({ identifierType: "phone", key: "4155550199", scamType: "romance" });
    expect(e2.id).toBe(e1.id);
    expect(e2.scamType).toBe("invoice");
    expect(await repo.addReport({ entryId: e1.id, reporterId: a, source: "message_report" })).toBe(true);
    expect(await repo.addReport({ entryId: e1.id, reporterId: a, source: "message_report" })).toBe(false);
    expect(await repo.reportsFor(e1.id)).toEqual([{ reporterId: a, source: "message_report" }]);
  });

  it("lists keys by status", async () => {
    const repo = createDrizzleRegistryRepo(handle.db);
    const e = await repo.upsertEntry({ identifierType: "email", key: "x@y.example", scamType: "other" });
    await repo.upsertEntry({ identifierType: "url", key: "evil.example/login", scamType: "other" });
    await repo.setStatus(e.id, "confirmed", new Date("2026-11-01T10:00:00Z"));
    expect(await repo.listKeys()).toEqual({ confirmed: ["x@y.example"], unconfirmed: ["evil.example/login"] });
  });

  it("counts reports per Monday week and scam type", async () => {
    const repo = createDrizzleRegistryRepo(handle.db);
    const e = await repo.upsertEntry({ identifierType: "phone", key: "2125550178", scamType: "impersonation_family" });
    // 2026-10-14 is a Wednesday; its week starts Monday 2026-10-12.
    await repo.addReport({ entryId: e.id, reporterId: a, source: "message_report", at: new Date("2026-10-14T12:00:00Z") });
    await repo.addReport({ entryId: e.id, reporterId: b, source: "message_report", at: new Date("2026-10-15T12:00:00Z") });
    expect(await repo.weeklyCounts(new Date("2026-10-01T00:00:00Z"))).toEqual([
      { week: "2026-10-12", scamType: "impersonation_family", count: 2 },
    ]);
  });
});
