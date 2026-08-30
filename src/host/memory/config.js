import z from "@deepseek-ai/schemastery";

export const MEMORY_SETTINGS_NS = "dsh-project-brain";

export const Config = z.object({
  retrievalMode: z.union(["keyword", "hybrid"]).default("hybrid"),
  vectorEnabled: z.boolean().default(false),
  embeddingBaseURL: z.string().default(""),
  embeddingModel: z.string().default(""),
  embeddingApiKeyEnv: z.string().role("credential-ref").default("PROJECT_BRAIN_EMBEDDING_API_KEY"),
  embeddingDimensions: z.number().step(1).min(0).default(0),
  embeddingBatchSize: z.number().step(1).min(1).max(128).default(16),
  embeddingMaxIndexPerRun: z.number().step(1).min(1).max(500).default(64),
  embeddingTimeoutMs: z.number().step(1).min(1000).max(120000).default(20000),
  keywordWeight: z.number().min(0).max(1).default(0.45),
  vectorWeight: z.number().min(0).max(1).default(0.35),
  importanceWeight: z.number().min(0).max(1).default(0.1),
  confidenceWeight: z.number().min(0).max(1).default(0.05),
  recencyWeight: z.number().min(0).max(1).default(0.05),
});

export function normalizeMemoryConfig(value) {
  const input = value && typeof value === "object" ? value : {};
  const num = (key, fallback, min, max) => {
    const raw = Number(input[key]);
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
  };
  const integer = (key, fallback, min, max) => Math.round(num(key, fallback, min, max));
  return Object.freeze({
    retrievalMode: input.retrievalMode === "keyword" ? "keyword" : "hybrid",
    vectorEnabled: input.vectorEnabled === true,
    embeddingBaseURL: typeof input.embeddingBaseURL === "string" ? input.embeddingBaseURL.trim() : "",
    embeddingModel: typeof input.embeddingModel === "string" ? input.embeddingModel.trim() : "",
    embeddingApiKeyEnv: typeof input.embeddingApiKeyEnv === "string" ? input.embeddingApiKeyEnv.trim() : "PROJECT_BRAIN_EMBEDDING_API_KEY",
    embeddingDimensions: Number.isSafeInteger(input.embeddingDimensions) && input.embeddingDimensions > 0 ? input.embeddingDimensions : null,
    embeddingBatchSize: integer("embeddingBatchSize", 16, 1, 128),
    embeddingMaxIndexPerRun: integer("embeddingMaxIndexPerRun", 64, 1, 500),
    embeddingTimeoutMs: integer("embeddingTimeoutMs", 20000, 1000, 120000),
    keywordWeight: num("keywordWeight", 0.45, 0, 1),
    vectorWeight: num("vectorWeight", 0.35, 0, 1),
    importanceWeight: num("importanceWeight", 0.1, 0, 1),
    confidenceWeight: num("confidenceWeight", 0.05, 0, 1),
    recencyWeight: num("recencyWeight", 0.05, 0, 1),
  });
}

export function publicMemoryConfig(config) {
  const c = normalizeMemoryConfig(config);
  const configured = Boolean(c.vectorEnabled && c.embeddingBaseURL && c.embeddingModel);
  return {
    requestedMode: c.retrievalMode,
    configuredMode: configured && c.retrievalMode === "hybrid" ? "hybrid" : "keyword",
    fallbackMode: "keyword",
    vectorEnabled: c.vectorEnabled,
    vectorConfigured: configured,
    embeddingModel: c.embeddingModel || null,
    embeddingDimensions: c.embeddingDimensions,
  };
}

export function createMemoryConfigRuntime(ctx, entryConfig) {
  let current = normalizeMemoryConfig(entryConfig);
  let credentials = null;

  if (ctx && typeof ctx.inject === "function") {
    try {
      ctx.inject(["settings"], (settingsCtx) => {
        let settings;
        try { settings = settingsCtx.get ? settingsCtx.get("settings") : settingsCtx.settings; } catch (e) { settings = null; }
        if (!settings || typeof settings.register !== "function") return;
        const scope = settings.register(MEMORY_SETTINGS_NS, Config, { base: entryConfig || {} });
        try { current = normalizeMemoryConfig(scope.get()); } catch (e) {}
        if (scope && typeof scope.watch === "function") {
          scope.watch((next) => { current = normalizeMemoryConfig(next); });
        }
      });
    } catch (e) {}

    try {
      ctx.inject(["credentials"], (credentialsCtx) => {
        try { credentials = credentialsCtx.get ? credentialsCtx.get("credentials") : credentialsCtx.credentials; } catch (e) { credentials = null; }
        if (credentialsCtx && typeof credentialsCtx.effect === "function") {
          try { credentialsCtx.effect(() => { credentials = null; }, "dsh-project-brain:credentials"); } catch (e) {}
        }
      });
    } catch (e) {}
  }

  return {
    get: () => current,
    async resolveCredential(ref) {
      if (!ref) return null;
      if (credentials && typeof credentials.resolve === "function") {
        try {
          const hit = await credentials.resolve(ref);
          if (hit && typeof hit.value === "string" && hit.value.trim()) return hit.value.trim();
        } catch (e) {}
      }
      const value = typeof process !== "undefined" && process.env ? process.env[ref] : null;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    },
  };
}
