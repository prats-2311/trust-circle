import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { installMsw, server } from "@/test/msw";
import { fetchJson, NETWORK_ERROR, SIGNED_OUT } from "./fetchJson";

installMsw();
const URL = "http://localhost/api/thing";

describe("fetchJson", () => {
  it("returns data on success", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ a: 1 })));
    expect(await fetchJson<{ a: number }>(URL)).toEqual({ ok: true, status: 200, data: { a: 1 } });
  });
  it("returns the server's error copy", async () => {
    server.use(http.post(URL, () => HttpResponse.json({ error: "Please check the details." }, { status: 400 })));
    expect(await fetchJson(URL, { method: "POST" })).toEqual({ ok: false, status: 400, error: "Please check the details.", signedOut: false });
  });
  it("treats 202 as success, so pending copy reaches the screen", async () => {
    server.use(http.post(URL, () => HttpResponse.json({ error: "We're finishing this payment for you.", paymentId: "p1" }, { status: 202 })));
    const r = await fetchJson<{ error: string; paymentId: string }>(URL, { method: "POST" });
    expect(r).toEqual({ ok: true, status: 202, data: { error: "We're finishing this payment for you.", paymentId: "p1" } });
  });
  it("flags a signed-out user", async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: "Please sign in." }, { status: 401 })));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 401, error: SIGNED_OUT, signedOut: true });
  });
  it("gives calm copy for network failures and non-JSON errors", async () => {
    server.use(http.get(URL, () => HttpResponse.error()));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 0, error: NETWORK_ERROR, signedOut: false });
    server.use(http.get(URL, () => new HttpResponse("oops", { status: 500 })));
    expect(await fetchJson(URL)).toEqual({ ok: false, status: 500, error: NETWORK_ERROR, signedOut: false });
  });
});
