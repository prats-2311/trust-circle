import { beforeEach, describe, expect, it } from "vitest";
import { loadSdk, resetSdkLoaderForTests, SDK_SRC } from "./sdkLoader";

type FakeScript = { src: string; listeners: Record<string, () => void>; addEventListener(e: string, f: () => void): void };

function setup(existing?: FakeScript) {
  const appended: FakeScript[] = [];
  const mk = (): FakeScript => ({
    src: "",
    listeners: {},
    addEventListener(e, f) {
      this.listeners[e] = f;
    },
  });
  const g = globalThis as Record<string, unknown>;
  g.window = {};
  g.document = {
    querySelector: () => existing ?? appended[0] ?? null,
    createElement: mk,
    body: { appendChild: (s: FakeScript) => appended.push(s) },
  };
  return appended;
}

describe("loadSdk", () => {
  beforeEach(() => resetSdkLoaderForTests());

  it("returns the same promise and appends one script", async () => {
    const appended = setup();
    const a = loadSdk();
    const b = loadSdk();
    expect(a).toBe(b);
    expect(appended).toHaveLength(1);
    expect(appended[0]!.src).toBe(SDK_SRC);
    appended[0]!.listeners.load!();
    await a;
  });

  it("reuses an existing script tag", async () => {
    const existing: FakeScript = { src: SDK_SRC, listeners: {}, addEventListener(e, f) { this.listeners[e] = f; } };
    const appended = setup(existing);
    const p = loadSdk();
    expect(appended).toHaveLength(0);
    existing.listeners.load!();
    await p;
  });

  it("allows a retry after a load failure", async () => {
    const appended = setup();
    const p = loadSdk();
    appended[0]!.listeners.error!();
    await expect(p).rejects.toThrow();
    expect(loadSdk()).not.toBe(p);
  });
});
