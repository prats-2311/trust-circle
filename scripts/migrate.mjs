// Applies every migration in ./drizzle in order. Plain Node with production dependencies only, so it can run in the start command.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is required");
  process.exit(1);
}

// Same client settings as src/db/client.ts; postgres-js reads sslmode from the URL. One connection is enough here.
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrate: up to date");
} catch (e) {
  // Drizzle wraps the database error; the cause is Postgres's own message, which never contains the URL or password.
  const cause = e instanceof Error && e.cause instanceof Error ? ` (cause: ${e.cause.message})` : "";
  console.error("migrate failed:", (e instanceof Error ? e.message : "unknown") + cause);
  process.exitCode = 1;
} finally {
  await sql.end();
}
