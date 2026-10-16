import { describe, expect, it } from "vitest";
import { localHostRefusal } from "./deployGuard";

describe("localHostRefusal", () => {
  it.each(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal", "LOCALHOST"])("refuses %s", (host) => {
    expect(localHostRefusal(host)).toMatch(/this machine/);
  });
  it("allows a real remote host", () => {
    expect(localHostRefusal("ep-cool-123.us-west-2.aws.neon.tech")).toBeNull();
  });
});
