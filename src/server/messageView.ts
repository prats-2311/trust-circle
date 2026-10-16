import type { RiskLevel, Requester } from "@/domain/types";
import type { MessageCheckRecord } from "@/messages/messageRepo";

export function toMessageCheckView(c: MessageCheckRecord & { impersonatedRequester?: Requester | null }) {
  // An unchecked message has no verdict, so it can never be shown as "low".
  const level: RiskLevel | null = c.checked ? c.level : null;
  return {
    id: c.id,
    source: c.source,
    text: c.text,
    checked: c.checked,
    level,
    scamType: c.checked ? c.scamType : ("unknown" as const),
    reasons: c.reasons,
    identifiers: c.identifiers,
    impersonatedRequester: c.impersonatedRequester ?? null,
    createdAt: c.createdAt,
  };
}
