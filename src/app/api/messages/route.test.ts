import { describe, expect, it, vi } from "vitest";

const history = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ messages: { history }, env: { SESSION_SECRET: "s" } }) }));
vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), currentUserId: () => "user-1" }));
import { GET } from "./route";

const rec = (id: string) => ({ id, source: "text", text: "t", checked: true, level: "high", scamType: "other", reasons: [], identifiers: [], createdAt: "2026-10-16T00:00:00Z" });
const get = (qs = "") => GET(new Request(`http://x/api/messages${qs}`));

describe("GET /api/messages", () => {
  it("returns the list without an id", async () => {
    history.mockResolvedValue([rec("a"), rec("b")]);
    const body = await (await get()).json();
    expect(body.map((c: { id: string }) => c.id)).toEqual(["a", "b"]);
  });
  it("returns one check for its owner", async () => {
    history.mockResolvedValue([rec("a"), rec("b")]);
    const res = await get("?id=b");
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("b");
  });
  it("answers 404 for an id that is not in the user's history", async () => {
    history.mockResolvedValue([rec("a")]);
    const res = await get("?id=zzz");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "We couldn't find that check." });
  });
});
