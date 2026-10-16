import { canonicalKey } from "@/domain/matchKeys";
import type { Identifier, ScamType } from "@/domain/types";
import { statusFor, type RegistrySource } from "./confirmation";
import type { RegistryEntry, RegistryRepo } from "./registryRepo";

export function identifierForPayee(payee: string): Identifier {
  return payee.includes("@") ? { type: "email", value: payee } : { type: "phone", value: payee };
}

export function createRegistryService(deps: { repo: RegistryRepo; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    /** Adds one report per identifier and re-applies the confirmation rules. */
    async record(a: { reporterId: string; identifiers: Identifier[]; scamType: ScamType; source: RegistrySource }): Promise<RegistryEntry[]> {
      const out: RegistryEntry[] = [];
      for (const id of a.identifiers) {
        const key = canonicalKey(id.value);
        if (key === "") continue;
        const entry = await deps.repo.upsertEntry({ identifierType: id.type, key, scamType: a.scamType });
        await deps.repo.addReport({ entryId: entry.id, reporterId: a.reporterId, source: a.source, at: now() });
        const status = statusFor(await deps.repo.reportsFor(entry.id));
        if (status !== entry.status) await deps.repo.setStatus(entry.id, status, now());
        out.push({ ...entry, status, confirmedAt: status === "confirmed" ? (entry.confirmedAt ?? now()) : null });
      }
      return out;
    },
    lists: () => deps.repo.listKeys(),
  };
}

export type RegistryService = ReturnType<typeof createRegistryService>;
