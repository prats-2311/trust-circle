export type PayPalAction = "create" | "authorize" | "capture" | "void" | "payout" | "refund";

export function centsToPayPalValue(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0 || cents > 1_000_000) throw new Error(`Invalid amount in cents: ${cents}`);
  return (cents / 100).toFixed(2);
}

export function requestId(paymentId: string, action: PayPalAction): string {
  return `tc-${paymentId}-${action}`;
}
