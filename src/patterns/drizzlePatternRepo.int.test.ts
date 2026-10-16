import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { freshTestDb } from "@/test/db";
import { createDrizzlePatternRepo } from "./drizzlePatternRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
});
afterAll(async () => handle?.close());

const unit = (...weights: [number, number][]) => {
  const v = Array.from({ length: 384 }, () => 0);
  for (const [i, w] of weights) v[i] = w;
  return v;
};

describe("drizzle pattern repo", () => {
  it("returns the nearest patterns first with cosine similarity", async () => {
    const repo = createDrizzlePatternRepo(handle.db);
    await repo.insert({ description: "bail scam", scamType: "impersonation_family", embedding: unit([0, 1]) });
    await repo.insert({ description: "invoice scam", scamType: "invoice", embedding: unit([1, 1]) });
    const [best, second] = await repo.nearest(unit([0, 1]), 2);
    expect(best!.pattern).toMatchObject({ description: "bail scam", scamType: "impersonation_family", reportCount: 1 });
    expect(best!.similarity).toBeCloseTo(1, 5);
    expect(second!.pattern.description).toBe("invoice scam");
  });
  it("is idempotent on description and increments report counts", async () => {
    const repo = createDrizzlePatternRepo(handle.db);
    const a = await repo.insert({ description: "bail scam", scamType: "impersonation_family", embedding: unit([0, 1]) });
    const b = await repo.insert({ description: "bail scam", scamType: "impersonation_family", embedding: unit([0, 1]) });
    expect(b.id).toBe(a.id);
    await repo.incrementReports(a.id);
    expect((await repo.nearest(unit([0, 1]), 1))[0]!.pattern.reportCount).toBe(2);
  });
});
