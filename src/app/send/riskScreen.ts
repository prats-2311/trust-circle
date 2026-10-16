import type { ChipTone } from "@/ui/Chip";

export function riskScreen(level: "low" | "medium" | "high", opts: { circleName: string | null }) {
  if (level === "low") {
    return { chipTone: "safe" as ChipTone, chip: "No warning signs", title: "This payment looks fine", lead: "Approve it in PayPal to send it.", continueLabel: "Continue to PayPal", holdNote: null };
  }
  const paused = { title: "Let's pause before this goes", lead: "Nothing has been sent. Here is what made us stop." };
  if (level === "medium") {
    return { chipTone: "caution" as ChipTone, chip: "Paused for a check", ...paused, continueLabel: "I understand, continue to PayPal", holdNote: null };
  }
  const who = opts.circleName;
  return {
    chipTone: "held" as ChipTone,
    chip: "We'll hold this payment",
    ...paused,
    continueLabel: who ? `Continue, and let ${who} review it` : "Continue, and hold it for 24 hours",
    holdNote: who
      ? `If you continue, PayPal holds the money. It isn't sent until ${who} approves it.`
      : "If you continue, PayPal holds the money. It isn't sent until the waiting time is over and you release it.",
  };
}

/** A 202 is never an error: the caller goes to the payment page. A 409 means it was already decided. */
export function approvalErrorCopy(status: number, error: string): { message: string; canRetry: boolean } {
  if (status === 409) return { message: "This payment has already been dealt with.", canRetry: false };
  return { message: error, canRetry: true };
}
