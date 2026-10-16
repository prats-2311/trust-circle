import type { Outcome } from "@/server/paymentOutcome";
import type { ChipTone } from "@/ui/Chip";

export type Stage =
  | { stage: "none" }
  | { stage: "waiting_for_person"; contactName: string; askedAt: string; challengeOpensAt: string }
  | { stage: "official_routes"; organisation: string; steps: string[] }
  | { stage: "challenge"; method: "safe_word" | "memory_question"; requesterName: string; guidance: string[] }
  | { stage: "challenge_passed" }
  | { stage: "resolved"; outcome: "confirmed" | "denied" | "failed" };

export type ScreenKind =
  | "not_approved" | "pending" | "waiting" | "challenge_memory" | "challenge_safe_word" | "official_routes" | "held"
  | "sent" | "refunded" | "stopped_by_person" | "stopped_by_check" | "stopped_by_circle" | "cancelled" | "hold_ended";

export function screenFor(p: { state: string; outcome: Outcome }, stage: Stage | null): ScreenKind {
  switch (p.state) {
    case "created":
      return "not_approved";
    case "approved": case "authorised": case "released": case "captured":
      return "pending";
    case "paid_out":
      return "sent";
    case "refunded": case "payout_failed":
      return "refunded";
    case "held":
      if (stage?.stage === "waiting_for_person") return "waiting";
      if (stage?.stage === "challenge") return stage.method === "safe_word" ? "challenge_safe_word" : "challenge_memory";
      if (stage?.stage === "official_routes") return "official_routes";
      // The check failed or the real person said no: the block is finishing, so say it is stopped.
      if (stage?.stage === "resolved" && stage.outcome === "failed") return "stopped_by_check";
      if (stage?.stage === "resolved" && stage.outcome === "denied") return "stopped_by_person";
      return "held";
    case "blocked": case "voided": case "expired":
      if (stage?.stage === "resolved" && stage.outcome === "denied") return "stopped_by_person";
      if (stage?.stage === "resolved" && stage.outcome === "failed") return "stopped_by_check";
      if (p.outcome === "circle") return "stopped_by_circle";
      if (p.outcome === "sender") return "cancelled";
      return "hold_ended";
    default:
      // An unknown state may mean money is moving; never reassure.
      return "pending";
  }
}

type Copy = { chipTone: ChipTone; chip: string; title: string; lead: string };

export function screenCopy(kind: ScreenKind, d: { amount: string; payee: string; contactName: string | null }): Copy {
  const held = (title: string, lead: string, chip = "On hold"): Copy => ({ chipTone: "held", chip, title, lead });
  const stopped = (lead: string): Copy => ({ chipTone: "safe", chip: "Stopped", title: "Payment stopped. Your money is safe.", lead });
  switch (kind) {
    case "not_approved":
      return { chipTone: "neutral", chip: "Not approved yet", title: "This payment hasn't been approved in PayPal", lead: "Nothing has been sent. You can start again from home." };
    case "pending":
      return held("We're finishing this payment", "It's on its way through PayPal. Please don't send it again.", "Finishing");
    case "waiting":
      return held(`We've asked ${d.contactName ?? "the real person"} if it was really them`, "Someone pretending to be them can't answer from there.");
    case "challenge_memory":
      return held(`Ask the caller something only ${d.contactName ?? "they"} would know`, "Let's check another way while we wait.");
    case "challenge_safe_word":
      return held("Ask the caller for your family's safe word", "Don't say it first or give any hints. Type exactly what they say.");
    case "official_routes":
      return held("Check with them yourself", "Reach them through their official app or website, never through the message.");
    case "held":
      return held("Your money hasn't left your account", `${d.contactName ?? "Your circle"} is looking at this payment. Nothing is sent unless it's approved.`);
    case "sent":
      return { chipTone: "safe", chip: "Sent", title: `${d.amount} sent to ${d.payee}`, lead: "The payment went through PayPal." };
    case "refunded":
      return { chipTone: "caution", chip: "Refunded", title: "This payment came back to you", lead: "It couldn't be delivered, so PayPal returned the money to your account." };
    case "stopped_by_person":
      return stopped(`${d.contactName ?? "The real person"} told us they didn't ask for this money. The ${d.amount} was never sent.`);
    case "stopped_by_check":
      return stopped(`The check didn't match, so we stopped it. The ${d.amount} was never sent.`);
    case "stopped_by_circle":
      return stopped(`Your circle stopped it before anything moved. The ${d.amount} was never sent.`);
    case "cancelled":
      return { chipTone: "neutral", chip: "Cancelled", title: "You cancelled this payment", lead: `The ${d.amount} was never sent.` };
    case "hold_ended":
      return { chipTone: "neutral", chip: "Hold ended", title: "The hold ended", lead: "Nobody decided within 3 days, so the payment was not sent. The money stayed in your account." };
  }
}
