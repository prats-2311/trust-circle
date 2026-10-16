import { describe, expect, it, vi } from "vitest";

const reportCheck = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ reports: { reportCheck }, env: { SESSION_SECRET: "s" } }) }));
vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), currentUserId: () => "user-1" }));
import { NotAllowedError } from "@/payments/paymentService";
import { ReportError } from "@/reports/reportService";
import { POST } from "./route";

const call = () => POST(new Request("http://x/api/messages/1/report", { method: "POST" }), { params: Promise.resolve({ id: "1" }) });

describe("POST /api/messages/:id/report", () => {
  it("answers an unexpected failure with a report-specific message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reportCheck.mockRejectedValue(new Error("db down"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "We couldn't prepare your report right now. Please try again." });
  });
  it("keeps the mappings for known errors", async () => {
    reportCheck.mockRejectedValue(new NotAllowedError("nope"));
    expect((await call()).status).toBe(403);
    reportCheck.mockRejectedValue(new ReportError("no"));
    expect((await call()).status).toBe(400);
  });
});
