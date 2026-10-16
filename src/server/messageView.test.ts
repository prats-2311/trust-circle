import { describe, expect, it } from "vitest";
import { toMessageCheckView } from "./messageView";

describe("toMessageCheckView", () => {
  it("omits the sender id and defaults the requester", () => {
    const view = toMessageCheckView({
      id: "c1", senderId: "secret-sender", source: "text", text: "hi", checked: true, level: "low", scamType: "none",
      reasons: [], identifiers: [], createdAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(view).not.toHaveProperty("senderId");
    expect(view.impersonatedRequester).toBeNull();
  });
  it("never reports an unchecked message as low", () => {
    const view = toMessageCheckView({
      id: "c2", senderId: "s", source: "text", text: "hi", checked: false, level: "low", scamType: "none",
      reasons: [], identifiers: [], createdAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(view.level).toBeNull();
    expect(view.scamType).toBe("unknown");
  });
});
