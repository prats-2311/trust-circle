export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmUp } = await import("./server/warmup");
    await warmUp();
  }
}
