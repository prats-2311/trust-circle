import { describe, expect, it } from "vitest";
import { resetRefusal } from "./resetGuard";

describe("resetRefusal", () => {
  it("allows a local database", () => {
    expect(resetRefusal({ DATABASE_URL: "postgres://u:p@localhost:5433/tc" })).toBeNull();
    expect(resetRefusal({ DATABASE_URL: "postgres://u:p@127.0.0.1:5434/tc" })).toBeNull();
  });
  it("refuses a remote database and never repeats the URL", () => {
    const msg = resetRefusal({ DATABASE_URL: "postgres://user:secret@db.example.com:5432/prod" });
    expect(msg).toContain("E2E_ALLOW_RESET=1");
    expect(msg).not.toContain("secret");
    expect(msg).not.toContain("db.example.com");
  });
  it("refuses a missing or unparseable URL", () => {
    expect(resetRefusal({})).not.toBeNull();
    expect(resetRefusal({ DATABASE_URL: "not a url secret" })).not.toContain("secret");
    expect(resetRefusal({ DATABASE_URL: "not a url" })).not.toBeNull();
  });
  it("allows a remote database only with the explicit override", () => {
    expect(resetRefusal({ DATABASE_URL: "postgres://u:p@db.example.com/x", E2E_ALLOW_RESET: "1" })).toBeNull();
    expect(resetRefusal({ DATABASE_URL: "postgres://u:p@db.example.com/x", E2E_ALLOW_RESET: "true" })).not.toBeNull();
  });
});
