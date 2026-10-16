import { readJsonObject } from "./http";

/** The whole request; the service applies the tighter 3 MB image limit with friendlier copy. */
export const MAX_UPLOAD_BYTES = 4_000_000;

export type ParsedCheck = { text: string } | { image: Uint8Array } | { error: "bad_body" | "too_large" };

export async function parseCheckRequest(req: Request): Promise<ParsedCheck> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return { error: "too_large" };
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { error: "bad_body" };
    }
    const image = form.get("image");
    if (image instanceof File) {
      if (image.size > MAX_UPLOAD_BYTES) return { error: "too_large" };
      return { image: new Uint8Array(await image.arrayBuffer()) };
    }
    const text = form.get("text");
    return typeof text === "string" ? { text } : { error: "bad_body" };
  }
  const body = await readJsonObject(req);
  return body && typeof body.text === "string" ? { text: body.text } : { error: "bad_body" };
}
