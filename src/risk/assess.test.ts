import { describe, expect, it, vi } from "vitest";
import { assessPayment } from "./assess";
import type { SenderContext } from "./signals";

const ctx: SenderContext = {
  previousPayees: [],
  recentAmountsCents: [],
  paymentsInLastHour: 0,
  flaggedPayees: [],
  registry: { confirmed: [], unconfirmed: [] },
};

describe("assessPayment", () => {
  it("passes computed signals to the judge and combines the result", async () => {
    const judge = vi.fn().mockResolvedValue({
      ok: true,
      judgement: { level: "high", scamType: "impersonation_family", reasons: ["x"], impersonatedRequester: null },
    });
    const d = await assessPayment({ payee: "new@example.com", amountCents: 80000 }, ctx, judge);
    expect(judge).toHaveBeenCalledWith(
      { payee: "new@example.com", amountCents: 80000 },
      expect.arrayContaining([expect.objectContaining({ code: "FIRST_TIME_PAYEE" })]),
    );
    expect(d.level).toBe("high");
  });

  it("treats a judge that throws as an AI failure", async () => {
    const judge = vi.fn().mockRejectedValue(new Error("boom"));
    const d = await assessPayment({ payee: "new@example.com", amountCents: 1000 }, ctx, judge);
    expect(d.level).toBe("high");
    expect(d.aiUsed).toBe(false);
  });
});
