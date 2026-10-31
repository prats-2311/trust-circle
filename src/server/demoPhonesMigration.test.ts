import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_PERSONAS, DEMO_PHONES, type Persona } from "./demo";

const sql = readFileSync("drizzle/0010_demo_phones.sql", "utf8");

describe("demo phones migration", () => {
  it.each(Object.entries(DEMO_PHONES) as [Persona, string][])("fills %s's number only when it is missing", (persona, phone) => {
    const stmt = sql.split("\n").find((l) => l.includes(`'${DEMO_PERSONAS[persona]}'`));
    expect(stmt).toBeDefined();
    expect(stmt).toContain(`SET phone = '${phone}'`);
    expect(stmt).toContain("phone IS NULL");
  });
  it("covers every demo number and nothing else", () => {
    expect(sql.match(/UPDATE users/g)).toHaveLength(Object.keys(DEMO_PHONES).length);
  });
});
