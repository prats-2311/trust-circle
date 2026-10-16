import { describe, expect, it } from "vitest";
import type { MessageJudge } from "@/ai/groqMessageJudge";
import type { PaymentJudge } from "@/ai/groqJudge";
import { EVAL_CASES, type EvalCase } from "./cases";
import type { PatternMatcher } from "@/patterns/patternService";
import { runEval, scoreResults, type EvalResult } from "./runEval";

const payments = EVAL_CASES.filter((c): c is Extract<EvalCase, { kind: "payment" }> => c.kind === "payment");
const messages = EVAL_CASES.filter((c): c is Extract<EvalCase, { kind: "message" }> => c.kind === "message");
const labelByPayee = new Map(payments.map((c) => [c.payment.payee, c.label]));
const labelByText = new Map(messages.map((c) => [c.text, c.label]));

const verdict = (scam: boolean) => ({
  level: scam ? ("high" as const) : ("low" as const),
  scamType: scam ? ("other" as const) : ("none" as const),
  reasons: scam ? ["Matches a known scam."] : ["No warning signs."],
  impersonatedRequester: null,
});
// An AI that always agrees with the label: isolates what the rules add or take away.
const oraclePayment: PaymentJudge = async (input) => ({ ok: true, judgement: verdict(labelByPayee.get(input.payee) === "scam") });
const oracleMessage: MessageJudge = async (input) => ({
  ok: true,
  judgement: { ...verdict(input.kind === "text" && labelByText.get(input.text) === "scam"), transcript: "" },
});
const downPayment: PaymentJudge = async () => ({ ok: false, error: "groq http 503" });
const downMessage: MessageJudge = async () => ({ ok: false, error: "groq http 503" });

describe("evaluation set", () => {
  it("has at least 60 well-formed, balanced cases", () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
    expect(new Set(payments.map((c) => c.payment.payee)).size).toBe(payments.length);
    for (const kind of [payments, messages] as EvalCase[][]) {
      expect(kind.filter((c) => c.label === "scam").length).toBeGreaterThanOrEqual(12);
      expect(kind.filter((c) => c.label === "genuine").length).toBeGreaterThanOrEqual(12);
    }
    expect(new Set(EVAL_CASES.map((c) => c.preset))).toEqual(new Set(["family", "business", "solo"]));
    for (const m of messages) expect(m.text.length).toBeLessThanOrEqual(4000);
  });

  it("loses no scams and holds at most 10% of genuine cases when the AI is right", async () => {
    const { metrics } = await runEval(EVAL_CASES, { paymentJudge: oraclePayment, messageJudge: oracleMessage });
    expect(metrics.catchRate).toBe(1);
    expect(metrics.falseHoldRate).toBeLessThanOrEqual(0.1);
    expect(metrics.unchecked).toBe(0);
  });

  it("fails closed when the AI is down", async () => {
    const { results } = await runEval(EVAL_CASES, { paymentJudge: downPayment, messageJudge: downMessage });
    // Every scam with a rule signal is held. A scam to a payee already paid, for an everyday amount, has no rule
    // signal, so with the AI down it goes through: only the story gives it away (h02).
    for (const r of results.filter((x) => x.kind === "payment" && x.label === "scam")) {
      expect(r.level).toBe(r.signals.length > 0 ? "high" : "low");
    }
    expect(results.find((r) => r.id === "h02")!.level).toBe("low");
    for (const r of results.filter((x) => x.kind === "message")) expect(r.checked).toBe(false);
    expect(results.find((r) => r.id === "g01")!.level).toBe("low");
  });
});

describe("retry and patterns", () => {
  const one = EVAL_CASES.filter((c) => c.kind === "payment" && c.label === "scam").slice(0, 1);
  it("retries an unchecked case once and clears the cause when the retry works", async () => {
    let calls = 0;
    const flaky: PaymentJudge = async (input) => (++calls === 1 ? { ok: false, error: "groq http 503" } : oraclePayment(input, []));
    const { results } = await runEval(one, { paymentJudge: flaky, messageJudge: oracleMessage });
    expect(results[0]).toMatchObject({ checked: true, attempts: 2, uncheckedCause: null });
  });
  it("records the judge's error when the retry fails too", async () => {
    const { results } = await runEval(one, { paymentJudge: downPayment, messageJudge: downMessage });
    expect(results[0]).toMatchObject({ checked: false, attempts: 2, uncheckedCause: "groq http 503" });
  });
  it("makes one attempt when retryUnchecked is false", async () => {
    let calls = 0;
    const down: PaymentJudge = async () => (calls++, { ok: false, error: "groq http 503" });
    const { results } = await runEval(one, { paymentJudge: down, messageJudge: downMessage, retryUnchecked: false });
    expect(calls).toBe(1);
    expect(results[0]).toMatchObject({ attempts: 1, uncheckedCause: "groq http 503" });
  });
  it("passes the pattern matcher through to both kinds of case", async () => {
    const patterns: PatternMatcher = async () => ({ patternId: "p", scamType: "romance", similarity: 0.5 });
    const msg = EVAL_CASES.filter((c) => c.kind === "message").slice(0, 1);
    const { results } = await runEval([...one, ...msg], { paymentJudge: oraclePayment, messageJudge: oracleMessage, patterns });
    for (const r of results) expect(r.signals).toContain("KNOWN_SCAM_PATTERN");
  });
});

describe("scoreResults", () => {
  const r = (label: "scam" | "genuine", level: "low" | "medium" | "high", checked = true): EvalResult => ({
    id: "x", kind: "message", preset: "family", label, level, scamType: "other", checked, signals: [], attempts: 1, uncheckedCause: null,
  });
  it("computes catch, hold, false-alarm and false-hold rates", () => {
    const m = scoreResults([r("scam", "high"), r("scam", "medium"), r("scam", "low"), r("genuine", "low"), r("genuine", "medium", false)]);
    expect(m).toMatchObject({ total: 5, scams: 3, genuine: 2, caught: 2, held: 1, falseAlarms: 1, falseHolds: 0, unchecked: 1 });
    expect(m.catchRate).toBeCloseTo(2 / 3);
    expect(m.falseAlarmRate).toBe(0.5);
  });
  it("returns zero rates for empty groups", () => {
    expect(scoreResults([]).catchRate).toBe(0);
  });
});
