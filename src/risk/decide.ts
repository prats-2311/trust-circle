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
const REMOTE_ACCESS_REASON = "Someone claiming to be a company is connected to your computer or phone. Real banks and support teams never ask for money this way.";

function sanitiseReasons(raw: string[]): string[] {
  const cleaned = raw.map((r) => r.trim()).filter((r) => r.length > 0);
  return [...new Set(cleaned)].slice(0, MAX_REASONS);
}

/** `patternScamType`: the scam type of a matched known pattern, kept when that pattern (not the AI) raised the level. */
export function decide(signals: Signal[], ai: AiOutcome, patternScamType?: ScamType): RiskDecision {
  const rule = ruleLevel(signals);
  if (ai.ok) {
    const requester = ai.judgement.impersonatedRequester;
    // A claimed organisation connected to the sender's device is the remote-access scam: always hold. Family tech help is a person.
    const remote = requester?.kind === "organisation" && requester.remoteAccess === true;
    const aiLevel = remote ? maxLevel(ai.judgement.level, "high") : ai.judgement.level;
    const level = maxLevel(rule, aiLevel);
    const details = signals.map((s) => s.detail).slice(0, MAX_REASONS);
    const overridden = level !== aiLevel;
    let reasons = overridden ? details : sanitiseReasons(ai.judgement.reasons);
    if (remote && aiLevel !== ai.judgement.level) reasons = [REMOTE_ACCESS_REASON, ...reasons].slice(0, MAX_REASONS);
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
