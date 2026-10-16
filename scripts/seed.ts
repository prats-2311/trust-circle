import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { trustLinks, users } from "../src/db/schema";

type Db = ReturnType<typeof createDb>["db"];

type Preset = "family" | "business" | "solo";

async function upsertUser(db: Db, email: string, displayName: string, preset: Preset) {
  await db
    .insert(users)
    .values({ email, displayName, preset })
    .onConflictDoUpdate({ target: users.email, set: { preset } });
  const [u] = await db.select().from(users).where(eq(users.email, email));
  return u!;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const margaret = await upsertUser(db, "margaret.demo@trustcircle.example", "Margaret", "family");
    const sarah = await upsertUser(db, "sarah.demo@trustcircle.example", "Sarah", "family");
    const daniel = await upsertUser(db, "daniel.demo@trustcircle.example", "Daniel", "family");
    const robert = await upsertUser(db, "robert.demo@trustcircle.example", "Robert", "solo");
    const priya = await upsertUser(db, "priya.demo@trustcircle.example", "Priya", "business");
    const tom = await upsertUser(db, "tom.demo@trustcircle.example", "Tom", "business");
    await db
      .insert(trustLinks)
      .values([
        { senderId: margaret.id, contactId: sarah.id, relationship: "daughter" },
        { senderId: margaret.id, contactId: daniel.id, relationship: "grandson" },
        { senderId: priya.id, contactId: tom.id, relationship: "accountant" },
      ])
      .onConflictDoNothing();
    console.log(JSON.stringify({ margaret: margaret.id, sarah: sarah.id, daniel: daniel.id, robert: robert.id, priya: priya.id, tom: tom.id }));
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
