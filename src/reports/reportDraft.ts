import { SCAM_TYPE_LABELS } from "@/domain/scamTypeLabels";
import type { MessageCheckRecord } from "@/messages/messageRepo";

export const PAYPAL_PHISHING_ADDRESS = "phishing@paypal.com";
const MAX_MAILTO = 1800;
const MESSAGE_EXCERPT = 1200;
const IDENTIFIER_LABELS = { phone: "Phone number", email: "Email address", url: "Link" } as const;

export function draftReport(c: Pick<MessageCheckRecord, "scamType" | "reasons" | "identifiers" | "text">): { subject: string; body: string } {
  const label = SCAM_TYPE_LABELS[c.scamType];
  const lines = [
    "I received this message and believe it is a scam.",
    "",
    `Type of scam: ${label}`,
  ];
  if (c.reasons.length) lines.push("", "Why it looks like a scam:", ...c.reasons.map((r) => `- ${r}`));
  if (c.identifiers.length) lines.push("", "Contact details in the message:", ...c.identifiers.map((i) => `- ${IDENTIFIER_LABELS[i.type]}: ${i.value}`));
  if (c.text) {
    const chars = Array.from(c.text);
    const excerpt = chars.length > MESSAGE_EXCERPT ? `${chars.slice(0, MESSAGE_EXCERPT).join("")}…` : c.text;
    lines.push("", "The message:", `"${excerpt}"`);
  }
  lines.push("", "Reported with Trust Circle.");
  return { subject: `Scam report: ${label}`, body: lines.join("\n") };
}

/** A link that opens the user's own email app with the report filled in; the app never sends it. */
export function mailtoFor(d: { subject: string; body: string }): string {
  const build = (body: string) => `mailto:${PAYPAL_PHISHING_ADDRESS}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(body)}`;
  // Trim by code points so an emoji is never cut in half (encodeURIComponent throws on a lone surrogate).
  let chars = Array.from(d.body);
  let body = d.body;
  while (build(body).length > MAX_MAILTO && chars.length > 0) {
    chars = chars.slice(0, Math.floor(chars.length * 0.9));
    body = chars.join("");
  }
  return build(body);
}
