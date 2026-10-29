export type Outcome = "circle" | "sender" | "expired" | null;

/** Why a payment stopped, from its audit trail; message text never enters the trail. */
export function paymentOutcome(audits: { action: string; actorId: string | null }[], senderId: string): Outcome {
  const last = [...audits].reverse().find((a) => a.action === "BLOCK" || a.action === "EXPIRE");
  if (!last) return null;
  if (last.action === "EXPIRE") return "expired";
  return last.actorId === senderId ? "sender" : "circle";
}

/** True when PayPal's own reply to the void said VOIDED, so the screen can say PayPal confirmed it. */
export function paypalVoided(audits: { action: string; detail?: Record<string, unknown> }[]): boolean {
  return audits.some((a) => a.action === "VOID" && a.detail?.paypalStatus === "VOIDED");
}
