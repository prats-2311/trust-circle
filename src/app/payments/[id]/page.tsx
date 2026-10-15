"use client";
import { use, useEffect, useState } from "react";

type PaymentView = { id: string; state: string; coolingOffUntil: string | null };

function errorText(json: unknown): string {
  return json && typeof json === "object" && "error" in json && typeof json.error === "string"
    ? json.error
    : "Something went wrong. Please try again.";
}

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<PaymentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then((all: PaymentView[]) => setP(all.find((x) => x.id === id) ?? null))
      .catch(() => setError("We couldn't load this payment. Please refresh."));
  }, [id]);

  async function release() {
    const r = await fetch(`/api/payments/${id}/release`, { method: "POST" });
    const j: unknown = await r.json().catch(() => null);
    if (r.ok) {
      setError(null);
      setP(j as PaymentView);
    } else {
      setError(errorText(j));
    }
  }

  if (!p) {
    return (
      <main>
        {error ? <p role="alert">{error}</p> : "Loading…"}
      </main>
    );
  }
  return (
    <main>
      <h1 data-testid="payment-state">{p.state}</h1>
      {p.state === "held" && p.coolingOffUntil && (
        <p>Your circle has been asked. You can release it yourself after {new Date(p.coolingOffUntil).toLocaleString()}.</p>
      )}
      {p.state === "held" && (
        <button data-testid="release" onClick={release}>Release now</button>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
