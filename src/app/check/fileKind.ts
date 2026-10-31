const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const AUDIO_EXT = /\.(opus|ogg|oga|m4a|mp3|wav|webm)$/i;

// WhatsApp voice notes often arrive with an empty or generic MIME type, so the name counts too.
export function fileKind(f: { name: string; type: string }): "image" | "audio" | null {
  if (/^image\/(png|jpeg|webp)$/.test(f.type) || IMAGE_EXT.test(f.name)) return "image";
  if (f.type.startsWith("audio/") || f.type === "video/webm" || AUDIO_EXT.test(f.name)) return "audio";
  return null;
}
