import type { ChipTone } from "@/ui/Chip";

export function riskScreen(level: "low" | "medium" | "high", opts: { circleName: string | null; coolingOffHours: number }) {
  if (level === "low") {
    return { chipTone: "safe" as ChipTone, chip: "No warning signs", title: "This payment looks fine", lead: "Approve it in PayPal to send it.", continueLabel: "Continue to PayPal", holdNote: null };
  }
  const paused = { title: "Let's pause before this goes", lead: "Nothing has been sent. Here is what made us stop." };
  if (level === "medium") {
    return { chipTone: "caution" as ChipTone, chip: "Paused for a check", ...paused, continueLabel: "I understand, continue to PayPal", holdNote: null };
  }
  const who = opts.circleName;
  const hours = opts.coolingOffHours;
  return {
    chipTone: "held" as ChipTone,
    chip: "We'll hold this payment",
    ...paused,
    continueLabel: who ? `Continue, and let ${who} review it` : `Continue, and hold it for ${hours} hours`,
    holdNote: who
      ? `If you continue, PayPal holds the money. ${who} can approve or stop it. If nobody decides, you can release it yourself after ${hours} hours.`
      : `If you continue, PayPal holds the money for ${hours} hours. After that you can release it yourself.`,
  };
}

/** Cancel failures. 409 is handled by the caller as "already dealt with". Server text is never shown for 0 or 5xx. */
export function cancelErrorCopy(status: number, error: string): string {
  return status === 0 || status >= 500 ? "We couldn't confirm the cancel just now. Please refresh to see where this payment is." : error;
}

/** A 202 is never an error: the caller goes to the payment page. A 409 means it was already decided. Server text is never shown for 0 or 5xx: it may say "nothing was sent". */
export function approvalErrorCopy(status: number, error: string): { message: string; canRetry: boolean } {
  if (status === 409) return { message: "This payment has already been dealt with.", canRetry: false };
  if (status === 0 || status >= 500) {
    return {
      message: "We couldn't confirm this payment just now. You approved it in PayPal, so it may already be in progress. Check your payments before you try again.",
      canRetry: true,
    };
  }
  return { message: error, canRetry: true };
}
