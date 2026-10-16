"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="quiet"
      className="w-auto!"
      onClick={async () => {
        await fetch("/api/demo/logout", { method: "POST" }).catch(() => undefined);
        router.push("/");
      }}
    >
      Sign out
    </Button>
  );
}
