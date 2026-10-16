import { createDb } from "../src/db/client";
import { seedDemoHistory } from "../src/server/demoSeed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const { payments, registryReports } = await seedDemoHistory(db);
    console.log(`Demo history ready: ${payments} payments, ${registryReports} registry reports`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed:history failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
