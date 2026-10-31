import { describe, expect, it } from "vitest";
import { audioFileName, sniffAudio } from "./audio";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffAudio", () => {
  it("recognises each supported format from its bytes", () => {
    expect(sniffAudio(new Uint8Array(ascii("OggS\0\x02")))).toBe("ogg");
    expect(sniffAudio(new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]))).toBe("wav");
    expect(sniffAudio(new Uint8Array(ascii("ID3\x03")))).toBe("mp3");
    expect(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90]))).toBe("mp3");
    expect(sniffAudio(new Uint8Array([0, 0, 0, 0x20, ...ascii("ftypM4A ")]))).toBe("m4a");
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f]))).toBe("webm");
  });

  it("rejects a picture, an empty file and a lone sync byte", () => {
    expect(sniffAudio(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(sniffAudio(new Uint8Array())).toBeNull();
    expect(sniffAudio(new Uint8Array([0xff]))).toBeNull();
    expect(sniffAudio(new Uint8Array([0xff, 0x00]))).toBeNull();
  });
});

describe("audioFileName", () => {
  it("names the upload after its format", () => {
    expect(audioFileName("ogg")).toBe("voice.ogg");
    expect(audioFileName("m4a")).toBe("voice.m4a");
    expect(audioFileName("webm")).toBe("voice.webm");
  });
});
