import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";

export async function freshTestDb() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://trustcircle:trustcircle@localhost:5434/trustcircle_test";
  const handle = createDb(url);
  await migrate(handle.db, { migrationsFolder: "./drizzle" });
  await handle.db.execute(sql`TRUNCATE scam_reports, scam_patterns, registry_reports, registry_entries, alerts, verifications, message_checks, audit_log, payments, trust_links, users CASCADE`);
  return handle;
}
