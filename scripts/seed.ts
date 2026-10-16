import { createDb } from "../src/db/client";
import { seedBaseDemo } from "../src/server/demoSeed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    console.log(JSON.stringify(await seedBaseDemo(db)));
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
