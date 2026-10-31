import type { Identifier, IdentifierType } from "@/domain/types";
import { matchKeys, normalisePayee, phoneVariants } from "@/domain/matchKeys";

export { matchKeys, phoneVariants };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Links typed without http:// or www.: a domain followed by a path, or a bare domain on a common ending.
const BARE_LINK_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:[a-z]{2,}\/[^\s<>"')\]]+|(?:com|net|org|info|biz|io|co|me|ly|xyz|top|online|site|example)\b)/gi;
const PHONE_RE = /\+?\d[\d\s().-]{6,18}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IDENTIFIERS = 20;

/** The phone number as it was typed in the text. Falls back to the normalised value when no match is found. */
export function phoneAsWritten(text: string, value: string): string {
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0].trim().replace(/[\s.,;:!?-]+$/, "");
    if (normalisePayee(raw) === value || normalisePayee(m[0]) === value) {
      // PHONE_RE starts at a digit or +, so an opening bracket before the area code is left behind.
      const open = m.index > 0 && text[m.index - 1] === "(" && raw.indexOf(")") !== -1 && (raw.indexOf("(") === -1 || raw.indexOf(")") < raw.indexOf("("));
      return open ? `(${raw}` : raw;
    }
  }
  return value;
}

export function extractIdentifiers(text: string): Identifier[] {
  const out: Identifier[] = [];
  const seen = new Set<string>();
  const add = (type: IdentifierType, value: string) => {
    const key = `${type}:${value}`;
    if (seen.has(key) || out.length >= MAX_IDENTIFIERS) return;
    seen.add(key);
    out.push({ type, value });
  };

  const urls = text.match(URL_RE) ?? [];
  for (const u of urls) add("url", u.replace(/[.,;:!?]+$/, "").replace(/\/+$/, "").toLowerCase());
  const withoutUrls = urls.reduce((t, u) => t.replace(u, " "), text);

  const emails = withoutUrls.match(EMAIL_RE) ?? [];
  for (const e of emails) add("email", normalisePayee(e));
  const withoutEmails = emails.reduce((t, e) => t.replace(e, " "), withoutUrls);

  const bare = withoutEmails.match(BARE_LINK_RE) ?? [];
  for (const b of bare) add("url", b.replace(/[.,;:!?]+$/, "").replace(/\/+$/, "").toLowerCase());
  const withoutLinks = bare.reduce((t, b) => t.replace(b, " "), withoutEmails);

  for (const p of withoutLinks.match(PHONE_RE) ?? []) {
    if (ISO_DATE.test(p.trim())) continue;
    const digits = p.replace(/\D/g, "").length;
    if (digits >= 7 && digits <= 15) add("phone", normalisePayee(p));
  }
  return out;
}
