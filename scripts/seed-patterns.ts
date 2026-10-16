import { createDb } from "../src/db/client";
import { createLocalEmbedder } from "../src/patterns/embedder";
import { seedPatterns } from "../src/server/demoSeed";
import { PATTERNS } from "./seed-pattern-list";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const stored = await seedPatterns(db, createLocalEmbedder(), PATTERNS);
    console.log(`Stored ${stored} scam patterns`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed:patterns failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
