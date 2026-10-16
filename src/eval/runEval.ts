import type { MessageJudge } from "@/ai/groqMessageJudge";
import type { PaymentJudge } from "@/ai/groqJudge";
import type { PromptGuard } from "@/ai/promptGuard";
import type { Preset, RiskLevel, ScamType } from "@/domain/types";
import { assessMessage } from "@/messages/assessMessage";
import { assessPayment } from "@/risk/assess";
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

export async function runEval(
  cases: EvalCase[],
  deps: { paymentJudge: PaymentJudge; messageJudge: MessageJudge; guard?: PromptGuard; pauseMs?: number; onResult?: (r: EvalResult) => void },
): Promise<{ results: EvalResult[]; metrics: EvalMetrics }> {
  const results: EvalResult[] = [];
  for (const c of cases) {
    const base = { id: c.id, kind: c.kind, preset: c.preset, label: c.label };
    let result: EvalResult;
    if (c.kind === "payment") {
      const d = await assessPayment(
        c.payment,
        { ...DEFAULT_HISTORY, ...c.history, flaggedPayees: [], registry: NO_REGISTRY },
        deps.paymentJudge,
        deps.guard,
      );
      result = { ...base, level: d.level, scamType: d.scamType, checked: d.aiUsed, signals: d.signals.map((s) => s.code) };
    } else {
      const m = await assessMessage({ kind: "text", text: c.text }, { registry: NO_REGISTRY }, { judge: deps.messageJudge, guard: deps.guard });
      result = { ...base, level: m.level, scamType: m.scamType, checked: m.checked, signals: m.signals.map((s) => s.code) };
    }
    results.push(result);
    deps.onResult?.(result);
    if (deps.pauseMs) await new Promise((resolve) => setTimeout(resolve, deps.pauseMs));
  }
  return { results, metrics: scoreResults(results) };
}
