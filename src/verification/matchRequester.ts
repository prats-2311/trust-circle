import type { CircleMember } from "@/circle/circleRepo";

const FILLER = new Set(["my", "your", "the", "a", "an", "our", "dear"]);
// A broad word the requester used, and the relationship labels it covers.
const BROADER: Record<string, string[]> = {
  grandchild: ["grandson", "granddaughter"],
  grandkid: ["grandson", "granddaughter"],
  child: ["son", "daughter"],
  kid: ["son", "daughter"],
  mom: ["mother"],
  mum: ["mother"],
  dad: ["father"],
  grandma: ["grandmother"],
  grandpa: ["grandfather"],
};

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/[\s'-]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));
}

/** The one circle member the requester claims to be, or null when there is no match or more than one. */
export function matchRequester(name: string, circle: CircleMember[]): CircleMember | null {
  const asked = words(name);
  if (asked.length === 0) return null;
  const hits = circle.filter((m) => {
    const own = new Set([...words(m.displayName), ...words(m.relationship)]);
    return asked.some((w) => own.has(w) || (BROADER[w] ?? []).some((r) => own.has(r)));
  });
  return hits.length === 1 ? hits[0]! : null;
}
