import { isAnonymous, type PatternDescriber } from "@/ai/patternDescriber";
import type { Identifier } from "@/domain/types";
import { keySet, matchKeys } from "@/domain/matchKeys";
import type { MessageRepo } from "@/messages/messageRepo";
import type { PatternService } from "@/patterns/patternService";
import { NotAllowedError } from "@/payments/paymentService";
import type { RegistryService } from "@/registry/registryService";
import { TRUSTED_DOMAINS } from "./trustedDomains";
import { draftReport, mailtoFor } from "./reportDraft";
import type { ScamReportRecord, ScamReportRepo } from "./scamReportRepo";

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

export interface ReportResult {
  reportId: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  alreadyReported: boolean;
}

function hostOf(appUrl: string | undefined): string[] {
  try {
    return appUrl ? [new URL(appUrl).hostname.toLowerCase().replace(/^www\./, "")] : [];
  } catch {
    return [];
  }
}

const toResult = (r: ScamReportRecord, alreadyReported: boolean): ReportResult => ({
  reportId: r.id,
  subject: r.subject,
  body: r.body,
  mailtoUrl: mailtoFor(r),
  alreadyReported,
});

export function createReportService(deps: {
  messages: Pick<MessageRepo, "get">;
  reports: ScamReportRepo;
  registry: Pick<RegistryService, "record">;
  patterns: Pick<PatternService, "add">;
  describe: PatternDescriber;
  /** Contact details that belong to the reporter or people they know, never to a scammer. */
  excludeKeys?: (reporterId: string) => Promise<string[]>;
  appUrl?: string;
}) {
  const trusted = [...TRUSTED_DOMAINS, ...hostOf(deps.appUrl)];
  const isBareTrustedDomain = (i: Identifier) =>
    i.type === "url" && matchKeys(i.value).some((k) => !k.includes("/") && trusted.some((d) => k === d || k.endsWith(`.${d}`)));

  async function scammerIdentifiers(reporterId: string, identifiers: Identifier[]): Promise<Identifier[]> {
    let excluded = new Set<string>();
    try {
      excluded = keySet((await deps.excludeKeys?.(reporterId)) ?? []);
    } catch (e) {
      console.warn("report exclusions unavailable", { error: e instanceof Error ? e.name : "unknown" });
    }
    return identifiers.filter((i) => !isBareTrustedDomain(i) && !matchKeys(i.value).some((k) => excluded.has(k)));
  }

  return {
    async reportCheck(a: { checkId: string; reporterId: string }): Promise<ReportResult> {
      const check = await deps.messages.get(a.checkId);
      if (!check || check.senderId !== a.reporterId) throw new NotAllowedError("Message check not found");
      const existing = await deps.reports.findByCheck(check.id);
      if (existing) return toResult(existing, true);
      if (!check.checked || check.level === "low") throw new ReportError("Only a message that looks like a scam can be reported.");

      const { record, created } = await deps.reports.insert({ reporterId: a.reporterId, messageCheckId: check.id, patternId: null, ...draftReport(check) });
      // Claimed first: a concurrent second call sees created: false and changes nothing.
      if (!created) return toResult(record, true);

      try {
        const identifiers = await scammerIdentifiers(a.reporterId, check.identifiers);
        if (identifiers.length > 0) {
          await deps.registry.record({ reporterId: a.reporterId, identifiers, scamType: check.scamType, source: "message_report" });
        }
      } catch (e) {
        console.warn("registry record failed", { error: e instanceof Error ? e.name : "unknown" });
      }
      // Only an anonymised script is shared; when none can be written safely, the report goes ahead without one.
      const description = await deps.describe({ text: check.text, scamType: check.scamType }).catch(() => null);
      let patternId: string | null = null;
      if (description && isAnonymous(description)) {
        try {
          patternId = (await deps.patterns.add({ description, scamType: check.scamType })).id;
          await deps.reports.setPattern(record.id, patternId);
        } catch (e) {
          console.warn("pattern store failed", { error: e instanceof Error ? e.name : "unknown" });
        }
      }
      return toResult({ ...record, patternId }, false);
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
