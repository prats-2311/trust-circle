import { describe, expect, it } from "vitest";
import { createMemoryCircleRepo } from "./circleRepo";

const margaret = { id: "00000000-0000-4000-8000-000000000001", email: "m@example.com", displayName: "Margaret", safeWordHash: null };
const sarah = { id: "00000000-0000-4000-8000-000000000002", email: "s@example.com", displayName: "Sarah", safeWordHash: null };
const daniel = { id: "00000000-0000-4000-8000-000000000003", email: "d@example.com", displayName: "Daniel", safeWordHash: null };

describe("memory circle repo", () => {
  const seed = () =>
    createMemoryCircleRepo({
      users: [margaret, sarah, daniel],
      links: [
        { senderId: margaret.id, contactId: sarah.id, relationship: "daughter" },
        { senderId: margaret.id, contactId: daniel.id, relationship: "grandson" },
      ],
    });

  it("lists a sender's circle with names and relationships", async () => {
    expect(await seed().contactsOf(margaret.id)).toEqual([
      { contactId: sarah.id, displayName: "Sarah", relationship: "daughter" },
      { contactId: daniel.id, displayName: "Daniel", relationship: "grandson" },
    ]);
  });
  it("returns an empty circle for someone with no contacts", async () => {
    expect(await seed().contactsOf(sarah.id)).toEqual([]);
  });
  it("stores a safe-word hash", async () => {
    const repo = seed();
    await repo.setSafeWordHash(margaret.id, "scrypt$a$b");
    expect((await repo.getUser(margaret.id))!.safeWordHash).toBe("scrypt$a$b");
  });
  it("returns null for an unknown user", async () => {
    expect(await seed().getUser("nope")).toBeNull();
  });
});
