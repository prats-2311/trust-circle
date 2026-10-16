"use client";
import { useMemo, useState } from "react";

/** Runs one async action at a time; extra taps while it runs are ignored. */
export function createOnce(onBusy: (busy: boolean) => void) {
  let inFlight = false;
  return {
    async run(fn: () => Promise<void>): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      onBusy(true);
      try {
        await fn();
      } finally {
        inFlight = false;
        onBusy(false);
      }
    },
  };
}

export function useOnce() {
  const [busy, setBusy] = useState(false);
  const once = useMemo(() => createOnce(setBusy), []);
  return { busy, run: once.run };
}
