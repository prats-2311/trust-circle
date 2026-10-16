import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleMessageRepo } from "./drizzleMessageRepo";
import type { NewMessageCheck } from "./messageRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let senderId: string;
const check = (over: Partial<NewMessageCheck> = {}): NewMessageCheck => ({
  senderId, source: "text", text: "hello", checked: true, level: "low", scamType: "none", reasons: [],
  identifiers: [{ type: "phone", value: "+14155550199" }], ...over,
});

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [s] = await handle.db.insert(users).values({ email: "m@example.com", displayName: "Margaret" }).returning();
  senderId = s!.id;
});
afterAll(async () => handle?.close());

describe("drizzle message repo", () => {
  it("round-trips a check including identifiers and reasons", async () => {
    const repo = createDrizzleMessageRepo(handle.db);
    const saved = await repo.insert(check({ level: "high", scamType: "impersonation_family", reasons: ["Asks for gift cards."] }));
    const [read] = await repo.listBySender(senderId, 10);
    expect(read).toEqual(saved);
    expect(read!.identifiers).toEqual([{ type: "phone", value: "+14155550199" }]);
  });
  it("lists newest first and honours the limit", async () => {
    const repo = createDrizzleMessageRepo(handle.db);
    await repo.insert(check({ text: "first" }));
    await repo.insert(check({ text: "second" }));
    await repo.insert(check({ text: "third" }));
    expect((await repo.listBySender(senderId, 2)).map((c) => c.text)).toEqual(["third", "second"]);
  });
  it("returns nothing for a non-uuid sender", async () => {
    expect(await createDrizzleMessageRepo(handle.db).listBySender("nope", 10)).toEqual([]);
  });
});
