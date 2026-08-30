// injector.js - Context Injector（v0.3.0）
// SPEC §4.5：跨 Session 续接时，从 Project Brain 挑选应注入的 Memory。
// 通过 systemPrompt.service.section() 注册一个 "project-brain-context" 段，
// DSH 每次 assemble prompt 时调用 render() 返回 markdown 文本。
//
// 数据流：
//   ① agent/session-start → 清 cache（让下个 section render 重读 .project-brain/）
//   ② preview.changed → 清 cache
//   ③ section.render → 同步从 module cache 取预读数据（render 是同步的）
//
// 预读策略：在 agent/session-start 监听里，async 读 .project-brain/{memory,todo,timeline}.jsonl
//   → 存到 module 变量 → render 直接用。
//
// 选择算法（SPEC §4.5）：
//   score = importance * 0.5 + recency_score * 0.3 + moduleMatch * 0.2
//   recency_score: 7天内=1.0，90天线性衰减到0
//   moduleMatch: 当前 cwd 命中 relatedFiles/relatedModules 计分（这里用 cwd 作为弱相关）
//
// Token 预算：默认 1500 token 上限，超出截断。

import { brainPath, readJsonl, readJson } from "./store/brain-files.js";
import { todoStats, recentTimeline } from "./store/brain-logic.js";
import { retrieveMemories } from "./memory/retrieval.js";

const DEFAULT_MAX_TOKENS = 1500;
// 每个 workspace 独立缓存。旧实现只有一个 module-global cache，A 项目启动后再
// 打开 B 项目时，B 的 system prompt 可能拿到 A 的记忆。
const projectCache = new Map();
const sessionProjects = new Map();

function cwdFrom(value) {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.cwd,
    value.meta && value.meta.cwd,
    value.header && value.header.cwd,
    value.header && value.header.meta && value.header.meta.cwd,
  ];
  for (const cwd of candidates) {
    if (typeof cwd === "string" && cwd.trim()) return cwd.trim();
  }
  return null;
}

function sessionFrom(value) {
  if (!value || typeof value !== "object") return null;
  return value.session || (value.agent && value.agent.session) ||
    (value.initiator && value.initiator.session) || value.currentSession || null;
}

function sessionIdFrom(value) {
  if (!value || typeof value !== "object") return null;
  const session = sessionFrom(value);
  return value.sessionId || value.id || (session && (session.id || (session.meta && session.meta.id))) || null;
}

function resolveContextProject(context, sessions) {
  const direct = cwdFrom(context) || cwdFrom(sessionFrom(context));
  if (direct) return direct;
  const sid = sessionIdFrom(context);
  if (sid && sessionProjects.has(sid)) return sessionProjects.get(sid);
  if (sid && sessions && typeof sessions.get === "function") {
    try {
      const cwd = cwdFrom(sessions.get(sid));
      if (cwd) return cwd;
    } catch (e) {}
  }
  // 单项目进程下保留兼容；多项目时宁可不注入，也绝不猜测并串数据。
  if (projectCache.size === 1) return projectCache.keys().next().value;
  return null;
}

// 估算 token 数（粗略：英文 4 字符/token，中文 1.5 字符/token）
function estimateTokens(text) {
  if (!text) return 0;
  // 中文字符 \u4e00-\u9fff 算 1.5 字符/token，英文算 4
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = text.length - cn;
  return Math.ceil(cn / 1.5 + other / 4);
}

// 截断 markdown 到 token 上限（按段落截断，避免截到一半）
function truncateToTokens(md, maxTokens) {
  if (estimateTokens(md) <= maxTokens) return md;
  const lines = md.split("\n");
  let used = 0;
  const out = [];
  for (const line of lines) {
    const t = estimateTokens(line);
    if (used + t > maxTokens) {
      out.push("\n…（内容超出 token 预算已截断，可调用 project_continue / project_memory_list 获取完整内容）");
      break;
    }
    out.push(line);
    used += t;
  }
  return out.join("\n");
}

// 选择 Top-K 记忆（按 memoryScore 排序）
function topKMemories(memories, n) {
  return retrieveMemories({ memories, topK: n }).map((hit) => hit.memory);
}

// 渲染 markdown section
function renderContext(projectData, memories, todos, recentEvents, activeTodo) {
  const lines = [];
  lines.push("## Project Brain Context（自动注入 · v0.3.0）");
  lines.push("");
  lines.push("> 以下内容由 dsh-project-brain 自动从 `.project-brain/` 读取，用于让你（LLM）一进入 session 就掌握项目上下文。可调用 `project_continue` / `project_memory_list` / `project_todo_list` 获取更详细数据。");
  lines.push("");

  if (projectData) {
    lines.push("### 项目概况");
    lines.push(`- 名称: ${projectData.name || "(未命名)"}`);
    if (projectData.type) lines.push(`- 类型: ${projectData.type}`);
    if (projectData.techStack) {
      const ts = Object.entries(projectData.techStack).map(([k, v]) => `${k}=${v}`).join(", ");
      if (ts) lines.push(`- 技术栈: ${ts}`);
    }
    if (projectData.description) lines.push(`- 简介: ${projectData.description}`);
    lines.push("");
  }

  // Top 记忆
  if (memories.length > 0) {
    lines.push("### 关键记忆（按重要度+时新性排序，Top " + memories.length + "）");
    for (const m of memories) {
      const tag = m.type ? `[${m.type}] ` : "";
      lines.push(`- ${tag}${m.title}`);
      if (m.content) {
        const snippet = String(m.content).slice(0, 200).replace(/\n+/g, " ");
        lines.push(`  ${snippet}`);
      }
    }
    lines.push("");
  }

  // 活跃 TODO（最多 5）
  if (todos.length > 0) {
    lines.push("### 活跃 TODO（最多 5）");
    for (const t of todos.slice(0, 5)) {
      const prio = t.priority ? `[${t.priority}] ` : "";
      const status = t.status === "in_progress" ? "⏳ " : "";
      lines.push(`- ${status}${prio}${t.title}`);
    }
    lines.push("");
  }

  // 最近活动（最多 3）
  if (recentEvents.length > 0) {
    lines.push("### 最近活动");
    for (const e of recentEvents) {
      const date = new Date(e.occurredAt);
      const ymd = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
      lines.push(`- ${ymd}: ${e.title}`);
    }
    lines.push("");
  }

  // 当前进行中的 TODO 重点提示
  if (activeTodo) {
    lines.push(`> ⚡ 当前进行中：**${activeTodo.title}** （优先级 ${activeTodo.priority || "medium"}）`);
  }

  lines.push("");
  lines.push("### 项目记忆约定");
  lines.push("- 开发中出现稳定的架构决策、需求约束、Bug 根因或可复用教训时，调用 `project_memory_add` 持久化。");
  lines.push("- 新任务用 `project_todo_add`，状态变化用 `project_todo_update` / `project_todo_done`，不要只留在当前对话里。");
  lines.push("- 项目结构发生明显变化后调用 `project_rescan`；需要理解最近代码变化时调用 `project_diff`。");

  return lines.join("\n");
}

// 从 fs 服务读取项目数据（async）
async function loadProjectDataForInjection(fs, projectPath) {
  try {
    const [project, memories, todos, timeline] = await Promise.all([
      readJson(fs, brainPath(projectPath, "project.json")),
      readJsonl(fs, brainPath(projectPath, "memory.jsonl")),
      readJsonl(fs, brainPath(projectPath, "todo.jsonl")),
      readJsonl(fs, brainPath(projectPath, "timeline.jsonl")),
    ]);
    return { project, memories: memories || [], todos: todos || [], timeline: timeline || [] };
  } catch (e) {
    return { project: null, memories: [], todos: [], timeline: [] };
  }
}

// 预读并刷新 cache
async function refreshCache(fs, projectPath) {
  if (!fs || !projectPath) return;
  const data = await loadProjectDataForInjection(fs, projectPath);
  if (!data.project || data.project.__error) {
    projectCache.delete(projectPath);
    return;
  }
  projectCache.set(projectPath, { data, ts: Date.now() });
}

// 只读取指定 workspace 的 ready 数据。
function getCachedSection(projectPath) {
  const cached = projectPath ? projectCache.get(projectPath) : null;
  if (!cached || !cached.data) return null;
  const { project, memories, todos, timeline } = cached.data;
  const stats = todoStats(todos);
  const activeTodos = todos.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const top = topKMemories(memories, 5);
  const recent = recentTimeline(timeline, 3);
  const inProgress = activeTodos.find((t) => t.status === "in_progress");
  let md = renderContext(project, top, activeTodos, recent, inProgress);
  md = truncateToTokens(md, DEFAULT_MAX_TOKENS);
  return md;
}

// 主入口：注册 systemPrompt section + 监听 session-start 预读
export function setupInjector(ctx, fs, sandboxPolicy) {
  if (!ctx) return;

  let systemPrompt = null;
  try { systemPrompt = ctx.get ? ctx.get("systemPrompt") : ctx.systemPrompt; } catch (e) { systemPrompt = null; }
  let sessions = null;
  try { sessions = ctx.get ? ctx.get("sessions") : ctx.sessions; } catch (e) { sessions = null; }

  const logger = (level, msg) => {
    try {
      if (ctx.logger && typeof ctx.logger[level] === "function") ctx.logger[level]("[dsh-project-brain] " + msg);
      else if (typeof console !== "undefined") console.log("[dsh-project-brain] " + msg);
    } catch (e) {}
  };

  // 1) 注册 systemPrompt section（text 是函数，每次 assemble 调用）
  //   v0.3.1 修复：DSH PromptSection 用 `text: string | ((ctx) => string)`，不是 `render`。
  //   之前传 `render` 字段导致 DSH 在合并 sections 时对 undefined 调 .indexOf 抛错。
  if (systemPrompt && typeof systemPrompt.section === "function") {
    try {
      const section = {
        name: "project-brain-context",
        order: 100,  // harness=-100, persona=0, tool guidance=100-199; 我们放在工具指引区间内
        text: (context) => {
          try {
            const projectPath = resolveContextProject(context, sessions);
            const md = getCachedSection(projectPath);
            if (!md) return "";
            return md;
          } catch (e) {
            return "";
          }
        },
      };
      const disposer = systemPrompt.section(section);
      if (typeof ctx.effect === "function") {
        try { ctx.effect(() => disposer, "dsh-project-brain:injector:section"); } catch (e) {}
      }
      logger("info", "injector: systemPrompt section registered (v0.3.1: text 字段修复)");
    } catch (e) {
      logger("warn", "injector: section registration failed: " + String((e && e.message) || e));
    }
  } else {
    logger("warn", "injector: systemPrompt service unavailable, skip section registration");
  }

  // 2) agent/session-start → 预读 cache
  if (ctx.on) {
    try {
      ctx.on("agent/session-start", (payload) => {
        try {
          const session = sessionFrom(payload);
          let projectPath = cwdFrom(session) || cwdFrom(payload);
          const sid = sessionIdFrom(payload);
          if (!projectPath && sandboxPolicy) {
            projectPath = sandboxPolicy.workspaceRoot || null;
          }
          if (projectPath && fs) {
            if (sid) sessionProjects.set(sid, projectPath);
            refreshCache(fs, projectPath).catch((e) => logger("warn", "injector: refresh cache failed: " + String((e && e.message) || e)));
            logger("info", "injector: session-start cached project=" + projectPath);
          } else {
            logger("info", "injector: session-start without projectPath, skip");
          }
        } catch (e) {}
      });
    } catch (e) {
      logger("warn", "injector: agent/session-start subscription failed: " + String((e && e.message) || e));
    }
  }

  // 3) preview.changed → 刷新 cache（用户调了 project_todo_add 等后立即反映）
  if (ctx.on) {
    try {
      ctx.on("project_brain/preview.changed", (payload) => {
        try {
          const projectPath = payload && payload.projectPath;
          if (projectPath && fs) {
            refreshCache(fs, projectPath).catch(() => {});
          }
        } catch (e) {}
      });
    } catch (e) {}
  }
}
