import z from "@deepseek-ai/schemastery";

export const MEMORY_SETTINGS_NS = "dsh-project-brain";

export const Config = z.object({
  retrievalMode: z.union(["keyword", "hybrid"]).default("hybrid"),
  vectorEnabled: z.boolean().default(false),
  embeddingBaseURL: z.string().default(""),
  embeddingModel: z.string().default(""),
  embeddingApiKeyEnv: z.string().default("PROJECT_BRAIN_EMBEDDING_API_KEY"),
  embeddingDimensions: z.number().step(1).min(0).default(0),
  embeddingBatchSize: z.number().step(1).min(1).max(128).default(16),
  embeddingMaxIndexPerRun: z.number().step(1).min(1).max(500).default(64),
  embeddingTimeoutMs: z.number().step(1).min(1000).max(120000).default(20000),
  keywordWeight: z.number().min(0).max(1).default(0.15),
  vectorWeight: z.number().min(0).max(1).default(0.25),
  importanceWeight: z.number().min(0).max(1).default(0.30),
  confidenceWeight: z.number().min(0).max(1).default(0.10),
  recencyWeight: z.number().min(0).max(1).default(0.20),
  sessionSemanticMemoryEnabled: z.boolean().default(true),
  sessionSemanticMaxChars: z.number().step(1).min(2000).max(40000).default(16000),
  sessionSemanticMaxItems: z.number().step(1).min(1).max(8).default(4),
  sessionSemanticTimeoutMs: z.number().step(1).min(5000).max(120000).default(30000),
  architectureEnabled: z.boolean().default(true),
  architectureLlmEnabled: z.boolean().default(true),
  architectureLlmIncludeSource: z.boolean().default(true),
  architectureMaxFiles: z.number().step(1).min(20).max(1000).default(240),
  architectureMaxNodes: z.number().step(1).min(6).max(60).default(24),
  architectureLlmTimeoutMs: z.number().step(1).min(5000).max(120000).default(60000),
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
    keywordWeight: num("keywordWeight", 0.15, 0, 1),
    vectorWeight: num("vectorWeight", 0.25, 0, 1),
    importanceWeight: num("importanceWeight", 0.30, 0, 1),
    confidenceWeight: num("confidenceWeight", 0.10, 0, 1),
    recencyWeight: num("recencyWeight", 0.20, 0, 1),
    sessionSemanticMemoryEnabled: input.sessionSemanticMemoryEnabled !== false,
    sessionSemanticMaxChars: integer("sessionSemanticMaxChars", 16000, 2000, 40000),
    sessionSemanticMaxItems: integer("sessionSemanticMaxItems", 4, 1, 8),
    sessionSemanticTimeoutMs: integer("sessionSemanticTimeoutMs", 30000, 5000, 120000),
    architectureEnabled: input.architectureEnabled !== false,
    architectureLlmEnabled: input.architectureLlmEnabled !== false,
    architectureLlmIncludeSource: input.architectureLlmIncludeSource !== false,
    architectureMaxFiles: integer("architectureMaxFiles", 240, 20, 1000),
    architectureMaxNodes: integer("architectureMaxNodes", 24, 6, 60),
    architectureLlmTimeoutMs: integer("architectureLlmTimeoutMs", 60000, 5000, 120000),
  });
}

// 全大写蛇形（如 PROJECT_BRAIN_EMBEDDING_API_KEY）当环境变量/凭据名；
// 其余（方舟 UUID、sk-…）当直接填写的 API Key。
export function isEmbeddingEnvRef(value) {
  return /^[A-Z][A-Z0-9_]{2,127}$/.test(String(value || "").trim());
}

export function redactSecret(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (isEmbeddingEnvRef(s)) return s;
  if (s.length <= 8) return "••••";
  return "••••" + s.slice(-4);
}

export async function resolveEmbeddingApiKey(ref, resolveCredential) {
  const s = String(ref || "").trim();
  if (!s) return null;
  if (!isEmbeddingEnvRef(s)) return s;
  if (typeof resolveCredential === "function") {
    try {
      const hit = await resolveCredential(s);
      if (typeof hit === "string" && hit.trim()) return hit.trim();
    } catch (e) {}
  }
  return null;
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
    sessionSemanticMemory: {
      enabled: c.sessionSemanticMemoryEnabled,
      maxChars: c.sessionSemanticMaxChars,
      maxItems: c.sessionSemanticMaxItems,
    },
    architecture: {
      enabled: c.architectureEnabled,
      llmEnabled: c.architectureLlmEnabled,
      llmIncludeSource: c.architectureLlmIncludeSource,
      maxFiles: c.architectureMaxFiles,
      maxNodes: c.architectureMaxNodes,
    },
  };
}

export function createMemoryConfigRuntime(ctx, entryConfig) {
  let current = normalizeMemoryConfig(entryConfig);
  let credentials = null;
  let settingsService = null;
  let settingsScope = null;

  if (ctx && typeof ctx.inject === "function") {
    try {
      ctx.inject(["settings"], (settingsCtx) => {
        let settings;
        try { settings = settingsCtx.get ? settingsCtx.get("settings") : settingsCtx.settings; } catch (e) { settings = null; }
        if (!settings || typeof settings.register !== "function") return;
        settingsService = settings;
        settingsScope = settings.register(MEMORY_SETTINGS_NS, Config, { base: entryConfig || {} });
        try { current = normalizeMemoryConfig(settingsScope.get()); } catch (e) {}
        if (settingsScope && typeof settingsScope.watch === "function") {
          settingsScope.watch((next) => { current = normalizeMemoryConfig(next); });
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
    getSettingsService: () => settingsService,
    getSettingsScope: () => settingsScope,
    settingsWritable: () => {
      try {
        return !!(settingsService && settingsService.writable !== false && typeof settingsService.update === "function");
      } catch (e) {
        return false;
      }
    },
    async updateSettings(patch) {
      if (!settingsService || typeof settingsService.update !== "function") {
        const error = new Error("settings service unavailable; config is read-only in this runtime");
        error.code = "SETTINGS_UNAVAILABLE";
        throw error;
      }
      if (settingsService.writable === false) {
        const error = new Error("settings provider is read-only");
        error.code = "SETTINGS_READONLY";
        throw error;
      }
      // update = merge patch into user layer, validate, persist, commit, emit.
      // scope.watch 已在注册时挂上，commit 后会自动把 current 刷成新值。
      await settingsService.update(MEMORY_SETTINGS_NS, patch);
      return normalizeMemoryConfig(settingsService.get(MEMORY_SETTINGS_NS));
    },
    async resolveCredential(ref) {
      return resolveEmbeddingApiKey(ref, async (name) => {
        if (credentials && typeof credentials.resolve === "function") {
          try {
            const hit = await credentials.resolve(name);
            if (hit && typeof hit.value === "string" && hit.value.trim()) return hit.value.trim();
          } catch (e) {}
        }
        const value = typeof process !== "undefined" && process.env ? process.env[name] : null;
        return typeof value === "string" && value.trim() ? value.trim() : null;
      });
    },
  };
}
