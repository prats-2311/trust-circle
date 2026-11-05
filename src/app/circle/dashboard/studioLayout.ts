export const LAYOUT_KEY = "tc.studio.layout.v1";

/** The saved explore-board state, or null when there is none or it can't be trusted. */
export function loadLayout(storage: Pick<Storage, "getItem"> | null): unknown | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: unknown; state?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || parsed.v !== 1) return null;
    return parsed.state && typeof parsed.state === "object" ? parsed.state : null;
  } catch {
    return null;
  }
}

export function saveLayout(storage: Pick<Storage, "setItem"> | null, state: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(LAYOUT_KEY, JSON.stringify({ v: 1, state }));
  } catch {
    // Private mode or a full disk: the layout just isn't remembered.
  }
}

export function clearLayout(storage: Pick<Storage, "removeItem"> | null): void {
  if (!storage) return;
  try {
    storage.removeItem(LAYOUT_KEY);
  } catch {
    // ignore
  }
}
