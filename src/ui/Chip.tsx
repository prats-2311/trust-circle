import type { ReactNode } from "react";
import { CheckCircleIcon, InfoIcon, PauseIcon, WarningIcon, XCircleIcon } from "./icons";

export type ChipTone = "held" | "caution" | "blocked" | "safe" | "neutral";

const TONES: Record<ChipTone, { cls: string; Icon: typeof PauseIcon }> = {
  held: { cls: "bg-held-tint text-held-ink", Icon: PauseIcon },
  caution: { cls: "bg-caution-tint text-caution-ink", Icon: WarningIcon },
  blocked: { cls: "bg-blocked-tint text-blocked-ink", Icon: XCircleIcon },
  safe: { cls: "bg-evergreen-tint text-evergreen-dark", Icon: CheckCircleIcon },
  neutral: { cls: "bg-neutral-tint text-ink-2", Icon: InfoIcon },
};

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const { cls, Icon } = TONES[tone];
  return (
    <span className={`inline-flex min-h-[34px] items-center gap-2 self-start rounded-full py-1 pl-2.5 pr-3.5 text-[16px] font-bold ${cls}`}>
      <Icon aria-hidden="true" size={20} weight="bold" />
      {children}
    </span>
  );
}
