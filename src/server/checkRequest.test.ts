import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, parseCheckRequest, tooLargeMessage } from "./checkRequest";

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
    expect(await parseCheckRequest(post(big))).toEqual({ error: "too_large", field: "image" });
  });
  it("reads a multipart voice note", async () => {
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(5_000_000)], "v.ogg", { type: "audio/ogg" }));
    const parsed = await parseCheckRequest(post(form));
    expect("audio" in parsed && parsed.audio.byteLength).toBe(5_000_000);
  });
  it("refuses an oversized voice note", async () => {
    const form = new FormData();
    form.set("audio", new File([new Uint8Array(11_000_001)], "v.ogg", { type: "audio/ogg" }));
    expect(await parseCheckRequest(post(form))).toEqual({ error: "too_large", field: "audio" });
  });
  it("prefers the image when both image and audio are sent", async () => {
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1])], "v.ogg"));
    form.set("image", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "s.png"));
    expect(await parseCheckRequest(post(form))).toEqual({ image: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });
  });
  it("reports content-length refusals against no particular file type", async () => {
    expect(await parseCheckRequest(post("x", { "content-length": "11000001" }))).toEqual({ error: "too_large", field: "file" });
  });
  it("refuses malformed or empty bodies", async () => {
    expect(await parseCheckRequest(post("{oops", { "content-type": "application/json" }))).toEqual({ error: "bad_body" });
    expect(await parseCheckRequest(post(JSON.stringify({ text: 5 }), { "content-type": "application/json" }))).toEqual({ error: "bad_body" });
    expect(await parseCheckRequest(post(new FormData()))).toEqual({ error: "bad_body" });
  });
});

describe("tooLargeMessage", () => {
  it("has screenshot and voice note copy", () => {
    expect(tooLargeMessage("image")).toBe("That screenshot is too large. Please crop it to the message and try again.");
    expect(tooLargeMessage("audio")).toBe("That voice note is too large. Please check one under 10 MB.");
    expect(tooLargeMessage("file")).toBe("That file is too large. Please add a screenshot under 3 MB or a voice note under 10 MB.");
  });
});
