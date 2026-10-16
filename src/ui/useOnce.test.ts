import { describe, expect, it } from "vitest";
import { createOnce } from "./useOnce";

describe("createOnce", () => {
  it("ignores a second run while the first is in flight, then allows another", async () => {
    const once = createOnce(() => {});
    let calls = 0;
    let release!: () => void;
    const first = once.run(() => new Promise<void>((r) => { calls += 1; release = r; }));
    await once.run(async () => { calls += 1; });
    expect(calls).toBe(1);
    release();
    await first;
    await once.run(async () => { calls += 1; });
    expect(calls).toBe(2);
  });
  it("frees itself after a failure", async () => {
    const once = createOnce(() => {});
    await once.run(async () => { throw new Error("x"); }).catch(() => {});
    let ran = false;
    await once.run(async () => { ran = true; });
    expect(ran).toBe(true);
  });
});
