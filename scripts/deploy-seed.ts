import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { createDb } from "../src/db/client";
import { createLocalEmbedder } from "../src/patterns/embedder";
import { seedBaseDemo, seedDemoHistory, seedPatterns } from "../src/server/demoSeed";
import { localHostRefusal } from "../src/server/deployGuard";
import { PATTERNS } from "./seed-pattern-list";

// Run once from your machine against the production database:
//   read -rs DATABASE_URL && export DATABASE_URL && npm run deploy:seed
// The URL must come from the shell, never from .env.local (tsx is started without --env-file on purpose).
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set in the shell for this command (it is not read from .env.local).");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL could not be read as a URL.");
  }
  const refusal = localHostRefusal(host);
  if (refusal) throw new Error(refusal);

  console.log(`About to migrate and seed the database on host: ${host}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question("Type that host to confirm: ")).trim();
  rl.close();
  if (typed !== host) throw new Error("Host did not match. Nothing was changed.");

  const migrated = spawnSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit", env: process.env });
  if (migrated.status !== 0) throw new Error("Migrations failed. Nothing was seeded.");

  const { db, close } = createDb(url);
  try {
    await seedBaseDemo(db);
    console.log("Base demo people ready");
    const stored = await seedPatterns(db, createLocalEmbedder(), PATTERNS);
    console.log(`Stored ${stored} scam patterns`);
    const history = await seedDemoHistory(db);
    console.log(`Demo history ready: ${history.payments} payments, ${history.registryReports} registry reports`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("deploy:seed failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
