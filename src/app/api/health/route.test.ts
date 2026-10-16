import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/server/container", () => ({ getContainer: () => ({ db: { execute } }) }));
import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/health", () => {
  it("answers 200 with db up when the query works", async () => {
    execute.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up" });
  });

  it("answers 200 with db down when the query throws", async () => {
    execute.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "down" });
  });

  it("answers 200 with db down when the query takes longer than 2 seconds", async () => {
    vi.useFakeTimers();
    try {
      execute.mockReturnValue(new Promise(() => {}));
      const pending = GET();
      await vi.advanceTimersByTimeAsync(2_001);
      const res = await pending;
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, db: "down" });
    } finally {
      vi.useRealTimers();
    }
  });
});
