"use client";
import { useEffect, useState } from "react";

type HeldPayment = {
  id: string;
  payee: string;
  amountCents: number;
  reasons: string[];
  senderAnswer: string | null;
};

export default function CirclePage() {
  const [held, setHeld] = useState<HeldPayment[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/circle/held")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json() as Promise<HeldPayment[]>;
      })
      .then((list) => {
        setHeld(list);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [tick]);

  async function decide(id: string, decision: "approve" | "block") {
    const r = await fetch(`/api/payments/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const j: unknown = await r.json().catch(() => null);
    const obj = j && typeof j === "object" ? (j as Record<string, unknown>) : {};
    if (r.ok && typeof obj.state === "string") setMsg(`Payment ${obj.state}`);
    else setMsg(typeof obj.error === "string" ? obj.error : "Something went wrong. Please try again.");
    setTick((t) => t + 1);
  }

  return (
    <main>
      <h1>Payments waiting for you</h1>
      {msg && <p role="status" data-testid="decision-result">{msg}</p>}
      {failed && <p role="alert">We couldn&apos;t load your payments. Please refresh.</p>}
      {!failed && held.length === 0 && <p>Nothing is waiting.</p>}
      {held.map((p) => (
        <article key={p.id} data-testid="held-payment">
          <p>${(p.amountCents / 100).toFixed(2)} to {p.payee}</p>
          <ul>{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {p.senderAnswer && <p>They said: “{p.senderAnswer}”</p>}
          <button data-testid="approve" onClick={() => decide(p.id, "approve")}>Yes, send it</button>
          <button data-testid="block" onClick={() => decide(p.id, "block")}>Block it</button>
        </article>
      ))}
    </main>
  );
}
