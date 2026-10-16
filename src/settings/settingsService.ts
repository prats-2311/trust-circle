import type { Preset } from "@/domain/types";
import { PRESETS, isCoolingOffHours } from "./presets";
import type { SettingsRepo, UserSettings } from "./settingsRepo";

export class SettingsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsInputError";
  }
}

const DEFAULTS: UserSettings = { preset: "family", coolingOffHours: PRESETS.family.defaultCoolingOffHours, onboardedAt: null };

export function createSettingsService(deps: { repo: SettingsRepo; now?: () => Date }) {
  const { repo } = deps;
  const now = deps.now ?? (() => new Date());
  const read = async (userId: string): Promise<UserSettings> => (await repo.get(userId)) ?? { ...DEFAULTS };
  // An unknown user (or one removed mid-request) is never an error for a payment; they get the defaults.
  const write = async (userId: string, patch: Partial<UserSettings>): Promise<UserSettings> =>
    (await repo.update(userId, patch)) ?? { ...DEFAULTS, ...patch };

  return {
    async get(userId: string) {
      const s = await read(userId);
      return { ...s, circleLimitCents: PRESETS[s.preset].circleLimitCents };
    },
    async choosePreset(userId: string, preset: Preset) {
      if (typeof preset !== "string" || !Object.hasOwn(PRESETS, preset)) throw new SettingsInputError("Please choose Family, Business or Just me.");
      const current = await read(userId);
      // Choosing the same preset again must not undo a cooling-off the user changed.
      if (current.preset === preset) return current;
      return write(userId, { preset, coolingOffHours: PRESETS[preset].defaultCoolingOffHours });
    },
    async setCoolingOff(userId: string, hours: number) {
      if (!isCoolingOffHours(hours)) throw new SettingsInputError("Please choose 12, 24 or 48 hours.");
      return write(userId, { coolingOffHours: hours });
    },
    async finishOnboarding(userId: string) {
      const current = await read(userId);
      if (current.onboardedAt) return current;
      return write(userId, { onboardedAt: now() });
    },
    async coolingOffMs(userId: string) {
      return (await read(userId)).coolingOffHours * 3_600_000;
    },
    async circleLimitCents(userId: string) {
      return PRESETS[(await read(userId)).preset].circleLimitCents;
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
