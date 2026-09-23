// vacuum.js — 把主文件里过期的死行移出去，控制 memory.jsonl / timeline.jsonl 的体积。
//
// 为什么需要：fs 只有覆盖写，每次 append 都要读全文再写全文。归档行永久堆在
// memory.jsonl 里，timeline 更是每次操作都加一条，时间一长每写一条都要搬几 MB。
//
// 为什么不是真删：这个项目一贯的姿态是「宁可留着也不误删」——dream 从不因标题
// 相似删除，supersede 也保留旧条目。所以这里搬到 .project-brain/archive/ 下，
// 主文件真的变小，数据仍然找得回来。
//
// 触发方式：只挂在 project_dream 的 mode=full 上，且 dryRun 默认 true。不自动跑。

import { brainPath, readJsonl, writeJsonl } from "../store/brain-files.js";
import { brainTxKey, withWriteLock } from "../store/write-lock.js";
import { isCoreMemory } from "../store/brain-logic.js";

const DAY_MS = 86_400_000;

export const VACUUM_DEFAULTS = Object.freeze({
  // 归档多久之后才允许搬走
  memoryRetainDays: 90,
  // 即使全都超期，也至少留这么多条归档在主文件里
  memoryMinRetained: 200,
  timelineMaxEvents: 2000,
  timelineRetainDays: 180,
});

function resolveOptions(config) {
  const num = (key, fallback, min, max) => {
    const raw = Number(config && config[key]);
    if (!Number.isFinite(raw)) return fallback;
    return Math.round(Math.min(max, Math.max(min, raw)));
  };
  return {
    memoryRetainDays: num("vacuumMemoryRetainDays", VACUUM_DEFAULTS.memoryRetainDays, 7, 3650),
    memoryMinRetained: num("vacuumMemoryMinRetained", VACUUM_DEFAULTS.memoryMinRetained, 0, 10000),
    timelineMaxEvents: num("vacuumTimelineMaxEvents", VACUUM_DEFAULTS.timelineMaxEvents, 200, 100000),
    timelineRetainDays: num("vacuumTimelineRetainDays", VACUUM_DEFAULTS.timelineRetainDays, 7, 3650),
  };
}

function ageMs(entry, now) {
  const at = Number(entry && (entry.updatedAt || entry.createdAt || entry.occurredAt)) || 0;
  return at > 0 ? now - at : Infinity;
}

// 活跃记忆的 supersededBy 指向谁，谁就是证据链的一环，再旧也不能搬走。
function referencedIds(rows) {
  const referenced = new Set();
  for (const m of rows || []) {
    if (!m) continue;
    if (m.supersededBy) referenced.add(String(m.supersededBy));
    if (m.source && m.source.supersedes) referenced.add(String(m.source.supersedes));
  }
  return referenced;
}

export function planMemoryVacuum(rows, { now = Date.now(), config } = {}) {
  const opts = resolveOptions(config);
  const all = (rows || []).filter(Boolean);
  const cutoff = opts.memoryRetainDays * DAY_MS;
  const referenced = referencedIds(all);

  const dead = all.filter((m) => !isCoreMemory(m) && m.status !== "dormant");
  const evictable = dead
    .filter((m) => !referenced.has(String(m.id)))
    .filter((m) => m.pinned !== true)
    .filter((m) => ageMs(m, now) > cutoff)
    .sort((a, b) => ageMs(b, now) - ageMs(a, now));

  // 留一个下限：就算全都超期，也别把归档区一次清空，用户还想翻。
  const overflow = Math.max(0, dead.length - opts.memoryMinRetained);
  const evict = evictable.slice(0, overflow);
  const evictIds = new Set(evict.map((m) => String(m.id)));

  return {
    evict,
    keep: all.filter((m) => !evictIds.has(String(m.id))),
    stats: {
      total: all.length,
      dead: dead.length,
      expired: evictable.length,
      evicted: evict.length,
      retainDays: opts.memoryRetainDays,
      minRetained: opts.memoryMinRetained,
    },
  };
}

// 第一屏的「最近做什么」读最新的 session_summary，任务动态的主干起点是 init。
// 这两类再旧也留着，否则截断会把界面打回「暂无」。
function isTimelineAnchor(event, latestSummaryId) {
  if (!event) return false;
  if (event.eventType === "init") return true;
  return latestSummaryId && event.id === latestSummaryId;
}

export function planTimelineTrim(events, { now = Date.now(), config } = {}) {
  const opts = resolveOptions(config);
  const all = (events || []).filter(Boolean);
  const cutoff = opts.timelineRetainDays * DAY_MS;

  const summaries = all
    .filter((e) => e.eventType === "session_summary")
    .sort((a, b) => (Number(b.occurredAt) || 0) - (Number(a.occurredAt) || 0));
  const latestSummaryId = summaries.length ? summaries[0].id : null;

  const byRecency = all.slice().sort((a, b) => (Number(b.occurredAt) || 0) - (Number(a.occurredAt) || 0));
  const keepIds = new Set();
  for (const event of byRecency) {
    if (isTimelineAnchor(event, latestSummaryId)) {
      keepIds.add(event.id);
      continue;
    }
    if (keepIds.size >= opts.timelineMaxEvents) continue;
    if (ageMs(event, now) > cutoff) continue;
    keepIds.add(event.id);
  }

  const evict = all.filter((e) => !keepIds.has(e.id));
  return {
    evict,
    keep: all.filter((e) => keepIds.has(e.id)),
    stats: {
      total: all.length,
      evicted: evict.length,
      maxEvents: opts.timelineMaxEvents,
      retainDays: opts.timelineRetainDays,
      anchorsKept: all.filter((e) => isTimelineAnchor(e, latestSummaryId)).length,
    },
  };
}

export function archiveFileName(kind, now) {
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return "archive/" + kind + "-" + stamp + ".jsonl";
}

// 先把要搬走的行写进 archive/，确认落盘成功再缩主文件。顺序反了就是真删。
async function relocate({ fs, projectPath, kind, mainFile, plan, now }) {
  if (!plan.evict.length) return { ok: true, moved: 0, archivePath: null };
  const archiveRel = archiveFileName(kind, now);
  const wroteArchive = await writeJsonl(fs, brainPath(projectPath, archiveRel), plan.evict);
  if (!wroteArchive) {
    return { ok: false, code: "E_ARCHIVE_WRITE_FAILED", moved: 0, archivePath: archiveRel };
  }
  const wroteMain = await writeJsonl(fs, brainPath(projectPath, mainFile), plan.keep);
  if (!wroteMain) {
    // archive 已经写了但主文件没缩，数据没丢，下次再跑一遍即可。
    return { ok: false, code: "E_MAIN_WRITE_FAILED", moved: 0, archivePath: archiveRel };
  }
  return { ok: true, moved: plan.evict.length, archivePath: archiveRel };
}

export async function vacuumBrain({ fs, projectPath, config, now = Date.now(), dryRun = true } = {}) {
  const memoryFile = brainPath(projectPath, "memory.jsonl");
  const timelineFile = brainPath(projectPath, "timeline.jsonl");

  const [memoryRows, timelineRows] = await Promise.all([
    readJsonl(fs, memoryFile),
    readJsonl(fs, timelineFile),
  ]);
  const memoryPlan = planMemoryVacuum(memoryRows, { now, config });
  const timelinePlan = planTimelineTrim(timelineRows, { now, config });

  const plan = {
    memory: memoryPlan.stats,
    timeline: timelinePlan.stats,
    totalEvicted: memoryPlan.stats.evicted + timelinePlan.stats.evicted,
  };
  if (dryRun) return { ok: true, dryRun: true, plan, archives: [] };
  if (plan.totalEvicted === 0) return { ok: true, dryRun: false, plan, archives: [], changed: false };

  // 和 admit / 人工编辑抢同一把事务锁：整表重写期间不能有别人在 append。
  return withWriteLock(brainTxKey(projectPath, "memory.jsonl"), async () => {
    const archives = [];
    const memoryMoved = await relocate({ fs, projectPath, kind: "memory", mainFile: "memory.jsonl", plan: memoryPlan, now });
    if (!memoryMoved.ok) return { ok: false, code: memoryMoved.code, plan, archives };
    if (memoryMoved.archivePath) archives.push({ kind: "memory", path: memoryMoved.archivePath, rows: memoryMoved.moved });

    const timelineMoved = await relocate({ fs, projectPath, kind: "timeline", mainFile: "timeline.jsonl", plan: timelinePlan, now });
    if (!timelineMoved.ok) return { ok: false, code: timelineMoved.code, plan, archives };
    if (timelineMoved.archivePath) archives.push({ kind: "timeline", path: timelineMoved.archivePath, rows: timelineMoved.moved });

    return { ok: true, dryRun: false, plan, archives, changed: true };
  });
}
