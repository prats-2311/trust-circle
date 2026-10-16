import { maxLevel, type Requester, type RiskLevel, type ScamType } from "@/domain/types";
import { ruleLevel, type Signal } from "./signals";

export interface AiJudgement {
  level: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  impersonatedRequester: Requester | null;
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

function sanitiseReasons(raw: string[]): string[] {
  const cleaned = raw.map((r) => r.trim()).filter((r) => r.length > 0);
  return [...new Set(cleaned)].slice(0, MAX_REASONS);
}

/** `patternScamType`: the scam type of a matched known pattern, kept when that pattern (not the AI) raised the level. */
export function decide(signals: Signal[], ai: AiOutcome, patternScamType?: ScamType): RiskDecision {
  const rule = ruleLevel(signals);
  if (ai.ok) {
    const level = maxLevel(rule, ai.judgement.level);
    const details = signals.map((s) => s.detail).slice(0, MAX_REASONS);
    const overridden = level !== ai.judgement.level;
    let reasons = overridden ? details : sanitiseReasons(ai.judgement.reasons);
    if (level !== "low" && reasons.length === 0) reasons = details;
    return {
      level,
      scamType: overridden ? (patternScamType ?? "unknown") : ai.judgement.scamType,
      reasons,
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
