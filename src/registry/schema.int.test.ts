import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { registryEntries, registryReports, scamPatterns, users } from "@/db/schema";
import { freshTestDb } from "@/test/db";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let userId: string;

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [u] = await handle.db.insert(users).values({ email: "r@example.com", displayName: "Robert" }).returning();
  userId = u!.id;
});
afterAll(async () => handle?.close());

const unit = (i: number) => Array.from({ length: 384 }, (_, j) => (j === i ? 1 : 0));

describe("registry and pattern tables", () => {
  it("has the vector extension", async () => {
    const rows = await handle.db.execute(sql`select extname from pg_extension where extname = 'vector'`);
    expect(rows.length).toBe(1);
  });

  it("stores a 384-dimension embedding and orders by cosine distance", async () => {
    await handle.db.insert(scamPatterns).values([
      { description: "first", scamType: "invoice", embedding: unit(0) },
      { description: "second", scamType: "romance", embedding: unit(1) },
    ]);
    const rows = await handle.db.execute(
      sql`select description from scam_patterns order by embedding <=> ${JSON.stringify(unit(1))}::vector limit 1`,
    );
    expect(rows[0]!.description).toBe("second");
  });

  it("keeps one entry per key and one report per reporter and source", async () => {
    const [e] = await handle.db.insert(registryEntries).values({ identifierType: "phone", key: "4155550199", scamType: "impersonation_family" }).returning();
    await expect(handle.db.insert(registryEntries).values({ identifierType: "phone", key: "4155550199", scamType: "other" })).rejects.toThrow();
    expect(e!.status).toBe("unconfirmed");
    await handle.db.insert(registryReports).values({ entryId: e!.id, reporterId: userId, source: "message_report" });
    await expect(handle.db.insert(registryReports).values({ entryId: e!.id, reporterId: userId, source: "message_report" })).rejects.toThrow();
  });
});
