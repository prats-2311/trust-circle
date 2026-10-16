import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
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
    const a = await repo.insert({ reporterId: userId, messageCheckId: checkId, patternId: null, subject: "s", body: "b" });
    const b = await repo.insert({ reporterId: userId, messageCheckId: checkId, patternId: null, subject: "s2", body: "b2" });
    expect(b.id).toBe(a.id);
    expect((await repo.findByCheck(checkId))!.subject).toBe("s");
    expect(await repo.findByCheck("not-a-uuid")).toBeNull();
  });
});
