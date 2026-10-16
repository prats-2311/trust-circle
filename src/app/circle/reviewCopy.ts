import { formatTime } from "@/ui/format";
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
    return { tone: "safe", title: "You stopped the payment", lead: `We've told ${senderName}. Their money is safe, and this account is on the shared scam list now.` };
  }
  return { tone: "safe", title: "Payment approved", lead: `It's on its way to the person ${senderName} wanted to pay.` };
}

const clock = formatTime;

/** The verification note on the review screen. contactName is who was asked; senderName is who is paying. */
export function verificationNotice(stage: Stage | null, senderName: string, viewerName: string): string | null {
  if (!stage) return null;
  if (stage.stage === "waiting_for_person") {
    return stage.contactName === viewerName
      ? `We asked you at ${clock(stage.askedAt)}. Answer from your circle page.`
      : `We asked ${stage.contactName} at ${clock(stage.askedAt)}. No reply yet.`;
  }
  if (stage.stage === "challenge_passed") return `${senderName} checked with the caller, and they answered. It's still your decision.`;
  if (stage.stage === "resolved" && stage.outcome === "failed") return "The caller couldn't pass the check, so the payment is being stopped.";
  return null;
}

/** Shown when the payment loads in a state other than held. A real 409 from the decision POST uses decisionResultCopy instead. */
export function closedCopy(paymentState: string, stage: Stage | null, senderName: string): { title: string; lead: string } {
  const title = "This payment is no longer waiting for a decision";
  if (stage?.stage === "resolved" && stage.outcome === "failed") {
    return { title, lead: "The caller couldn't pass the check, so the payment was stopped." };
  }
  if (stage?.stage === "resolved" && stage.outcome === "denied") {
    return { title, lead: `${stage.contactName ?? "The real person"} said they didn't ask for this money, so the payment was stopped.` };
  }
  if (stage?.stage === "resolved" && stage.outcome === "confirmed") return { title, lead: "This payment has already gone through." };
  if (paymentState === "paid_out") return { title, lead: "This payment has already gone through." };
  if (paymentState === "refunded") return { title, lead: `It couldn't be delivered, so PayPal returned the money to ${senderName}.` };
  if (paymentState === "payout_failed") return { title, lead: `It couldn't be delivered, so the money is on its way back to ${senderName}.` };
  if (paymentState === "created") return { title, lead: `${senderName} didn't approve it in PayPal, so nothing was sent.` };
  if (["approved", "authorised", "released", "captured"].includes(paymentState)) return { title, lead: "It's going through PayPal now." };
  return { title, lead: `It was stopped, and the money stayed in ${senderName}'s account.` };
}
