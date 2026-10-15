"use client";
import { useState } from "react";

const USERS = [
  { id: process.env.NEXT_PUBLIC_DEMO_SENDER_ID ?? "", label: "Margaret (sender)", to: "/send" },
  { id: process.env.NEXT_PUBLIC_DEMO_CONTACT_ID ?? "", label: "Sarah (trusted contact)", to: "/circle" },
];

export default function DemoPage() {
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: string, to: string) {
    setError(null);
    const res = await fetch("/api/demo/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    if (!res.ok) {
      setError("We couldn't sign you in. Please try again.");
      return;
    }
    window.location.assign(to);
  }

  return (
    <main>
      <h1>Trust Circle demo</h1>
      {USERS.map((u) => (
        <button key={u.label} data-testid={`demo-${u.to.slice(1)}`} onClick={() => signIn(u.id, u.to)}>
          {u.label}
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
