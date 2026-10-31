import { execFileSync } from "node:child_process";

export const SCRIPT =
  "Hi Gran, it's Daniel. I've lost my phone and I'm in real trouble. Please send eight hundred dollars to my PayPal, danny dot help at example dot com, today. Don't tell Mum.";

function main() {
  if (process.platform !== "darwin") throw new Error("make-fixture-audio needs macOS (the say command)");
  execFileSync("say", ["-v", "Samantha", "-o", "fixtures/scam-voice.m4a", "--file-format=m4af", "--data-format=aac", SCRIPT]);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(1);
}
