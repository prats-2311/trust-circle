import type { Preset } from "@/domain/types";
import type { CoolingOffHours } from "./presets";

export interface UserSettings {
  preset: Preset;
  coolingOffHours: CoolingOffHours;
  onboardedAt: Date | null;
}

export interface SettingsRepo {
  get(userId: string): Promise<UserSettings | null>;
  update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings | null>;
}

export function createMemorySettingsRepo(seed: Record<string, UserSettings> = {}): SettingsRepo {
  const rows = new Map(Object.entries(seed).map(([id, s]) => [id, { ...s }]));
  return {
    async get(userId) {
      const s = rows.get(userId);
      return s ? { ...s } : null;
    },
    async update(userId, patch) {
      const s = rows.get(userId);
      if (!s) return null;
      const next = { ...s, ...patch };
      rows.set(userId, next);
      return { ...next };
    },
  };
}
