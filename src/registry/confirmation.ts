export type RegistrySource = "message_report" | "contact_block" | "real_person_denied";

/** Spec 4.5: confirmed by a contact's block, the real person's denial, or reports from two different users. */
export function statusFor(reports: { reporterId: string; source: RegistrySource }[]): "unconfirmed" | "confirmed" {
  if (reports.some((r) => r.source === "contact_block" || r.source === "real_person_denied")) return "confirmed";
  const reporters = new Set(reports.filter((r) => r.source === "message_report").map((r) => r.reporterId));
  return reporters.size >= 2 ? "confirmed" : "unconfirmed";
}
