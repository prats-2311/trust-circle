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
    const excerpt = c.text.length > MESSAGE_EXCERPT ? `${c.text.slice(0, MESSAGE_EXCERPT)}…` : c.text;
    lines.push("", "The message:", `"${excerpt}"`);
  }
  lines.push("", "Reported with Trust Circle.");
  return { subject: `Scam report: ${label}`, body: lines.join("\n") };
}

/** A link that opens the user's own email app with the report filled in; the app never sends it. */
export function mailtoFor(d: { subject: string; body: string }): string {
  const build = (body: string) => `mailto:${PAYPAL_PHISHING_ADDRESS}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(body)}`;
  let body = d.body;
  while (build(body).length > MAX_MAILTO && body.length > 0) body = body.slice(0, Math.floor(body.length * 0.9));
  return build(body);
}
