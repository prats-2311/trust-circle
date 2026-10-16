import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetDemo, expireStale, systemVoidHeld, listByStates } = vi.hoisted(() => ({
  resetDemo: vi.fn(), expireStale: vi.fn(), systemVoidHeld: vi.fn(), listByStates: vi.fn(),
}));
let flag: string | undefined = "1";
vi.mock("@/server/demoReset", () => ({ resetDemo }));
vi.mock("@/server/container", () => ({
  getContainer: () => ({ env: { CRON_SECRET: "s".repeat(24), DEMO_DAILY_RESET: flag }, db: { tag: "db" },
    service: { expireStale, systemVoidHeld }, repo: { listByStates } }),
}));
import { POST } from "./route";

const post = (token?: string) =>
  POST(new Request("http://x/api/cron/demo-reset", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} }));

beforeEach(() => {
  vi.clearAllMocks();
  flag = "1";
  resetDemo.mockResolvedValue(undefined);
  expireStale.mockResolvedValue({});
  systemVoidHeld.mockResolvedValue({});
  listByStates.mockResolvedValue([]);
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

  it("sweeps stale payments, then voids each held one before resetting", async () => {
    const order: string[] = [];
    expireStale.mockImplementation(async () => void order.push("expire"));
    systemVoidHeld.mockImplementation(async (id: string) => void order.push(`void:${id}`));
    resetDemo.mockImplementation(async () => void order.push("reset"));
    listByStates.mockImplementation(async (states: string[]) => {
      if (states.length === 1 && states[0] === "held") return [{ id: "h1" }, { id: "h2" }];
      return [];
    });
    const res = await post("s".repeat(24));
    expect(await res.json()).toEqual({ ok: true });
    expect(order).toEqual(["expire", "void:h1", "void:h2", "reset"]);
  });

  it.each(["approved", "authorised", "released", "captured", "payout_failed", "blocked", "expired"])(
    "skips and changes nothing when a payment is still %s",
    async (state) => {
      listByStates.mockImplementation(async (states: string[]) => (states.includes(state as never) && states.length > 1 ? [{ id: "x", state }] : []));
      const res = await post("s".repeat(24));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, skipped: "in-flight" });
      expect(resetDemo).not.toHaveBeenCalled();
    },
  );

  it("skips when voiding a held payment is still pending", async () => {
    systemVoidHeld.mockRejectedValue(new Error("pending"));
    listByStates.mockImplementation(async (states: string[]) => (states.length === 1 ? [{ id: "h1" }] : [{ id: "h1", state: "blocked" }]));
    const res = await post("s".repeat(24));
    expect(await res.json()).toEqual({ ok: true, skipped: "in-flight" });
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("skips when a void fails before it starts and the payment is still held", async () => {
    systemVoidHeld.mockRejectedValue(new Error("network"));
    listByStates.mockImplementation(async (states: string[]) => (states.includes("held") ? [{ id: "h1", state: "held" }] : []));
    const res = await post("s".repeat(24));
    expect(await res.json()).toEqual({ ok: true, skipped: "in-flight" });
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("does not sweep or reset on a bad token", async () => {
    await post("wrong");
    expect(expireStale).not.toHaveBeenCalled();
  });
});
