"use client";
import { SignedOut } from "@/ui/SignedOut";
import { SIGNED_OUT } from "@/ui/fetchJson";
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments")
      .then(async (r) => {
        if (r.status === 401) {
          if (!cancelled) setError(SIGNED_OUT);
          return;
        }
        if (!r.ok) throw new Error("load failed");
        const all = (await r.json()) as PaymentView[];
        if (cancelled) return;
        setP(all.find((x) => x.id === id) ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load this payment. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function release() {
    setError(null);
    const r = await fetch(`/api/payments/${id}/release`, { method: "POST" });
    if (r.status === 401) return setError(SIGNED_OUT);
    const j: unknown = await r.json().catch(() => null);
    if (r.ok) {
      setP(j as PaymentView);
    } else {
      setError(errorText(j));
    }
  }

  if (!p) {
    return (
      <main>
        {error === SIGNED_OUT ? <SignedOut /> : error ? <p role="alert">{error}</p> : loaded ? <p role="alert">We couldn&apos;t find this payment.</p> : "Loading…"}
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
      {error === SIGNED_OUT ? <SignedOut /> : error && <p role="alert">{error}</p>}
    </main>
  );
}
