import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { isUuid } from "@/domain/ids";
import type { CoolingOffHours } from "./presets";
import type { SettingsRepo, UserSettings } from "./settingsRepo";

const columns = { preset: users.preset, coolingOffHours: users.coolingOffHours, onboardedAt: users.onboardedAt };

export function createDrizzleSettingsRepo(db: Db): SettingsRepo {
  const view = (r: { preset: UserSettings["preset"]; coolingOffHours: number; onboardedAt: Date | null }): UserSettings => ({
    preset: r.preset,
    coolingOffHours: r.coolingOffHours as CoolingOffHours,
    onboardedAt: r.onboardedAt,
  });
  return {
    async get(userId) {
      if (!isUuid(userId)) return null;
      const [row] = await db.select(columns).from(users).where(eq(users.id, userId));
      return row ? view(row) : null;
    },
    async update(userId, patch) {
      if (!isUuid(userId)) return null;
      if (Object.keys(patch).length === 0) return this.get(userId);
      const [row] = await db.update(users).set(patch).where(eq(users.id, userId)).returning(columns);
      return row ? view(row) : null;
    },
  };
}
