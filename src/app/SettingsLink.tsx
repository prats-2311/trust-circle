import Link from "next/link";
import { GearIcon } from "@/ui/icons";

export function SettingsLink() {
  return (
    <Link href="/settings" className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-[18px] font-medium text-ink-2 no-underline">
      <GearIcon aria-hidden="true" size={22} />
      Settings
    </Link>
  );
}
