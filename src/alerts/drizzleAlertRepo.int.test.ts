import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { freshTestDb } from "@/test/db";
import { createDrizzleAlertRepo } from "./drizzleAlertRepo";

let handle: Awaited<ReturnType<typeof freshTestDb>>;
let sarahId: string;
const payload = { senderName: "Margaret", amountCents: 80000, payee: "x@example.com" };

beforeEach(async () => {
  if (handle) await handle.close();
  handle = await freshTestDb();
  const [s] = await handle.db.insert(users).values({ email: "s@example.com", displayName: "Sarah" }).returning();
  sarahId = s!.id;
});
afterAll(async () => handle?.close());

describe("drizzle alert repo", () => {
  const alert = (channel: "in_app" | "email") =>
    ({ recipientId: sarahId, kind: "payment_held", paymentId: null, verificationId: null, channel, status: "sent", payload }) as const;

  it("lists only in-app alerts, newest first, with the payload intact", async () => {
    const repo = createDrizzleAlertRepo(handle.db);
    await repo.insert(alert("in_app"));
    await repo.insert(alert("email"));
    await repo.insert({ ...alert("in_app"), kind: "verify_request" });
    const list = await repo.listForRecipient(sarahId, 10);
    expect(list.map((a) => a.kind)).toEqual(["verify_request", "payment_held"]);
    expect(list[0]!.payload).toEqual(payload);
  });
  it("marks read for the right recipient only, and tolerates bad ids", async () => {
    const repo = createDrizzleAlertRepo(handle.db);
    const a = await repo.insert(alert("in_app"));
    const at = new Date("2026-11-01T10:00:00Z");
    expect(await repo.markRead(a.id, randomUUID(), at)).toBe(false);
    expect(await repo.markRead("not-a-uuid", sarahId, at)).toBe(false);
    expect(await repo.markRead(a.id, sarahId, at)).toBe(true);
    expect((await repo.listForRecipient(sarahId, 10))[0]!.readAt).toEqual(at);
  });
});
