export const SIGNED_OUT = "Your session has ended. Please choose a demo account again.";
export const NETWORK_ERROR = "We couldn't reach Trust Circle. Please check your connection and try again.";

export type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; signedOut: boolean };

/** Every screen talks to the API through this, so 401s, network errors and 202s are handled the same way. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR, signedOut: false };
  }
  if (res.status === 401) return { ok: false, status: 401, error: SIGNED_OUT, signedOut: true };
  const body: unknown = await res.json().catch(() => undefined);
  if (res.ok) return { ok: true, status: res.status, data: body as T };
  const error = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : NETWORK_ERROR;
  return { ok: false, status: res.status, error, signedOut: false };
}

export const jsonBody = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(value),
});
