"use client";
import { useEffect, useRef, useState } from "react";
import { loadSdk } from "./sdkLoader";

type PayPalSession = { start(opts: { presentationMode: string }, order: Promise<{ orderId: string }>): Promise<void> };
type PayPalSdk = {
  findEligibleMethods(o: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(h: {
    onApprove: (data: { orderId: string; payerId: string; fundingSource: string }) => void;
    onCancel: () => void;
    onError: (e: unknown) => void;
  }): PayPalSession;
};

declare global {
  interface Window {
    paypal?: { createInstance(o: Record<string, unknown>): Promise<PayPalSdk> };
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React.JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string; disabled?: boolean };
    }
  }
}

export function PayPalApprove({ orderId, onApproved }: { orderId: string; onApproved: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const approvedRef = useRef(onApproved);
  const openRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    approvedRef.current = onApproved;
  }, [onApproved]);

  useEffect(() => {
    let cancelled = false;
    let button: HTMLElement | null = null;
    let handler: (() => void) | null = null;
    (async () => {
      try {
        await loadSdk();
        const sdk = await window.paypal!.createInstance({
          clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
          components: ["paypal-payments"],
          pageType: "checkout",
        });
        const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
        if (!methods.isEligible("paypal")) {
          setError("PayPal isn't available right now. Nothing was sent.");
          return;
        }
        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: () => {
            openRef.current = false;
            setBusy(false);
            approvedRef.current();
          },
          onCancel: () => {
            openRef.current = false;
            setBusy(false);
            setError("You cancelled in PayPal. Nothing was sent.");
          },
          onError: () => {
            openRef.current = false;
            setBusy(false);
            setError("PayPal had a problem. Nothing was sent.");
          },
        });
        if (cancelled || !ref.current) return;
        button = ref.current;
        handler = () => {
          if (openRef.current) return;
          openRef.current = true;
          setBusy(true);
          setError(null);
          session.start({ presentationMode: "auto" }, Promise.resolve({ orderId })).catch(() => {
            openRef.current = false;
            setBusy(false);
            setError("PayPal had a problem. Nothing was sent.");
          });
        };
        button.hidden = false;
        button.addEventListener("click", handler);
      } catch {
        if (cancelled) return;
        setError("PayPal couldn't load. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
      if (button && handler) button.removeEventListener("click", handler);
    };
  }, [orderId]);

  return (
    <div>
      <paypal-button ref={ref} type="pay" hidden data-testid="paypal-button" disabled={busy}></paypal-button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
