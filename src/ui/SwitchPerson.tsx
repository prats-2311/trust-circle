import Link from "next/link";

/** Takes a demo viewer back to the demo buttons, so any screen can be left for another person's view. */
export function SwitchPerson({ className = "" }: { className?: string }) {
  return (
    <Link href="/#try" className={`inline-flex min-h-[44px] items-center px-2 text-[16px] font-medium text-ink-2 underline underline-offset-4 ${className}`}>
      Switch person
    </Link>
  );
}
