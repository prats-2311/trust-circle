import type { Preset } from "@/domain/types";

export const COOLING_OFF_CHOICES = [12, 24, 48] as const;
export type CoolingOffHours = (typeof COOLING_OFF_CHOICES)[number];

export interface PresetInfo {
  label: string;
  description: string;
  circleWord: string;
  circleLimitCents: number | null;
  defaultCoolingOffHours: CoolingOffHours;
}

export const PRESETS: Record<Preset, PresetInfo> = {
  family: {
    label: "Family",
    description: "For an older relative. Children or grandchildren check risky payments.",
    circleWord: "your family",
    circleLimitCents: 50_000,
    defaultCoolingOffHours: 24,
  },
  business: {
    label: "Business",
    description: "For a freelancer or small business. Your accountant or partner checks risky payments.",
    circleWord: "your business contacts",
    circleLimitCents: 250_000,
    defaultCoolingOffHours: 24,
  },
  solo: {
    label: "Just me",
    description: "Risky payments wait before they go, so you have time to check.",
    circleWord: "you",
    circleLimitCents: null,
    defaultCoolingOffHours: 24,
  },
};

export function isCoolingOffHours(x: unknown): x is CoolingOffHours {
  return typeof x === "number" && (COOLING_OFF_CHOICES as readonly number[]).includes(x);
}
