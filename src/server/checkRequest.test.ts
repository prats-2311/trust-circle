import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, parseCheckRequest } from "./checkRequest";

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("http://x/api/messages/check", { method: "POST", body, headers });

describe("parseCheckRequest", () => {
  it("reads JSON text", async () => {
    expect(await parseCheckRequest(post(JSON.stringify({ text: "hi" }), { "content-type": "application/json" }))).toEqual({ text: "hi" });
  });
  it("reads multipart text and images", async () => {
    const text = new FormData();
    text.set("text", "hello");
    expect(await parseCheckRequest(post(text))).toEqual({ text: "hello" });
    const image = new FormData();
    image.set("image", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "s.png", { type: "image/png" }));
    expect(await parseCheckRequest(post(image))).toEqual({ image: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });
  });
  it("refuses an oversized image", async () => {
    const big = new FormData();
    big.set("image", new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.png", { type: "image/png" }));
    expect(await parseCheckRequest(post(big))).toEqual({ error: "too_large" });
  });
  it("refuses malformed or empty bodies", async () => {
    expect(await parseCheckRequest(post("{oops", { "content-type": "application/json" }))).toEqual({ error: "bad_body" });
    expect(await parseCheckRequest(post(JSON.stringify({ text: 5 }), { "content-type": "application/json" }))).toEqual({ error: "bad_body" });
    expect(await parseCheckRequest(post(new FormData()))).toEqual({ error: "bad_body" });
  });
});
