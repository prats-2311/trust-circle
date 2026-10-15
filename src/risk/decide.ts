import { maxLevel, type RiskLevel, type ScamType } from "@/domain/types";
import { ruleLevel, type Signal } from "./signals";

export interface AiJudgement {
  level: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  impersonatedRequester: { kind: "person" | "organisation"; name: string } | null;
}

export type AiOutcome = { ok: true; judgement: AiJudgement } | { ok: false; error: string };

export interface RiskDecision {
  level: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  signals: Signal[];
  aiUsed: boolean;
  impersonatedRequester: AiJudgement["impersonatedRequester"];
}

const MAX_REASONS = 3;

export function decide(signals: Signal[], ai: AiOutcome): RiskDecision {
  const rule = ruleLevel(signals);
  if (ai.ok) {
    return {
      level: maxLevel(rule, ai.judgement.level),
      scamType: ai.judgement.scamType,
      reasons: ai.judgement.reasons.slice(0, MAX_REASONS),
      signals,
      aiUsed: true,
      impersonatedRequester: ai.judgement.impersonatedRequester,
    };
  }
  return {
    level: signals.length > 0 ? "high" : rule,
    scamType: "unknown",
    reasons: signals.map((s) => s.detail).slice(0, MAX_REASONS),
    signals,
    aiUsed: false,
    impersonatedRequester: null,
  };
}
