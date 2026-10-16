import type { Stage } from "@/app/payments/[id]/screen";

export type DecisionTone = "safe" | "pending" | "info";

/** What a circle member sees after Stop or Approve. A contact's block alerts nobody, so it never says anyone was told. */
export function decisionResultCopy(
  decision: "approve" | "block",
  status: number,
  senderName: string,
): { tone: DecisionTone; title: string; lead: string } {
  if (status === 202) {
    return { tone: "pending", title: "We're finishing this for you", lead: "It's being completed through PayPal. Please don't decide again." };
  }
  if (status === 409) {
    return {
      tone: "info",
      title: "This payment has already been dealt with",
      lead: "Someone else in the circle, or the real person, has already answered.",
    };
  }
  if (decision === "block") {
    return { tone: "safe", title: "You stopped the payment", lead: `${senderName}'s money is safe, and this account is on the shared scam list now.` };
  }
  return { tone: "safe", title: "Payment approved", lead: `It's on its way to the person ${senderName} wanted to pay.` };
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });

/** The verification note on the review screen. contactName is who was asked; senderName is who is paying. */
export function verificationNotice(stage: Stage | null, senderName: string): string | null {
  if (!stage) return null;
  if (stage.stage === "waiting_for_person") return `We asked ${stage.contactName} at ${clock(stage.askedAt)}. No reply yet.`;
  if (stage.stage === "challenge_passed") return `${senderName} checked with the caller, and they answered. It's still your decision.`;
  if (stage.stage === "resolved" && stage.outcome === "failed") return "The caller couldn't pass the check, so the payment is being stopped.";
  return null;
}
