import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scamPatterns, users } from "@/db/schema";
import { createDrizzleMessageRepo } from "@/messages/drizzleMessageRepo";
import { freshTestDb } from "@/test/db";
import { createDrizzleScamReportRepo } from "./drizzleScamReportRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let userId: string;
let checkId: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [u] = await handle.db.insert(users).values({ email: "m@example.com", displayName: "Margaret" }).returning();
  userId = u!.id;
  const c = await createDrizzleMessageRepo(handle.db).insert({
    senderId: userId, source: "text", text: "hi", checked: true, level: "high", scamType: "other", reasons: [], identifiers: [],
  });
  checkId = c.id;
});
afterAll(async () => handle?.close());

describe("drizzle scam report repo", () => {
  it("is idempotent per check and finds by check", async () => {
    const repo = createDrizzleScamReportRepo(handle.db);
    const { record: a, created } = await repo.insert({ reporterId: userId, messageCheckId: checkId, patternId: null, subject: "s", body: "b" });
    const { record: b, created: createdAgain } = await repo.insert({ reporterId: userId, messageCheckId: checkId, patternId: null, subject: "s2", body: "b2" });
    expect(created).toBe(true);
    expect(createdAgain).toBe(false);
    expect(b.id).toBe(a.id);
    expect((await repo.findByCheck(checkId))!.subject).toBe("s");
    expect(await repo.findByCheck("not-a-uuid")).toBeNull();
  });
  it("persists the pattern id once it is known", async () => {
    const repo = createDrizzleScamReportRepo(handle.db);
    const { record } = await repo.insert({ reporterId: userId, messageCheckId: checkId, patternId: null, subject: "s", body: "b" });
    const [p] = await handle.db.insert(scamPatterns).values({ description: "A plain script description here.", scamType: "other", embedding: new Array<number>(384).fill(0.01) }).returning();
    await repo.setPattern(record.id, p!.id);
    expect((await repo.findByCheck(checkId))!.patternId).toBe(p!.id);
  });
});
