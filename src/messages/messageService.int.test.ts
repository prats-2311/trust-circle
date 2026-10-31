import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageAiOutcome } from "@/ai/groqMessageJudge";
import { trustLinks, users } from "@/db/schema";
import { createDrizzleCircleRepo } from "@/circle/drizzleCircleRepo";
import { freshTestDb } from "@/test/db";
import { createDrizzleMessageRepo } from "./drizzleMessageRepo";
import { matchKeys } from "./identifiers";
import { createMessageService } from "./messageService";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let senderId: string;
const TRANSCRIPT = "Gran it's Daniel, send $800 to danny.help@example.com";
const OGG = new Uint8Array([...Buffer.from("OggS"), 0, 2, 3, 4]);
const high: MessageAiOutcome = {
  ok: true,
  judgement: { level: "high", scamType: "impersonation_family", reasons: ["Asks for money."], impersonatedRequester: null, transcript: "" },
};

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [s] = await handle.db.insert(users).values({ email: "v@example.com", displayName: "Margaret" }).returning();
  senderId = s!.id;
});
afterAll(async () => handle?.close());

describe("voice checks with the real repo", () => {
  it("flags the payee spoken in a voice note and links the transcript", async () => {
    const service = createMessageService({
      repo: createDrizzleMessageRepo(handle.db),
      judge: vi.fn().mockResolvedValue(high),
      transcribe: vi.fn().mockResolvedValue({ ok: true, text: TRANSCRIPT, noSpeech: false }),
    });
    const saved = await service.check({ senderId, audio: OGG });
    expect(saved.source).toBe("voice");
    expect(await service.flaggedPayees(senderId)).toEqual(expect.arrayContaining(matchKeys("danny.help@example.com")));
    expect(await service.linkedMessage(senderId, "danny.help@example.com")).toBe(TRANSCRIPT);
    expect((await service.history(senderId))[0]!.source).toBe("voice");
  });
});

describe("new-number check with the real repos", () => {
  it("raises a Daniel message from a new number to high and links the number", async () => {
    const [d] = await handle.db.insert(users).values({ email: "d@example.com", displayName: "Daniel", phone: "+1 (415) 555-0131" }).returning();
    await handle.db.insert(trustLinks).values({ senderId, contactId: d!.id, relationship: "grandson" });
    const circle = createDrizzleCircleRepo(handle.db);
    const medium: MessageAiOutcome = {
      ok: true,
      judgement: { level: "medium", scamType: "impersonation_family", reasons: ["Asks for money."], impersonatedRequester: { kind: "person", name: "Daniel" }, transcript: "" },
    };
    const service = createMessageService({
      repo: createDrizzleMessageRepo(handle.db),
      judge: vi.fn().mockResolvedValue(medium),
      circle: (id) => circle.contactsWithPhones(id),
    });
    const text = "Hi Gran it's Daniel, lost my phone, new number +1 (415) 555-0186, need $600 today";
    const saved = await service.check({ senderId, text });
    expect(saved.level).toBe("high");
    expect(await service.linkedMessage(senderId, "+1 (415) 555-0186")).toBe(text);
  });
});
