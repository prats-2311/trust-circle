import type { Requester } from "@/domain/types";
import type { MessageCheckRecord } from "@/messages/messageRepo";

export function toMessageCheckView(c: MessageCheckRecord & { impersonatedRequester?: Requester | null }) {
  return {
    id: c.id,
    source: c.source,
    text: c.text,
    checked: c.checked,
    level: c.level,
    scamType: c.scamType,
    reasons: c.reasons,
    identifiers: c.identifiers,
    impersonatedRequester: c.impersonatedRequester ?? null,
    createdAt: c.createdAt,
  };
}
