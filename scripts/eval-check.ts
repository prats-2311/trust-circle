import { readFileSync } from "node:fs";
import { checkFacts } from "../src/eval/factsCheck";

const read = (p: string) => readFileSync(p, "utf8");
const problems = checkFacts(read("docs/eval/results.md"), {
  "README.md": read("README.md"),
  "docs/submission.md": read("docs/submission.md"),
});
if (problems.length) {
  for (const p of problems) console.error(`eval:check: ${p}`);
  process.exit(1);
}
console.log("eval:check: README and submission match docs/eval/results.md");
