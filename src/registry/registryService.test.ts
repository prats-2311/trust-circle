import { describe, expect, it } from "vitest";
import { createMemoryRegistryRepo } from "./registryRepo";
import { createRegistryService, identifierForPayee } from "./registryService";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const phone = { type: "phone" as const, value: "+14155550199" };

describe("registry service", () => {
  it("records an unconfirmed entry under its canonical key", async () => {
    const registry = createRegistryService({ repo: createMemoryRegistryRepo() });
    const [entry] = await registry.record({ reporterId: A, identifiers: [phone], scamType: "impersonation_family", source: "message_report" });
    expect(entry).toMatchObject({ key: "4155550199", status: "unconfirmed", scamType: "impersonation_family" });
    expect(await registry.lists()).toEqual({ confirmed: [], unconfirmed: ["4155550199"] });
  });

  it("does not let one person confirm by reporting twice, but two people do", async () => {
    const registry = createRegistryService({ repo: createMemoryRegistryRepo() });
    await registry.record({ reporterId: A, identifiers: [phone], scamType: "other", source: "message_report" });
    await registry.record({ reporterId: A, identifiers: [{ type: "phone", value: "(415) 555-0199" }], scamType: "other", source: "message_report" });
    expect((await registry.lists()).confirmed).toEqual([]);
    const [entry] = await registry.record({ reporterId: B, identifiers: [phone], scamType: "other", source: "message_report" });
    expect(entry!.status).toBe("confirmed");
    expect(entry!.confirmedAt).toBeInstanceOf(Date);
    expect(await registry.lists()).toEqual({ confirmed: ["4155550199"], unconfirmed: [] });
  });

  it("confirms at once on a contact block", async () => {
    const registry = createRegistryService({ repo: createMemoryRegistryRepo() });
    const [entry] = await registry.record({ reporterId: A, identifiers: [identifierForPayee("Scam@Mail.example")], scamType: "other", source: "contact_block" });
    expect(entry).toMatchObject({ key: "scam@mail.example", status: "confirmed" });
  });

  it("keeps the first scam type for an entry", async () => {
    const registry = createRegistryService({ repo: createMemoryRegistryRepo() });
    await registry.record({ reporterId: A, identifiers: [phone], scamType: "invoice", source: "message_report" });
    const [entry] = await registry.record({ reporterId: B, identifiers: [phone], scamType: "romance", source: "message_report" });
    expect(entry!.scamType).toBe("invoice");
  });

  it("skips identifiers with no usable key", async () => {
    const registry = createRegistryService({ repo: createMemoryRegistryRepo() });
    expect(await registry.record({ reporterId: A, identifiers: [{ type: "phone", value: "---" }], scamType: "other", source: "message_report" })).toEqual([]);
    expect(await registry.lists()).toEqual({ confirmed: [], unconfirmed: [] });
  });

  it("maps payees to identifiers", () => {
    expect(identifierForPayee("a@b.example")).toEqual({ type: "email", value: "a@b.example" });
    expect(identifierForPayee("+14155550199")).toEqual({ type: "phone", value: "+14155550199" });
  });
});
