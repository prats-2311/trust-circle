import { keySet, matchKeys, normalisePayee } from "@/domain/matchKeys";
import { maxLevel, type RiskLevel } from "@/domain/types";

export interface PaymentRiskInput {
  payee: string;
  amountCents: number;
  note?: string;
  senderAnswer?: string;
  linkedMessage?: string;
}

export interface SenderContext {
  previousPayees: string[];
  recentAmountsCents: number[];
  paymentsInLastHour: number;
  circleLimitCents?: number;
  flaggedPayees: string[];
  registry: { confirmed: string[]; unconfirmed: string[] };
}

export type SignalCode =
  | "REGISTRY_CONFIRMED"
  | "LINKED_SCAM_MESSAGE"
  | "REGISTRY_UNCONFIRMED"
  | "FIRST_TIME_PAYEE"
  | "UNUSUAL_AMOUNT"
  | "OVER_CIRCLE_LIMIT"
  | "RAPID_REPEAT"
  | "HIDDEN_INSTRUCTIONS"
  | "KNOWN_SCAM_PATTERN";

export interface Signal {
  code: SignalCode;
  detail: string;
}

const UNUSUAL_MULTIPLIER = 3;
const THIN_HISTORY_THRESHOLD_CENTS = 50_000;
const RAPID_REPEAT_COUNT = 3;
const CONTRIBUTING: SignalCode[] = ["FIRST_TIME_PAYEE", "UNUSUAL_AMOUNT", "OVER_CIRCLE_LIMIT", "RAPID_REPEAT"];

export { normalisePayee };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function computeSignals(input: PaymentRiskInput, ctx: SenderContext): Signal[] {
  const payee = normalisePayee(input.payee);
  const set = (list: string[]) => new Set(list.map(normalisePayee));
  const payeeKeys = matchKeys(input.payee);
  const listed = (values: string[]) => {
    const keys = keySet(values);
    return payeeKeys.some((k) => keys.has(k));
  };
  const signals: Signal[] = [];

  if (listed(ctx.registry.confirmed)) {
    signals.push({ code: "REGISTRY_CONFIRMED", detail: "This payee has been confirmed as a scammer by other users." });
  } else if (listed(ctx.registry.unconfirmed)) {
    signals.push({ code: "REGISTRY_UNCONFIRMED", detail: "Someone has reported this payee as a possible scam." });
  }
  if (listed(ctx.flaggedPayees)) {
    signals.push({ code: "LINKED_SCAM_MESSAGE", detail: "You checked a message from this payee and it looked like a scam." });
  }
  if (!set(ctx.previousPayees).has(payee)) {
    signals.push({ code: "FIRST_TIME_PAYEE", detail: "You have not paid this person before." });
  }
  const unusual =
    ctx.recentAmountsCents.length >= 3
      ? input.amountCents > UNUSUAL_MULTIPLIER * median(ctx.recentAmountsCents)
      : input.amountCents >= THIN_HISTORY_THRESHOLD_CENTS;
  if (unusual) {
    signals.push({ code: "UNUSUAL_AMOUNT", detail: "This is much more than you usually send." });
  }
  if (ctx.circleLimitCents !== undefined && input.amountCents > ctx.circleLimitCents) {
    signals.push({ code: "OVER_CIRCLE_LIMIT", detail: "This is above the limit your circle set." });
  }
  if (ctx.paymentsInLastHour >= RAPID_REPEAT_COUNT) {
    signals.push({ code: "RAPID_REPEAT", detail: "You have made several payments in the last hour." });
  }
  return signals;
}

export const HIDDEN_INSTRUCTIONS_SIGNAL: Signal = Object.freeze({
  code: "HIDDEN_INSTRUCTIONS",
  detail: "This contains hidden instructions meant to trick safety checks, which is a common scam trick.",
} as const);

export const KNOWN_PATTERN_SIGNAL: Signal = Object.freeze({
  code: "KNOWN_SCAM_PATTERN",
  detail: "This reads like a scam other people have reported.",
} as const);

export function ruleLevel(signals: Signal[]): RiskLevel {
  const has = (c: SignalCode) => signals.some((s) => s.code === c);
  if (has("REGISTRY_CONFIRMED") || has("LINKED_SCAM_MESSAGE") || has("HIDDEN_INSTRUCTIONS")) return "high";
  const contributing = signals.filter((s) => CONTRIBUTING.includes(s.code)).length;
  let level: RiskLevel = contributing >= 3 ? "high" : contributing === 2 ? "medium" : "low";
  if (has("REGISTRY_UNCONFIRMED") || has("OVER_CIRCLE_LIMIT") || has("KNOWN_SCAM_PATTERN")) level = maxLevel(level, "medium");
  return level;
}
