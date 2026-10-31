import { describe, expect, it, vi } from "vitest";
import type { MessageAiOutcome } from "@/ai/groqMessageJudge";
import { createMemoryMessageRepo } from "./messageRepo";
import { createMessageService, MAX_IMAGE_BYTES, MessageInputError, VoiceLimitError } from "./messageService";

const SENDER = "00000000-0000-4000-8000-000000000001";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 1]);
const PDF = new Uint8Array(Buffer.from("%PDF-1.7 not an image"));

const verdict = (level: "low" | "high", transcript = ""): MessageAiOutcome => ({
  ok: true,
  judgement: {
    level,
    scamType: level === "high" ? "impersonation_family" : "none",
    reasons: level === "high" ? ["Asks for gift cards."] : [],
    impersonatedRequester: level === "high" ? { kind: "person", name: "grandson" } : null,
    transcript,
  },
});

function setup(judgeResult: MessageAiOutcome = verdict("high")) {
  const repo = createMemoryMessageRepo();
  const judge = vi.fn().mockResolvedValue(judgeResult);
  return { repo, judge, service: createMessageService({ repo, judge }) };
}

describe("message service: input checks", () => {
  it.each([
    [{ text: "   " }, "text", "Please paste the message you want to check."],
    [{ text: "x".repeat(4001) }, "text", "That message is too long. Please paste the part that asks for money or personal details."],
    [{ image: new Uint8Array() }, "image", "Please add a screenshot of the message."],
    [{ image: new Uint8Array(MAX_IMAGE_BYTES + 1) }, "image", "That screenshot is too large. Please crop it to the message and try again."],
    [{ image: PDF }, "image", "Please add a screenshot saved as a PNG, JPEG or WebP picture."],
  ])("rejects %# before calling the AI", async (over, field, message) => {
    const { service, judge } = setup();
    const err = await service.check({ senderId: SENDER, ...over } as Parameters<typeof service.check>[0]).catch((e) => e);
    expect(err).toBeInstanceOf(MessageInputError);
    expect(err.field).toBe(field);
    expect(err.message).toBe(message);
    expect(judge).not.toHaveBeenCalled();
  });
});

describe("message service: checks", () => {
  it("stores a text check with its identifiers and returns the requester", async () => {
    const { service, repo } = setup();
    const r = await service.check({ senderId: SENDER, text: " Grandma call me at +1 (415) 555-0199 " });
    expect(r).toMatchObject({
      senderId: SENDER,
      source: "text",
      text: "Grandma call me at +1 (415) 555-0199",
      checked: true,
      level: "high",
      identifiers: [{ type: "phone", value: "+14155550199" }],
      impersonatedRequester: { kind: "person", name: "grandson" },
    });
    expect(await repo.listBySender(SENDER, 10)).toHaveLength(1);
  });

  it.each([
    [PNG, "image/png"],
    [JPEG, "image/jpeg"],
    [WEBP, "image/webp"],
  ])("detects the real image type from its bytes (%#)", async (bytes, mimeType) => {
    const { service, judge } = setup(verdict("high", "Hi Grandma"));
    await service.check({ senderId: SENDER, image: bytes });
    expect(judge.mock.calls[0]![0]).toEqual({ kind: "image", mimeType, base64: Buffer.from(bytes).toString("base64") });
  });

  it("keeps only the transcript of a screenshot, never the image", async () => {
    const { service, repo } = setup(verdict("high", "Hi Grandma, text +1 415 555 0199"));
    const r = await service.check({ senderId: SENDER, image: PNG });
    expect(r.source).toBe("image");
    expect(r.text).toBe("Hi Grandma, text +1 415 555 0199");
    const stored = JSON.stringify(await repo.listBySender(SENDER, 10));
    expect(stored).not.toContain(Buffer.from(PNG).toString("base64"));
  });

  it("stores an unchecked result when the AI fails", async () => {
    const { service } = setup({ ok: false, error: "groq http 503" });
    const r = await service.check({ senderId: SENDER, text: "See you at dinner" });
    expect(r.checked).toBe(false);
  });

  it("passes the sender's registry lists to the assessment", async () => {
    const repo = createMemoryMessageRepo();
    const registry = vi.fn().mockResolvedValue({ confirmed: ["4155550199"], unconfirmed: [] });
    const service = createMessageService({ repo, judge: vi.fn().mockResolvedValue({ ok: false, error: "down" }), registry });
    const r = await service.check({ senderId: SENDER, text: "call +1 415 555 0199" });
    expect(registry).toHaveBeenCalledWith(SENDER);
    expect(r.level).toBe("high");
  });
});

describe("message service: links to payments", () => {
  it("flags emails and phones from high-risk checks only, in every comparable form", async () => {
    const repo = createMemoryMessageRepo();
    const judge = vi.fn().mockResolvedValueOnce(verdict("high")).mockResolvedValueOnce(verdict("low"));
    const service = createMessageService({ repo, judge });
    await service.check({ senderId: SENDER, text: "Pay dhill@mail.example or +1 415 555 0199, see http://x.example" });
    await service.check({ senderId: SENDER, text: "Lunch? friend@mail.example" });
    expect((await service.flaggedPayees(SENDER)).sort()).toEqual(["+14155550199", "14155550199", "4155550199", "dhill@mail.example"].sort());
  });

  it("finds the message a payee appeared in", async () => {
    const { service } = setup();
    await service.check({ senderId: SENDER, text: "Grandma send it to dhill@mail.example" });
    expect(await service.linkedMessage(SENDER, "DHill@mail.example")).toBe("Grandma send it to dhill@mail.example");
    expect(await service.linkedMessage(SENDER, "other@mail.example")).toBeUndefined();
    expect(await service.linkedMessage("00000000-0000-4000-8000-000000000009", "dhill@mail.example")).toBeUndefined();
  });
});

describe("message service: patterns", () => {
  it("passes the pattern matcher to the assessment", async () => {
    const repo = createMemoryMessageRepo();
    const patterns = vi.fn().mockResolvedValue(null);
    const service = createMessageService({ repo, judge: vi.fn().mockResolvedValue(verdict("low")), patterns });
    await service.check({ senderId: SENDER, text: "Lunch on Friday?" });
    expect(patterns).toHaveBeenCalledWith("Lunch on Friday?");
  });
});

describe("message service: voice notes", () => {
  const OGG = new Uint8Array([...Buffer.from("OggS"), 0, 2, 3, 4]);
  const TRANSCRIPT = "Gran it's Daniel, send $800 to danny.help@example.com";
  const COULD_NOT = "We couldn't listen to this one. Please type what it says, or ask the person directly.";
  const voiceSetup = (result: Awaited<ReturnType<import("@/ai/groqTranscriber").Transcriber>> = { ok: true, text: TRANSCRIPT }, now = () => 0) => {
    const repo = createMemoryMessageRepo();
    const insert = vi.spyOn(repo, "insert");
    const judge = vi.fn().mockResolvedValue(verdict("high"));
    const guard = vi.fn().mockResolvedValue(0.01);
    const transcribe = vi.fn().mockResolvedValue(result);
    const service = createMessageService({ repo, judge, guard, transcribe, now });
    return { repo, insert, judge, guard, transcribe, service };
  };

  it("transcribes, then judges the transcript as text and stores it as voice", async () => {
    const { service, judge, insert, guard, transcribe } = voiceSetup();
    const r = await service.check({ senderId: SENDER, audio: OGG });
    expect(transcribe).toHaveBeenCalledWith({ bytes: OGG, format: "ogg" });
    expect(judge).toHaveBeenCalledWith({ kind: "text", text: TRANSCRIPT }, expect.anything());
    expect(guard).toHaveBeenCalledWith(TRANSCRIPT);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source: "voice", text: TRANSCRIPT }));
    expect(r.source).toBe("voice");
  });

  it.each([[{ ok: false, error: "groq http 500" } as const], [{ ok: true, text: "   " } as const], [{ ok: true, text: "" } as const]])(
    "refuses a voice note it could not understand %#",
    async (result) => {
      const { service, insert } = voiceSetup(result);
      const err = await service.check({ senderId: SENDER, audio: OGG }).catch((e) => e);
      expect(err).toBeInstanceOf(MessageInputError);
      expect(err.field).toBe("audio");
      expect(err.message).toBe(COULD_NOT);
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("refuses a voice note when no transcriber is configured", async () => {
    const repo = createMemoryMessageRepo();
    const service = createMessageService({ repo, judge: vi.fn() });
    const err = await service.check({ senderId: SENDER, audio: OGG }).catch((e) => e);
    expect(err).toBeInstanceOf(MessageInputError);
    expect(err.message).toBe(COULD_NOT);
  });

  it.each([
    [new Uint8Array(), "Please add a voice note."],
    [new Uint8Array(Buffer.from("%PDF-1.7 nope")), "Please add a voice note saved as OGG, OPUS, M4A, MP3, WAV or WEBM."],
    [Object.assign(new Uint8Array(10_000_001), { 0: 0x4f, 1: 0x67, 2: 0x67, 3: 0x53 }), "That voice note is too large. Please check one under 10 MB."],
  ])("rejects bad audio %# before transcribing", async (audio, message) => {
    const { service, transcribe } = voiceSetup();
    const err = await service.check({ senderId: SENDER, audio }).catch((e) => e);
    expect(err).toBeInstanceOf(MessageInputError);
    expect(err.field).toBe("audio");
    if (message !== "Please add a voice note.") expect(err.message).toBe(message);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("accepts a 5 MB voice note", async () => {
    const { service } = voiceSetup();
    const big = new Uint8Array(5_000_000);
    big.set(OGG);
    await expect(service.check({ senderId: SENDER, audio: big })).resolves.toMatchObject({ source: "voice" });
  });

  it("stores a long transcript truncated to 4000 characters", async () => {
    const { service } = voiceSetup({ ok: true, text: "a".repeat(5000) });
    const r = await service.check({ senderId: SENDER, audio: OGG });
    expect(r.text).toHaveLength(4000);
  });

  it("caps voice checks at 20 per user per rolling hour", async () => {
    let t = 0;
    const { service } = voiceSetup(undefined, () => t);
    for (let i = 0; i < 20; i++) await service.check({ senderId: "u1", audio: OGG });
    await expect(service.check({ senderId: "u1", audio: OGG })).rejects.toBeInstanceOf(VoiceLimitError);
    await expect(service.check({ senderId: "u2", audio: OGG })).resolves.toBeDefined();
    await expect(service.check({ senderId: "u1", text: "hello" })).resolves.toBeDefined();
    t = 3_600_001;
    await expect(service.check({ senderId: "u1", audio: OGG })).resolves.toBeDefined();
  });

  it("does not count refused requests toward the cap", async () => {
    const { service } = voiceSetup();
    for (let i = 0; i < 25; i++) await service.check({ senderId: "u1", audio: new Uint8Array([1]) }).catch(() => undefined);
    await expect(service.check({ senderId: "u1", audio: OGG })).resolves.toBeDefined();
  });
});
