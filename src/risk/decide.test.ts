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
});
