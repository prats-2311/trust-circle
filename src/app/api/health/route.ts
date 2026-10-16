import { sql } from "drizzle-orm";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 2_000;

/** Always 200, so a sleeping database never fails the web check. Does not load the model. */
export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { db } = getContainer();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS);
    });
    await Promise.race([db.execute(sql`select 1`), timeout]);
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: true, db: "down" });
  } finally {
    clearTimeout(timer);
  }
}
