import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { freshTestDb } from "@/test/db";
import { payments, pushSubscriptions, scamPatterns, trustLinks, users } from "@/db/schema";
import { DEMO_PERSONAS, DEMO_PHONES } from "./demo";
import { seedBaseDemo } from "./demoSeed";
import { resetDemo } from "./demoReset";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
});
afterAll(async () => handle?.close());

const total = async (table: typeof users | typeof trustLinks | typeof scamPatterns | typeof payments) =>
  (await handle.db.select({ n: count() }).from(table))[0]!.n;

describe("resetDemo", () => {
  it("leaves only the seeded history, and keeps users, links and patterns", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    const [margaret] = await db.select().from(users).where(eq(users.email, "margaret.demo@trustcircle.example"));
    await db.insert(scamPatterns).values({ description: "p", scamType: "invoice", embedding: Array.from({ length: 384 }, () => 0.01) });
    await db.insert(payments).values({ id: "11111111-1111-4111-a111-111111111111", senderId: margaret!.id, payee: "stranger@example.com", amountCents: 100, state: "held", riskLevel: "low", scamType: "none", reasons: [] });
    const before = { users: await total(users), links: await total(trustLinks), patterns: await total(scamPatterns) };

    await resetDemo(db);

    const rows = await db.select().from(payments);
    expect(rows.some((p) => p.payee === "stranger@example.com")).toBe(false);
    expect(rows).toHaveLength(10);
    expect(await total(trustLinks)).toBe(before.links);
    expect(await total(scamPatterns)).toBe(before.patterns);
    // History seeding adds six demo reporters on top of the base users.
    expect(await total(users)).toBe(before.users + 6);
  });

  it("sends every demo person back set up, with no safe word and the default cooling-off", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    await db.update(users).set({ onboardedAt: null, safeWordHash: "x", coolingOffHours: 48 });

    await resetDemo(db);

    for (const email of Object.values(DEMO_PERSONAS)) {
      const [u] = await db.select().from(users).where(eq(users.email, email));
      expect(u!.onboardedAt, email).not.toBeNull();
      expect(u!.safeWordHash, email).toBeNull();
      expect(u!.coolingOffHours, email).toBe(24);
    }
  });

  it("seeds every demo person already set up", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    for (const email of Object.values(DEMO_PERSONAS)) {
      const [u] = await db.select().from(users).where(eq(users.email, email));
      expect(u!.onboardedAt, email).not.toBeNull();
    }
  });

  it("keeps an allowed push endpoint and drops a disallowed one", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    const [margaret] = await db.select().from(users).where(eq(users.email, "margaret.demo@trustcircle.example"));
    const good = "https://fcm.googleapis.com/fcm/send/abc";
    await db.insert(pushSubscriptions).values([
      { endpoint: good, userId: margaret!.id, p256dh: "k", auth: "a" },
      { endpoint: "https://evil.example/push", userId: margaret!.id, p256dh: "k", auth: "a" },
    ]);

    await resetDemo(db);

    const left = (await db.select().from(pushSubscriptions)).map((r) => r.endpoint);
    expect(left).toEqual([good]);
  });

  it("rolls everything back when a step fails part-way", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    const [margaret] = await db.select().from(users).where(eq(users.email, "margaret.demo@trustcircle.example"));
    await db.insert(payments).values({ id: "11111111-1111-4111-a111-111111111111", senderId: margaret!.id, payee: "stranger@example.com", amountCents: 100, state: "held", riskLevel: "low", scamType: "none", reasons: [] });
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, margaret!.id));

    // The log callback runs between steps; failing after "People reset" is a failure mid-reset.
    await expect(resetDemo(db, { log: (s) => { if (s === "People reset") throw new Error("boom"); } })).rejects.toThrow("boom");

    const rows = await db.select().from(payments);
    expect(rows.map((p) => p.payee)).toEqual(["stranger@example.com"]);
    const [after] = await db.select().from(users).where(eq(users.id, margaret!.id));
    expect(after!.onboardedAt).not.toBeNull();
  });

  it("restores the demo phone numbers and clears the others", async () => {
    const { db } = handle;
    await seedBaseDemo(db);
    await db.update(users).set({ phone: null }).where(eq(users.email, "daniel.demo@trustcircle.example"));
    await db.update(users).set({ phone: "+1 (415) 555-0100" }).where(eq(users.email, "margaret.demo@trustcircle.example"));

    await resetDemo(db);

    const phone = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0]!.phone;
    expect(await phone("daniel.demo@trustcircle.example")).toBe(DEMO_PHONES.daniel);
    expect(await phone("sarah.demo@trustcircle.example")).toBe(DEMO_PHONES.sarah);
    expect(await phone("tom.demo@trustcircle.example")).toBe(DEMO_PHONES.tom);
    expect(await phone("margaret.demo@trustcircle.example")).toBeNull();
  });

  it("logs each step through opts.log", async () => {
    await seedBaseDemo(handle.db);
    const lines: string[] = [];
    await resetDemo(handle.db, { log: (s) => lines.push(s) });
    expect(lines.length).toBeGreaterThan(0);
  });
});
