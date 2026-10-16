export async function register(): Promise<void> {
  // Server start only. `next build` also runs register() in some modes, and the build may have no
  // secrets, so skip that phase. This never opens a database connection.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { loadEnvSafe } = await import("./config/env");
  try {
    for (const warning of loadEnvSafe(process.env).warnings) console.warn("config", warning);
  } catch (e) {
    console.error("config", e instanceof Error ? e.message : "invalid environment");
    throw e;
  }
  const { warmUp } = await import("./server/warmup");
  await warmUp();
}
