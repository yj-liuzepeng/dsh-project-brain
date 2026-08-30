// brain-logic.js - 纯逻辑层（无 IO、无宿主依赖）
// 供 Host tools（经 esbuild 打包）与 scripts/smoke-test.mjs（node 直跑）共用。
// 数据格式与 scripts/brain-memory.mjs 写入的 jsonl 保持一致。

export const MEMORY_TYPES = [
  "decision", "requirement", "architecture", "change",
  "bug", "lesson", "issue", "context",
];

export const TODO_STATUSES = ["pending", "in_progress", "blocked", "done", "cancelled"];
export const TODO_PRIORITIES = ["low", "medium", "high", "urgent"];

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const HIGH_VALUE_MEMORY_TYPES = { decision: true, architecture: true, bug: true, lesson: true };

export function makeId(prefix, now, rand) {
  const t = (now != null ? now : Date.now()).toString(36);
  const r = rand != null ? rand : Math.random().toString(36).slice(2, 8);
  return prefix + "-" + t + "-" + r;
}

export function normalizeMemoryType(type) {
  const s = String(type || "").toLowerCase().trim();
  return MEMORY_TYPES.indexOf(s) >= 0 ? s : null;
}

export function normalizePriority(priority) {
  const s = String(priority || "").toLowerCase().trim();
  return TODO_PRIORITIES.indexOf(s) >= 0 ? s : null;
}

export function normalizeStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  return TODO_STATUSES.indexOf(s) >= 0 ? s : null;
}

export function makeMemoryEntry(input, now) {
  const i = input || {};
  const importance = Number(i.importance);
  const confidence = Number(i.confidence);
  const relatedFiles = Array.isArray(i.relatedFiles) ? i.relatedFiles.map(String).slice(0, 20) : null;
  const tags = Array.isArray(i.tags) ? i.tags.map(String).slice(0, 10) : null;
  return {
    schemaVersion: 2,
    id: i.id || makeId("mem", now),
    type: normalizeMemoryType(i.type) || "context",
    title: String(i.title || "").slice(0, 200),
    content: String(i.content || ""),
    importance: isNaN(importance) ? 0.5 : Math.min(1, Math.max(0, importance)),
    confidence: isNaN(confidence) ? 0.7 : Math.min(1, Math.max(0, confidence)),
    status: "active",
    ...(i.source && typeof i.source === "object" ? { source: i.source } : {}),
    ...(relatedFiles && relatedFiles.length ? { relatedFiles: relatedFiles } : {}),
    ...(tags && tags.length ? { tags: tags } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function isActiveMemory(memory) {
  return Boolean(memory) && memory.status !== "archived" && memory.status !== "superseded" && memory.status !== "deleted";
}

export function makeTodoEntry(input, now) {
  const i = input || {};
  const relatedFiles = Array.isArray(i.relatedFiles) ? i.relatedFiles.map(String).slice(0, 20) : null;
  return {
    id: i.id || makeId("todo", now),
    title: String(i.title || "").slice(0, 200),
    description: String(i.description || ""),
    status: "pending",
    priority: normalizePriority(i.priority) || "medium",
    ...(relatedFiles && relatedFiles.length ? { relatedFiles: relatedFiles } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

// 活跃 todo（未 done / 未 cancelled），优先级高在前，同优先级新创建在前
export function activeTodos(todos) {
  const list = (todos || []).filter(function (t) {
    return t && t.status !== "done" && t.status !== "cancelled";
  });
  list.sort(function (a, b) {
    const pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 2;
    const pb = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : 2;
    if (pa !== pb) return pa - pb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}

export function todoStats(todos) {
  const list = todos || [];
  const active = list.filter(function (t) { return t && t.status !== "done" && t.status !== "cancelled"; });
  const done = list.filter(function (t) { return t && t.status === "done"; });
  return { pendingTodos: active.length, completedTodos: done.length, total: list.length };
}

// Memory 排序分：importance*0.5 + recency*0.3 + typeBoost*0.2
// recency: 7 天内 1.0，90 天线性衰减到 0
export function memoryScore(m, now) {
  const nowMs = now != null ? now : Date.now();
  const importance = typeof m.importance === "number" ? m.importance : 0.5;
  const created = m.createdAt || 0;
  const ageDays = Math.max(0, (nowMs - created) / 86400000);
  let recency = 1 - ageDays / 90;
  if (recency < 0) recency = 0;
  if (ageDays <= 7) recency = 1;
  const typeBoost = HIGH_VALUE_MEMORY_TYPES[m.type] ? 1 : 0.5;
  return importance * 0.5 + recency * 0.3 + typeBoost * 0.2;
}

export function topMemories(memories, n, now) {
  const list = (memories || []).filter(isActiveMemory);
  list.sort(function (a, b) { return memoryScore(b, now) - memoryScore(a, now); });
  return list.slice(0, n || 5);
}

export function recentTimeline(timeline, n) {
  const list = (timeline || []).slice();
  list.sort(function (a, b) { return (b.occurredAt || 0) - (a.occurredAt || 0); });
  return list.slice(0, n || 5);
}

export function techStackToType(techStack) {
  if (!techStack || typeof techStack !== "object") return "Untyped";
  const parts = [];
  for (const k of Object.keys(techStack)) {
    if (techStack[k]) parts.push(String(techStack[k]));
  }
  return parts.length > 0 ? parts.join(" · ") : "Untyped";
}

// project_continue 的数据组装（纯函数）
export function buildContinueData(brain, now) {
  const nowMs = now != null ? now : Date.now();
  const p = brain && brain.project;
  const memories = (brain && brain.memories) || [];
  const todos = (brain && brain.todos) || [];
  const timeline = (brain && brain.timeline) || [];

  const activity = recentTimeline(timeline, 5).map(function (e) {
    return { id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType };
  });
  const top = topMemories(memories, 5, nowMs).map(function (m) {
    return {
      id: m.id, type: m.type, title: m.title,
      content: String(m.content || "").slice(0, 200),
      importance: m.importance, createdAt: m.createdAt,
    };
  });
  const active = activeTodos(todos);
  const pending = active.slice(0, 10).map(function (t) {
    return { id: t.id, title: t.title, status: t.status, priority: t.priority };
  });
  const stats = todoStats(todos);
  const activeMemories = memories.filter(isActiveMemory);
  const decisions = activeMemories.filter(function (m) { return m.type === "decision"; });
  const inProgress = active.filter(function (t) { return t.status === "in_progress"; })[0];

  let suggestedNextStep;
  if (inProgress) {
    suggestedNextStep = "继续进行中任务：" + inProgress.title;
  } else if (active.length > 0) {
    suggestedNextStep = "建议开始：" + active[0].title;
  } else if (activity.length > 0) {
    suggestedNextStep = "无待办；可参考最近活动：" + activity[0].title;
  } else {
    suggestedNextStep = "暂无待办；建议用 project_todo_add 规划下一步";
  }

  return {
    initialized: Boolean(p && !p.__error),
    projectPath: brain ? brain.projectPath : null,
    project: p && !p.__error ? {
      id: p.id,
      name: p.name,
      type: techStackToType(p.techStack),
      lastUpdateAt: p.updatedAt || p.lastScannedAt || nowMs,
    } : null,
    recentActivity: activity,
    topMemories: top,
    pendingTodos: pending,
    stats: {
      pendingTodos: stats.pendingTodos,
      completedTodos: stats.completedTodos,
      decisions: decisions.length,
      memories: activeMemories.length,
    },
    suggestedNextStep: suggestedNextStep,
  };
}

// 按 id 前缀或标题精确匹配找活跃 todo（project_todo_done 用）
export function findTodo(todos, ref) {
  const key = String(ref || "").trim();
  if (!key) return null;
  const active = activeTodos(todos);
  for (const t of active) {
    if (t.id === key || t.id.indexOf(key) === 0) return t;
  }
  const lower = key.toLowerCase();
  for (const t of active) {
    if (String(t.title || "").toLowerCase() === lower) return t;
  }
  return null;
}

// ─── Dream 整合算法（v0.3.12 新增）───
// 纯逻辑：从 memory 列表算 merge + archive 候选（plannedActions）。
// 抽到 brain-logic 是为了让 smoke 测试不依赖 dsh-tools runtime。
//
// 参数：
//   memories:        现有 memory 列表
//   opts:            { now, mergeThreshold=0.92, archiveImportance=0.15, archiveAgeDays=30 }
// 返回：{ plannedActions, mergeCount, archiveCount }
export function computeDreamActions(memories, opts) {
  const o = opts || {};
  const now = typeof o.now === "number" ? o.now : Date.now();
  const mergeThreshold = typeof o.mergeThreshold === "number" ? o.mergeThreshold : 0.92;
  const archiveImp = typeof o.archiveImportance === "number" ? o.archiveImportance : 0.15;
  const archiveAgeDays = typeof o.archiveAgeDays === "number" ? o.archiveAgeDays : 30;

  const list = memories || [];
  const plannedActions = [];
  const seen = new Set();

  // 1) 去重候选（Jaccard ≥ threshold）
  const items = list.filter(isActiveMemory).map((m, i) => ({ m, i, bg: titleBigrams(m.title) }));
  for (let i = 0; i < items.length; i++) {
    if (seen.has(items[i].i)) continue;
    const group = [items[i].i];
    for (let j = i + 1; j < items.length; j++) {
      if (seen.has(items[j].i)) continue;
      if (items[i].m.type !== items[j].m.type) continue;
      const sim = jaccard(items[i].bg, items[j].bg);
      if (sim >= mergeThreshold) {
        group.push(items[j].i);
        seen.add(items[j].i);
      }
    }
    if (group.length > 1) {
      const sorted = group.map((idx) => items[idx].m).sort((a, b) => {
        const ai = (a.importance || 0) * 100 + (String(a.content || "").length);
        const bi = (b.importance || 0) * 100 + (String(b.content || "").length);
        return bi - ai;
      });
      const keep = sorted[0];
      const drop = sorted.slice(1);
      plannedActions.push({
        action: "merge",
        keepId: keep.id,
        keepTitle: keep.title,
        dropIds: drop.map((m) => m.id),
        dropTitles: drop.map((m) => m.title),
        note: "Jaccard ≥ " + mergeThreshold + "（title 相似），保留 importance 高 + content 长的",
      });
    }
    seen.add(items[i].i);
  }

  // 2) 归档候选（低 importance + 超过 archiveAgeDays 天，且未 archived）
  for (const m of list) {
    if ((m.importance || 0) >= archiveImp) continue;
    const age = now - (m.createdAt || 0);
    if (age < archiveAgeDays * 86400000) continue;
    if (m.status === "archived") continue;
    plannedActions.push({
      action: "archive_candidate",
      id: m.id,
      type: m.type,
      title: m.title,
      importance: m.importance,
      ageDays: Math.round(age / 86400000),
      note: "importance < " + archiveImp + " 且年龄 > " + archiveAgeDays + " 天",
    });
  }

  return {
    plannedActions,
    mergeCount: plannedActions.filter((a) => a.action === "merge").length,
    archiveCount: plannedActions.filter((a) => a.action === "archive_candidate").length,
  };
}

// 应用 commit 计划到 memory 列表（不写文件，纯返回 next list）
//   merge:    dropped 移除；keep 加 reinforced + importance +0.05 + relatedMemoryIds 合并
//   archive:  status 改成 archived
//   mode=full 时：archived 的 memory 真正从列表中移除（清理 dead bytes）
export function applyDreamCommit(memories, plannedActions, now, mode) {
  const list = (memories || []).slice();
  const merges = (plannedActions || []).filter((a) => a.action === "merge");
  const archives = (plannedActions || []).filter((a) => a.action === "archive_candidate");
  const dropIds = new Set();
  const keepMap = new Map();
  for (const m of merges) {
    for (const id of m.dropIds) dropIds.add(id);
    keepMap.set(m.keepId, m);
  }
  let next = list.filter((mem) => !dropIds.has(mem.id)).map((mem) => {
    const k = keepMap.get(mem.id);
    if (!k) return mem;
    const mergedRelated = (mem.relatedMemoryIds || []).concat(k.dropIds).filter((v, i, arr) => arr.indexOf(v) === i);
    return Object.assign({}, mem, {
      relatedMemoryIds: mergedRelated,
      lastAccessedAt: now,
      status: "reinforced",
      importance: Math.min(1, (mem.importance || 0.5) + 0.05),
    });
  });
  const archiveIds = new Set(archives.map((a) => a.id));
  next = next.map((mem) => {
    if (!archiveIds.has(mem.id)) return mem;
    return Object.assign({}, mem, { status: "archived", lastAccessedAt: now });
  });
  // full 模式：archived 的 memory 真正移除（已标记完，下一步清理）
  if (mode === "full") {
    next = next.filter((mem) => mem.status !== "archived");
  }
  // 稳定排序：按 importance DESC, createdAt DESC（让 build-time embed Top-K 更准）
  next.sort((a, b) => {
    const ai = (b.importance || 0) - (a.importance || 0);
    if (ai !== 0) return ai;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return next;
}

// title 归一化 + 双字bigram（Jaccard 相似度用）
function titleBigrams(s) {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, " ").trim();
  if (t.length < 2) return new Set([t]);
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
