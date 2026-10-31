import { describe, expect, it } from "vitest";
import { resultCopy, resultKind, voiceLine } from "./resultCopy";

const base = { source: "text" as const, checked: true, level: "high" as const, scamType: "impersonation_family" as const, reasons: ["Asks for gift cards."], impersonatedRequester: { kind: "person" as const, name: "grandson Daniel" } };

describe("resultKind", () => {
  it("never treats an unchecked result as clear", () => {
    expect(resultKind({ checked: false, level: "low" })).toBe("not_checked");
    expect(resultKind({ checked: true, level: null })).toBe("not_checked");
    expect(resultKind({ checked: true, level: "medium" })).toBe("warning");
    expect(resultKind({ checked: true, level: "low" })).toBe("clear");
  });
});

describe("resultCopy", () => {
  it("names who the scam pretends to be", () => {
    expect(resultCopy(base)).toMatchObject({
      kind: "scam", chipTone: "blocked", chip: "Very likely a scam",
      title: "Someone is pretending to be Daniel",
      lead: "Family member in trouble. Don't reply, click links or send money.", canReport: true,
    });
    expect(resultCopy({ ...base, impersonatedRequester: { kind: "person", name: "your grandson" } }).title).toBe("Someone is pretending to be grandson");
    expect(resultCopy({ ...base, impersonatedRequester: null }).title).toBe("This message is very likely a scam");
  });
  it("tells the person an unchecked message is not safe", () => {
    const c = resultCopy({ ...base, checked: false, level: null });
    expect(c).toMatchObject({ kind: "not_checked", chipTone: "neutral", canReport: false });
    expect(c.lead).toContain("isn't the same as safe");
  });
  it("warns without claiming a scam, and keeps a clear result calm", () => {
    expect(resultCopy({ ...base, level: "medium" })).toMatchObject({ kind: "warning", chipTone: "caution", canReport: true });
    expect(resultCopy({ ...base, level: "low" })).toMatchObject({ kind: "clear", chipTone: "safe", canReport: false });
  });
});

describe("voiceLine", () => {
  it("names the person the voice may be copying", () => {
    expect(voiceLine({ kind: "person", name: "Daniel" })).toBe("A voice that sounds like Daniel isn't proof. Voices can be copied. Call Daniel on the number you already have.");
  });
  it("is generic for an organisation or nobody", () => {
    const generic = "A voice that sounds like someone you know isn't proof. Voices can be copied. Call them on the number you already have.";
    expect(voiceLine({ kind: "organisation", name: "PayPal" })).toBe(generic);
    expect(voiceLine(null)).toBe(generic);
  });
});
