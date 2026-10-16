// Downloads the embedding model during the build so the first message check never waits for it.
// Cache directory, model and dtype must match src/patterns/embedder.ts.
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";

env.cacheDir = path.join(process.cwd(), ".cache", "transformers");

try {
  await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  console.log("prefetch-model: model cached in", env.cacheDir);
} catch (e) {
  // The model also downloads on first use, so a failed prefetch must not fail the build.
  console.warn("prefetch-model: skipped:", e instanceof Error ? e.message : "unknown");
}
