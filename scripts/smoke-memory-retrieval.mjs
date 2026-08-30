import assert from "node:assert/strict";
import { makeMemoryEntry } from "../src/host/store/brain-logic.js";
import { activeMemories, cosineSimilarity, retrieveMemories } from "../src/host/memory/retrieval.js";
import { ensureEmbeddingIndex, fetchEmbeddings } from "../src/host/memory/embeddings.js";
import { normalizeMemoryConfig, publicMemoryConfig } from "../src/host/memory/config.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  PASS  " + name);
}

const now = Date.now();
const memories = [
  makeMemoryEntry({ id: "auth", type: "decision", title: "认证方案", content: "使用 JWT refresh token 完成登录认证", importance: 0.8 }, now),
  makeMemoryEntry({ id: "db", type: "architecture", title: "数据库选型", content: "使用 PostgreSQL 保存订单", importance: 0.8 }, now),
  { ...makeMemoryEntry({ id: "old", type: "bug", title: "旧认证故障", content: "JWT 过期", importance: 1 }, now), status: "archived" },
];

check("Memory V2 默认字段完整", () => {
  assert.equal(memories[0].schemaVersion, 2);
  assert.equal(memories[0].status, "active");
  assert.equal(memories[0].confidence, 0.7);
});
check("归档记忆不进入活跃集合", () => assert.deepEqual(activeMemories(memories).map((m) => m.id), ["auth", "db"]));
check("BM25 将认证记忆排在数据库记忆前", () => {
  const hits = retrieveMemories({ memories, query: "JWT 登录认证", topK: 2 });
  assert.equal(hits[0].memory.id, "auth");
  assert.ok(hits[0].keywordScore > hits[1].keywordScore);
});
check("混合检索使用向量相似度", () => {
  const hits = retrieveMemories({
    memories,
    query: "完全无关键词",
    topK: 2,
    vectors: new Map([["auth", [1, 0]], ["db", [0, 1]]]),
    queryVector: [0, 1],
    config: { keywordWeight: 0, vectorWeight: 1, importanceWeight: 0, confidenceWeight: 0, recencyWeight: 0 },
  });
  assert.equal(hits[0].memory.id, "db");
});
check("余弦相似度边界正确", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
});
check("默认配置无需向量服务", () => {
  const config = normalizeMemoryConfig({});
  assert.equal(config.vectorEnabled, false);
  assert.equal(publicMemoryConfig(config).configuredMode, "keyword");
});
check("显式向量配置公开状态不含凭据", () => {
  const status = publicMemoryConfig({ vectorEnabled: true, retrievalMode: "hybrid", embeddingBaseURL: "http://localhost:11434/v1", embeddingModel: "embed" });
  assert.equal(status.configuredMode, "hybrid");
  assert.equal(Object.hasOwn(status, "embeddingApiKeyEnv"), false);
});
const requests = [];
const vectors = await fetchEmbeddings({
  texts: ["a", "b"],
  config: normalizeMemoryConfig({ embeddingBaseURL: "http://example.test/v1", embeddingModel: "embed-test" }),
  apiKey: "secret",
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }) };
  },
});
check("兼容 OpenAI embeddings endpoint", () => assert.equal(requests[0].url, "http://example.test/v1/embeddings"));
check("embedding 响应按 index 还原顺序", () => assert.deepEqual(vectors, [[1, 0], [0, 1]]));
check("embedding 请求携带模型和 Bearer 凭据", () => {
  assert.equal(JSON.parse(requests[0].options.body).model, "embed-test");
  assert.equal(requests[0].options.headers.Authorization, "Bearer secret");
});

const files = new Map();
const memoryFs = {
  resolve: async (path) => path,
  readText: async (path) => {
    if (!files.has(path)) throw new Error("ENOENT");
    return files.get(path);
  },
  writeText: async (path, value) => { files.set(path, value); },
  mkdir: async () => {},
};
const indexState = await ensureEmbeddingIndex({
  fs: memoryFs,
  projectPath: "/project",
  memories,
  config: normalizeMemoryConfig({ vectorEnabled: true, embeddingBaseURL: "http://local/v1", embeddingModel: "local", embeddingApiKeyEnv: "" }),
  fetchImpl: async (_url, options) => ({
    ok: true,
    json: async () => ({ data: JSON.parse(options.body).input.map((_text, index) => ({ index, embedding: index === 0 ? [1, 0] : [0, 1] })) }),
  }),
});
check("增量索引只处理活跃记忆并写派生缓存", () => {
  assert.equal(indexState.indexed, 2);
  assert.equal(indexState.total, 2);
  assert.ok([...files.keys()].some((path) => path.endsWith("cache/embeddings.jsonl")));
});
const failedIndex = await ensureEmbeddingIndex({
  fs: { ...memoryFs, readText: async () => { throw new Error("ENOENT"); } },
  projectPath: "/failed",
  memories,
  config: normalizeMemoryConfig({ vectorEnabled: true, embeddingBaseURL: "http://bad/v1", embeddingModel: "bad", embeddingApiKeyEnv: "" }),
  fetchImpl: async () => ({ ok: false, status: 503, text: async () => "unavailable" }),
});
check("向量服务失败返回诊断而不抛出", () => {
  assert.equal(failedIndex.indexed, 0);
  assert.equal(failedIndex.error.code, "EMBEDDING_API_ERROR");
});

console.log("memory retrieval: " + passed + " assertions PASS");
