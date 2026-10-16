import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetDemo } = vi.hoisted(() => ({ resetDemo: vi.fn() }));
let flag: string | undefined = "1";
vi.mock("@/server/demoReset", () => ({ resetDemo }));
vi.mock("@/server/container", () => ({
  getContainer: () => ({ env: { CRON_SECRET: "s".repeat(24), DEMO_DAILY_RESET: flag }, db: { tag: "db" } }),
}));
import { POST } from "./route";

const post = (token?: string) =>
  POST(new Request("http://x/api/cron/demo-reset", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} }));

beforeEach(() => {
  vi.clearAllMocks();
  flag = "1";
  resetDemo.mockResolvedValue(undefined);
});

describe("POST /api/cron/demo-reset", () => {
  it("answers 404 and resets nothing when DEMO_DAILY_RESET is unset", async () => {
    flag = undefined;
    const res = await post("s".repeat(24));
    expect(res.status).toBe(404);
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("answers 401 for a bad token", async () => {
    const res = await post("wrong");
    expect(res.status).toBe(401);
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("answers 401 with no token", async () => {
    expect((await post()).status).toBe(401);
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("resets once and answers ok for a good token", async () => {
    const res = await post("s".repeat(24));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(resetDemo).toHaveBeenCalledTimes(1);
    expect(resetDemo).toHaveBeenCalledWith({ tag: "db" });
  });
});
