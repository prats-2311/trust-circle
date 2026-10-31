import { describe, expect, it } from "vitest";
import { fileKind } from "./fileKind";

describe("fileKind", () => {
  it("treats a WhatsApp .opus with an empty type as audio", () => {
    expect(fileKind({ name: "PTT-20261031-WA0003.opus", type: "" })).toBe("audio");
  });
  it("goes by the extension when the type is generic", () => {
    expect(fileKind({ name: "a.ogg", type: "application/octet-stream" })).toBe("audio");
  });
  it("accepts audio and webm video types", () => {
    expect(fileKind({ name: "x", type: "audio/mp4" })).toBe("audio");
    expect(fileKind({ name: "x", type: "video/webm" })).toBe("audio");
  });
  it("recognises screenshots", () => {
    expect(fileKind({ name: "x.png", type: "image/png" })).toBe("image");
    expect(fileKind({ name: "X.JPG", type: "" })).toBe("image");
  });
  it("rejects anything else", () => {
    expect(fileKind({ name: "doc.pdf", type: "application/pdf" })).toBeNull();
  });
});
