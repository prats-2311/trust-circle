const RELATIONSHIP = /^(?:grandson|granddaughter|grandchild|grandma|grandpa|grandmother|grandfather|son|daughter|nephew|niece|brother|sister|husband|wife|cousin|uncle|aunt|mum|mom|dad|father|mother)\s+(?=\p{Lu})/iu;

/** Who the caller claims to be, as it should read on screen: "my grandson Daniel" becomes "Daniel". */
export function cleanRequesterName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ").replace(/^(?:my|your)\s+/i, "");
  // A relationship word only goes when a capitalised name follows it. The `i` flag must not make "daniel" count as a name.
  const m = RELATIONSHIP.exec(name);
  return m && /^\p{Lu}/u.test(name.slice(m[0].length)) ? name.slice(m[0].length) : name;
}
