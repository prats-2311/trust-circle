"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { Notice } from "@/ui/Notice";
import { useOnce } from "@/ui/useOnce";
import type { Persona } from "@/server/demo";

export function DemoButtons() {
  const { busy, run } = useOnce();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Persona | null>(null);
  const go = (as: Persona) =>
    run(async () => {
      setError(null);
      setPending(as);
      const r = await fetchJson<{ home: string }>("/api/demo/login", jsonBody({ as }));
      if (r.ok) window.location.assign(r.data.home);
      else {
        setError(r.error);
        setPending(null);
      }
    });
  const label = (who: Persona, text: string) => (pending === who ? "Signing you in…" : text);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button className="w-auto! px-7" disabled={busy} onClick={() => go("margaret")} data-testid="try-margaret">
          {label("margaret", "Try as Margaret")}
        </Button>
        <Button variant="secondary" className="w-auto! px-7" disabled={busy} onClick={() => go("sarah")} data-testid="try-sarah">
          {label("sarah", "Try as Sarah, her daughter")}
        </Button>
      </div>
      <details className="text-[16px] text-ink-2">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold">Other demo accounts</summary>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("daniel")} data-testid="try-daniel">
            {label("daniel", "Daniel, the grandson")}
          </Button>
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("priya")} data-testid="try-priya">
            {label("priya", "Priya, a freelancer (business)")}
          </Button>
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("tom")} data-testid="try-tom">
            {label("tom", "Tom, Priya's accountant")}
          </Button>
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("robert")} data-testid="try-robert">
            {label("robert", "Robert, no circle")}
          </Button>
        </div>
      </details>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
