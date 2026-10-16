import { createDb } from "../src/db/client";
import { createLocalEmbedder } from "../src/patterns/embedder";
import { createDrizzlePatternRepo } from "../src/patterns/drizzlePatternRepo";
import { createPatternService } from "../src/patterns/patternService";
import { PATTERNS } from "./seed-pattern-list";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const service = createPatternService({ repo: createDrizzlePatternRepo(db), embed: createLocalEmbedder() });
    for (const p of PATTERNS) await service.add(p);
    console.log(`Stored ${PATTERNS.length} scam patterns`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed:patterns failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
