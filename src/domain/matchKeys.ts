export function normalisePayee(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return trimmed.replace(/[^\d+]/g, "");
}

export function phoneVariants(normalised: string): string[] {
  const digits = normalised.replace(/^\+/, "");
  const out = new Set([normalised, digits]);
  if (digits.length > 10) out.add(digits.slice(-10));
  return [...out];
}

/** Comparable keys for an email, link or phone number, however it was written. */
export function matchKeys(value: string): string[] {
  const v = value.trim().toLowerCase();
  if (v.includes("@") && !/[/:]/.test(v)) return [v];
  if (/[a-z]/.test(v)) {
    return [
      v
        .replace(/[?#\\].*$/, "")
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .replace(/^[^/@]*@/, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, ""),
    ];
  }
  return phoneVariants(normalisePayee(v));
}

/** The one key the registry stores: the most general form (a long number's last ten digits). */
export function canonicalKey(value: string): string {
  return matchKeys(value).at(-1)!;
}

export function keySet(values: string[]): Set<string> {
  return new Set(values.flatMap(matchKeys));
}

export function sharesKey(a: string, b: string): boolean {
  const keys = new Set(matchKeys(a));
  return matchKeys(b).some((k) => keys.has(k));
}
