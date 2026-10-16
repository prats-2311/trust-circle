import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { auditLog, payments, registryEntries, registryReports, trustLinks, users } from "../src/db/schema";
import type { ScamType } from "../src/domain/types";

// Every name, address and number here is invented for the demo (555 numbers, .example domains).
const WEEK = 7 * 86_400_000;
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const { db, close } = createDb(url);
  try {
    const byEmail = async (email: string) => (await db.select().from(users).where(eq(users.email, email)))[0];
    const margaret = await byEmail("margaret.demo@trustcircle.example");
    const sarah = await byEmail("sarah.demo@trustcircle.example");
    if (!margaret || !sarah) throw new Error("Run `npm run seed` first");
    const now = Date.now();
    const ago = (weeks: number, days = 0) => new Date(now - weeks * WEEK - days * 86_400_000);

    const history: { n: number; payee: string; cents: number; state: "paid_out" | "voided"; risk: "low" | "medium" | "high"; scamType: ScamType; reasons: string[]; at: Date; block?: boolean; expire?: boolean }[] = [
      { n: 1, payee: "pharmacy@greenleaf-pharmacy.example", cents: 4250, state: "paid_out", risk: "low", scamType: "none", reasons: [], at: ago(9, 2) },
      { n: 2, payee: "church.office@stmarks.example", cents: 2500, state: "paid_out", risk: "low", scamType: "none", reasons: [], at: ago(7, 1) },
      { n: 3, payee: "+1 212 555 0178", cents: 120000, state: "voided", risk: "high", scamType: "impersonation_family", reasons: ["Someone claiming to be family asked for money urgently.", "You have not paid this person before."], at: ago(6, 3), block: true },
      { n: 4, payee: "lawncare.bob@example.com", cents: 6000, state: "paid_out", risk: "low", scamType: "none", reasons: [], at: ago(5, 2) },
      { n: 5, payee: "support.refunds@paypa1-help.example", cents: 49900, state: "voided", risk: "high", scamType: "impersonation_organisation", reasons: ["Real support teams never ask you to send money back."], at: ago(3, 4), block: true },
      { n: 6, payee: "book.club.fund@example.com", cents: 1500, state: "paid_out", risk: "low", scamType: "none", reasons: [], at: ago(2, 1) },
      { n: 7, payee: "winner.claims@lotto-intl.example", cents: 35000, state: "voided", risk: "high", scamType: "prize_or_lottery", reasons: ["A real prize never needs a fee first."], at: ago(1, 5), expire: true },
      { n: 8, payee: "vet.clinic@example.com", cents: 32000, state: "paid_out", risk: "medium", scamType: "none", reasons: ["This is more than you usually send."], at: ago(0, 2) },
    ];
    for (const h of history) {
      await db.insert(payments).values({
        id: id(h.n), senderId: margaret.id, payee: h.payee, amountCents: h.cents, note: null, senderAnswer: null, state: h.state,
        riskLevel: h.risk, scamType: h.scamType, reasons: h.reasons, impersonatedRequester: null,
        createdAt: h.at, updatedAt: h.at,
      }).onConflictDoNothing();
      if (h.block) {
        await db.insert(auditLog).values({ id: id(100 + h.n), paymentId: id(h.n), actorId: sarah.id, action: "BLOCK", fromState: "held", toState: "blocked", detail: { demo: true }, createdAt: h.at }).onConflictDoNothing();
      }
      if (h.expire) {
        await db.insert(auditLog).values({ id: id(100 + h.n), paymentId: id(h.n), actorId: null, action: "EXPIRE", fromState: "held", toState: "expired", detail: { demo: true }, createdAt: h.at }).onConflictDoNothing();
      }
    }

    const reporters = [];
    for (let r = 1; r <= 6; r++) {
      await db.insert(users).values({ id: id(200 + r), email: `demo.reporter${r}@trustcircle.example`, displayName: `Demo reporter ${r}` }).onConflictDoNothing();
      reporters.push(id(200 + r));
    }
    const types: ScamType[] = ["impersonation_family", "impersonation_organisation", "invoice", "tech_support", "romance", "prize_or_lottery"];
    let n = 0;
    for (let week = 11; week >= 0; week--) {
      // A rising family-impersonation wave over the last month, steady others: invented, for the chart.
      const perWeek = week < 4 ? 5 : 3;
      for (let k = 0; k < perWeek && n < 40; k++, n++) {
        const scamType = week < 4 && k < 3 ? "impersonation_family" : types[(week + k) % types.length]!;
        const entryId = id(300 + n);
        await db.insert(registryEntries).values({ id: entryId, identifierType: "phone", key: `555${String(1000000 + n).slice(-7)}`, scamType, status: "unconfirmed" }).onConflictDoNothing();
        await db.insert(registryReports).values({ id: id(400 + n), entryId, reporterId: reporters[(n + k) % reporters.length]!, source: "message_report", createdAt: ago(week, k % 5) }).onConflictDoNothing();
      }
    }
    // Keep Sarah in Margaret's circle even if the base seed changes.
    await db.insert(trustLinks).values({ senderId: margaret.id, contactId: sarah.id, relationship: "daughter" }).onConflictDoNothing();
    console.log(`Demo history ready: ${history.length} payments, ${n} registry reports`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error("seed:history failed:", e instanceof Error ? e.message : "unknown");
  process.exit(1);
});
