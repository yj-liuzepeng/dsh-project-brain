import { isActiveMemory, memoryScore } from "../store/brain-logic.js";

export { isActiveMemory };

export function activeMemories(memories) {
  return (memories || []).filter(isActiveMemory);
}

export function tokenizeMemoryText(value) {
  const text = String(value || "").toLowerCase();
  const tokens = [];
  for (const part of text.match(/[a-z0-9_./:@-]+|[\u4e00-\u9fff]+/g) || []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length === 1) tokens.push(part);
      else {
        for (let i = 0; i < part.length - 1; i++) tokens.push(part.slice(i, i + 2));
      }
    } else if (part.length > 1) {
      tokens.push(part);
    }
  }
  return tokens.slice(0, 2000);
}

export function memoryDocument(memory) {
  return [
    memory && memory.title,
    memory && memory.title,
    memory && memory.content,
    memory && Array.isArray(memory.tags) ? memory.tags.join(" ") : "",
    memory && Array.isArray(memory.relatedFiles) ? memory.relatedFiles.join(" ") : "",
    memory && memory.type,
  ].filter(Boolean).join("\n");
}

function termCounts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
  return map;
}

export function bm25Scores(memories, query, options = {}) {
  const docs = (memories || []).map((memory) => tokenizeMemoryText(memoryDocument(memory)));
  const queryTokens = [...new Set(tokenizeMemoryText(query))];
  const scores = new Map();
  if (docs.length === 0 || queryTokens.length === 0) return scores;
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1;
  const k1 = typeof options.k1 === "number" ? options.k1 : 1.2;
  const b = typeof options.b === "number" ? options.b : 0.75;
  const dfs = new Map();
  for (const token of queryTokens) {
    let count = 0;
    for (const doc of docs) if (doc.includes(token)) count += 1;
    dfs.set(token, count);
  }
  docs.forEach((doc, index) => {
    const counts = termCounts(doc);
    let score = 0;
    for (const token of queryTokens) {
      const tf = counts.get(token) || 0;
      if (!tf) continue;
      const df = dfs.get(token) || 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc.length / avgLength)));
    }
    scores.set(memories[index].id, score);
  });
  return scores;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : 0;
}

function normalizeScoreMap(map) {
  let max = 0;
  for (const value of map.values()) if (value > max) max = value;
  const out = new Map();
  for (const [key, value] of map) out.set(key, max > 0 ? value / max : 0);
  return out;
}

function recencyScore(memory, now) {
  const created = memory.updatedAt || memory.createdAt || 0;
  const ageDays = Math.max(0, (now - created) / 86400000);
  return ageDays <= 7 ? 1 : Math.max(0, 1 - ageDays / 180);
}

function tokenJaccard(a, b) {
  const aa = new Set(tokenizeMemoryText(memoryDocument(a)));
  const bb = new Set(tokenizeMemoryText(memoryDocument(b)));
  if (aa.size === 0 || bb.size === 0) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  return intersection / (aa.size + bb.size - intersection);
}

export function retrieveMemories({ memories, query = "", topK = 5, now = Date.now(), vectors, queryVector, config = {} } = {}) {
  const candidates = activeMemories(memories);
  const keyword = normalizeScoreMap(bm25Scores(candidates, query));
  const vectorRaw = new Map();
  if (queryVector && vectors) {
    for (const memory of candidates) {
      const vector = vectors instanceof Map ? vectors.get(memory.id) : vectors[memory.id];
      if (vector) vectorRaw.set(memory.id, Math.max(0, cosineSimilarity(queryVector, vector)));
    }
  }
  const vector = normalizeScoreMap(vectorRaw);
  const hasQuery = tokenizeMemoryText(query).length > 0;
  const hasVector = vector.size > 0;
  const weights = {
    keyword: hasQuery ? Number(config.keywordWeight ?? 0.45) : 0,
    vector: hasVector ? Number(config.vectorWeight ?? 0.35) : 0,
    importance: hasQuery ? Number(config.importanceWeight ?? 0.1) : 0.55,
    confidence: hasQuery ? Number(config.confidenceWeight ?? 0.05) : 0.1,
    recency: hasQuery ? Number(config.recencyWeight ?? 0.05) : 0.2,
    type: hasQuery ? 0 : 0.15,
  };
  const ranked = candidates.map((memory) => {
    const importance = typeof memory.importance === "number" ? memory.importance : 0.5;
    const confidence = typeof memory.confidence === "number" ? memory.confidence : 0.6;
    const stableType = ["decision", "requirement", "architecture", "bug", "lesson"].includes(memory.type) ? 1 : 0.35;
    const relevance = (keyword.get(memory.id) || 0) * weights.keyword
      + (vector.get(memory.id) || 0) * weights.vector
      + importance * weights.importance
      + confidence * weights.confidence
      + recencyScore(memory, now) * weights.recency
      + stableType * weights.type;
    return { memory, relevance, keywordScore: keyword.get(memory.id) || 0, vectorScore: vector.get(memory.id) || 0 };
  }).sort((a, b) => b.relevance - a.relevance);

  const selected = [];
  const remaining = ranked.slice();
  while (selected.length < Math.max(1, topK) && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let similarityPenalty = 0;
      let sameType = 0;
      for (const chosen of selected) {
        similarityPenalty = Math.max(similarityPenalty, tokenJaccard(candidate.memory, chosen.memory));
        if (candidate.memory.type === chosen.memory.type) sameType += 1;
      }
      const diversityScore = candidate.relevance - similarityPenalty * 0.22 - Math.max(0, sameType - 1) * 0.08;
      if (diversityScore > bestScore) {
        bestScore = diversityScore;
        bestIndex = i;
      }
    }
    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push({ ...picked, score: bestScore });
  }
  return selected;
}

export function legacyTopMemories(memories, n, now) {
  return activeMemories(memories).slice().sort((a, b) => memoryScore(b, now) - memoryScore(a, now)).slice(0, n || 5);
}
