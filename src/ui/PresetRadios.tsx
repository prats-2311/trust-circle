import type { Preset } from "@/domain/types";
import { PRESETS } from "@/settings/presets";
import { BriefcaseIcon, UserIcon, UsersThreeIcon } from "./icons";

const ICONS = { family: UsersThreeIcon, business: BriefcaseIcon, solo: UserIcon } as const;
const ORDER: Preset[] = ["family", "business", "solo"];

/** Three large radio cards. Each is a real radio with a visible label, so it works with a keyboard and a screen reader. */
export function PresetRadios({ value, onChange, disabled, labelledBy }: { labelledBy: string; value: Preset | null; onChange: (p: Preset) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
      {ORDER.map((p) => {
        const Icon = ICONS[p];
        return (
          <label
            key={p}
            className="flex min-h-[72px] cursor-pointer items-start gap-4 rounded-panel border-2 border-line-strong bg-surface p-4 has-[:checked]:border-evergreen has-[:checked]:bg-evergreen-tint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-held"
          >
            <input
              type="radio"
              name="preset"
              value={p}
              data-testid={`preset-${p}`}
              checked={value === p}
              disabled={disabled}
              onChange={() => onChange(p)}
              className="mt-1 h-6 w-6 flex-none accent-evergreen"
            />
            <Icon aria-hidden="true" size={28} className="mt-0.5 flex-none text-evergreen" />
            <span className="flex flex-col gap-1">
              <span className="text-[20px] font-bold">{PRESETS[p].label}</span>
              <span className="text-[17px] leading-snug text-ink-2">{PRESETS[p].description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
