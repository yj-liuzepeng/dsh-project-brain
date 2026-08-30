// Offline end-to-end test of project_ask algorithm (no DSH needed)
// Verifies the FIX (readJson for project.json + JSON round-trip) works
import fs from 'node:fs';

// Mock DSH fs interface
const mockFs = {
  resolve: async (p) => p,
  readText: async (target) => {
    try { return fs.readFileSync(target, 'utf8'); } catch (e) { return null; }
  },
};

// Inline copies of brain-files.js + ask.js core algorithm
function parseJsonl(text) {
  if (!text) return [];
  let t = String(text);
  if (t.charCodeAt(0) === 65279) t = t.slice(1);
  const out = [];
  for (const line of t.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (e) {}
  }
  return out;
}
async function readJson(fs, path) {
  const text = await fs.readText(path);
  if (text == null) return null;
  let t = text;
  if (typeof t === "string" && t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  try { return JSON.parse(t); } catch (e) { return { __error: String(e.message) }; }
}
async function readJsonl(fs, path) { return parseJsonl(await fs.readText(path)); }
function brainPath(projectPath, file) { return projectPath + "/.project-brain/" + file; }
function tokenize(s) {
  if (!s) return [];
  const out = [];
  const en = String(s).toLowerCase().split(/[^a-z0-9_\u4e00-\u9fff]+/i);
  for (const tok of en) { const t = tok && tok.trim(); if (t && t.length >= 2) out.push(t); }
  return out;
}
function scoreEntry(entry, tokens, fields) {
  if (!entry || tokens.length === 0) return 0;
  let score = 0, hits = 0;
  for (const tok of tokens) {
    for (const f of fields) {
      const v = entry[f];
      if (v == null) continue;
      const s = String(v).toLowerCase();
      if (s.indexOf(tok) >= 0) { score += 1; hits += 1; if (f === "title") score += 1; break; }
    }
  }
  return hits > 0 ? score : -1;
}
function techStackToType(techStack) {
  if (!techStack || typeof techStack !== "object") return "Untyped";
  const parts = [];
  for (const k of Object.keys(techStack)) { if (techStack[k]) parts.push(String(techStack[k])); }
  return parts.length > 0 ? parts.join(" \xB7 ") : "Untyped";
}

// === Run ask main path ===
const projectPath = "C:\\Users\\liuzp16\\Desktop\\liuzp\\plugins";
const projectJson = await readJson(mockFs, brainPath(projectPath, "project.json"));
const memories = await readJsonl(mockFs, brainPath(projectPath, "memory.jsonl"));
const todos = await readJsonl(mockFs, brainPath(projectPath, "todo.jsonl"));
const timeline = await readJsonl(mockFs, brainPath(projectPath, "timeline.jsonl"));

console.log("Loaded:", projectJson?.name, "| memories:", memories.length, "| todos:", todos.length, "| timeline:", timeline.length);

const question = "plugins 项目主要做了什么";
const tokens = tokenize(question);
const memSources = memories.map((m) => ({
  kind: "memory", id: m.id, type: m.type, title: m.title,
  snippet: String(m.content || "").slice(0, 200),
  score: Number((scoreEntry(m, tokens, ["title", "content"]) + (typeof m.importance === "number" ? m.importance : 0.3)).toFixed(2)),
  importance: m.importance, relatedFiles: m.relatedFiles || null,
}));
memSources.sort((a, b) => b.score - a.score);

const projectInfo = projectJson ? {
  name: typeof projectJson.name === "string" ? projectJson.name : "",
  type: typeof projectJson.techStack === "object" && projectJson.techStack ? techStackToType(projectJson.techStack) : "Untyped",
  lastUpdateAt: typeof projectJson.updatedAt === "number" ? projectJson.updatedAt : (typeof projectJson.lastScannedAt === "number" ? projectJson.lastScannedAt : null),
} : null;

const ret = {
  ok: true,
  data: {
    projectPath, question, tokens,
    project: projectInfo,
    sources: memSources.slice(0, 5),
    counts: { memories: memories.length, todos: todos.length, timeline: timeline.length, matched: memSources.length },
    confidence: memSources.length > 0 ? Math.min(1, memSources[0].score / 5) : 0,
    answer: null,
    llm: { used: false, requested: false, error: null },
    hint: null,
  },
};

console.log("\n=== Round-trip test ===");
try {
  const round = JSON.parse(JSON.stringify(ret));
  console.log("OK length:", JSON.stringify(round).length);
  console.log("Sources:", round.data.sources.map((s) => `${s.kind}/${s.id}: ${s.title.slice(0, 40)}`).slice(0, 3).join("\n  "));
  console.log("Project:", round.data.project);
  console.log("Confidence:", round.data.confidence.toFixed(2));
} catch (e) {
  console.log("FAIL:", e.message);
}
