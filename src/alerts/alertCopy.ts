import type { AlertKind, AlertPayload } from "./alertRepo";

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function alertCopy(a: {
  kind: AlertKind;
  payload: AlertPayload;
  paymentId: string | null;
  verificationId: string | null;
}): { title: string; body: string; path: string } {
  const { senderName: sender, payee } = a.payload;
  const amount = formatUsd(a.payload.amountCents);
  const requester = a.payload.requesterName ?? "They";
  switch (a.kind) {
    case "payment_held":
      return {
        title: `${sender}'s payment of ${amount} is on hold`,
        body: `${sender} tried to send ${amount} to ${payee}. We've paused it so you can take a look. The money stays in their account while you take a look.`,
        path: `/circle/payments/${a.paymentId}`,
      };
    case "medium_payment_sent":
      return {
        title: `${sender} sent ${amount} to someone new`,
        body: `${sender} confirmed a payment of ${amount} to ${payee} after a warning. You don't need to do anything, but it may be worth a call.`,
        path: `/circle/payments/${a.paymentId}`,
      };
    case "verify_request":
      return {
        title: `Did you just ask ${sender} for ${amount}?`,
        body: `Someone asked ${sender} to send ${amount} and said they were you. Please tell us if it was really you. The money is on hold until you answer.`,
        path: `/verify/${a.verificationId}`,
      };
    case "payment_stopped":
      return {
        title: "Your payment has been stopped",
        body: `${requester} told us they didn't ask for this money, so we stopped your payment of ${amount} to ${payee}. The money was never sent.`,
        path: `/payments/${a.paymentId}`,
      };
    case "payment_confirmed":
      return {
        title: `${requester} confirmed the payment`,
        body: `${requester} said they asked for this money, so we're sending ${amount} to ${payee}.`,
        path: `/payments/${a.paymentId}`,
      };
  }
}
