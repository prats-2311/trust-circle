import { execSync } from "node:child_process";
import { inArray, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { DEMO_PERSONAS } from "../src/server/demo";

// Puts the demo back to a clean story: users, circles and known scam patterns stay; everything that happened goes.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    await db.execute(
      sql`TRUNCATE scam_reports, registry_reports, registry_entries, alerts, verifications, message_checks, audit_log, payments CASCADE`,
    );
    await db.update(users).set({ safeWordHash: null }).where(inArray(users.email, Object.values(DEMO_PERSONAS)));
  } finally {
    await close();
  }
  execSync("npm run seed:history", { stdio: "inherit" });
  console.log("Demo reset: clean history, patterns kept");
}

main().catch((e) => {
  console.error("demo:reset failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
