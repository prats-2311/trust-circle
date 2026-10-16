import { createDb } from "../src/db/client";
import { resetDemo } from "../src/server/demoReset";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    await resetDemo(db, { log: (s) => console.log(s) });
  } finally {
    await close();
  }
  console.log("Demo reset: clean history, patterns kept");
}

main().catch((e) => {
  console.error("demo:reset failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
