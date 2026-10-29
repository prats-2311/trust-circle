import { describe, expect, it, vi } from "vitest";

const getContainer = vi.fn();
vi.mock("@/server/container", () => ({ getContainer }));
import { GET } from "./route";

describe("GET /api/ping", () => {
  it("answers 200 without touching the database, so keep-warm pings let the database sleep", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getContainer).not.toHaveBeenCalled();
  });
});
