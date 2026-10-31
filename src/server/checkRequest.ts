import { readJsonObject } from "./http";

/** The whole request; the service applies the tighter per-file limits with friendlier copy. */
export const MAX_UPLOAD_BYTES = 11_000_000;

export type ParsedCheck =
  | { text: string }
  | { image: Uint8Array }
  | { audio: Uint8Array }
  | { error: "bad_body" }
  | { error: "too_large"; field: "image" | "audio" };

export function tooLargeMessage(field: "image" | "audio"): string {
  return field === "audio"
    ? "That voice note is too large. Please check one under 10 MB."
    : "That screenshot is too large. Please crop it to the message and try again.";
}

export async function parseCheckRequest(req: Request): Promise<ParsedCheck> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return { error: "too_large", field: "image" };
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { error: "bad_body" };
    }
    const image = form.get("image");
    if (image instanceof File) {
      if (image.size > MAX_UPLOAD_BYTES) return { error: "too_large", field: "image" };
      return { image: new Uint8Array(await image.arrayBuffer()) };
    }
    const audio = form.get("audio");
    if (audio instanceof File) {
      if (audio.size > MAX_UPLOAD_BYTES) return { error: "too_large", field: "audio" };
      return { audio: new Uint8Array(await audio.arrayBuffer()) };
    }
    const text = form.get("text");
    return typeof text === "string" ? { text } : { error: "bad_body" };
  }
  const body = await readJsonObject(req);
  return body && typeof body.text === "string" ? { text: body.text } : { error: "bad_body" };
}
