// suggest.js - v0.4.15 智能续接（project_suggest_next）
//
// 核心目标：Session 开始时给用户 1-2 句"今天可能想推进什么"，让跨 session 续接不需要用户重新描述项目。
// 数据源：
//   - 高重要性 + 近期记忆（decision / architecture / requirement / bug / lesson）
//   - 进行中的 TODO（in_progress > pending > 阻塞）
//   - 最近活动时间线（特别是上次 session 的最后一个事件）
//   - 项目概述（project.description / techStack）
//   - 可选：架构报告（architecture.overview.purpose / layers / components）
//
// LLM 调用（可选）：
//   - 复用当前 DSH Session 的 LLM（与 architecture / session-extractor / project_diff 共用 streamLlmText）
//   - prompt：给 LLM 一个结构化输入，要求 JSON 输出
//   - 失败 / 不可用：返回 buildLocalFallback（纯规则推荐）
//
// 强约束：纯函数 + 不依赖 DSH runtime（便于 smoke 离线测试）。

import { recentTimeline, activeTodos, topMemories, isCoreMemory } from "./store/brain-logic.js";

// ──  收集证据（纯函数，input brain 数据） ──

function buildEvidence(brain, now) {
  const nowMs = typeof now === "number" ? now : Date.now();
  const project = (brain && brain.project) || null;
  const memories = ((brain && brain.memories) || []).filter(isCoreMemory);
  const todos = (brain && brain.todos) || [];
  const timeline = (brain && brain.timeline) || [];
  const architecture = brain && brain.architecture;

  // 活跃 TODO（in_progress 优先）
  const inProgress = todos.filter((t) => t && t.status === "in_progress");
  const pending = todos.filter((t) => t && t.status === "pending");
  const blocked = todos.filter((t) => t && t.status === "blocked");

  // Top-5 记忆（按 brain-logic 的 importance*0.5 + recency*0.3 算法）
  const topMem = topMemories(memories, 5, nowMs);

  // 最近活动时间线（取最近 3 条）
  const recentEvents = recentTimeline(timeline, 3);

  // 距上次 session 摘要多久
  const lastSummary = timeline
    .filter((e) => e && (e.eventType === "session_summary" || e.eventType === "init" || e.eventType === "rescan"))
    .sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0))[0];
  const daysSinceLastSession = lastSummary
    ? Math.max(0, Math.round((nowMs - (lastSummary.occurredAt || nowMs)) / 86_400_000))
    : null;

  return {
    project,
    memories: topMem,
    activeTodos: { inProgress, pending, blocked },
    recentEvents,
    architecture,
    daysSinceLastSession,
    now: nowMs,
  };
}

// ──  本地 fallback 推荐（不调 LLM） ──

function buildLocalFallback(evidence) {
  const { project, memories, activeTodos: t, recentEvents, daysSinceLastSession } = evidence;

  // 优先级 1：进行中的任务
  if (t.inProgress.length > 0) {
    const top = t.inProgress[0];
    const relatedMem = pickRelatedMem(top, memories);
    return {
      title: "继续推进：" + truncate(top.title, 60),
      reason: relatedMem
        ? "上次中断在 “" + truncate(relatedMem.title, 30) + "” 相关工作"
        : "你正在处理这条任务（in_progress）",
      confidence: 0.85,
      suggestedTodoId: top.id || null,
      suggestedMemoryIds: relatedMem ? [relatedMem.id] : [],
      fallback: true,
    };
  }

  // 优先级 2：最高优先级 pending TODO
  if (t.pending.length > 0) {
    const sorted = sortTodosByPriority(t.pending);
    const top = sorted[0];
    const relatedMem = pickRelatedMem(top, memories);
    return {
      title: "建议开始：" + truncate(top.title, 60),
      reason: relatedMem
        ? "与已记录的 “" + truncate(relatedMem.title, 30) + "” 决策/教训相关"
        : "这是当前最高优先级待办（" + (top.priority || "medium") + "）",
      confidence: 0.7,
      suggestedTodoId: top.id || null,
      suggestedMemoryIds: relatedMem ? [relatedMem.id] : [],
      fallback: true,
    };
  }

  // 优先级 3：被阻塞的任务
  if (t.blocked.length > 0) {
    return {
      title: "解决阻塞：" + truncate(t.blocked[0].title, 60),
      reason: "有 " + t.blocked.length + " 个任务被阻塞，先解决阻塞可解锁后续工作",
      confidence: 0.5,
      suggestedTodoId: t.blocked[0].id || null,
      suggestedMemoryIds: [],
      fallback: true,
    };
  }

  // 优先级 4：基于记忆的推断
  if (memories.length > 0) {
    const recents = memories.filter((m) => {
      const age = (evidence.now - (m.updatedAt || m.createdAt || 0)) / 86_400_000;
      return age <= 7;
    });
    if (recents.length > 0) {
      return {
        title: "回顾近期记忆：" + truncate(recents[0].title, 60),
        reason: daysSinceLastSession != null && daysSinceLastSession > 0
          ? "距上次 Session " + daysSinceLastSession + " 天，先回顾近期项目知识"
          : "最近记录的项目决策可作为下一步起点",
        confidence: 0.45,
        suggestedTodoId: null,
        suggestedMemoryIds: [recents[0].id],
        fallback: true,
      };
    }
  }

  // 优先级 5：无任何数据
  if (recentEvents.length > 0) {
    return {
      title: "回顾上次活动：" + truncate(recentEvents.title, 60),
      reason: "项目无活跃任务，可从最近活动入手",
      confidence: 0.3,
      suggestedTodoId: null,
      suggestedMemoryIds: [],
      fallback: true,
    };
  }

  return {
    title: project ? "规划下一步" : "初始化项目脑",
    reason: project
      ? "暂无待办和近期记忆，建议用 project_todo_add 规划下一步"
      : "项目脑还未初始化，调用 project_init 开始",
    confidence: 0.2,
    suggestedTodoId: null,
    suggestedMemoryIds: [],
    fallback: true,
  };
}

function sortTodosByPriority(todos) {
  const order = { urgent: 0, high: 1, medium: 2, low: 3 };
  return todos.slice().sort((a, b) => {
    const pa = order[a.priority || "medium"] != null ? order[a.priority || "medium"] : 2;
    const pb = order[b.priority || "medium"] != null ? order[b.priority || "medium"] : 2;
    return pa - pb;
  });
}

function pickRelatedMem(todo, memories) {
  if (!todo || memories.length === 0) return null;
  // 优先找 relatedFiles / tags 重叠的记忆
  const todoFiles = new Set((todo.relatedFiles || []).map(String));
  const todoTags = new Set((todo.tags || []).map(String));
  for (const m of memories) {
    const overlap = (m.relatedFiles || []).some((f) => todoFiles.has(f));
    const tagOverlap = (m.tags || []).some((t) => todoTags.has(t));
    if (overlap || tagOverlap) return m;
  }
  // 退化：最近一条同类型记忆
  return memories[0] || null;
}

function truncate(s, limit) {
  s = String(s || "").trim();
  if (s.length <= limit) return s;
  return s.slice(0, limit - 1) + "…";
}

// ──  LLM prompt ──

function buildSuggestPrompt(evidence) {
  const payload = {
    project: evidence.project
      ? { name: evidence.project.name, type: evidence.project.type || evidence.project.techStack, description: truncate(evidence.project.description, 300) }
      : null,
    daysSinceLastSession: evidence.daysSinceLastSession,
    inProgress: evidence.activeTodos.inProgress.slice(0, 3).map(compactTodo),
    pendingTop: sortTodosByPriority(evidence.activeTodos.pending).slice(0, 3).map(compactTodo),
    blocked: evidence.activeTodos.blocked.slice(0, 2).map(compactTodo),
    topMemories: evidence.memories.slice(0, 5).map(compactMem),
    recentEvents: evidence.recentEvents.slice(0, 3).map((e) => ({ eventType: e.eventType, title: truncate(e.title, 80), occurredAt: e.occurredAt })),
    architectureSummary: evidence.architecture && evidence.architecture.summary
      ? truncate(evidence.architecture.summary, 400)
      : null,
  };
  return [
    "你是 dsh-project-brain 的「智能续接」助手。Session 开始时给用户 1-2 句话 + 一条「理由」，让他不需要重新描述项目就知道今天能做什么。",
    "根据下面提供的项目状态（活跃 TODO / 记忆 / 时间线 / 架构概况）判断：今天最值得推进的一件事是什么？理由是什么？",
    "规则：",
    "1) title 必须简洁（≤ 30 字），是动词开头（「继续 X」「建议开始 X」「回顾 X」「解决 X」「规划 X」）；",
    "3) reason 必须有依据：引用具体的 TODO id、记忆 title、或者时间线事件；",
    "4) suggestedTodoId 必须填 1 个（最相关的那个 active todo），suggestedMemoryIds 填 1-3 个最相关的记忆；",
    "5) confidence 0~1：进行中任务 ≥0.8，最高级 pending 0.5-0.8，记忆推断 0.3-0.5，纯空白 ≤0.3；",
    "6) 不允许编造信息；只能基于提供的 evidence；如果完全没数据，title 写「初始化项目脑」或「规划下一步」；",
    "7) 输出严格 JSON 对象，不要 Markdown。",
    "格式：" + JSON.stringify({ title: "动词 + 内容", reason: "依据 + 上下文", confidence: 0.7, suggestedTodoId: "todo id 或 null", suggestedMemoryIds: ["memory id"] }),
    "证据：" + JSON.stringify(payload),
  ].join("\n");
}

function compactTodo(t) {
  return { id: t.id, title: truncate(t.title, 80), priority: t.priority || "medium", status: t.status, tags: (t.tags || []).slice(0, 3) };
}
function compactMem(m) {
  return { id: m.id, type: m.type, title: truncate(m.title, 80), importance: m.importance, tags: (m.tags || []).slice(0, 3) };
}

// ──  解析 LLM 输出（与 analyzer.js 共享的 JSON 容错） ──

function parseSuggestJson(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const candidates = [];
  // 1) 原始
  candidates.push(text);
  // 2) 去 ```json 围栏
  candidates.push(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim());
  // 3) 找首个 { 到末尾最后一个 } 的 balanced 子串
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  // 4) 清理尾逗号（防止 LLM 输出 {"foo":"a",}）
  const stripTrailing = (s) => s.replace(/,\s*([}\]])/g, "$1");
  for (const c of candidates) {
    if (!c) continue;
    try { return JSON.parse(stripTrailing(c)); } catch (e) {}
  }
  return null;
}

function normalizeSuggestion(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const title = String(parsed.title || "").trim().slice(0, 80);
  const reason = String(parsed.reason || "").trim().slice(0, 200);
  if (!title || !reason) return null;
  const confidence = Number(parsed.confidence);
  const suggestedTodoId = parsed.suggestedTodoId && typeof parsed.suggestedTodoId === "string" ? parsed.suggestedTodoId.slice(0, 64) : null;
  const suggestedMemoryIds = Array.isArray(parsed.suggestedMemoryIds)
    ? parsed.suggestedMemoryIds.filter((x) => typeof x === "string").slice(0, 5)
    : [];
  return {
    title,
    reason,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    suggestedTodoId,
    suggestedMemoryIds,
    fallback: false,
  };
}

// ──  公开 API ──

// buildLocalSuggestion 不调 LLM，只走规则（供 RPC fallback / build-time embed）
export function buildLocalSuggestion(brain, now) {
  const evidence = buildEvidence(brain, now);
  const local = buildLocalFallback(evidence);
  return {
    ok: true,
    data: {
      suggestion: local,
      evidence: {
        activeTodos: {
          inProgress: evidence.activeTodos.inProgress.length,
          pending: evidence.activeTodos.pending.length,
          blocked: evidence.activeTodos.blocked.length,
        },
        memories: evidence.memories.length,
        recentEvents: evidence.recentEvents.length,
        daysSinceLastSession: evidence.daysSinceLastSession,
      },
      source: "local",
    },
  };
}

// buildLlmSuggestion 给 caller 用的低阶 helper：返回 { text, attempt }，让上层 streamLlmText 调用
//   实际在 tools/suggest.js 包装，避免 host 模块直接依赖 llm service 接口
export function buildSuggestPromptForLlm(brain, now) {
  const evidence = buildEvidence(brain, now);
  return { prompt: buildSuggestPrompt(evidence), evidence };
}

export { parseSuggestJson, normalizeSuggestion, buildEvidence, buildLocalFallback };

// 给 smoke test / build embed 用的纯数据组装（不依赖 llm service）
export function buildSuggestionData(brain, now) {
  return buildLocalSuggestion(brain, now);
}