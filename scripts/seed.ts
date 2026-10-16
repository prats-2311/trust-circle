import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { trustLinks, users } from "../src/db/schema";

type Db = ReturnType<typeof createDb>["db"];

async function upsertUser(db: Db, email: string, displayName: string) {
  await db.insert(users).values({ email, displayName, preset: "family" }).onConflictDoNothing();
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return u!;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const margaret = await upsertUser(db, "margaret.demo@trustcircle.example", "Margaret");
    const sarah = await upsertUser(db, "sarah.demo@trustcircle.example", "Sarah");
    const daniel = await upsertUser(db, "daniel.demo@trustcircle.example", "Daniel");
    await db
      .insert(trustLinks)
      .values([
        { senderId: margaret.id, contactId: sarah.id, relationship: "daughter" },
        { senderId: margaret.id, contactId: daniel.id, relationship: "grandson" },
      ])
      .onConflictDoNothing();
    console.log(JSON.stringify({ margaret: margaret.id, sarah: sarah.id, daniel: daniel.id }));
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
