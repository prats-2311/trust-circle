import { SCAM_TYPE_LABELS } from "@/domain/scamTypeLabels";
import { cleanRequesterName } from "@/domain/requesterName";
import type { Requester, ScamType } from "@/domain/types";
import type { ChipTone } from "@/ui/Chip";

export type ResultKind = "scam" | "warning" | "clear" | "not_checked";
export type CheckView = {
  source: "text" | "image" | "voice";
  checked: boolean;
  level: "low" | "medium" | "high" | null;
  scamType: ScamType;
  reasons: string[];
  impersonatedRequester: Requester | null;
};

export function voiceLine(r: Requester | null): string {
  const name = r?.kind === "person" ? cleanRequesterName(r.name) : null;
  return name
    ? `A voice that sounds like ${name} isn't proof. Voices can be copied. Call ${name} on the number you already have.`
    : "A voice that sounds like someone you know isn't proof. Voices can be copied. Call them on the number you already have.";
}

export function resultKind(v: { checked: boolean; level: "low" | "medium" | "high" | null }): ResultKind {
  if (!v.checked || v.level === null) return "not_checked";
  return v.level === "high" ? "scam" : v.level === "medium" ? "warning" : "clear";
}

const who = (r: Requester | null) => (r ? cleanRequesterName(r.name) : null);

export function resultCopy(v: CheckView): { kind: ResultKind; chipTone: ChipTone; chip: string; title: string; lead: string; canReport: boolean } {
  const kind = resultKind(v);
  switch (kind) {
    case "scam": {
      const name = who(v.impersonatedRequester);
      return {
        kind, chipTone: "blocked", chip: "Very likely a scam",
        title: name ? `Someone is pretending to be ${name}` : "This message is very likely a scam",
        lead: `${SCAM_TYPE_LABELS[v.scamType]}. Don't reply, click links or send money.`, canReport: true,
      };
    }
    case "warning":
      return {
        kind, chipTone: "caution", chip: "Warning signs", title: "Be careful with this message",
        lead: "Some things in it are often seen in scams. Check with someone you trust before you reply or pay.", canReport: true,
      };
    case "clear":
      return {
        kind, chipTone: "safe", chip: "No warning signs", title: "We didn't find warning signs",
        lead: "If something still feels wrong, trust that feeling and ask someone in your circle.", canReport: false,
      };
    default:
      return {
        kind, chipTone: "neutral", chip: "Not checked yet", title: "We couldn't check this message right now",
        lead: "That isn't the same as safe. Please don't reply, click a link or pay until it has been checked.", canReport: false,
      };
  }
}
