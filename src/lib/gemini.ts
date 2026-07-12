import { GoogleGenAI } from "@google/genai";
import type { Schema } from "@google/genai";

/**
 * Model tiers. Each entry is a fallback list tried in order: if a model is
 * rate-limited (429) or overloaded (503), we back off, retry, then step down
 * to the next model. Names verified against the live free-tier key; the
 * `*-latest` aliases are last-resort fallbacks that can drift.
 */
export const MODELS = {
  fast: ["gemini-3.1-flash-lite", "gemini-flash-latest"],
  strong: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-pro-latest"],
} as const;

/** Embedding models, best-effort. Callers must tolerate a null result. */
const EMBEDDING_MODELS = ["gemini-embedding-001", "text-embedding-004"];

const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES_PER_MODEL = 2;
const BASE_BACKOFF_MS = 600;

let cached: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  cached ??= new GoogleGenAI({ apiKey });
  return cached;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Best-effort extraction of an HTTP-ish status code from an SDK error. */
function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e.status === "number") return e.status;
    if (typeof e.code === "number") return e.code;
  }
  const match = String((err as Error)?.message ?? err).match(/\b(429|500|503)\b/);
  return match ? Number(match[1]) : null;
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== null && RETRYABLE_STATUS.has(status)) return true;
  const message = String((err as Error)?.message ?? err).toLowerCase();
  return /resource_exhausted|unavailable|overloaded|rate limit|try again/.test(message);
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run `fn` against each model in turn. Retryable failures back off and retry a
 * few times on the same model, then step down to the next; non-retryable
 * failures surface immediately.
 */
async function callWithFallback<T>(
  models: readonly string[],
  fn: (model: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        return await fn(model);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw err;
        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        // exhausted retries on this model — fall through to the next one
      }
    }
  }

  throw new Error(`all models exhausted (${models.join(", ")}): ${describe(lastError)}`);
}

interface GenerateJsonOptions {
  models: readonly string[];
  system?: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
}

/** Generate a JSON value constrained to `schema`, parsed and typed by the caller. */
export async function generateJson<T>(opts: GenerateJsonOptions): Promise<T> {
  const ai = getClient();

  const text = await callWithFallback(opts.models, async (model) => {
    const res = await ai.models.generateContent({
      model,
      contents: opts.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        temperature: opts.temperature ?? 0.2,
        ...(opts.system ? { systemInstruction: opts.system } : {}),
      },
    });
    const out = res.text;
    if (!out) throw new Error("model returned an empty response");
    return out;
  });

  return JSON.parse(text) as T;
}

/**
 * Embed texts, returning one vector per input. Returns null on any failure so
 * callers can degrade gracefully rather than fail the whole run.
 */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT",
): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const ai = getClient();

  try {
    return await callWithFallback(EMBEDDING_MODELS, async (model) => {
      const res = await ai.models.embedContent({
        model,
        contents: texts,
        config: { taskType },
      });
      const vectors = res.embeddings?.map((e) => e.values ?? []);
      if (!vectors || vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
        throw new Error("incomplete embedding response");
      }
      return vectors;
    });
  } catch {
    return null;
  }
}
