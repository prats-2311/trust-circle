import path from "node:path";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMS = 384;

/** Turns texts into unit-length meaning-vectors, one per text. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

type FeatureExtractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/** Models live inside the project so a build can download them once and the running server finds them. */
export const TRANSFORMERS_CACHE_DIR = path.join(process.cwd(), ".cache", "transformers");

/** Loads the model library with its cache directory set. scripts/prefetch-model.mjs must use the same directory. */
export async function loadTransformers() {
  const mod = await import("@huggingface/transformers");
  mod.env.cacheDir = TRANSFORMERS_CACHE_DIR;
  return mod;
}

/**
 * Runs the model inside this process: no external service. The first call downloads (23 MB, cached)
 * and loads it, which takes a few seconds; later calls take milliseconds.
 */
export function createLocalEmbedder(opts: { model?: string } = {}): Embedder {
  let extractor: Promise<FeatureExtractor> | undefined;
  const load = () => {
    extractor ??= loadTransformers().then(
      ({ pipeline }) => pipeline("feature-extraction", opts.model ?? EMBEDDING_MODEL, { dtype: "q8" }) as unknown as Promise<FeatureExtractor>,
    );
    return extractor;
  };
  return async (texts) => {
    if (texts.length === 0) return [];
    try {
      const fe = await load();
      return (await fe(texts, { pooling: "mean", normalize: true })).tolist();
    } catch (e) {
      extractor = undefined; // retry the load next time
      throw e;
    }
  };
}

declare global {
  var __tcEmbedder: Embedder | undefined;
}

/** One embedder per process, so the model loads once however many times the container is built. */
export function getEmbedder(): Embedder {
  globalThis.__tcEmbedder ??= createLocalEmbedder();
  return globalThis.__tcEmbedder;
}
