import { describe, expect, it } from "vitest";
import { decide, type AiOutcome } from "./decide";
import type { Signal } from "./signals";

const first: Signal = { code: "FIRST_TIME_PAYEE", detail: "You have not paid this person before." };
const unusual: Signal = { code: "UNUSUAL_AMOUNT", detail: "This is much more than you usually send." };
const confirmed: Signal = { code: "REGISTRY_CONFIRMED", detail: "Confirmed scammer." };

const ai = (level: "low" | "medium" | "high", reasons = ["r1"]): AiOutcome => ({
  ok: true,
  judgement: { level, scamType: "impersonation_family", reasons, impersonatedRequester: { kind: "person", name: "grandson" } },
});

describe("decide", () => {
  it("lets the AI raise the level", () => {
    const d = decide([first, unusual], ai("high"));
    expect(d.level).toBe("high");
    expect(d.scamType).toBe("impersonation_family");
    expect(d.impersonatedRequester).toEqual({ kind: "person", name: "grandson" });
    expect(d.aiUsed).toBe(true);
  });

  it("never lets the AI lower the level (prompt injection guard)", () => {
    expect(decide([confirmed], ai("low")).level).toBe("high");
    expect(decide([first, unusual], ai("low")).level).toBe("medium");
  });

  it("keeps the pattern's scam type when the pattern caused the raise", () => {
    const low: AiOutcome = { ok: true, judgement: { level: "low", scamType: "other", reasons: [], impersonatedRequester: null } };
    const sig: Signal = { code: "KNOWN_SCAM_PATTERN", detail: "Matches a known scam." };
    expect(decide([sig], low, "impersonation_family").scamType).toBe("impersonation_family");
    expect(decide([sig], low).scamType).toBe("unknown");
  });

  it("caps reasons at three", () => {
    expect(decide([], ai("medium", ["a", "b", "c", "d", "e"])).reasons).toEqual(["a", "b", "c"]);
  });

  it("holds any signalled payment when the AI fails", () => {
    const d = decide([first], { ok: false, error: "timeout" });
    expect(d.level).toBe("high");
    expect(d.aiUsed).toBe(false);
    expect(d.scamType).toBe("unknown");
    expect(d.reasons).toEqual([first.detail]);
  });

  it("stays low when the AI fails and there are no signals", () => {
    const d = decide([], { ok: false, error: "timeout" });
    expect(d.level).toBe("low");
    expect(d.reasons).toEqual([]);
  });

  it("uses signal details and unknown scam type when rules overrode a lower AI level", () => {
    const s: Signal[] = [
      confirmed,
      { code: "LINKED_SCAM_MESSAGE", detail: "L" },
      first,
      unusual,
    ];
    const d = decide(s, ai("low", ["ai says fine"]));
    expect(d.level).toBe("high");
    expect(d.reasons).toEqual([confirmed.detail, "L", first.detail]);
    expect(d.scamType).toBe("unknown");
    expect(d.aiUsed).toBe(true);
    expect(d.impersonatedRequester).toEqual({ kind: "person", name: "grandson" });
  });

  it("falls back to signal details when AI reasons are empty at medium or high", () => {
    expect(decide([first], ai("high", [])).reasons).toEqual([first.detail]);
    expect(decide([first], ai("high", ["  "])).reasons).toEqual([first.detail]);
    expect(decide([], ai("high", [])).reasons).toEqual([]);
  });

  it("trims, drops blanks and de-duplicates AI reasons before capping", () => {
    expect(decide([], ai("medium", ["a", " a ", "", "b", "c", "d"])).reasons).toEqual(["a", "b", "c"]);
  });

  it("caps reasons at three when the AI fails with many signals", () => {
    const many: Signal[] = [confirmed, first, unusual, { code: "RAPID_REPEAT", detail: "R" }];
    expect(decide(many, { ok: false, error: "x" }).reasons).toHaveLength(3);
  });
});
