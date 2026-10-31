export type AudioFormat = "ogg" | "wav" | "mp3" | "m4a" | "webm";

/** Decides the format from the bytes; the declared MIME type is never trusted. */
export function sniffAudio(b: Uint8Array): AudioFormat | null {
  const ascii = (from: number, to: number) => Buffer.from(b.subarray(from, to)).toString("latin1");
  if (b.length >= 4 && ascii(0, 4) === "OggS") return "ogg";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (b.length >= 3 && ascii(0, 3) === "ID3") return "mp3";
  if (b.length >= 2 && b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0) return "mp3";
  if (b.length >= 8 && ascii(4, 8) === "ftyp") return "m4a";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

export function audioFileName(f: AudioFormat): string {
  return `voice.${f}`;
}
