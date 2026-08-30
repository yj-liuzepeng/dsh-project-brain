// project_ask Tool - 自然语言查询项目脑（v0.3.0：可选 LLM RAG）
//
// MVP 实现：纯规则检索（标题 / 内容 / 相关文件关键词匹配）。
// v0.3.0 升级：当 useLLM=true 且 llm service 可用时，调 llm.stream 合成答案。
//              llm 不可用 / 失败时 fallback 到纯规则版。
// 参数：
//   - question (必填)
//   - topK: 返回 source 数（默认 5）
//   - useLLM: 是否调 LLM 合成答案（默认 false，兼容零 token 用法）
//   - path: 项目路径
// 返回：sources（Top-K）+ answer（LLM 合成，可选）+ counts + confidence

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, readJson, readJsonl } from "../host/store/brain-files.js";
import { techStackToType } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { activeMemories, retrieveMemories } from "../host/memory/retrieval.js";
import { embedQuery, ensureEmbeddingIndex } from "../host/memory/embeddings.js";
import { normalizeMemoryConfig } from "../host/memory/config.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
};

function tokenize(s) {
  if (!s) return [];
  const out = [];
  const en = String(s).toLowerCase().split(/[^a-z0-9_\u4e00-\u9fff]+/i);
  for (const tok of en) {
    const t = tok && tok.trim();
    if (t && t.length >= 2) out.push(t);
  }
  return out;
}

function scoreEntry(entry, tokens, fields) {
  if (!entry || tokens.length === 0) return 0;
  let score = 0;
  let hits = 0;
  for (const tok of tokens) {
    for (const f of fields) {
      const v = entry[f];
      if (v == null) continue;
      const s = String(v).toLowerCase();
      if (s.indexOf(tok) >= 0) {
        score += 1;
        hits += 1;
        if (f === "title") score += 1;
        break;
      }
    }
  }
  return hits > 0 ? score : -1;
}

// 用 sources 构造 RAG prompt
function buildRagPrompt(question, sources, projectInfo) {
  const parts = [];
  parts.push("你是 dsh-project-brain 助手。用户问了一个关于项目的问题，请仅基于下面提供的 sources 回答，不要编造信息。");
  parts.push("");
  if (projectInfo) {
    parts.push("【项目概况】");
    parts.push("- 名称: " + (projectInfo.name || "(未命名)"));
    if (projectInfo.type) parts.push("- 类型: " + projectInfo.type);
    parts.push("");
  }
  parts.push("【相关 Memory / TODO / Timeline（Top sources）】");
  sources.forEach((s, i) => {
    const tag = s.kind + " + " + (s.type || s.status || s.eventType || "");
    parts.push(`[${i + 1}] (${tag}) ${s.title}`);
    if (s.snippet) parts.push("    " + s.snippet);
    parts.push("");
  });
  parts.push("【用户问题】");
  parts.push(question);
  parts.push("");
  parts.push("请用简洁的中文回答（3-5 句话），并在末尾列出引用的来源编号 [1][2]...。如果 sources 无法回答，直接说『信息不足』。");
  return parts.join("\n");
}

// 调 llm.stream 合成答案；失败返回 null（让 caller fallback）
async function synthesizeAnswer(exec, question, sources, projectInfo) {
  if (!sources || sources.length === 0) return null;
  // 拿 llm service（exec.ctx 是 Cordis context）
  let llm = null;
  try {
    const ctx = exec && exec.ctx;
    llm = ctx && (ctx.get ? ctx.get("llm") : ctx.llm);
  } catch (e) { llm = null; }
  if (!llm || typeof llm.stream !== "function") return null;

  const prompt = buildRagPrompt(question, sources, projectInfo);
  const options = {
    // provider 留空：DSH 通常有默认 route；不传让系统选
    messages: [{ role: "user", content: prompt }],
  };
  try {
    const iterable = llm.stream(options);
    if (!iterable || typeof iterable[Symbol.asyncIterator] !== "function") return null;
    let collected = "";
    for await (const chunk of iterable) {
      if (!chunk) continue;
      // 多种 chunk 形态兼容
      if (typeof chunk.text === "string") collected += chunk.text;
      else if (typeof chunk.content === "string") collected += chunk.content;
      else if (typeof chunk.delta === "string") collected += chunk.delta;
      // 超长截断
      if (collected.length > 8000) break;
    }
    return collected.trim() || null;
  } catch (e) {
    return null;
  }
}

export function buildAskTool({ fs, sandboxPolicy, getMemoryConfig, resolveEmbeddingCredential }) {
  return defineTool({
    name: "project_ask",
    description:
      "dsh-project-brain: 自然语言查询项目脑。默认使用本地 BM25 检索；配置后可使用混合向量检索，返回 " +
      "Top-K sources + 项目概览。useLLM=true 时额外调 LLM 合成答案（RAG 风格）。" +
      "可用于回答「为什么这么设计 / 之前踩过什么坑 / 最近改了什么」等问题。",
    parameters: {
      question: { type: "string", description: "自然语言问题（必填）" },
      topK: { type: "number", description: "返回条目数上限，默认 5" },
      useLLM: { type: "boolean", description: "是否调 LLM 合成答案（默认 false，纯规则返回 sources）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderAsk(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const question = args && args.question ? String(args.question).trim() : "";
        if (!question) return { ok: false, data: { error: { code: "E_NO_QUESTION", message: "question 必填" } } };
        const topK = Math.max(1, Math.min(20, Number(args && args.topK) || 5));
        const useLLM = Boolean(args && args.useLLM);
        const tokens = tokenize(question);
        const memoryConfig = normalizeMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});

        const projectJson = await readJson(fs, brainPath(projectPath, "project.json")).catch(() => null);
        const memories = await readJsonlSafe(fs, brainPath(projectPath, "memory.jsonl"));
        const todos = await readJsonlSafe(fs, brainPath(projectPath, "todo.jsonl"));
        const timeline = await readJsonlSafe(fs, brainPath(projectPath, "timeline.jsonl"));

        const activeMemoryList = activeMemories(memories);
        let vectors = null;
        let queryVector = null;
        let vectorState = {
          requested: memoryConfig.vectorEnabled && memoryConfig.retrievalMode === "hybrid",
          used: false,
          indexed: 0,
          total: activeMemoryList.length,
          pending: activeMemoryList.length,
          model: memoryConfig.embeddingModel || null,
          dimensions: memoryConfig.embeddingDimensions,
          fallbackReason: null,
        };
        if (vectorState.requested) {
          if (!memoryConfig.embeddingBaseURL || !memoryConfig.embeddingModel) {
            vectorState.fallbackReason = { code: "EMBEDDING_NOT_CONFIGURED", message: "向量检索已启用，但 endpoint 或 model 未配置" };
          } else {
            const indexState = await ensureEmbeddingIndex({
              fs,
              projectPath,
              memories: activeMemoryList,
              config: memoryConfig,
              resolveCredential: resolveEmbeddingCredential,
            });
            vectors = indexState.vectors;
            vectorState = { ...vectorState, ...indexState, requested: true, used: false, fallbackReason: indexState.error };
            try {
              queryVector = await embedQuery({
                query: question,
                config: memoryConfig,
                resolveCredential: resolveEmbeddingCredential,
              });
              const indexedVector = vectors.size > 0 ? vectors.values().next().value : null;
              if (indexedVector && indexedVector.length !== queryVector.length) {
                queryVector = null;
                vectorState.fallbackReason = {
                  code: "EMBEDDING_DIMENSION_MISMATCH",
                  message: "查询向量维度与索引不一致，请检查模型配置或删除派生缓存后重试",
                };
              } else {
                vectorState.used = vectors.size > 0;
              }
            } catch (error) {
              vectorState.fallbackReason = {
                code: error.code || "EMBEDDING_QUERY_FAILED",
                message: String(error.message || error),
              };
            }
          }
        }
        const memScored = retrieveMemories({
          memories: activeMemoryList,
          query: question,
          topK,
          vectors,
          queryVector,
          config: memoryConfig,
        });

        const todoScored = (todos || []).map((t) => {
          const s = scoreEntry(t, tokens, ["title", "description"]);
          return s < 0 ? null : { ...t, _score: s };
        }).filter(Boolean);
        todoScored.sort((a, b) => (b._score || 0) - (a._score || 0));

        const tlScored = (timeline || []).map((e) => {
          const s = scoreEntry(e, tokens, ["title", "detail"]);
          return s < 0 ? null : { ...e, _score: s };
        }).filter(Boolean);
        tlScored.sort((a, b) => (b._score || 0) - (a._score || 0));

        const memSources = memScored.map((hit) => ({
          kind: "memory", id: hit.memory.id, type: hit.memory.type, title: hit.memory.title,
          snippet: String(hit.memory.content || "").slice(0, 200),
          score: Number(Math.max(0, hit.relevance || 0).toFixed(4)),
          keywordScore: Number((hit.keywordScore || 0).toFixed(4)),
          vectorScore: Number((hit.vectorScore || 0).toFixed(4)),
          importance: hit.memory.importance, confidence: hit.memory.confidence,
          relatedFiles: hit.memory.relatedFiles || null,
        }));
        const todoSources = todoScored.slice(0, Math.max(1, Math.floor(topK / 2))).map((t) => ({
          kind: "todo", id: t.id, status: t.status, priority: t.priority, title: t.title,
          snippet: String(t.description || "").slice(0, 120),
          score: Number((t._score || 0).toFixed(2)),
        }));
        const tlSources = tlScored.slice(0, 2).map((e) => ({
          kind: "timeline", id: e.id, eventType: e.eventType, title: e.title,
          occurredAt: e.occurredAt,
          score: Number((e._score || 0).toFixed(2)),
        }));
        const sources = memSources.concat(todoSources).concat(tlSources);

        const projectInfo = projectJson ? {
          name: projectJson.name,
          type: techStackToType(projectJson.techStack),
          lastUpdateAt: projectJson.updatedAt || projectJson.lastScannedAt || null,
        } : null;

        // 可选 LLM 合成
        let answer = null;
        let llmUsed = false;
        let llmError = null;
        if (useLLM) {
          try {
            answer = await synthesizeAnswer(exec, question, sources, projectInfo);
            llmUsed = answer != null;
          } catch (e) {
            llmError = String((e && e.message) || e);
          }
        }

        // v0.3.9 修复：之前 "value is not lossless JSON" 是因为 sources 数组里某项含不可序列化字段
        // 强制 JSON round-trip 把 undefined/Symbol/Function 都剥掉
        const ret = {
          ok: true,
          data: {
            projectPath,
            question,
            tokens,
            project: projectInfo,
            sources,
            counts: {
              memories: activeMemoryList.length,
              archivedMemories: (memories || []).length - activeMemoryList.length,
              todos: (todos || []).length,
              timeline: (timeline || []).length,
              matched: sources.length,
            },
            confidence: sources.length > 0 ? Math.min(1, memSources.length > 0 ? memSources[0].score : 0.3) : 0,
            retrieval: {
              requestedMode: memoryConfig.retrievalMode,
              actualMode: vectorState.used ? "hybrid" : "keyword",
              vectorRequested: vectorState.requested,
              vectorUsed: vectorState.used,
              indexed: vectorState.indexed,
              total: vectorState.total,
              pending: vectorState.pending,
              model: vectorState.model,
              dimensions: vectorState.dimensions,
              fallbackReason: vectorState.fallbackReason,
            },
            answer: answer,
            llm: {
              used: llmUsed,
              requested: useLLM,
              error: llmError,
            },
            hint: sources.length === 0 ? "没有匹配条目。可考虑放宽关键词，或先调用 project_init / project_memory_add 录入更多上下文。" : null,
          },
        };
        // 诊断：先尝试 JSON round-trip，如果失败就在 data 里加 _diag
        try {
          const roundtrip = JSON.parse(JSON.stringify(ret));
          return roundtrip;
        } catch (e) {
          ret.data._diag = "JSON.stringify FAIL: " + String((e && e.message) || e);
          return ret;
        }
      } catch (e) {
        return { ok: false, data: { error: { code: "E_ASK_FAILED", message: String((e && e.message) || e) } } };
      }
    },
  });
}

async function readJsonlSafe(fs, path) {
  try {
    return await readJsonl(fs, path);
  } catch (e) {
    return [];
  }
}

function renderAsk(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: ask — matched ${d.counts.matched} sources (confidence ${(d.confidence || 0).toFixed(2)}, llm=${d.llm && d.llm.used ? "yes" : "no"})` }];
    if (d.answer) {
      lines.push({ type: "text", text: "\n【LLM 答案】" });
      lines.push({ type: "text", text: d.answer });
    }
    for (const s of d.sources || []) {
      lines.push({ type: "text", text: `  [${s.kind}/${s.id}] ${s.title}${s.snippet ? " — " + s.snippet.slice(0, 80) : ""}` });
    }
    if (d.llm && d.llm.error) lines.push({ type: "text", text: `  llm_error: ${d.llm.error}` });
    if (d.hint) lines.push({ type: "text", text: `  hint: ${d.hint}` });
    if (d._diag) lines.push({ type: "text", text: `  ⚠️ DIAG: ${d._diag}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + JSON.stringify(value) }];
}
