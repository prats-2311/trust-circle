import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { webhookEvents } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleWebhookRepo } from "./drizzleWebhookRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
const at = new Date("2026-10-16T10:00:00Z");
const later = new Date("2026-10-16T10:00:05Z");

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
});
afterAll(async () => handle?.close());

const row = async (id: string) => (await handle.db.select().from(webhookEvents).where(eq(webhookEvents.id, id)))[0];

describe("drizzle webhook repo", () => {
  it("claims a new event with attempts 1 and takes an unprocessed one again with attempts + 1", async () => {
    const repo = createDrizzleWebhookRepo(handle.db);
    expect(await repo.claim("WH-1", "PAYMENT.PAYOUTS-ITEM.RETURNED", at)).toEqual({ attempts: 1 });
    expect(await repo.claim("WH-1", "PAYMENT.PAYOUTS-ITEM.RETURNED", later)).toEqual({ attempts: 2 });
    expect((await row("WH-1"))?.receivedAt).toEqual(at);
    expect((await row("WH-1"))?.attempts).toBe(2);
  });

  it("does not claim a processed event again", async () => {
    const repo = createDrizzleWebhookRepo(handle.db);
    await repo.claim("WH-1", "T", at);
    await repo.markProcessed("WH-1", later, "applied");
    expect(await repo.claim("WH-1", "T", later)).toBeNull();
    expect((await row("WH-1"))?.attempts).toBe(1);
  });

  it("marks an event processed with its result", async () => {
    const repo = createDrizzleWebhookRepo(handle.db);
    await repo.claim("WH-1", "T", at);
    await repo.markProcessed("WH-1", later, "applied");
    expect(await row("WH-1")).toMatchObject({ processedAt: later, result: "applied" });
  });

  it("marks a failed event with the error name and leaves it unprocessed", async () => {
    const repo = createDrizzleWebhookRepo(handle.db);
    await repo.claim("WH-2", "T", at);
    await repo.markFailed("WH-2", later, "ConcurrentUpdateError");
    expect(await row("WH-2")).toMatchObject({ processedAt: null, result: "failed:ConcurrentUpdateError" });
    expect(await repo.claim("WH-2", "T", later)).toEqual({ attempts: 2 });
  });
});
