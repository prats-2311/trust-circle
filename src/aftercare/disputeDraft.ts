export const SCAM_PAYEE_TITLE = "Payment to an account now on the scam list";
export const SCAM_PAYEE_DETAIL =
  "This payment went through before the account was reported. You can ask PayPal to open a dispute; we've drafted what to say.";

/** Text the person copies and sends to PayPal themselves. Nothing here is sent by the app. */
export function draftDispute(p: { senderName: string; payee: string; amountCents: number; date: Date }): string {
  const amount = `$${(p.amountCents / 100).toFixed(2)}`;
  const date = p.date.toISOString().slice(0, 10);
  return [
    "I would like to dispute a payment I believe went to a scammer.",
    "",
    `Account holder: ${p.senderName}`,
    `Paid to: ${p.payee}`,
    `Amount: ${amount}`,
    `Date: ${date}`,
    "",
    "Why: this account has since been reported as a scam to Trust Circle, a scam-protection service for PayPal payments. I did not know when I sent it.",
    "",
    "Please open a dispute and tell me what else you need from me.",
  ].join("\n");
}

/** The dispute draft is only for the code's own scam-payee finding, never for anything the model wrote. */
export function canDraftDispute(f: { source: "code" | "model"; severity: string; title: string }): boolean {
  return f.source === "code" && f.severity === "act" && f.title === SCAM_PAYEE_TITLE;
}
