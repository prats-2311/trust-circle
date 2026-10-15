"use client";
import { useEffect, useRef, useState } from "react";

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
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string };
    }
  }
}

function loadSdk(): Promise<void> {
  if (window.paypal) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.sandbox.paypal.com/web-sdk/v6/core";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PayPal failed to load"));
    document.body.appendChild(s);
  });
}

export function PayPalApprove({ orderId, onApproved }: { orderId: string; onApproved: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const approvedRef = useRef(onApproved);
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
          onApprove: () => approvedRef.current(),
          onCancel: () => setError("You cancelled in PayPal. Nothing was sent."),
          onError: () => setError("PayPal had a problem. Nothing was sent."),
        });
        if (cancelled || !ref.current) return;
        button = ref.current;
        handler = () => {
          void session.start({ presentationMode: "auto" }, Promise.resolve({ orderId }));
        };
        button.hidden = false;
        button.addEventListener("click", handler);
      } catch {
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
      <paypal-button ref={ref} type="pay" hidden data-testid="paypal-button"></paypal-button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
