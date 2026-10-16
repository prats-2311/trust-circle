import { describe, expect, it, vi } from "vitest";
import type { MessageAiOutcome } from "@/ai/groqMessageJudge";
import { createMemoryMessageRepo } from "./messageRepo";
import { createMessageService, MAX_IMAGE_BYTES, MessageInputError } from "./messageService";

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
