"use client";
import { useEffect } from "react";

/** Registers the service worker that shows push alerts. Errors are ignored: alerts still arrive in the app. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
