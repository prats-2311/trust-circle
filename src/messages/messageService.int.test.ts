import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageAiOutcome } from "@/ai/groqMessageJudge";
import { users } from "@/db/schema";
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
