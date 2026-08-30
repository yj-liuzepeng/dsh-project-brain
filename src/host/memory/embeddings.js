import { createHash } from "node:crypto";
import { brainPath, readJsonl, writeJsonl } from "../store/brain-files.js";
import { activeMemories, memoryDocument } from "./retrieval.js";

const CACHE_FILE = "cache/embeddings.jsonl";

export function embeddingContentHash(memory) {
  return createHash("sha256").update(memoryDocument(memory), "utf8").digest("hex");
}

export function embeddingModelKey(config) {
  return [config.embeddingBaseURL || "", config.embeddingModel || "", config.embeddingDimensions || "auto"].join("|");
}

function embeddingEndpoint(baseURL) {
  const base = String(baseURL || "").replace(/\/+$/, "");
  return /\/embeddings$/i.test(base) ? base : base + "/embeddings";
}

function validVector(value) {
  return Array.isArray(value) && value.length > 0 && value.every((n) => Number.isFinite(Number(n)));
}

export async function fetchEmbeddings({ texts, config, apiKey, signal, fetchImpl = fetch }) {
  if (!config.embeddingBaseURL || !config.embeddingModel) {
    const error = new Error("Embedding endpoint or model is not configured");
    error.code = "EMBEDDING_NOT_CONFIGURED";
    throw error;
  }
  const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(config.embeddingTimeoutMs || 20000)
    : undefined;
  const combinedSignal = signal && timeoutSignal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, timeoutSignal])
    : signal || timeoutSignal;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  const body = { model: config.embeddingModel, input: texts };
  if (config.embeddingDimensions) body.dimensions = config.embeddingDimensions;
  const response = await fetchImpl(embeddingEndpoint(config.embeddingBaseURL), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: combinedSignal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error("Embedding API error " + response.status + (detail ? ": " + detail.slice(0, 160) : ""));
    error.code = "EMBEDDING_API_ERROR";
    throw error;
  }
  const payload = await response.json();
  const data = payload && Array.isArray(payload.data) ? payload.data.slice().sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
  const vectors = data.map((item) => item && item.embedding);
  if (vectors.length !== texts.length || vectors.some((vector) => !validVector(vector))) {
    const error = new Error("Embedding API returned invalid vectors");
    error.code = "EMBEDDING_INVALID_RESPONSE";
    throw error;
  }
  const dimensions = vectors[0].length;
  if (vectors.some((vector) => vector.length !== dimensions)) {
    const error = new Error("Embedding API returned inconsistent dimensions");
    error.code = "EMBEDDING_DIMENSION_MISMATCH";
    throw error;
  }
  return vectors.map((vector) => vector.map(Number));
}

async function readCache(fs, projectPath) {
  try { return await readJsonl(fs, brainPath(projectPath, CACHE_FILE)); } catch (e) { return []; }
}

export async function ensureEmbeddingIndex({ fs, projectPath, memories, config, resolveCredential, signal, fetchImpl } = {}) {
  const active = activeMemories(memories);
  const modelKey = embeddingModelKey(config);
  const rows = await readCache(fs, projectPath);
  const currentById = new Map();
  for (const row of rows) {
    if (!row || row.modelKey !== modelKey || !validVector(row.vector)) continue;
    currentById.set(row.memoryId, row);
  }
  const pending = active.filter((memory) => {
    const row = currentById.get(memory.id);
    return !row || row.contentHash !== embeddingContentHash(memory);
  });
  const limit = Math.min(pending.length, config.embeddingMaxIndexPerRun || 64);
  const toIndex = pending.slice(0, limit);
  let error = null;
  let indexedNow = 0;

  if (toIndex.length > 0) {
    try {
      const apiKey = config.embeddingApiKeyEnv && resolveCredential
        ? await resolveCredential(config.embeddingApiKeyEnv)
        : null;
      if (config.embeddingApiKeyEnv && !apiKey) {
        const missing = new Error("Embedding credential is not configured: " + config.embeddingApiKeyEnv);
        missing.code = "EMBEDDING_CREDENTIAL_MISSING";
        throw missing;
      }
      const batchSize = config.embeddingBatchSize || 16;
      for (let offset = 0; offset < toIndex.length; offset += batchSize) {
        const batch = toIndex.slice(offset, offset + batchSize);
        const vectors = await fetchEmbeddings({
          texts: batch.map(memoryDocument),
          config,
          apiKey,
          signal,
          fetchImpl,
        });
        batch.forEach((memory, index) => {
          currentById.set(memory.id, {
            memoryId: memory.id,
            contentHash: embeddingContentHash(memory),
            modelKey,
            model: config.embeddingModel,
            dimensions: vectors[index].length,
            vector: vectors[index],
            updatedAt: Date.now(),
          });
          indexedNow += 1;
        });
      }
    } catch (caught) {
      error = caught;
    }
  }

  if (indexedNow > 0) {
    const activeIds = new Set(active.map((memory) => memory.id));
    const wrote = await writeJsonl(fs, brainPath(projectPath, CACHE_FILE), [...currentById.values()].filter((row) => activeIds.has(row.memoryId)));
    if (!wrote && !error) {
      error = Object.assign(new Error("Embedding cache could not be written"), { code: "EMBEDDING_CACHE_WRITE_FAILED" });
    }
  }

  const vectors = new Map();
  for (const memory of active) {
    const row = currentById.get(memory.id);
    if (row && row.contentHash === embeddingContentHash(memory)) vectors.set(memory.id, row.vector);
  }
  return {
    vectors,
    indexed: vectors.size,
    total: active.length,
    indexedNow,
    pending: Math.max(0, active.length - vectors.size),
    error: error ? { code: error.code || "EMBEDDING_FAILED", message: String(error.message || error) } : null,
    model: config.embeddingModel,
    dimensions: vectors.size ? vectors.values().next().value.length : config.embeddingDimensions,
  };
}

export async function embedQuery({ query, config, resolveCredential, signal, fetchImpl } = {}) {
  const apiKey = config.embeddingApiKeyEnv && resolveCredential
    ? await resolveCredential(config.embeddingApiKeyEnv)
    : null;
  if (config.embeddingApiKeyEnv && !apiKey) {
    const error = new Error("Embedding credential is not configured: " + config.embeddingApiKeyEnv);
    error.code = "EMBEDDING_CREDENTIAL_MISSING";
    throw error;
  }
  return (await fetchEmbeddings({ texts: [query], config, apiKey, signal, fetchImpl }))[0];
}
