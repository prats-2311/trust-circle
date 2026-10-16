import { describe, expect, it, vi } from "vitest";
import type { PaymentRecord } from "@/payments/paymentRepo";
import { createRegistryHooks } from "./hooks";

const payment = { id: "p1", payee: "dhill.urgent@outlook.example", scamType: "impersonation_family" } as PaymentRecord;

describe("registry hooks", () => {
  it("records the payee as a contact block", async () => {
    const registry = { record: vi.fn().mockResolvedValue([]) };
    await createRegistryHooks(registry).onContactBlock(payment, "sarah");
    expect(registry.record).toHaveBeenCalledWith({
      reporterId: "sarah", identifiers: [{ type: "email", value: "dhill.urgent@outlook.example" }], scamType: "impersonation_family", source: "contact_block",
    });
  });
  it("records the payee when the real person says it wasn't them", async () => {
    const registry = { record: vi.fn().mockResolvedValue([]) };
    await createRegistryHooks(registry).onImpersonationConfirmed({ ...payment, payee: "+14155550199" } as PaymentRecord, "daniel");
    expect(registry.record).toHaveBeenCalledWith({
      reporterId: "daniel", identifiers: [{ type: "phone", value: "+14155550199" }], scamType: "impersonation_family", source: "real_person_denied",
    });
  });
});
