import { formatUsd } from "@/alerts/alertCopy";
import { PauseIcon } from "./icons";

const R = 96;
const LENGTH = Math.round(2 * Math.PI * R);

export function HoldRing({ fractionUsed, amountCents, label }: { fractionUsed: number; amountCents: number; label: string }) {
  const offset = Math.round(LENGTH * (1 - Math.min(1, Math.max(0, fractionUsed))));
  return (
    <div className="relative mx-auto h-[228px] w-[228px]">
      <svg role="img" aria-label={label} width="228" height="228" viewBox="0 0 228 228" className="-rotate-90">
        <circle cx="114" cy="114" r={R} fill="none" stroke="var(--color-held-track)" strokeWidth="12" />
        <circle
          className="tc-ring-fill"
          cx="114"
          cy="114"
          r={R}
          fill="none"
          stroke="var(--color-held)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={offset}
          style={{ ["--tc-ring-length" as string]: LENGTH }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <PauseIcon aria-hidden="true" size={26} weight="fill" className="text-held" />
        <span className="text-[44px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">{formatUsd(amountCents)}</span>
        <span className="text-[17px] font-bold text-held">On hold</span>
      </div>
    </div>
  );
}
