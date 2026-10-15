import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string) {
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema });
  return { db, close: () => sql.end() };
}
export type Db = ReturnType<typeof createDb>["db"];
