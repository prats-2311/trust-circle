import { execSync } from "node:child_process";
import { resetRefusal } from "../src/server/resetGuard";

export default function globalSetup() {
  const refusal = resetRefusal(process.env);
  if (refusal) throw new Error(refusal);
  execSync("npm run demo:reset", { stdio: "inherit" });
}
