"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";

const PUSH_CLEANUP_MS = 3000;

/** Best effort: take this device off the account's push list before the session ends. Never throws. */
async function dropPushSubscription(): Promise<void> {
  try {
    const work = (async () => {
      const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
      if (!sub) return;
      await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    })();
    work.catch(() => {});
    await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, PUSH_CLEANUP_MS))]);
  } catch {
    // Sign-out always continues.
  }
}

export function SignOutButton() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  return (
    <>
      {failed && <Notice tone="error">We couldn&apos;t sign you out. Please try again.</Notice>}
      <Button
        variant="quiet"
        className="w-auto!"
        onClick={async () => {
          setFailed(false);
          await dropPushSubscription();
          const ok = await fetch("/api/demo/logout", { method: "POST" })
            .then((r) => r.ok)
            .catch(() => false);
          if (!ok) return setFailed(true);
          router.push("/");
        }}
      >
        Sign out
      </Button>
    </>
  );
}
