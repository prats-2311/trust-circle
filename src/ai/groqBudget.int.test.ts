import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDrizzleAiUsage } from "./groqBudget";
import { freshTestDb } from "@/test/db";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  await handle.db.execute(sql`TRUNCATE ai_usage`);
});
afterAll(async () => handle?.close());

describe("ai usage counter", () => {
  it("counts 10 concurrent calls exactly", async () => {
    const count = createDrizzleAiUsage(handle.db);
    const totals = await Promise.all(Array.from({ length: 10 }, () => count("2026-11-05")));
    expect([...totals].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await count("2026-11-05")).toBe(11);
    expect(await count("2026-11-06")).toBe(1);
  });
});
