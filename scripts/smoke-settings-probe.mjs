import assert from "node:assert/strict";
import { probeEmbedding, probeSessionLlm } from "../src/host/settings-probe.js";
import { isEmbeddingEnvRef, normalizeMemoryConfig, resolveEmbeddingApiKey } from "../src/host/memory/config.js";
import { registerConnectionRpc } from "../src/host/rpc/sidebar.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  PASS  " + name);
}

check("大写蛇形是环境变量名，UUID/sk- 是直接密钥", () => {
  assert.equal(isEmbeddingEnvRef("PROJECT_BRAIN_EMBEDDING_API_KEY"), true);
  assert.equal(isEmbeddingEnvRef("ARK_API_KEY"), true);
  assert.equal(isEmbeddingEnvRef("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), false);
  assert.equal(isEmbeddingEnvRef("sk-abc"), false);
});

const inlineResolved = await resolveEmbeddingApiKey("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", async () => {
  throw new Error("inline key must not look up env");
});
const envMiss = await resolveEmbeddingApiKey("ARK_API_KEY", async () => null);
const envHit = await resolveEmbeddingApiKey("ARK_API_KEY", async () => "from-env");
check("resolveEmbeddingApiKey：直填 key 原样返回，变量名才去解析", () => {
  assert.equal(inlineResolved, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.equal(envMiss, null);
  assert.equal(envHit, "from-env");
});

const disabled = await probeEmbedding({ config: { vectorEnabled: false, embeddingBaseURL: "https://example.test/v1", embeddingModel: "m" } });
check("向量关闭时探测失败且不发请求", () => {
  assert.equal(disabled.ok, false);
  assert.equal(disabled.code, "EMBEDDING_DISABLED");
});

const missingEndpoint = await probeEmbedding({
  config: { vectorEnabled: true, retrievalMode: "hybrid", embeddingBaseURL: "", embeddingModel: "m", embeddingApiKeyEnv: "" },
});
check("缺地址时探测失败", () => {
  assert.equal(missingEndpoint.ok, false);
  assert.equal(missingEndpoint.code, "EMBEDDING_NOT_CONFIGURED");
});

const missingKey = await probeEmbedding({
  config: {
    vectorEnabled: true,
    retrievalMode: "hybrid",
    embeddingBaseURL: "https://example.test/v1",
    embeddingModel: "embed",
    embeddingApiKeyEnv: "PROJECT_BRAIN_EMBEDDING_API_KEY",
  },
  resolveCredential: async () => null,
});
check("环境变量名解析不到密钥时失败", () => {
  assert.equal(missingKey.ok, false);
  assert.equal(missingKey.code, "EMBEDDING_CREDENTIAL_MISSING");
  assert.equal(missingKey.details && missingKey.details.envName, "PROJECT_BRAIN_EMBEDDING_API_KEY");
});

const inlineCalls = [];
const inlineProbe = await probeEmbedding({
  config: {
    vectorEnabled: true,
    retrievalMode: "hybrid",
    embeddingBaseURL: "https://example.test/v1",
    embeddingModel: "embed",
    embeddingApiKeyEnv: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  },
  resolveCredential: async () => {
    throw new Error("inline key must not look up env");
  },
  fetchImpl: async (_url, options) => {
    inlineCalls.push(options.headers.Authorization);
    return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [0.1, 0.2] }] }) };
  },
});
check("设置里直接填 UUID key 会带 Bearer 发出", () => {
  assert.equal(inlineProbe.ok, true);
  assert.equal(inlineCalls[0], "Bearer aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  assert.equal(Object.hasOwn(inlineProbe.details || {}, "apiKey"), false);
});

const calls = [];
const okProbe = await probeEmbedding({
  config: {
    vectorEnabled: true,
    retrievalMode: "hybrid",
    embeddingBaseURL: "https://ark.example/api/coding/v3",
    embeddingModel: "doubao-embedding-vision",
    embeddingApiKeyEnv: "PROJECT_BRAIN_EMBEDDING_API_KEY",
    embeddingDimensions: 1024,
  },
  resolveCredential: async (ref) => {
    assert.equal(ref, "PROJECT_BRAIN_EMBEDDING_API_KEY");
    return "ark-secret";
  },
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    const zeros = Array.from({ length: 1024 }, () => 0.01);
    return { ok: true, json: async () => ({ data: [{ index: 0, embedding: zeros }] }) };
  },
});
check("连通成功返回维度和耗时，不写 cache", () => {
  assert.equal(okProbe.ok, true);
  assert.equal(okProbe.code, "OK");
  assert.equal(okProbe.details.dimensions, 1024);
  assert.equal(okProbe.details.model, "doubao-embedding-vision");
  assert.equal(okProbe.details.endpoint, "https://ark.example/api/coding/v3/embeddings");
  assert.equal(typeof okProbe.details.latencyMs, "number");
  assert.equal(JSON.parse(calls[0].options.body).model, "doubao-embedding-vision");
  assert.equal(calls[0].options.headers.Authorization, "Bearer ark-secret");
  assert.equal(Object.hasOwn(okProbe.details, "apiKey"), false);
});

const httpFail = await probeEmbedding({
  config: {
    vectorEnabled: true,
    embeddingBaseURL: "https://example.test/v1",
    embeddingModel: "embed",
    embeddingApiKeyEnv: "",
  },
  fetchImpl: async () => ({ ok: false, status: 404, text: async () => "no such path" }),
});
check("HTTP 失败带上 EMBEDDING_API_ERROR", () => {
  assert.equal(httpFail.ok, false);
  assert.equal(httpFail.code, "EMBEDDING_API_ERROR");
});

const noLlm = await probeSessionLlm({ llm: null, route: { provider: "ark", model: "x" }, sessionId: "s1" });
check("无 LLM 服务时探测失败", () => {
  assert.equal(noLlm.ok, false);
  assert.equal(noLlm.code, "LLM_SERVICE_UNAVAILABLE");
});

const noRoute = await probeSessionLlm({
  llm: { stream() { throw new Error("should not stream"); } },
  route: null,
  sessionId: "s1",
});
check("无会话路由时探测失败", () => {
  assert.equal(noRoute.ok, false);
  assert.equal(noRoute.code, "LLM_SESSION_ROUTE_UNAVAILABLE");
});

const llmOk = await probeSessionLlm({
  llm: {
    stream() {
      return (async function* () {
        yield { type: "text-delta", index: 0, text: "PONG" };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  },
  route: { provider: "volcengine", model: "doubao-seed" },
  sessionId: "s1",
  timeoutMs: 5000,
});
check("LLM 连通成功带回路由信息", () => {
  assert.equal(llmOk.ok, true);
  assert.equal(llmOk.code, "OK");
  assert.equal(llmOk.details.provider, "volcengine");
  assert.equal(llmOk.details.model, "doubao-seed");
  assert.match(String(llmOk.details.sample || ""), /PONG/i);
});

let rpcHandler;
let rpcCredRef = null;
const connection = {
  rpc: {
    handle(_channel, handler) { rpcHandler = handler; },
  },
};
const ctx = {
  sessions: {
    get(id) {
      if (id !== "sid") return null;
      return {
        requestContext() { return { provider: "volcengine", model: "doubao-seed" }; },
        requestHeader() { return { config: { provider: "volcengine", model: "doubao-seed" } }; },
      };
    },
  },
  get(name) { return name === "sessions" ? this.sessions : undefined; },
};
assert.equal(registerConnectionRpc({
  connection,
  ctx,
  fs: { resolve: async (p) => p, readText: async () => null, writeText: async () => true },
  sandboxPolicy: null,
  tools: { execute: async () => ({ ok: true }) },
  getMemoryConfig: () => normalizeMemoryConfig({
    vectorEnabled: true,
    retrievalMode: "hybrid",
    embeddingBaseURL: "https://saved.example/v1",
    embeddingModel: "saved-model",
    embeddingApiKeyEnv: "PROJECT_BRAIN_EMBEDDING_API_KEY",
  }),
  resolveEmbeddingCredential: async (ref) => {
    rpcCredRef = ref;
    return null;
  },
  getLlm: () => ({
    stream() {
      return (async function* () {
        yield { type: "text-delta", index: 0, text: "PONG" };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  }),
}), true);

const rpcEmb = await rpcHandler("settings", {
  sessionId: "sid",
  action: "probe",
  target: "embedding",
  config: {
    vectorEnabled: true,
    embeddingBaseURL: "https://form.example/v1",
    embeddingModel: "form-model",
    embeddingApiKeyEnv: "FORM_KEY",
  },
});
check("RPC probe embedding 用表单覆盖值且 ok=true 包装结果", () => {
  assert.equal(rpcEmb.ok, true);
  assert.equal(rpcEmb.value.probe.target, "embedding");
  assert.equal(rpcEmb.value.probe.ok, false);
  assert.equal(rpcEmb.value.probe.code, "EMBEDDING_CREDENTIAL_MISSING");
  assert.equal(rpcCredRef, "FORM_KEY");
});

const rpcLlm = await rpcHandler("settings", { sessionId: "sid", action: "probe", target: "llm" });
check("RPC probe llm 走当前会话路由", () => {
  assert.equal(rpcLlm.ok, true);
  assert.equal(rpcLlm.value.probe.target, "llm");
  assert.equal(rpcLlm.value.probe.ok, true);
  assert.equal(rpcLlm.value.probe.details.provider, "volcengine");
});

const rpcBad = await rpcHandler("settings", { sessionId: "sid", action: "probe", target: "nope" });
check("未知探测目标是 RPC 错误", () => {
  assert.equal(rpcBad.ok, false);
});

console.log("settings probe: " + passed + " assertions PASS");
