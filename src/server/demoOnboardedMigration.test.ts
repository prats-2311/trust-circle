import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS } from "./demo";

const sql = readFileSync("drizzle/0011_demo_onboarded.sql", "utf8");

describe("demo onboarded migration", () => {
  it("marks exactly the demo people as set up, and only when they are not already", () => {
    const listed = [...sql.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(Object.values(DEMO_PERSONAS).sort());
    expect(sql).toContain("SET onboarded_at = now()");
    expect(sql).toContain("onboarded_at IS NULL");
    expect(sql.match(/UPDATE users/g)).toHaveLength(1);
  });
});
