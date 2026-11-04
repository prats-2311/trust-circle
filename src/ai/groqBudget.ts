import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

export class GroqBudgetError extends Error {
  constructor() {
    super("daily AI call cap reached");
    this.name = "GroqBudgetError";
  }
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

const isGroq = (input: Parameters<typeof fetch>[0]): boolean => {
  try {
    return new URL(urlOf(input)).hostname === "api.groq.com";
  } catch {
    return false;
  }
};

/**
 * A fetch that counts calls to Groq per UTC day and refuses (by throwing) once the day's cap is passed.
 * The callers already turn a thrown fetch into "AI unavailable", so a spent budget degrades the same way an outage does.
 * `count` increments today's total and returns it. If it fails, the call goes ahead: a broken counter must not stop the app.
 */
export function createGroqBudget(opts: {
  cap: number;
  count: (day: string) => Promise<number>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): typeof fetch {
  const inner = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => new Date());
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (isGroq(input)) {
      let total: number | null = null;
      try {
        total = await opts.count(now().toISOString().slice(0, 10));
      } catch (e) {
        console.warn("ai usage unavailable", { error: e instanceof Error ? e.name : "unknown" });
      }
      if (total !== null && total > opts.cap) throw new GroqBudgetError();
    }
    return inner(input, init);
  }) as typeof fetch;
}

/** Atomically adds one to the day's row and returns the new total. */
export function createDrizzleAiUsage(db: Db): (day: string) => Promise<number> {
  return async (day) => {
    const rows = await db.execute(
      sql`INSERT INTO ai_usage (day, calls) VALUES (${day}::date, 1) ON CONFLICT (day) DO UPDATE SET calls = ai_usage.calls + 1 RETURNING calls`,
    );
    return Number((rows[0] as { calls: number }).calls);
  };
}
