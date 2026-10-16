"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { Notice } from "@/ui/Notice";
import { useOnce } from "@/ui/useOnce";

type Persona = "margaret" | "sarah" | "daniel" | "robert";

export function DemoButtons() {
  const { busy, run } = useOnce();
  const [error, setError] = useState<string | null>(null);
  const go = (as: Persona) =>
    run(async () => {
      setError(null);
      const r = await fetchJson<{ home: string }>("/api/demo/login", jsonBody({ as }));
      if (r.ok) window.location.assign(r.data.home);
      else setError(r.error);
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button className="w-auto! px-7" disabled={busy} onClick={() => go("margaret")} data-testid="try-margaret">
          Try as Margaret
        </Button>
        <Button variant="secondary" className="w-auto! px-7" disabled={busy} onClick={() => go("sarah")} data-testid="try-sarah">
          Try as Sarah, her daughter
        </Button>
      </div>
      <details className="text-[16px] text-ink-2">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold">Other demo accounts</summary>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("daniel")} data-testid="try-daniel">
            Daniel, her grandson
          </Button>
          <Button variant="quiet" className="w-auto!" disabled={busy} onClick={() => go("robert")} data-testid="try-robert">
            Robert, another PayPal user
          </Button>
        </div>
      </details>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
