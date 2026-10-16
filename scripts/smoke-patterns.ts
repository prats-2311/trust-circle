import { createLocalEmbedder } from "../src/patterns/embedder";
import { createMemoryPatternRepo } from "../src/patterns/patternRepo";
import { createPatternService } from "../src/patterns/patternService";

const patterns = [
  { description: "caller claims to be a grandchild in custody and asks for bail money to be sent urgently and kept secret", scamType: "impersonation_family" as const },
  { description: "message claims an account is limited and asks the person to log in through a link to verify their identity", scamType: "impersonation_organisation" as const },
  { description: "supplier says their bank details changed and asks for an overdue invoice to be paid to a new account", scamType: "invoice" as const },
];
const probes: [string, boolean][] = [
  ["Grandma it's me, I got arrested and need money for a lawyer today, please don't tell mom", true],
  ["Your nephew was in a car accident and is being held, we need $2000 for his release, he asked you not to tell anyone", true],
  ["Your PayPal account has been suspended. Confirm your details at the link within 24 hours", true],
  ["Please note our banking information has been updated, kindly settle INV-77 to the account below", true],
  ["Hi Mom, landed safely, will call after dinner", false],
  ["Your prescription is ready for pickup at the Main St store", false],
  ["Book club is at Linda's house Thursday, bring your copy", false],
  ["Thanks for your payment of $450, receipt 88213", false],
];

async function main() {
  const service = createPatternService({ repo: createMemoryPatternRepo(), embed: createLocalEmbedder() });
  for (const p of patterns) await service.add(p);
  let wrong = 0;
  for (const [text, scam] of probes) {
    const m = await service.match(text);
    const ok = Boolean(m) === scam;
    if (!ok) wrong += 1;
    console.log(`${ok ? "ok  " : "MISS"} ${scam ? "scam   " : "genuine"} ${m ? m.similarity.toFixed(3) : "-"}`);
  }
  console.log(wrong === 0 ? "PASS" : `FAIL (${wrong} wrong)`);
  process.exitCode = wrong === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
});
