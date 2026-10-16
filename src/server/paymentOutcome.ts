export type Outcome = "circle" | "sender" | "expired" | null;

/** Why a payment stopped, from its audit trail; message text never enters the trail. */
export function paymentOutcome(audits: { action: string; actorId: string | null }[], senderId: string): Outcome {
  const last = [...audits].reverse().find((a) => a.action === "BLOCK" || a.action === "EXPIRE");
  if (!last) return null;
  if (last.action === "EXPIRE") return "expired";
  return last.actorId === senderId ? "sender" : "circle";
}
