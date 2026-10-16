import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleSettingsRepo } from "./drizzleSettingsRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let userId: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [u] = await handle.db.insert(users).values({ email: "m@example.com", displayName: "Margaret" }).returning();
  userId = u!.id;
});
afterAll(async () => handle?.close());

describe("drizzle settings repo", () => {
  it("returns the defaults for a seeded user", async () => {
    expect(await createDrizzleSettingsRepo(handle.db).get(userId)).toEqual({ preset: "family", coolingOffHours: 24, onboardedAt: null });
  });
  it("updates preset, cooling-off and onboardedAt", async () => {
    const repo = createDrizzleSettingsRepo(handle.db);
    const at = new Date("2026-10-16T10:00:00Z");
    const updated = await repo.update(userId, { preset: "business", coolingOffHours: 12, onboardedAt: at });
    expect(updated).toEqual({ preset: "business", coolingOffHours: 12, onboardedAt: at });
    expect(await repo.get(userId)).toEqual(updated);
  });
  it("returns null for a non-UUID without querying", async () => {
    const repo = createDrizzleSettingsRepo(handle.db);
    expect(await repo.get("nope")).toBeNull();
    expect(await repo.update("nope", { preset: "solo" })).toBeNull();
  });
  it("rejects a cooling-off outside the allowed choices at the database", async () => {
    await expect(createDrizzleSettingsRepo(handle.db).update(userId, { coolingOffHours: 72 as never })).rejects.toThrow();
  });
});
