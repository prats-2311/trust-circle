"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Notice } from "@/ui/Notice";

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
