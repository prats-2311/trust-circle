import { describe, expect, it, vi } from "vitest";
import { createMemoryMessageRepo } from "@/messages/messageRepo";
import { NotAllowedError } from "@/payments/paymentService";
import { createMemoryScamReportRepo } from "./scamReportRepo";
import { createReportService, ReportError } from "./reportService";

const SENDER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const DESCRIPTION = "Caller claims to be a grandchild in custody and asks for bail money to be sent urgently and kept secret.";

async function setup(
  over: {
    level?: "low" | "medium" | "high";
    checked?: boolean;
    describe?: string | null;
    identifiers?: { type: "phone" | "email" | "url"; value: string }[];
    excludeKeys?: (id: string) => Promise<string[]>;
  } = {},
) {
  const messages = createMemoryMessageRepo();
  const check = await messages.insert({
    senderId: SENDER, source: "text", text: "Grandma it's me, call +1 415 555 0199", checked: over.checked ?? true,
    level: over.level ?? "high", scamType: "impersonation_family", reasons: ["Asks for secrecy."],
    identifiers: over.identifiers ?? [{ type: "phone", value: "+14155550199" }],
  });
  const registry = { record: vi.fn().mockResolvedValue([]) };
  const patterns = { add: vi.fn().mockResolvedValue({ id: "pat1", description: DESCRIPTION, scamType: "impersonation_family", reportCount: 1 }) };
  const describe = vi.fn().mockResolvedValue(over.describe === undefined ? DESCRIPTION : over.describe);
  const reports = createMemoryScamReportRepo();
  const service = createReportService({ messages, reports, registry, patterns, describe, excludeKeys: over.excludeKeys, appUrl: "https://trustcircle.example" });
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

  describe("keeping non-scammers out of the registry", () => {
    const scam = { type: "phone" as const, value: "+14155550199" };
    const recorded = (s: Awaited<ReturnType<typeof setup>>) => s.registry.record.mock.calls[0]![0].identifiers;

    it("drops the reporter's own email, circle emails and previous payees written another way", async () => {
      const s = await setup({
        identifiers: [
          scam,
          { type: "email", value: "Margaret@Example.com" },
          { type: "email", value: "daughter@example.com" },
          { type: "phone", value: "+1 (415) 555-0123" },
        ],
        excludeKeys: async () => ["margaret@example.com", "daughter@example.com", "415-555-0123"],
      });
      await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
      expect(recorded(s)).toEqual([scam]);
    });

    it("drops a bare well-known domain but keeps one with a path", async () => {
      const s = await setup({
        identifiers: [
          { type: "url", value: "https://www.paypal.com" },
          { type: "url", value: "trustcircle.example/" },
          { type: "url", value: "paypal.me/x" },
          scam,
        ],
      });
      await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
      expect(recorded(s)).toEqual([{ type: "url", value: "paypal.me/x" }, scam]);
    });

    it("still records the scammer when the exclusion list cannot be built", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const s = await setup({ excludeKeys: async () => { throw new TypeError("db"); } });
      const r = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
      expect(r.alreadyReported).toBe(false);
      expect(recorded(s)).toEqual([scam]);
      expect(warn).toHaveBeenCalledWith("report exclusions unavailable", { error: "TypeError" });
      warn.mockRestore();
    });
  });

  it("does not store a description that names anyone", async () => {
    const s = await setup({ describe: "Caller claims to be Josh, a grandchild in custody, and asks for bail money." });
    const r = await s.service.reportCheck({ checkId: s.check.id, reporterId: SENDER });
    expect(s.patterns.add).not.toHaveBeenCalled();
    expect(r.alreadyReported).toBe(false);
  });
});
