import type { MessageAiOutcome, MessageInput, MessageJudge } from "@/ai/groqMessageJudge";
import { INJECTION_THRESHOLD, type PromptGuard } from "@/ai/promptGuard";
import type { Identifier, Requester, RiskLevel, ScamType } from "@/domain/types";
import { decide } from "@/risk/decide";
import type { PatternMatch, PatternMatcher } from "@/patterns/patternService";
import { HIDDEN_INSTRUCTIONS_SIGNAL, KNOWN_PATTERN_SIGNAL, type Signal } from "@/risk/signals";
import { extractIdentifiers, matchKeys } from "./identifiers";

export interface RegistryLists {
  confirmed: string[];
  unconfirmed: string[];
}

export interface MessageAssessment {
  /** False when the AI could not check the message. Never present an unchecked result as safe. */
  checked: boolean;
  level: RiskLevel;
  scamType: ScamType;
  reasons: string[];
  identifiers: Identifier[];
  impersonatedRequester: Requester | null;
  /** The pasted text, or the words the vision model read from a screenshot. */
  text: string;
  signals: Signal[];
}

export function messageSignals(identifiers: Identifier[], registry: RegistryLists): Signal[] {
  const keys = new Set(identifiers.flatMap((i) => matchKeys(i.value)));
  const listed = (list: string[]) => list.some((entry) => matchKeys(entry).some((k) => keys.has(k)));
  if (listed(registry.confirmed)) {
    return [{ code: "REGISTRY_CONFIRMED", detail: "This message contains contact details that have been confirmed as a scammer's." }];
  }
  if (listed(registry.unconfirmed)) {
    return [{ code: "REGISTRY_UNCONFIRMED", detail: "Someone has reported contact details in this message as a possible scam." }];
  }
  return [];
}

async function injectionSignals(guard: PromptGuard | undefined, text: string): Promise<Signal[]> {
  if (!guard || !text) return [];
  try {
    const score = await guard(text);
    return score !== null && score >= INJECTION_THRESHOLD ? [HIDDEN_INSTRUCTIONS_SIGNAL] : [];
  } catch {
    return [];
  }
}

async function patternMatch(patterns: PatternMatcher | undefined, text: string): Promise<PatternMatch | null> {
  if (!patterns || !text) return null;
  try {
    return await patterns(text);
  } catch {
    return null;
  }
}

export async function assessMessage(
  input: MessageInput,
  ctx: { registry: RegistryLists },
  deps: { judge: MessageJudge; guard?: PromptGuard; patterns?: PatternMatcher },
): Promise<MessageAssessment> {
  const pasted = input.kind === "text" ? input.text.trim() : "";
  const early = messageSignals(extractIdentifiers(pasted), ctx.registry);
  let ai: MessageAiOutcome;
  try {
    ai = await deps.judge(input, early);
  } catch {
    ai = { ok: false, error: "judge threw" };
  }
  // A screenshot's words only exist once the vision model has read them.
  const text = input.kind === "image" ? (ai.ok ? ai.judgement.transcript.trim() : "") : pasted;
  const identifiers = extractIdentifiers(text);
  const [injection, pattern] = await Promise.all([injectionSignals(deps.guard, text), patternMatch(deps.patterns, text)]);
  const signals = [...messageSignals(identifiers, ctx.registry), ...injection, ...(pattern ? [KNOWN_PATTERN_SIGNAL] : [])];
  const d = decide(signals, ai, pattern?.scamType);
  return {
    checked: ai.ok,
    level: d.level,
    scamType: d.scamType,
    reasons: d.reasons,
    identifiers,
    impersonatedRequester: d.impersonatedRequester,
    text,
    signals,
  };
}
