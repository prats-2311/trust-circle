import { createDb } from "../src/db/client";
import { trustLinks, users } from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const [margaret] = await db
      .insert(users)
      .values({ email: "margaret.demo@trustcircle.example", displayName: "Margaret", preset: "family" })
      .onConflictDoNothing()
      .returning();
    const [sarah] = await db
      .insert(users)
      .values({ email: "sarah.demo@trustcircle.example", displayName: "Sarah", preset: "family" })
      .onConflictDoNothing()
      .returning();
    if (margaret && sarah) {
      await db.insert(trustLinks).values({ senderId: margaret.id, contactId: sarah.id, relationship: "daughter" }).onConflictDoNothing();
      console.log(JSON.stringify({ margaret: margaret.id, sarah: sarah.id }));
    } else {
      console.log("Demo users already exist");
    }
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
