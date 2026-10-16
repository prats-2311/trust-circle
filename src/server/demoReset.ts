import { inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { pushSubscriptions, users } from "../db/schema";
import { isAllowedPushEndpoint } from "../push/subscription";
import { DEMO_PERSONAS, type Persona } from "./demo";
import { seedDemoHistory } from "./demoSeed";

/** Puts the demo back to a clean story: users, circles and known scam patterns stay; everything that happened goes. */
export async function resetDemo(db: Db, opts: { log?: (s: string) => void } = {}): Promise<void> {
  const log = opts.log ?? (() => {});
  // All or nothing: a failure part-way leaves the demo exactly as it was.
  await db.transaction(async (trx) => {
    const tx = trx as unknown as Db;
    await tx.execute(
      sql`TRUNCATE scam_reports, registry_reports, registry_entries, alerts, verifications, message_checks, audit_log, payments`,
    );
    log("History cleared");
    // Subscriptions survive a reset, except any stored before endpoints had to be canonical push-service URLs.
    const stored = await tx.select({ endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions);
    const bad = stored.map((r) => r.endpoint).filter((e) => !isAllowedPushEndpoint(e));
    if (bad.length > 0) await tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, bad));
    await tx.update(users).set({ safeWordHash: null, onboardedAt: null, coolingOffHours: 24 }).where(inArray(users.email, Object.values(DEMO_PERSONAS)));
    const presetFor = (names: Persona[]) => names.map((n) => DEMO_PERSONAS[n]);
    await tx.update(users).set({ preset: "family" }).where(inArray(users.email, presetFor(["margaret", "sarah", "daniel"])));
    await tx.update(users).set({ preset: "business" }).where(inArray(users.email, presetFor(["priya", "tom"])));
    await tx.update(users).set({ preset: "solo" }).where(inArray(users.email, presetFor(["robert"])));
    log("People reset");
    const seeded = await seedDemoHistory(tx);
    log(`History seeded: ${seeded.payments} payments, ${seeded.registryReports} registry reports`);
  });
}
