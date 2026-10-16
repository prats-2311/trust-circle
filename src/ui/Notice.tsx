import type { ReactNode } from "react";
import { InfoIcon, PauseIcon, WarningIcon } from "./icons";

const TONES = {
  info: { cls: "bg-surface text-ink-2", Icon: InfoIcon, role: "status" as const },
  pending: { cls: "bg-held-tint text-held-ink", Icon: PauseIcon, role: "status" as const },
  error: { cls: "bg-blocked-tint text-blocked-ink", Icon: WarningIcon, role: "alert" as const },
};

/**
 * Screen readers announce changes inside a live region, not the region appearing. So the region
 * (a `role` div) is always mounted, and the icon and text fill it. With no children it renders
 * an empty region and nothing visible.
 */
export function Notice({ tone, children }: { tone: keyof typeof TONES; children?: ReactNode }) {
  const { cls, Icon, role } = TONES[tone];
  const empty = children === null || children === undefined || children === false || children === "";
  return (
    <div role={role} className={empty ? "sr-only" : `flex items-start gap-3 rounded-control px-4 py-3.5 text-[17px] leading-snug ${cls}`}>
      {!empty && (
        <>
          <Icon aria-hidden="true" size={22} weight="bold" className="mt-0.5 flex-none" />
          <span>{children}</span>
        </>
      )}
    </div>
  );
}
