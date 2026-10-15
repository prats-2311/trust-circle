export const SDK_SRC = "https://www.sandbox.paypal.com/web-sdk/v6/core";

let pending: Promise<void> | null = null;

/** Loads the PayPal SDK script at most once, even across remounts and StrictMode double effects. */
export function loadSdk(): Promise<void> {
  if (pending) return pending;
  if (window.paypal) return Promise.resolve();
  pending = new Promise<void>((resolve, reject) => {
    const fail = () => {
      pending = null;
      reject(new Error("PayPal failed to load"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", fail);
    if (!existing) {
      s.src = SDK_SRC;
      document.body.appendChild(s);
    } else if (window.paypal) {
      resolve();
    }
  });
  return pending;
}

export function resetSdkLoaderForTests(): void {
  pending = null;
}
