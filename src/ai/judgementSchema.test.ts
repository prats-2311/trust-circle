import { describe, expect, it } from "vitest";
import { JudgementSchema } from "./judgementSchema";

const base = { level: "high", scamType: "tech_support", reasons: ["r"] };

describe("JudgementSchema", () => {
  it("keeps the remote-access flag on the requester", () => {
    const j = JudgementSchema.parse({ ...base, impersonatedRequester: { kind: "organisation", name: "bank", remoteAccess: true } });
    expect(j.impersonatedRequester).toEqual({ kind: "organisation", name: "bank", remoteAccess: true });
  });
  it("accepts a requester without the flag, as older replies have", () => {
    const j = JudgementSchema.parse({ ...base, impersonatedRequester: { kind: "person", name: "grandson" } });
    expect(j.impersonatedRequester).toEqual({ kind: "person", name: "grandson" });
  });
  it("rejects a flag that isn't a boolean", () => {
    expect(JudgementSchema.safeParse({ ...base, impersonatedRequester: { kind: "person", name: "x", remoteAccess: "yes" } }).success).toBe(false);
  });
});
