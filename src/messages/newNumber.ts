import type { KnownContact } from "@/circle/circleRepo";
import type { Identifier, Requester } from "@/domain/types";
import { matchRequester } from "@/verification/matchRequester";
import { matchKeys } from "./identifiers";
import type { Signal } from "@/risk/signals";

/**
 * The message claims to be someone in the circle but comes from a number that is not theirs.
 * Fires only when none of the message's numbers is the member's known number.
 */
export function newNumberSignal(requester: Requester | null, identifiers: Identifier[], circle: KnownContact[]): Signal | null {
  if (!requester || requester.kind !== "person") return null;
  const member = matchRequester(requester.name, circle);
  if (!member) return null;
  const known = circle.find((c) => c.contactId === member.contactId)?.phone;
  if (!known) return null;
  const numbers = identifiers.filter((i) => i.type === "phone");
  if (numbers.length === 0) return null;
  const knownKeys = new Set(matchKeys(known));
  if (numbers.some((n) => matchKeys(n.value).some((k) => knownKeys.has(k)))) return null;
  return { code: "NEW_NUMBER_CLAIMS_CIRCLE", detail: `It came from ${numbers[0]!.value}, not ${member.displayName}'s number.` };
}
