const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const AUDIO_EXT = /\.(opus|ogg|oga|m4a|mp3|wav|webm)$/i;

// WhatsApp voice notes often arrive with an empty or generic MIME type, so the name counts too.
export function fileKind(f: { name: string; type: string }): "image" | "audio" | null {
  if (/^image\/(png|jpeg|webp)$/.test(f.type) || IMAGE_EXT.test(f.name)) return "image";
  if (f.type.startsWith("audio/") || f.type === "video/webm" || AUDIO_EXT.test(f.name)) return "audio";
  return null;
}

const MAX_IMAGE_BYTES = 3_000_000;
const MAX_AUDIO_BYTES = 10_000_000;

/** Checked before uploading, so a big file never travels only to be refused. */
export function fileTooLarge(kind: "image" | "audio" | null, size: number): string | null {
  if (kind === "audio" && size > MAX_AUDIO_BYTES) return "That voice note is too large. Please check one under 10 MB.";
  if (kind === "image" && size > MAX_IMAGE_BYTES) return "That screenshot is too large. Please crop it to the message and try again.";
  return null;
}
