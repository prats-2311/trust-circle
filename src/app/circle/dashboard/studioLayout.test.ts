import { describe, expect, it } from "vitest";
import { LAYOUT_KEY, loadLayout, saveLayout } from "./studioLayout";

function memory() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const boom = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("studio layout storage", () => {
  it("round trips a state", () => {
    const s = memory();
    saveLayout(s, { pages: [1, 2] });
    expect(JSON.parse(s.m.get(LAYOUT_KEY)!)).toEqual({ v: 1, state: { pages: [1, 2] } });
    expect(loadLayout(s)).toEqual({ pages: [1, 2] });
  });
  it("returns null when nothing is saved", () => {
    expect(loadLayout(memory())).toBeNull();
  });
  it("returns null, not a throw, from a throwing storage", () => {
    expect(loadLayout(boom)).toBeNull();
  });
  it("returns null for bad JSON", () => {
    const s = memory();
    s.setItem(LAYOUT_KEY, "{not json");
    expect(loadLayout(s)).toBeNull();
  });
  it("returns null for a wrong version", () => {
    const s = memory();
    s.setItem(LAYOUT_KEY, JSON.stringify({ v: 2, state: {} }));
    expect(loadLayout(s)).toBeNull();
  });
  it("returns null for a missing state", () => {
    const s = memory();
    s.setItem(LAYOUT_KEY, JSON.stringify({ v: 1 }));
    expect(loadLayout(s)).toBeNull();
  });
  it("handles null storage", () => {
    expect(loadLayout(null)).toBeNull();
    expect(() => saveLayout(null, {})).not.toThrow();
  });
  it("does not throw when saving to a throwing storage", () => {
    expect(() => saveLayout(boom, { a: 1 })).not.toThrow();
  });
});
