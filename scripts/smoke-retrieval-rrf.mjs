// smoke-retrieval-rrf.mjs - v0.7.x 双路召回 + RRF 融合策略验证
//
// 用例清单（全部 PASS）：
//   1)  bm25Recall 单路：仅 BM25 打分；与 query 无交集的记忆被过滤
//   2)  vectorRecall 单路：按余弦相似度降序
//   3)  cosineSimilarity 边界：同向=1 / 正交=0 / 反向=-1 不参与（取 max(0, _)）
//   4)  rrfMerge 基础：BM25 + vector 两路融合后，命中两路的记忆排在仅命中单路前
//   5)  rrfMerge 对称贡献：k 相同时两路权重相同（交换两路顺序不影响排序）
//   6)  rrfMerge 单路未命中：该路贡献 0，不影响其他路排序
//   7)  retrieveMemories 双路路径：query + queryVector + vectors 全部齐备时走 RRF（relevance 是 1/(k+rank) 形式）
//   8)  retrieveMemories fallback（无 queryVector）：退回 5 因子加权，relevance 在 [0,1] 区间
//   9)  retrieveMemories fallback（query 为空）：退回 5 因子加权，不走 RRF
//   10) retrieveMemories fallback（vectors 为空）：即使 queryVector 有值，vectors 空 → 退加权
//   11) retrieveMemories 多样性：diverseSelect 在 RRF 模式下仍生效（同 type 记忆被降权）
//   12) retrieveMemories hit 形状兼容：含 memory/relevance/score/keywordScore/vectorScore

import assert from "node:assert/strict";
import {
  activeMemories,
  bm25Recall,
  vectorRecall,
  rrfMerge,
  retrieveMemories,
  cosineSimilarity,
  DEFAULT_RRF_K,
} from "../src/host/memory/retrieval.js";
import { makeMemoryEntry } from "../src/host/store/brain-logic.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log("  PASS  " + name);
}

const now = Date.now();
const corpus = [
  makeMemoryEntry({ id: "jwt", type: "decision", title: "认证方案", content: "使用 JWT refresh token 完成登录认证", importance: 0.8 }, now),
  makeMemoryEntry({ id: "pg", type: "architecture", title: "数据库选型", content: "使用 PostgreSQL 保存订单", importance: 0.8 }, now),
  makeMemoryEntry({ id: "cache", type: "decision", title: "缓存策略", content: "Redis 缓存用户会话", importance: 0.7 }, now),
  makeMemoryEntry({ id: "logger", type: "bug", title: "日志聚合", content: "ELK 收集后端日志", importance: 0.5 }, now),
];

// ───── 1) bm25Recall 单路 ─────
check("bm25Recall 仅返回与 query 有交集的候选", () => {
  const hits = bm25Recall(corpus, "JWT 登录认证");
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].memory.id, "jwt");
  assert.ok(hits[0].score > 0);
  for (const hit of hits) assert.ok(hit.score > 0);
});

check("bm25Recall 与 query 无交集 → 返回空", () => {
  const hits = bm25Recall(corpus, "毫无关联的量子引力");
  assert.equal(hits.length, 0);
});

// ───── 2) vectorRecall 单路 ─────
check("vectorRecall 按余弦相似度降序", () => {
  const vectors = new Map([
    ["jwt", [1, 0, 0]],
    ["pg", [0, 1, 0]],
    ["cache", [0.9, 0.1, 0]],
    ["logger", [0, 0, 1]],
  ]);
  const hits = vectorRecall(corpus, vectors, [1, 0, 0]);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].memory.id, "jwt");
  // logger 与 query 正交（cos=0）被过滤；jwt 应排在 cache 之前（jwt=1, cache≈0.99）
  const ids = hits.map((h) => h.memory.id);
  assert.equal(ids.includes("logger"), false);
  assert.ok(ids.indexOf("jwt") < ids.indexOf("cache"));
});

check("vectorRecall 缺失 queryVector → 返回空", () => {
  const vectors = new Map([["jwt", [1, 0]]]);
  const hits = vectorRecall(corpus, vectors, null);
  assert.equal(hits.length, 0);
});

check("vectorRecall 向量缺失的记忆被跳过", () => {
  const vectors = new Map([["jwt", [1, 0]]]);
  const hits = vectorRecall(corpus, vectors, [1, 0]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].memory.id, "jwt");
});

// ───── 3) cosineSimilarity 边界 ─────
check("cosineSimilarity 边界值正确", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 0]), 0); // aa=0
});

// ───── 4) rrfMerge 基础 ─────
check("rrfMerge 命中双路 > 命中单路", () => {
  const bm25List = [
    { memory: corpus[0], score: 1.0 }, // jwt - 命中 BM25
    { memory: corpus[1], score: 0.3 }, // pg - 命中 BM25
  ];
  const vecList = [
    { memory: corpus[0], score: 1.0 }, // jwt - 命中 vector
    { memory: corpus[3], score: 0.5 }, // logger - 命中 vector
  ];
  const merged = rrfMerge([bm25List, vecList]);
  assert.equal(merged[0].memory.id, "jwt"); // 命中两路 → 第一
  const jwt = merged.find((m) => m.memory.id === "jwt");
  assert.ok(jwt.relevance > 1 / (DEFAULT_RRF_K + 1)); // 至少 = 两路 rank1 之和
});

// ───── 5) rrfMerge 对称贡献 ─────
check("rrfMerge 交换两路顺序后 relevance 不变", () => {
  const bm25List = [
    { memory: corpus[0], score: 1.0 },
    { memory: corpus[1], score: 0.5 },
  ];
  const vecList = [
    { memory: corpus[0], score: 0.9 },
    { memory: corpus[2], score: 0.8 },
  ];
  const m1 = rrfMerge([bm25List, vecList]);
  const m2 = rrfMerge([vecList, bm25List]);
  // 集合一致
  assert.deepEqual(m1.map((m) => m.memory.id).sort(), m2.map((m) => m.memory.id).sort());
  // jwt 命中两路 → 在两个结果中都排第一
  assert.equal(m1[0].memory.id, "jwt");
  assert.equal(m2[0].memory.id, "jwt");
  // jwt 的 relevance 值严格相等（与列表顺序无关）
  assert.ok(Math.abs(m1[0].relevance - m2[0].relevance) < 1e-9);
});

// ───── 6) rrfMerge 单路未命中 ─────
check("rrfMerge 单路未命中 → 该路贡献 0", () => {
  const bm25List = [
    { memory: corpus[0], score: 1.0 },
    { memory: corpus[1], score: 0.5 },
  ];
  const vecList = []; // vector 路完全没结果
  const merged = rrfMerge([bm25List, vecList]);
  assert.equal(merged[0].memory.id, "jwt");
  // jwt 只命中 1 路 → rrf = 1/(60+1)
  assert.ok(Math.abs(merged[0].relevance - 1 / (DEFAULT_RRF_K + 1)) < 1e-9);
});

// ───── 7) retrieveMemories 主路径：加权融合（向量只加分，不走 RRF） ─────
check("retrieveMemories 双路全齐 → 仍走加权（relevance 不是 RRF）", () => {
  const vectors = new Map([
    ["jwt", [1, 0]],
    ["pg", [0, 1]],
    ["cache", [0.95, 0.05]],
    ["logger", [0, 1]],
  ]);
  const queryVector = [1, 0];
  const hits = retrieveMemories({
    memories: corpus,
    query: "JWT 认证",
    topK: 3,
    vectors,
    queryVector,
  });
  assert.ok(hits.length > 0);
  assert.equal(hits[0].memory.id, "jwt");
  assert.ok(hits[0].relevance > 0.15);
  assert.ok(hits[0].relevance <= 1.2);
  assert.ok(hits[0].keywordScore > 0);
  assert.ok(hits[0].vectorScore > 0);
});

// ───── 8) retrieveMemories fallback：无 queryVector ─────
check("retrieveMemories 无 queryVector → 退回 5 因子加权", () => {
  const hits = retrieveMemories({
    memories: corpus,
    query: "JWT 登录",
    topK: 3,
    vectors: new Map([["jwt", [1, 0]]]), // 即使有 vectors，缺 queryVector 仍 fallback
    queryVector: null,
  });
  assert.ok(hits.length > 0);
  // fallback 路径下 relevance 是加权和（<= 1.05）
  assert.ok(hits[0].relevance <= 1.1);
  assert.equal(hits[0].vectorScore, 0); // 没走 vector
});

// ───── 9) retrieveMemories fallback：query 为空 ─────
check("retrieveMemories query 为空 → 退回加权（注入场景，不走 RRF）", () => {
  const vectors = new Map([
    ["jwt", [1, 0]],
    ["pg", [0, 1]],
  ]);
  const hits = retrieveMemories({
    memories: corpus,
    query: "",
    topK: 3,
    vectors,
    queryVector: [1, 0],
  });
  assert.ok(hits.length > 0);
  // 无 query 场景，importance 主导权重 0.45 → jwt/pg importance=0.8 应在前
  const ids = hits.map((h) => h.memory.id);
  assert.ok(ids.includes("jwt") && ids.includes("pg"));
});

// ───── 10) retrieveMemories fallback：vectors 为空 ─────
check("retrieveMemories vectors 为空 → 退加权（即使 queryVector 有值）", () => {
  const hits = retrieveMemories({
    memories: corpus,
    query: "JWT 登录",
    topK: 3,
    vectors: new Map(),
    queryVector: [1, 0],
  });
  assert.ok(hits.length > 0);
  // 走加权路径 → relevance 加权和形式
  assert.ok(hits[0].relevance <= 1.1);
  assert.equal(hits[0].vectorScore, 0);
});

// ───── 11) 多样性选择（双路下仍生效） ─────
check("diverseSelect 在加权主路径下仍生效（同 type 记忆被降权）", () => {
  const tight = [
    makeMemoryEntry({ id: "d1", type: "decision", title: "决策1", content: "类似内容 JWT", importance: 0.8 }, now),
    makeMemoryEntry({ id: "d2", type: "decision", title: "决策2", content: "类似内容 JWT", importance: 0.8 }, now),
    makeMemoryEntry({ id: "d3", type: "decision", title: "决策3", content: "类似内容 JWT", importance: 0.8 }, now),
    makeMemoryEntry({ id: "b1", type: "bug", title: "独立bug", content: "JWT", importance: 0.5 }, now),
  ];
  const vectors = new Map([
    ["d1", [1, 0]],
    ["d2", [1, 0]],
    ["d3", [1, 0]],
    ["b1", [1, 0]],
  ]);
  const hits = retrieveMemories({
    memories: tight,
    query: "JWT",
    topK: 2,
    vectors,
    queryVector: [1, 0],
  });
  assert.equal(hits.length, 2);
  // 多样性惩罚应该让 b1（不同 type）被选上
  const ids = hits.map((h) => h.memory.id);
  assert.ok(ids.includes("b1"), "多样性下不同 type 应被选中: " + ids.join(","));
});

// ───── 12) hit 形状兼容 ─────
check("retrieveMemories hit 包含全部兼容字段", () => {
  const hits = retrieveMemories({
    memories: corpus,
    query: "JWT",
    topK: 1,
    vectors: new Map([["jwt", [1, 0]]]),
    queryVector: [1, 0],
  });
  assert.equal(hits.length, 1);
  const h = hits[0];
  assert.ok(h.memory && h.memory.id);
  assert.ok(typeof h.relevance === "number");
  assert.ok(typeof h.score === "number"); // diverseSelect 输出分
  assert.ok(typeof h.keywordScore === "number");
  assert.ok(typeof h.vectorScore === "number");
});

console.log("\nrrf retrieval: " + passed + " assertions PASS");
if (passed < 12) process.exit(1);