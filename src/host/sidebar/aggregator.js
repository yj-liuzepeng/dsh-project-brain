// SidebarPreview aggregator（runtime RPC 路径）：project.json + timeline/memory/todo -> 5 区块数据
// 5s 内存缓存；preview.changed 事件清缓存
//
// 注意：静态 workspace client 无法 host.call（已知限制#2），SidebarPreview 日常数据
// 走 build-time embed（build.js --workspace）；本模块只在 cordis-loader 正常启动、
// harness 可用的动态路径下提供 runtime 数据（RPC getPreview）。
//
// P0.4.1：stats/activity 改为真实数据（todo.jsonl / memory.jsonl / timeline.jsonl），
// 与 build.js 的 embed 口径一致；删除已死的 writePreviewCache（webServer 路由方案遗留）。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { todoStats, recentTimeline, techStackToType, activeTodos, isActiveMemory } from "../store/brain-logic.js";
import { sanitizeProjectDescription } from "../../scanner.js";

const CACHE_TTL_MS = 5000;
const cache = new Map(); // projectPath -> { ts, data }

export function invalidateAggregatorCache(projectPath) {
  if (projectPath) {
    cache.delete(projectPath);
  } else {
    cache.clear();
  }
}

function readJsonSync(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    return { __error: String((e && e.message) || e) };
  }
}

function readJsonlSync(filePath) {
  if (!existsSync(filePath)) return [];
  const out = [];
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (e) { /* skip bad line */ }
  }
  return out;
}

function deriveFallbackPhase(p) {
  const now = Date.now();
  const ts = (p && (p.updatedAt || p.lastScannedAt)) || now;
  const ageMs = now - ts;
  if (ageMs < 60_000) {
    return { title: "Project Brain 已就绪", progress: { done: 1, total: 1 } };
  }
  if (ageMs < 24 * 3600_000) {
    return { title: "今日活跃", progress: { done: 1, total: 2 } };
  }
  return { title: "维护中", progress: { done: 1, total: 3 } };
}

// 有 todo 数据时：Phase = 任务进度（done/total 非 cancelled）
function derivePhase(p, todos) {
  const active = todos.filter((t) => t && t.status !== "cancelled");
  if (active.length === 0) return deriveFallbackPhase(p);
  const done = active.filter((t) => t.status === "done").length;
  const inProgress = active.filter((t) => t.status === "in_progress");
  const title = inProgress.length > 0
    ? "进行中：" + inProgress[0].title
    : "待办 " + (active.length - done) + " 项";
  return { title: title, progress: { done: done, total: active.length } };
}

export function buildSidebarPreview(projectPath) {
  if (!projectPath) projectPath = ".";
  const cached = cache.get(projectPath);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.data;
  }

  const brainDir = path.join(projectPath, ".project-brain");
  const p = readJsonSync(path.join(brainDir, "project.json"));
  const architecture = readJsonSync(path.join(brainDir, "architecture.json"));
  const timeline = readJsonlSync(path.join(brainDir, "timeline.jsonl"));
  const memories = readJsonlSync(path.join(brainDir, "memory.jsonl"));
  const visibleMemories = memories.filter(isActiveMemory);
  const todos = readJsonlSync(path.join(brainDir, "todo.jsonl"));

  let data;
  if (!p) {
    data = { initialized: false, empty: true, projectPath };
  } else if (p.__error) {
    data = { initialized: false, error: p.__error, projectPath };
  } else {
    const activity = recentTimeline(timeline, 3).map((e) => ({
      id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType,
    }));
    const stats = todoStats(todos);
    data = {
      initialized: true,
      projectPath,
      project: {
        id: p.id,
        name: p.name,
        type: techStackToType(p.techStack),
        lastUpdateAt: p.updatedAt || p.lastScannedAt || Date.now(),
      },
      phase: derivePhase(p, todos),
      recentActivity: activity.length > 0 ? activity : (p.lastScannedAt ? [{
        id: "scan",
        title: "完成 project_init 扫描",
        occurredAt: p.lastScannedAt,
        eventType: "init",
      }] : []),
      memories: visibleMemories
        .slice()
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, 3),
      todos: todos,
      architecture: architecture && !architecture.__error ? architecture : null,
      stats: {
        pendingTodos: stats.pendingTodos,
        completedTodos: stats.completedTodos,
        decisions: visibleMemories.filter((m) => m.type === "decision").length,
      },
    };
  }

  cache.set(projectPath, { ts: Date.now(), data });
  return data;
}

// ─── P0.4.2 动态数据（webServer route 用）：按 workspaceRoot 异步读 .project-brain/ ───
// 供 HTTP route `/plugins/dsh-project-brain/preview.json` 复用，client 启动时 fetch。
// 已生成的 workspace 直接读文件（零 token）；未生成返回 initialized:false（Onboarding）。
// 返回结构与 build.js 的 build-time embed 对齐，client 无需区分来源。

export async function buildWorkspacePreview(fs, workspaceRoot) {
  if (!workspaceRoot) workspaceRoot = ".";
  const root = String(workspaceRoot).replace(/[\\/]+$/, "");

  async function readJson(file) {
    try {
      const target = await fs.resolve(root + "/" + file);
      const text = await fs.readText(target);
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  async function readJsonl(file) {
    let text;
    try {
      const target = await fs.resolve(root + "/" + file);
      text = await fs.readText(target);
    } catch (e) {
      return [];
    }
    const out = [];
    for (const line of String(text).split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s)); } catch (e) { /* skip */ }
    }
    return out;
  }

  const [p, timelineAll, memoriesAll, todosAll, codegraph, architecture] = await Promise.all([
    readJson(".project-brain/project.json"),
    readJsonl(".project-brain/timeline.jsonl"),
    readJsonl(".project-brain/memory.jsonl"),
    readJsonl(".project-brain/todo.jsonl"),
    readJson(".project-brain/codegraph.json"),
    readJson(".project-brain/architecture.json"),
  ]);

  if (!p) {
    return {
      generatedAt: Date.now(),
      initialized: false,
      workspaceRoot: root,
      project: null,
      phase: null,
      recentActivity: [],
      memories: [],
      memoriesAll: [],
      todos: [],
      timelineAll: [],
      architecture: null,
      stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 },
    };
  }

  const timeline = timelineAll.slice().sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
  const visibleMemories = memoriesAll.filter(isActiveMemory);
  const recentActivity = timeline.slice(0, 5).map((e) => ({ id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType }));
  const memories = visibleMemories.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3);
  const stats = todoStats(todosAll);
  const inProgress = todosAll.filter((t) => t && t.status === "in_progress");
  const activeForPhase = todosAll.filter((t) => t && t.status !== "cancelled");
  const phase = activeForPhase.length > 0
    ? {
        title: inProgress.length > 0 ? "进行中：" + inProgress[0].title : "待办 " + stats.pendingTodos + " 项",
        progress: { done: stats.completedTodos, total: activeForPhase.length },
      }
    : {
        title: "已扫描（" + (p.entrypoints ? p.entrypoints.length : 0) + " 个入口）",
        progress: { done: 1, total: 1 },
      };
  const todosActive = activeTodos(todosAll);
  const todosDone = todosAll.filter((t) => t && t.status === "done");
  const todos = todosActive.concat(todosDone).slice(0, 50);

  return {
    generatedAt: Date.now(),
    initialized: true,
    workspaceRoot: root,
    project: {
      id: p.id,
      name: p.name || "(unnamed)",
      type: techStackToType(p.techStack),
      description: sanitizeProjectDescription(p.description) || "",
      techStack: p.techStack || {},
      tooling: p.tooling || [],
      languages: p.languages || {},
      entrypoints: p.entrypoints || [],
      lastUpdateAt: p.updatedAt || p.lastScannedAt || Date.now(),
    },
    phase: phase,
    recentActivity: recentActivity.length > 0 ? recentActivity : (p.lastScannedAt ? [{
      id: "scan",
      title: "完成 project_init 扫描",
      occurredAt: p.lastScannedAt,
      eventType: "init",
    }] : []),
    memories: memories,
    memoriesAll: visibleMemories.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 50),
    todos: todos,
    timelineAll: timeline.slice(0, 50),
    codegraph: codegraph,
    architecture: architecture,
    stats: {
      pendingTodos: stats.pendingTodos,
      completedTodos: stats.completedTodos,
      decisions: visibleMemories.filter((m) => m.type === "decision").length,
      archivedMemories: memoriesAll.length - visibleMemories.length,
    },
  };
}
