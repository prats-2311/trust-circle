import type { MessageJudge } from "@/ai/groqMessageJudge";
import type { PaymentJudge } from "@/ai/groqJudge";
import type { PromptGuard } from "@/ai/promptGuard";
import type { Preset, RiskLevel, ScamType } from "@/domain/types";
import { assessMessage } from "@/messages/assessMessage";
import { assessPayment } from "@/risk/assess";
import type { PatternMatcher } from "@/patterns/patternService";
import { DEFAULT_HISTORY, type EvalCase } from "./cases";

export interface EvalResult {
  id: string;
  kind: "payment" | "message";
  preset: Preset;
  label: "scam" | "genuine";
  level: RiskLevel;
  scamType: ScamType;
  checked: boolean;
  signals: string[];
  attempts: number;
  /** The judge's error when the case was still unchecked after the retry. */
  uncheckedCause: string | null;
}

export interface EvalMetrics {
  total: number;
  scams: number;
  genuine: number;
  caught: number;
  held: number;
  falseAlarms: number;
  falseHolds: number;
  unchecked: number;
  catchRate: number;
  holdRate: number;
  falseAlarmRate: number;
  falseHoldRate: number;
}

const NO_REGISTRY = { confirmed: [], unconfirmed: [] };
const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);

export function scoreResults(results: EvalResult[]): EvalMetrics {
  const scams = results.filter((r) => r.label === "scam");
  const genuine = results.filter((r) => r.label === "genuine");
  const caught = scams.filter((r) => r.level !== "low").length;
  const held = scams.filter((r) => r.level === "high").length;
  const falseAlarms = genuine.filter((r) => r.level !== "low").length;
  const falseHolds = genuine.filter((r) => r.level === "high").length;
  return {
    total: results.length,
    scams: scams.length,
    genuine: genuine.length,
    caught,
    held,
    falseAlarms,
    falseHolds,
    unchecked: results.filter((r) => !r.checked).length,
    catchRate: rate(caught, scams.length),
    holdRate: rate(held, scams.length),
    falseAlarmRate: rate(falseAlarms, genuine.length),
    falseHoldRate: rate(falseHolds, genuine.length),
  };
}

type Deps = {
  paymentJudge: PaymentJudge;
  messageJudge: MessageJudge;
  guard?: PromptGuard;
  patterns?: PatternMatcher;
  pauseMs?: number;
  retryUnchecked?: boolean;
  onResult?: (r: EvalResult) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(c: EvalCase, deps: Deps): Promise<{ result: Omit<EvalResult, "attempts" | "uncheckedCause">; cause: string | null }> {
  let cause: string | null = null;
  const note = (e: string) => void (cause = e);
  const paymentJudge: PaymentJudge = async (input, signals) => {
    try {
      const out = await deps.paymentJudge(input, signals);
      if (!out.ok) note(out.error);
      return out;
    } catch (e) {
      note(e instanceof Error ? e.message : "judge threw");
      throw e;
    }
  };
  const messageJudge: MessageJudge = async (input, signals) => {
    try {
      const out = await deps.messageJudge(input, signals);
      if (!out.ok) note(out.error);
      return out;
    } catch (e) {
      note(e instanceof Error ? e.message : "judge threw");
      throw e;
    }
  };
  const base = { id: c.id, kind: c.kind, preset: c.preset, label: c.label };
  if (c.kind === "payment") {
    const d = await assessPayment(
      c.payment,
      { ...DEFAULT_HISTORY, ...c.history, flaggedPayees: [], registry: NO_REGISTRY },
      paymentJudge,
      deps.guard,
      deps.patterns,
    );
    return { result: { ...base, level: d.level, scamType: d.scamType, checked: d.aiUsed, signals: d.signals.map((s) => s.code) }, cause };
  }
  const m = await assessMessage({ kind: "text", text: c.text }, { registry: NO_REGISTRY }, { judge: messageJudge, guard: deps.guard, patterns: deps.patterns });
  return { result: { ...base, level: m.level, scamType: m.scamType, checked: m.checked, signals: m.signals.map((s) => s.code) }, cause };
}

export async function runEval(cases: EvalCase[], deps: Deps): Promise<{ results: EvalResult[]; metrics: EvalMetrics }> {
  const retry = deps.retryUnchecked ?? true;
  const results: EvalResult[] = [];
  for (const c of cases) {
    let attempts = 1;
    let out = await attempt(c, deps);
    if (!out.result.checked && retry) {
      if (deps.pauseMs) await sleep(deps.pauseMs * 2);
      attempts = 2;
      out = await attempt(c, deps);
    }
    const result: EvalResult = { ...out.result, attempts, uncheckedCause: out.result.checked ? null : (out.cause ?? "unknown") };
    results.push(result);
    deps.onResult?.(result);
    if (deps.pauseMs) await sleep(deps.pauseMs);
  }
  return { results, metrics: scoreResults(results) };
}
