import type { ImageMime, MessageInput, MessageJudge } from "@/ai/groqMessageJudge";
import type { PromptGuard } from "@/ai/promptGuard";
import type { Requester } from "@/domain/types";
import { assessMessage, type RegistryLists } from "./assessMessage";
import { matchKeys } from "./identifiers";
import type { MessageCheckRecord, MessageRepo } from "./messageRepo";

export const MAX_MESSAGE_CHARS = 4000;
// Groq accepts base64 images up to 4 MB; 3 MB of bytes is about 4 MB once encoded.
export const MAX_IMAGE_BYTES = 3_000_000;
const RECENT_CHECKS = 200;
const LINKED_MESSAGE_CHARS = 1500;

export class MessageInputError extends Error {
  constructor(readonly field: "text" | "image", message: string) {
    super(message);
    this.name = "MessageInputError";
  }
}

export type CheckRequest = { senderId: string; text: string } | { senderId: string; image: Uint8Array };
export type MessageCheckResult = MessageCheckRecord & { impersonatedRequester: Requester | null };

/** The declared file type is not trusted; the first bytes say what the file really is. */
function sniffImage(b: Uint8Array): ImageMime | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => Buffer.from(b.subarray(from, to)).toString("latin1");
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function toInput(a: CheckRequest): MessageInput {
  if ("text" in a) {
    const text = a.text.trim();
    if (!text) throw new MessageInputError("text", "Please paste the message you want to check.");
    if (text.length > MAX_MESSAGE_CHARS) {
      throw new MessageInputError("text", "That message is too long. Please paste the part that asks for money or personal details.");
    }
    return { kind: "text", text };
  }
  if (a.image.byteLength === 0) throw new MessageInputError("image", "Please add a screenshot of the message.");
  if (a.image.byteLength > MAX_IMAGE_BYTES) {
    throw new MessageInputError("image", "That screenshot is too large. Please crop it to the message and try again.");
  }
  const mimeType = sniffImage(a.image);
  if (!mimeType) throw new MessageInputError("image", "Please add a screenshot saved as a PNG, JPEG or WebP picture.");
  return { kind: "image", mimeType, base64: Buffer.from(a.image).toString("base64") };
}

const payableKeys = (c: MessageCheckRecord) => c.identifiers.filter((i) => i.type !== "url").flatMap((i) => matchKeys(i.value));

export function createMessageService(deps: {
  repo: MessageRepo;
  judge: MessageJudge;
  guard?: PromptGuard;
  registry?: (senderId: string) => Promise<RegistryLists>;
}) {
  const registry = deps.registry ?? (async () => ({ confirmed: [], unconfirmed: [] }));
  const recent = (senderId: string) => deps.repo.listBySender(senderId, RECENT_CHECKS);

  return {
    async check(a: CheckRequest): Promise<MessageCheckResult> {
      const input = toInput(a);
      const r = await assessMessage(input, { registry: await registry(a.senderId) }, { judge: deps.judge, guard: deps.guard });
      // The screenshot itself is never stored, only the words read from it.
      const record = await deps.repo.insert({
        senderId: a.senderId,
        source: input.kind,
        text: r.text.slice(0, MAX_MESSAGE_CHARS),
        checked: r.checked,
        level: r.level,
        scamType: r.scamType,
        reasons: r.reasons,
        identifiers: r.identifiers,
      });
      return { ...record, impersonatedRequester: r.impersonatedRequester };
    },

    /** Emails and phone numbers from this sender's high-risk checks, in every comparable form. */
    async flaggedPayees(senderId: string): Promise<string[]> {
      const checks = await recent(senderId);
      return [...new Set(checks.filter((c) => c.level === "high").flatMap(payableKeys))];
    },

    async linkedMessage(senderId: string, payee: string): Promise<string | undefined> {
      const target = new Set(matchKeys(payee));
      const hit = (await recent(senderId)).find((c) => payableKeys(c).some((k) => target.has(k)));
      return hit ? hit.text.slice(0, LINKED_MESSAGE_CHARS) : undefined;
    },

    history(senderId: string): Promise<MessageCheckRecord[]> {
      return deps.repo.listBySender(senderId, 50);
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;
