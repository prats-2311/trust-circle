import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSdk, resetSdkLoaderForTests, SDK_SRC } from "./sdkLoader";

type Listener = () => void;
class FakeScript {
  src = "";
  removed = false;
  listeners: Record<string, Listener> = {};
  addEventListener(e: string, f: Listener) {
    this.listeners[e] = f;
  }
  remove() {
    this.removed = true;
  }
}

const g = globalThis as Record<string, unknown>;
let saved: { window: unknown; document: unknown };

function setup(existing?: FakeScript) {
  const appended: FakeScript[] = [];
  g.window = {};
  g.document = {
    querySelector: () => existing ?? appended.find((s) => !s.removed) ?? null,
    createElement: () => new FakeScript(),
    body: { appendChild: (s: FakeScript) => appended.push(s) },
  };
  return appended;
}

describe("loadSdk", () => {
  beforeEach(() => {
    saved = { window: g.window, document: g.document };
    resetSdkLoaderForTests();
  });
  afterEach(() => {
    if (saved.window === undefined) delete g.window;
    else g.window = saved.window;
    if (saved.document === undefined) delete g.document;
    else g.document = saved.document;
  });

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
    const existing = new FakeScript();
    existing.src = SDK_SRC;
    const appended = setup(existing);
    const p = loadSdk();
    expect(appended).toHaveLength(0);
    existing.listeners.load!();
    await p;
  });

  it("removes a failed tag and loads a fresh one on retry", async () => {
    const appended = setup();
    const first = loadSdk();
    appended[0]!.listeners.error!();
    await expect(first).rejects.toThrow();
    expect(appended[0]!.removed).toBe(true);

    const second = loadSdk();
    expect(second).not.toBe(first);
    expect(appended).toHaveLength(2);
    appended[1]!.listeners.load!();
    await expect(second).resolves.toBeUndefined();
  });
});
