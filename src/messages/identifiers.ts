import type { Identifier, IdentifierType } from "@/domain/types";
import { normalisePayee } from "@/risk/signals";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d[\d\s().-]{6,18}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IDENTIFIERS = 20;

export function phoneVariants(normalised: string): string[] {
  const digits = normalised.replace(/^\+/, "");
  const out = new Set([normalised, digits]);
  if (digits.length > 10) out.add(digits.slice(-10));
  return [...out];
}

/** Comparable keys for an email, URL or phone number, however it was written. */
export function matchKeys(value: string): string[] {
  const v = value.trim().toLowerCase();
  if (/[a-z@/]/.test(v)) return [v.replace(/\/+$/, "")];
  return phoneVariants(normalisePayee(v));
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

  for (const p of withoutEmails.match(PHONE_RE) ?? []) {
    if (ISO_DATE.test(p.trim())) continue;
    const digits = p.replace(/\D/g, "").length;
    if (digits >= 7 && digits <= 15) add("phone", normalisePayee(p));
  }
  return out;
}
