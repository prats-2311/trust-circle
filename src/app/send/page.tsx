"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionNotice, SIGN_IN_AGAIN } from "../SessionNotice";
import { PayPalApprove } from "./PayPalApprove";

type Risk = { level: "low" | "medium" | "high"; reasons: string[] };
type Result = { paymentId: string; orderId: string; risk: Risk };

export default function SendPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [confirmedMedium, setConfirmedMedium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approvedFor = useRef<string | null>(null);

  async function submit(form: FormData) {
    setError(null);
    const note = form.get("note");
    const answer = form.get("answer");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payee: form.get("payee"),
        amountCents: Math.round(Number(form.get("amount")) * 100),
        note: note || undefined,
        senderAnswer: answer || undefined,
      }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) return setError(SIGN_IN_AGAIN);
      const msg = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : null;
      setError(msg ?? "Something went wrong. Nothing was sent.");
      return;
    }
    setResult(json as Result);
  }

  const paymentId = result?.paymentId;
  const onApproved = useCallback(async () => {
    if (!paymentId || approvedFor.current === paymentId) return;
    approvedFor.current = paymentId;
    setError(null);
    const res = await fetch(`/api/payments/${paymentId}/approved`, { method: "POST" });
    if (res.ok) {
      router.push(`/payments/${paymentId}`);
      return;
    }
    if (res.status === 401) return setError(SIGN_IN_AGAIN);
    const json: unknown = await res.json().catch(() => null);
    const msg = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : null;
    setError(msg ?? "We couldn't finish that just now. Please check your payments for the latest status.");
  }, [paymentId, router]);

  return (
    <main>
      <h1>Send money</h1>
      {!result && (
        <form action={submit}>
          <label>To (email or phone)<input name="payee" required data-testid="payee" /></label>
          <label>Amount in dollars<input name="amount" type="number" step="0.01" min="0.01" required data-testid="amount" /></label>
          <label>Note<input name="note" data-testid="note" /></label>
          <label>Who asked you to make this payment, and why?<textarea name="answer" data-testid="answer" /></label>
          <button type="submit" data-testid="check">Continue</button>
          {error === SIGN_IN_AGAIN ? <SessionNotice /> : error && <p role="alert">{error}</p>}
        </form>
      )}
      {result && (
        <section data-testid={`risk-${result.risk.level}`}>
          <h2>{result.risk.level === "high" ? "We'll hold this payment" : result.risk.level === "medium" ? "Please take a moment" : "Looks fine"}</h2>
          <ul>{result.risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {result.risk.level === "high" && <p>If you continue, the money is reserved but not sent until someone in your circle confirms.</p>}
          {result.risk.level === "medium" && !confirmedMedium ? (
            <button data-testid="confirm-medium" onClick={() => setConfirmedMedium(true)}>I understand, continue</button>
          ) : (
            <PayPalApprove orderId={result.orderId} onApproved={onApproved} />
          )}
          {error === SIGN_IN_AGAIN ? <SessionNotice /> : error && <p role="alert">{error}</p>}
        </section>
      )}
    </main>
  );
}
