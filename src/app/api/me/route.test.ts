import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryCircleRepo } from "@/circle/circleRepo";
import { createMemorySettingsRepo } from "@/settings/settingsRepo";
import { createSettingsService } from "@/settings/settingsService";
import { signSession } from "@/server/session";

const SECRET = "test-secret";
const MARGARET = "11111111-1111-4111-8111-111111111111";
const DANIEL = "22222222-2222-4222-8222-222222222222";

let container: unknown;
vi.mock("@/server/container", () => ({ getContainer: () => container }));
import { GET } from "./route";

beforeEach(() => {
  const base = { preset: "family" as const, coolingOffHours: 24 as const, onboardedAt: null };
  container = {
    circle: createMemoryCircleRepo({
      users: [
        { id: MARGARET, email: "margaret.demo@trustcircle.example", displayName: "Margaret", safeWordHash: null },
        { id: DANIEL, email: "daniel.demo@trustcircle.example", displayName: "Daniel", safeWordHash: null },
      ],
      links: [{ senderId: MARGARET, contactId: DANIEL, relationship: "grandson" }],
    }),
    settings: createSettingsService({
      repo: createMemorySettingsRepo({
        [MARGARET]: { ...base, phone: null },
        [DANIEL]: { ...base, phone: "+1 (415) 555-0131" },
      }),
    }),
    env: { SESSION_SECRET: SECRET },
  };
});

const call = (userId: string) =>
  GET(new Request("http://x/api/me", { headers: { cookie: `tc_session=${encodeURIComponent(signSession(userId, SECRET))}` } }));

describe("GET /api/me", () => {
  it("includes the caller's own phone", async () => {
    const body = await (await call(DANIEL)).json();
    expect(body.phone).toBe("+1 (415) 555-0131");
  });
  it("returns null when the caller has no phone", async () => {
    expect((await (await call(MARGARET)).json()).phone).toBeNull();
  });
  it("never carries a circle member's number to the caller", async () => {
    const res = await call(MARGARET);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("555-0131");
    expect(text).toContain("Daniel");
  });
});
