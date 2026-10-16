import { describe, expect, it, vi } from "vitest";
import { createMemoryMessageRepo } from "@/messages/messageRepo";
import { NotAllowedError } from "@/payments/paymentService";
import { createMemoryScamReportRepo } from "./scamReportRepo";
import { createReportService, ReportError } from "./reportService";

const SENDER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const DESCRIPTION = "Caller claims to be a grandchild in custody and asks for bail money to be sent urgently and kept secret.";

async function setup(over: { level?: "low" | "medium" | "high"; checked?: boolean; describe?: string | null } = {}) {
  const messages = createMemoryMessageRepo();
  const check = await messages.insert({
    senderId: SENDER, source: "text", text: "Grandma it's me, call +1 415 555 0199", checked: over.checked ?? true,
    level: over.level ?? "high", scamType: "impersonation_family", reasons: ["Asks for secrecy."],
    identifiers: [{ type: "phone", value: "+14155550199" }],
  });
  const registry = { record: vi.fn().mockResolvedValue([]) };
  const patterns = { add: vi.fn().mockResolvedValue({ id: "pat1", description: DESCRIPTION, scamType: "impersonation_family", reportCount: 1 }) };
  const describe = vi.fn().mockResolvedValue(over.describe === undefined ? DESCRIPTION : over.describe);
  const reports = createMemoryScamReportRepo();
  const service = createReportService({ messages, reports, registry, patterns, describe });
  return { check, registry, patterns, describe, reports, service };
}

describe("report service", () => {
  it("records identifiers, stores the anonymised pattern and returns a mailto draft", async () => {
    const s = await setup();
    const r = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    expect(s.registry.record).toHaveBeenCalledWith({
      reporterId: SENDER, identifiers: [{ type: "phone", value: "+14155550199" }], scamType: "impersonation_family", source: "message_report",
    });
    expect(s.describe).toHaveBeenCalledWith({ text: s.check.text, scamType: "impersonation_family" });
    expect(s.patterns.add).toHaveBeenCalledWith({ description: DESCRIPTION, scamType: "impersonation_family" });
    expect(r.alreadyReported).toBe(false);
    expect(r.mailtoUrl.startsWith("mailto:phishing@paypal.com?")).toBe(true);
    expect((await s.reports.findByCheck(s.check.id))!.patternId).toBe("pat1");
  });

  it("returns the first report again without recording twice", async () => {
    const s = await setup();
    const first = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    const again = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    expect(again).toMatchObject({ reportId: first.reportId, alreadyReported: true });
    expect(s.registry.record).toHaveBeenCalledTimes(1);
  });

  it("still reports when no anonymous description could be written", async () => {
    const s = await setup({ describe: null });
    const r = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    expect(s.patterns.add).not.toHaveBeenCalled();
    expect(r.alreadyReported).toBe(false);
    expect((await s.reports.findByCheck(s.check.id))!.patternId).toBeNull();
  });

  it("counts two concurrent reports of the same check once", async () => {
    const s = await setup();
    const [a, b] = await Promise.all([
      s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER }),
      s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER }),
    ]);
    expect(s.registry.record).toHaveBeenCalledTimes(1);
    expect(s.patterns.add).toHaveBeenCalledTimes(1);
    expect([a.alreadyReported, b.alreadyReported].sort()).toEqual([false, true]);
  });

  it("still reports when the registry is unavailable", async () => {
    const s = await setup();
    s.registry.record.mockRejectedValue(new Error("down"));
    const r = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    expect(r.alreadyReported).toBe(false);
    expect(r.mailtoUrl.startsWith("mailto:")).toBe(true);
  });

  it("refuses someone else's check, and checks that are low or unchecked", async () => {
    const s = await setup();
    await expect(s.service.reportCheck({ checkId: s.check.id, reporterId: OTHER })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(s.service.reportCheck({ checkId: "nope", reporterId: SENDER })).rejects.toBeInstanceOf(NotAllowedError);
    for (const over of [{ level: "low" as const }, { checked: false }]) {
      const t = await setup(over);
      await expect(t.service.reportCheck({ checkId: t.check.id, reporterId: SENDER })).rejects.toBeInstanceOf(ReportError);
      expect(t.registry.record).not.toHaveBeenCalled();
    }
  });
});
