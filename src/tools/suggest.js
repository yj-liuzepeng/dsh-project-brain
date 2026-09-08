// project_suggest_next Tool - v0.4.15 智能续接
//
// Session 开始时（或主动调用）给用户一句"今天可能想推进什么"：
//   1) 默认走纯规则：基于 in_progress TODO / 高优先级 pending / 阻塞 / 近期记忆
//   2) 若 DSH Session 已有可用 model route，组装 RAG prompt 让 LLM 推断
//   3) LLM 失败 / 不可用 → 自动降级到本地规则
//
// 设计要点：
//   - 不调架构 LLM（architecture.llm）也不调 session_extractor，独立用 llm service 即可
//   - 完整 try/catch + swallow：不能让 Session 启动卡住
//   - 返回结构稳定（source: "llm" / "local" / "error"），UI 据此展示

import { defineTool } from "@deepseek-ai/dsh-tools";
import { readBrain } from "../host/store/brain-files.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { resolveSessionRoute, streamLlmText } from "../host/architecture/analyzer.js";
import { buildLocalSuggestion, buildSuggestPromptForLlm, parseSuggestJson, normalizeSuggestion } from "../host/suggest.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
    code: { type: "string" },
    message: { type: "string" },
  },
};

function executionRoute(exec) {
  if (!exec) return null;
  return resolveSessionRoute(exec.session)
    || resolveSessionRoute(exec.currentSession)
    || resolveSessionRoute(exec.agent && exec.agent.session)
    || resolveSessionRoute(exec.agent)
    || resolveSessionRoute(exec.ctx && exec.ctx.session);
}

function executionSessionId(exec) {
  return exec && (exec.sessionId
    || (exec.session && exec.session.id)
    || (exec.agent && exec.agent.sessionId)
    || (exec.agent && exec.agent.session && exec.agent.session.id)) || null;
}

async function tryLlmSuggestion({ llm, route, sessionId, brain, temperature }) {
  const { prompt, evidence } = buildSuggestPromptForLlm(brain, Date.now());
  let text;
  try {
    text = await streamLlmText(llm, route, prompt, sessionId, 20000, {
      system: "You are the dsh-project-brain 'smart continue' advisor. Output strict JSON only. Never invent TODOs, memories or files that were not provided as evidence.",
      maxTokens: 400,
      purpose: "project-suggest-next",
      // v0.4.17：deterministic 输出，让同一项目下不同 session 拿到的建议尽量一致
      temperature: typeof temperature === "number" ? temperature : 0,
    });
  } catch (error) {
    return { ok: false, error: error && error.code ? error.code : "STREAM_FAILED", message: String((error && error.message) || error) };
  }
  const parsed = parseSuggestJson(text);
  if (!parsed) return { ok: false, error: "INVALID_JSON", message: "LLM 返回非 JSON" };
  const normalized = normalizeSuggestion(parsed);
  if (!normalized) return { ok: false, error: "INVALID_SCHEMA", message: "LLM JSON 缺少必要字段" };
  return { ok: true, data: { suggestion: normalized, evidence: summarizeEvidence(evidence), source: "llm" } };
}

function summarizeEvidence(evidence) {
  return {
    activeTodos: {
      inProgress: evidence.activeTodos.inProgress.length,
      pending: evidence.activeTodos.pending.length,
      blocked: evidence.activeTodos.blocked.length,
    },
    memories: evidence.memories.length,
    recentEvents: evidence.recentEvents.length,
    daysSinceLastSession: evidence.daysSinceLastSession,
  };
}

export function buildSuggestTool({ fs, sandboxPolicy, getLlm }) {
  return defineTool({
    name: "project_suggest_next",
    description:
      "dsh-project-brain: 智能续接。Session 开始时给用户一句「今天可能想推进什么」+ 依据，" +
      "结合活跃 TODO / 近期记忆 / 最近活动 / 架构概览综合推断。" +
      "默认走本地规则（in_progress > 最高优先级 pending > 阻塞 > 记忆），" +
        "若 DSH 当前 Session 有可用 LLM route，会自动调模型升级建议质量；失败时降级到本地。" +
        "适用于「今天继续什么 / 接下来做什么」等场景。",
    parameters: {
      path: { type: "string", description: "项目根路径（可选；默认从当前 DSH Session 的 workspace 自动解析）" },
      useLLM: { type: "boolean", description: "是否尝试调 LLM（默认 true；设 false 强制走本地规则）" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderSuggest(value) },
    async execute(args, exec) {
      const startMs = Date.now();
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, data: { error: { code: "E_NO_PATH", message: "无法从当前 Session 解析 workspace 路径" } } };
        }
        const brain = await readBrain(fs, projectPath);
        if (!brain.project || brain.project.__error) {
          return { ok: false, data: { error: { code: "E_NOT_INITIALIZED", message: "项目还未初始化 .project-brain/project.json，请先调用 project_init" } } };
        }
        // 也读 architecture（LLM prompt 用）
        try {
          const archPath = projectPath.replace(/[\\/]+$/, "") + "/.project-brain/architecture.json";
          const text = await (async () => { try { return await fs.readText(await fs.resolve(archPath)); } catch { return null; } })();
          if (text) brain.architecture = JSON.parse(text);
        } catch (e) { /* ignore */ }

        const useLLM = args && args.useLLM === false ? false : true;
        const llm = getLlm ? getLlm() : null;
        const route = executionRoute(exec);
        const sessionId = executionSessionId(exec);

        let result;
        if (useLLM && llm && route && route.provider && route.model) {
          // v0.4.17：传 temperature=0 让同一项目下不同 session 拿到的建议尽量一致
          result = await tryLlmSuggestion({ llm, route, sessionId, brain, temperature: 0 });
          if (result.ok) {
            return { ok: true, data: result.data };
          }
          // LLM 失败：fallback 到本地
          const fallback = buildLocalSuggestion(brain, Date.now());
          return {
            ok: true,
            data: {
              suggestion: fallback.data.suggestion,
              evidence: fallback.data.evidence,
              source: "llm_failed",
              llmError: { code: result.error, message: result.message },
            },
            durationMs: Date.now() - startMs,
          };
        }

        const local = buildLocalSuggestion(brain, Date.now());
        return {
          ok: true,
          data: Object.assign({}, local.data, { durationMs: Date.now() - startMs, source: llm && !route ? "local_no_route" : "local" }),
        };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_SUGGEST_FAILED", message: String((e && e.message) || e) } } };
      }
    },
  });
}

function renderSuggest(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: suggest FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const s = d.suggestion || {};
    const lines = [{ type: "text", text: `dsh-project-brain: suggest (${d.source || "?"})` }];
    lines.push({ type: "text", text: `  ${s.title || "(无标题)"}` });
    if (s.reason) lines.push({ type: "text", text: `  reason: ${s.reason}` });
    if (s.confidence != null) lines.push({ type: "text", text: `  confidence: ${(s.confidence * 100).toFixed(0)}%` });
    if (s.suggestedTodoId) lines.push({ type: "text", text: `  todo: ${s.suggestedTodoId}` });
    if (s.suggestedMemoryIds && s.suggestedMemoryIds.length) lines.push({ type: "text", text: `  memories: ${s.suggestedMemoryIds.join(", ")}` });
    if (d.llmError) lines.push({ type: "text", text: `  llm_fallback: ${d.llmError.code} - ${d.llmError.message}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: suggest FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: suggest FAILED - " + JSON.stringify(value) }];
}