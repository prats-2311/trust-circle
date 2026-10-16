import type { PatternDescriber } from "@/ai/patternDescriber";
import type { MessageRepo } from "@/messages/messageRepo";
import type { PatternService } from "@/patterns/patternService";
import { NotAllowedError } from "@/payments/paymentService";
import type { RegistryService } from "@/registry/registryService";
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
}) {
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
        await deps.registry.record({ reporterId: a.reporterId, identifiers: check.identifiers, scamType: check.scamType, source: "message_report" });
      } catch (e) {
        console.warn("registry record failed", { error: e instanceof Error ? e.name : "unknown" });
      }
      // Only an anonymised script is shared; when none can be written safely, the report goes ahead without one.
      const description = await deps.describe({ text: check.text, scamType: check.scamType }).catch(() => null);
      let patternId: string | null = null;
      if (description) {
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
