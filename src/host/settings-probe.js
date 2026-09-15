import { isEmbeddingEnvRef, normalizeMemoryConfig, redactSecret, resolveEmbeddingApiKey } from "./memory/config.js";
import { embeddingEndpoint, fetchEmbeddings } from "./memory/embeddings.js";
import { streamLlmText } from "./architecture/analyzer.js";

function fail(code, message, details) {
  return { ok: false, code, message, details: details || {} };
}

function ok(message, details) {
  return { ok: true, code: "OK", message, details: details || {} };
}

export async function probeEmbedding({ config, resolveCredential, fetchImpl, signal } = {}) {
  const cfg = normalizeMemoryConfig(config);
  const endpoint = cfg.embeddingBaseURL ? embeddingEndpoint(cfg.embeddingBaseURL) : "";
  const model = cfg.embeddingModel || "";
  if (!cfg.vectorEnabled) {
    return fail("EMBEDDING_DISABLED", "向量检索未启用，打开开关后再测", { endpoint, model });
  }
  if (!cfg.embeddingBaseURL || !cfg.embeddingModel) {
    return fail("EMBEDDING_NOT_CONFIGURED", "需要同时填写 Embedding 地址和模型名", { endpoint, model });
  }
  let apiKey = null;
  if (cfg.embeddingApiKeyEnv) {
    apiKey = await resolveEmbeddingApiKey(cfg.embeddingApiKeyEnv, resolveCredential);
    if (!apiKey) {
      const shown = isEmbeddingEnvRef(cfg.embeddingApiKeyEnv) ? cfg.embeddingApiKeyEnv : redactSecret(cfg.embeddingApiKeyEnv);
      return fail("EMBEDDING_CREDENTIAL_MISSING", isEmbeddingEnvRef(cfg.embeddingApiKeyEnv)
        ? ("本机没有环境变量 " + shown + "。请在系统或用户环境变量中配置同名项并完全重启 DSH Desktop，或改为直接填写 API Key。")
        : "未解析到密钥，请直接填写 API Key。", {
        endpoint,
        model,
        envName: isEmbeddingEnvRef(cfg.embeddingApiKeyEnv) ? cfg.embeddingApiKeyEnv : undefined,
      });
    }
  }
  const started = Date.now();
  try {
    const vectors = await fetchEmbeddings({
      texts: ["project-brain connectivity probe"],
      config: cfg,
      apiKey,
      signal,
      fetchImpl,
    });
    const dimensions = vectors[0].length;
    const details = { endpoint, model, dimensions, latencyMs: Date.now() - started };
    if (cfg.embeddingDimensions && dimensions !== cfg.embeddingDimensions) {
      return fail(
        "EMBEDDING_DIMENSION_MISMATCH",
        "返回维度 " + dimensions + " 与配置 " + cfg.embeddingDimensions + " 不一致",
        Object.assign({}, details, { expected: cfg.embeddingDimensions }),
      );
    }
    return ok("向量连通，维度 " + dimensions, details);
  } catch (error) {
    return fail(
      (error && error.code) || "EMBEDDING_FAILED",
      String((error && error.message) || error),
      { endpoint, model, latencyMs: Date.now() - started },
    );
  }
}

export async function probeSessionLlm({ llm, route, sessionId, timeoutMs } = {}) {
  if (!llm || typeof llm.stream !== "function") {
    return fail("LLM_SERVICE_UNAVAILABLE", "DSH 未把模型服务暴露给项目脑", {});
  }
  if (!route || !route.provider || !route.model) {
    return fail("LLM_SESSION_ROUTE_UNAVAILABLE", "当前会话还没有模型路由，先发一条消息后再测", {});
  }
  const started = Date.now();
  const detailsBase = { provider: route.provider, model: route.model };
  try {
    const text = await streamLlmText(
      llm,
      route,
      "Reply with exactly the word PONG and nothing else.",
      sessionId,
      timeoutMs || 12000,
      {
        system: "You are a connectivity probe. Reply with exactly PONG.",
        maxTokens: 16,
        purpose: "project-brain-probe",
        temperature: 0,
      },
    );
    return ok("LLM 连通 " + route.provider + "/" + route.model, Object.assign({}, detailsBase, {
      latencyMs: Date.now() - started,
      sample: String(text || "").slice(0, 80),
    }));
  } catch (error) {
    return fail(
      (error && error.code) || "LLM_FAILED",
      String((error && error.message) || error),
      Object.assign({}, detailsBase, { latencyMs: Date.now() - started }),
    );
  }
}
