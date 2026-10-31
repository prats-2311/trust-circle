import type { ImageMime, MessageInput, MessageJudge } from "@/ai/groqMessageJudge";
import type { Transcriber } from "@/ai/groqTranscriber";
import type { PromptGuard } from "@/ai/promptGuard";
import type { PatternMatcher } from "@/patterns/patternService";
import type { Requester } from "@/domain/types";
import { sniffAudio, type AudioFormat } from "./audio";
import { assessMessage, type RegistryLists } from "./assessMessage";
import { matchKeys } from "./identifiers";
import type { MessageCheckRecord, MessageRepo } from "./messageRepo";

export const MAX_MESSAGE_CHARS = 4000;
// Groq accepts base64 images up to 4 MB; 3 MB of bytes is about 4 MB once encoded.
export const MAX_IMAGE_BYTES = 3_000_000;
export const MAX_AUDIO_BYTES = 10_000_000;
const VOICE_CHECKS_PER_HOUR = 20;
const HOUR_MS = 3_600_000;
const RECENT_CHECKS = 200;
const LINKED_MESSAGE_CHARS = 1500;

export class MessageInputError extends Error {
  constructor(readonly field: "text" | "image" | "audio", message: string) {
    super(message);
    this.name = "MessageInputError";
  }
}

export class VoiceLimitError extends Error {
  constructor() {
    super("You've checked a lot of voice notes in the last hour. Please try again later.");
    this.name = "VoiceLimitError";
  }
}

const COULD_NOT_LISTEN = "We couldn't listen to this one. Please type what it says, or ask the person directly.";

export type CheckRequest = { senderId: string; text: string } | { senderId: string; image: Uint8Array } | { senderId: string; audio: Uint8Array };
export type MessageCheckResult = MessageCheckRecord & { impersonatedRequester: Requester | null };

/** The declared file type is not trusted; the first bytes say what the file really is. */
function sniffImage(b: Uint8Array): ImageMime | null {
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => Buffer.from(b.subarray(from, to)).toString("latin1");
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function audioFormat(audio: Uint8Array): AudioFormat {
  if (audio.byteLength === 0) throw new MessageInputError("audio", "Please add a voice note.");
  if (audio.byteLength > MAX_AUDIO_BYTES) throw new MessageInputError("audio", "That voice note is too large. Please check one under 10 MB.");
  const format = sniffAudio(audio);
  if (!format) throw new MessageInputError("audio", "Please add a voice note saved as OGG, OPUS, M4A, MP3, WAV or WEBM.");
  return format;
}

function toInput(a: Exclude<CheckRequest, { audio: Uint8Array }>): MessageInput {
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
  patterns?: PatternMatcher;
  registry?: (senderId: string) => Promise<RegistryLists>;
  transcribe?: Transcriber;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;
  const voiceChecks = new Map<string, number[]>();

  /** Rolling hour per user, kept in this process only. */
  function countVoiceCheck(senderId: string) {
    const since = now() - HOUR_MS;
    const recentChecks = (voiceChecks.get(senderId) ?? []).filter((t) => t > since);
    if (recentChecks.length >= VOICE_CHECKS_PER_HOUR) {
      voiceChecks.set(senderId, recentChecks);
      throw new VoiceLimitError();
    }
    voiceChecks.set(senderId, [...recentChecks, now()]);
  }

  async function voiceInput(a: { senderId: string; audio: Uint8Array }): Promise<MessageInput> {
    const format = audioFormat(a.audio);
    countVoiceCheck(a.senderId);
    const heard = deps.transcribe ? await deps.transcribe({ bytes: a.audio, format }) : null;
    const text = heard?.ok ? heard.text.trim().slice(0, MAX_MESSAGE_CHARS) : "";
    if (!text) throw new MessageInputError("audio", COULD_NOT_LISTEN);
    return { kind: "text", text };
  }

  const registry = deps.registry ?? (async () => ({ confirmed: [], unconfirmed: [] }));
  const recent = (senderId: string) => deps.repo.listBySender(senderId, RECENT_CHECKS);

  return {
    async check(a: CheckRequest): Promise<MessageCheckResult> {
      const input = "audio" in a ? await voiceInput(a) : toInput(a);
      const r = await assessMessage(input, { registry: await registry(a.senderId) }, { judge: deps.judge, guard: deps.guard, patterns: deps.patterns });
      // Neither the screenshot nor the recording is stored, only the words read from it.
      const record = await deps.repo.insert({
        senderId: a.senderId,
        source: "audio" in a ? "voice" : input.kind,
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
