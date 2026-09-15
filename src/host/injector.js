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
import { buildInjectionContext } from "./memory/inject-context.js";
import { ensureHousekeepOnRead } from "./memory/admit.js";

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
  try { await ensureHousekeepOnRead(fs, projectPath); } catch (e) {}
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
  return buildInjectionContext({ project, memories, todos, timeline });
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
