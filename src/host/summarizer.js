// summarizer.js - P0.5 Session 摘要（v0.4.3 改为纯 node git 客户端）
//
// 目标：会话安静一段时间后，自动把本 session 的开发活动落到项目脑。
// 主路径是 session/flush（DSH Desktop 会派发）：每次有动静就把闹钟往后推，
// 空闲满 sessionIdleSummaryMs（默认 5 分钟）才摘要。
// session/disposed 仍监听：某些宿主会发，发了就立刻摘，不等空闲。
//
// 数据收集（按成本由低到高，任一失败立刻降级）：
//   1) git diff（v0.4.3 起用 v0.4.2 的 detector 纯 node git 客户端，不再依赖 DSH shell service）
//      → 至少能写出本次改了哪些文件，进而生成一条 type=change 的 Memory
//   2) LLM 流式抽取稳定的项目知识；严格校验、隐私清洗与去重，失败不阻塞 Git 摘要
//
// 写入：
//   - .project-brain/memory.jsonl：append 一条 change/lesson/bug 等结构化记忆
//   - .project-brain/timeline.jsonl：append 一条 eventType=session_summary 事件
//   - emit('project_brain/preview.changed') → 清 aggregator 缓存 + 触发 bundle rebuild
//
// 全部 try/catch + swallow：summarizer 抛错不能让 DSH 崩。

import { brainPath, appendJsonl, readBrain } from "./store/brain-files.js";
import { detectSessionChanges, sessionWindowStart } from "./diff/session-window.js";
import { markArchitectureStale, scanAndWrite } from "./scan-and-write.js";
import { architectureTriggerFiles, resolveSessionRoute, sourceChangeFiles } from "./architecture/analyzer.js";
import { extractSessionMemories } from "./memory/session-extractor.js";
import { admitMemory, isChangelogGenre, persistHousekeep } from "./memory/admit.js";

// 从 session 反推 cwd（不依赖 sandboxPolicy）
function sessionCwd(session) {
  if (!session) return null;
  try {
    if (typeof session.cwd === "string" && session.cwd.trim()) return session.cwd;
    if (session.meta && typeof session.meta.cwd === "string" && session.meta.cwd.trim()) return session.meta.cwd;
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd.trim()) return session.header.cwd;
    if (session.header && session.header.meta && typeof session.header.meta.cwd === "string" && session.header.meta.cwd.trim()) return session.header.meta.cwd;
  } catch (e) {}
  return null;
}

// 同一个会话里，距上次摘要至少要有这么多条新消息才值得再摘一次。
export const MIN_NEW_MESSAGES = 4;

export function countSessionMessages(session) {
  try {
    const messages = session && typeof session.deriveMessages === "function" ? session.deriveMessages() : [];
    return Array.isArray(messages) ? messages.length : 0;
  } catch (e) {
    return 0;
  }
}

// 返回该 session 上次摘要时覆盖到的消息数；从未摘要过返回 null。
// 老数据没有 messageCount 字段，当 0 处理：让它们至少还能再摘一次。
export function lastSummarizedMessageCount(timeline, sessionId) {
  if (!sessionId) return null;
  const mine = (timeline || []).filter(
    (e) => e && e.eventType === "session_summary" && e.sessionId === sessionId,
  );
  if (!mine.length) return null;
  return mine.reduce((max, e) => Math.max(max, Number(e.messageCount) || 0), 0);
}

// 单条摘要的处理（纯函数 + IO 走 fs 适配）
function changeFingerprint(diff) {
  const files = (diff.files || []).filter(Boolean).slice().sort();
  const commits = (diff.commits || []).map((c) => c && (c.hash || c.id || c.commit || c.message || "")).filter(Boolean);
  const input = JSON.stringify([files, commits, diff.stat || ""]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "git-" + (hash >>> 0).toString(16).padStart(8, "0");
}

export async function summarizeOne({ fs, projectPath, sessionId, session, llm, route, config = {}, logger }) {
  const log = (level, msg) => {
    try {
      const tag = "[dsh-project-brain] ";
      if (logger && typeof logger[level] === "function") logger[level](tag + msg);
      else if (typeof console !== "undefined") console.log(tag + msg);
    } catch (e) {}
  };

  // 0) 只处理显式初始化过的项目。旧实现会在用户只是打开一个普通项目时
  //    自动创建半残的 .project-brain/timeline.jsonl。
  const brain = await readBrain(fs, projectPath);
  if (!brain.project || brain.project.__error) {
    log("info", "summarizer: project not initialized, skip");
    return { skipped: "not_initialized", changedFiles: 0, files: [] };
  }
  // 幂等改成按「消息数增量」而不是「这个 sessionId 摘过没」。
  // DSH Desktop 里会话可以活好几天，一次性幂等会让第一次之后的工作全部沉不下来。
  const messageCount = countSessionMessages(session);
  const lastSummarized = lastSummarizedMessageCount(brain.timeline, sessionId);
  if (sessionId && lastSummarized !== null && messageCount - lastSummarized < MIN_NEW_MESSAGES) {
    log("info", "summarizer: only " + (messageCount - lastSummarized) + " new messages since last summary, skip " + sessionId);
    return { skipped: "no_new_messages", changedFiles: 0, files: [] };
  }

  // 1) 本次会话窗口内的变更（工作树 mtime + 窗口内 commit）。
  //    旧实现取 HEAD vs HEAD~1，等于把上一个 commit 当成本次成果：没提交就收不到，
  //    别人刚提交过就算到自己头上。这里按时间窗口取，未提交的改动同样算数。
  const windowStart = sessionWindowStart(brain, Date.now());
  let diff;
  try {
    diff = detectSessionChanges({ projectPath, sinceMs: windowStart, now: Date.now() });
  } catch (e) {
    diff = { files: [], changes: [], commits: [], stat: "", error: String((e && e.message) || e) };
  }
  if (diff.error) {
    log("info", "summarizer: session window degraded (" + diff.error + ")");
  }
  const changedFiles = (diff.files || []).filter(Boolean);
  const changeEntries = Array.isArray(diff.changes) ? diff.changes : [];
  diff.stat = changedFiles.length ? changedFiles.length + " files changed in session window" : "";
  const fingerprint = changedFiles.length ? changeFingerprint(diff) : null;
  const duplicateChange = Boolean(fingerprint && (brain.memories || []).some((m) =>
    m && m.source && m.source.kind === "session_summary" && m.source.fingerprint === fingerprint
  ));
  const diffEvidence = changedFiles.length
    ? "改动文件：\n" + changedFiles.map((f) => "- " + f).join("\n") + (diff.stat ? "\n\nstat:\n" + diff.stat : "")
    : "";

  const now = Date.now();
  const writes = [];
  let semantic = { status: "not_requested", memories: [], summary: "" };
  const admittedIds = [];

  try {
    semantic = await extractSessionMemories({ session, llm, route, sessionId, existingMemories: brain.memories, config, now: now + 1, diffEvidence });
    for (const entry of semantic.memories) {
      const grounded = !(entry.source && entry.source.grounded === false);
      if (!grounded && Number(entry.confidence) < 0.6) continue;
      const result = await admitMemory({
        fs,
        projectPath,
        candidate: {
          type: entry.type,
          title: entry.title,
          content: entry.content,
          importance: entry.importance,
          confidence: entry.confidence,
          relatedFiles: entry.relatedFiles,
          tags: entry.tags,
          source: entry.source,
          supersedes: entry.source && entry.source.supersedes,
        },
        channel: "automatic",
        now: entry.createdAt || now,
        llmConfirm: {
          admit: true,
          type: entry.type,
          supersedes: entry.source && entry.source.supersedes,
        },
        pinnedIds: admittedIds,
      });
      if (result.ok && result.action === "insert" && result.id) {
        admittedIds.push(result.id);
      }
    }
    if (admittedIds.length) log("info", `summarizer: admitted ${admittedIds.length} semantic memories`);
    if (semantic.summary) log("info", "summarizer: session summary generated (" + semantic.summary.length + " chars)");
  } catch (e) {
    semantic = { status: "failed", memories: [], summary: "", error: String((e && e.message) || e) };
    log("warn", "summarizer: semantic extraction degraded: " + semantic.error);
  }

  if (changedFiles.length > 0) {
    log("info", `summarizer: session window noted ${changedFiles.length} files (timeline only, no change memory)`);
  } else if (duplicateChange) {
    log("info", "summarizer: unchanged window already recorded (" + fingerprint + ")");
  } else {
    log("info", "summarizer: no file changes in session window");
  }

  // 4) timeline 事件：session_summary（含会话总结 summary，供下个 Session 续接）
  const rawSummary = String(semantic.summary || "").trim();
  const summaryRejected = rawSummary && isChangelogGenre("", rawSummary) ? "changelog_genre" : "";
  const summary = summaryRejected ? "" : rawSummary;
  const timelineEntry = {
    id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    title: "Session 摘要完成" + (changedFiles.length > 0
      ? "（" + changedFiles.length + " 文件变更，" + admittedIds.length + " 条语义记忆）"
      : "（" + admittedIds.length + " 条语义记忆）"),
    eventType: "session_summary",
    occurredAt: now,
    detail: "sessionId=" + (sessionId || "?") + " changedFiles=" + changedFiles.length + " semanticMemories=" + admittedIds.length + " semanticStatus=" + semantic.status + (changedFiles.length ? " files=" + changedFiles.slice(0, 20).join(",") : ""),
    sessionId: sessionId || null,
    summary,
    // 下一次摘要靠它判断「这段之后又聊了多少」，缺了就只能整段重摘。
    messageCount,
    files: changedFiles.slice(0, 20),
    changes: changeEntries.slice(0, 20),
    windowStart,
    summaryRejected: summaryRejected || undefined,
    changeFingerprint: fingerprint,
    deduplicated: duplicateChange,
    semanticStatus: semantic.status,
    semanticMemories: admittedIds.length,
  };
  writes.push(async () => {
    const ok = await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), timelineEntry);
    log(ok ? "info" : "warn", `summarizer: timeline event ${ok ? "appended" : "FAILED"} (${timelineEntry.id})`);
  });

  for (const write of writes) await write();

  let autoDreamResult = null;
  try {
    const hk = await persistHousekeep(fs, projectPath, { now: Date.now(), pinnedIds: admittedIds });
    autoDreamResult = {
      triggered: Boolean(hk && hk.changed),
      changed: Boolean(hk && hk.changed),
      actions: (hk && hk.actions) || [],
      archived: hk && hk.actions ? hk.actions.filter((a) => a.action === "archive_rule").length : 0,
      evicted: hk && hk.actions ? hk.actions.filter((a) => a.action === "evict_to_dormant").length : 0,
    };
    if (autoDreamResult.triggered) log("info", "summarizer: housekeep changed memory.jsonl");
  } catch (e) {
    log("warn", "summarizer: housekeep failed: " + String((e && e.message) || e));
  }

  // 5) emit preview.changed（让 aggregator 清缓存 + rebuild 触发）
  try {
    if (typeof require !== "undefined") {
      // no-op; emit 在下面统一处理
    }
  } catch (e) {}

  return {
    changedFiles: changedFiles.length,
    files: changedFiles,
    changes: changeEntries,
    windowStart,
    entrypoints: (brain.project && brain.project.entrypoints) || [],
    fingerprint,
    deduplicated: duplicateChange,
    semanticStatus: semantic.status,
    semanticMemories: admittedIds.length,
    summary,
    autoDream: autoDreamResult,
  };
}

// cwd 解析不出来时，把对象长什么样记下来——否则只能靠猜它是 session 还是别的载体。
export function describeSessionShape(value) {
  if (!value || typeof value !== "object") return String(typeof value);
  const own = Object.keys(value).slice(0, 12);
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(value) || {})
    .filter((k) => k !== "constructor").slice(0, 12);
  return "own[" + own.join(",") + "] proto[" + proto.join(",") + "]";
}

// 空闲多久算「这段工作告一段落」。
export const IDLE_SUMMARY_MS = 5 * 60 * 1000;

// 正式配置由 schema 夹在 30s–1h。这里直接采用调用方给的正数，
// 不再二次抬到 30s，否则集成测试无法用短空闲验证 flush 去抖。
function resolveIdleSummaryMs(runtime) {
  let configured = NaN;
  try {
    configured = Number(runtime.getMemoryConfig && runtime.getMemoryConfig().sessionIdleSummaryMs);
  } catch (e) {}
  if (!Number.isFinite(configured) || configured <= 0) return IDLE_SUMMARY_MS;
  return Math.min(3_600_000, configured);
}

// 按 workspace 排队的空闲摘要。
//
// 为什么不用 session/disposed：线上实测它一次都没派发过——DSH Desktop 正常使用中
// 会话不会 dispose，用户也不会去「关闭会话」。探针同时验证了 session/created 与
// session/flush 都能正常收到，所以不是 cordis filter 的问题，是那个事件本身不发生。
// 把整条自动沉淀通道挂在它上面，等于这条通道从来没通电。
//
// 改用空闲触发：每次会话有动静就把闹钟往后推，安静满 IDLE_SUMMARY_MS 才真正摘要。
// 这也更贴近真实节奏——用户不关会话，但会停下来。
export function createIdleSummaryScheduler(runSummary, idleMs = IDLE_SUMMARY_MS) {
  const pending = new Map();

  function cancel(projectPath) {
    const entry = pending.get(projectPath);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(projectPath);
  }

  function schedule({ projectPath, session, sessionId }) {
    if (!projectPath) return;
    cancel(projectPath);
    const timer = setTimeout(() => {
      pending.delete(projectPath);
      try { runSummary({ projectPath, session, sessionId }); } catch (e) { /* 调用方自己兜底 */ }
    }, idleMs);
    // 别因为一个待触发的摘要把宿主进程钉住。
    if (typeof timer.unref === "function") timer.unref();
    pending.set(projectPath, { timer, session, sessionId });
  }

  function flushAll() {
    for (const projectPath of [...pending.keys()]) {
      const entry = pending.get(projectPath);
      cancel(projectPath);
      try { runSummary({ projectPath, session: entry && entry.session, sessionId: entry && entry.sessionId }); } catch (e) {}
    }
  }

  return { schedule, cancel, flushAll, size: () => pending.size };
}

// 主入口：在 apply() 里调用，订阅会话事件
export function setupSummarizer(ctx, fs, sandboxPolicy, runtime = {}) {
  if (!ctx || typeof ctx.on !== "function") return;

  let logger = null;
  try { logger = ctx.logger || null; } catch (e) {}

  const log = (level, msg) => {
    try {
      const tag = "[dsh-project-brain] ";
      if (logger && typeof logger[level] === "function") logger[level](tag + msg);
      else if (typeof console !== "undefined") console.log(tag + msg);
    } catch (e) {}
  };

  // 事件里带的可能只是 session 投影：既不一定有 cwd，也不一定有 deriveMessages。
  // 拿 id 去 sessions 服务换回 live 实例（RPC 层已经验证过这条路），
  // 否则语义抽取会因为读不到转写而空转。
  const resolveSessionContext = (incoming) => {
    const sessionId = incoming && (incoming.id || (incoming.meta && incoming.meta.id));
    let session = incoming;
    let projectPath = sessionCwd(incoming);
    if (projectPath && typeof incoming.deriveMessages === "function") {
      return { projectPath, session, sessionId };
    }
    try {
      const sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
      const live = sessions && typeof sessions.get === "function" && sessionId ? sessions.get(sessionId) : null;
      if (live) {
        session = live;
        projectPath = projectPath || sessionCwd(live);
      }
    } catch (e) { /* 服务不可用就用事件里那个 */ }
    return { projectPath: projectPath || null, session, sessionId };
  };

  const idleMs = resolveIdleSummaryMs(runtime);
  const scheduler = createIdleSummaryScheduler((job) => runSummary(job, "idle"), idleMs);

  log("info", "summarizer: subscribed to session/flush + session/disposed（空闲 "
    + Math.round(idleMs / 1000) + "s 触发摘要）");

  // session/flush 是 DSH 真正会派发的会话信号（per-request barrier / idle checkpoint /
  // teardown drain）。每来一次就把空闲闹钟往后推，安静够久才真的去摘要。
  // flush 很频繁，日志按 session 去重：通了只说一次，没通也只抱怨一次。
  const flushSeen = new Set();
  ctx.on("session/flush", (incoming) => {
    try {
      const { projectPath, session, sessionId } = resolveSessionContext(incoming);
      if (!projectPath) {
        // 静默 return 会让这条链路再次变成哑的——上一轮就是这么错过 session/disposed 的。
        const key = "nocwd:" + (sessionId || "?");
        if (!flushSeen.has(key)) {
          flushSeen.add(key);
          log("warn", "summarizer: session/flush 拿不到 cwd，shape=" + describeSessionShape(incoming));
        }
        return;
      }
      if (!flushSeen.has("ok:" + projectPath)) {
        flushSeen.add("ok:" + projectPath);
        log("info", "summarizer: session/flush 链路已通，cwd=" + projectPath
          + " messages=" + countSessionMessages(session) + "（空闲后将摘要）");
      }
      scheduler.schedule({ projectPath, session, sessionId });
    } catch (e) {
      log("warn", "summarizer: flush listener failed: " + String((e && e.message) || e));
    }
  });

  // 保留 disposed：某些宿主/profile 下它是会发的，发了就立刻摘一次，不用等空闲。
  ctx.on("session/disposed", (incoming) => {
    try {
      const { projectPath, session, sessionId } = resolveSessionContext(incoming);
      if (!projectPath) {
        log("info", "summarizer: session/disposed without cwd, skip");
        return;
      }
      scheduler.cancel(projectPath);
      runSummary({ projectPath, session, sessionId }, "disposed");
    } catch (e) {
      log("warn", "summarizer: disposed listener failed: " + String((e && e.message) || e));
    }
  });

  function runSummary({ projectPath, session, sessionId }, trigger) {
    // fire-and-forget：summarizer 抛错不能让 DSH 崩
    try {
      if (!projectPath) return;
      log("info", `summarizer: ${trigger} 触发，cwd=${projectPath}`);
      // 用 ctx.effect 让 summarizer 生命周期受 fiber 控制（即使抛错也不会 leak）
      const work = summarizeOne({
        fs, projectPath, sessionId, session, logger,
        llm: runtime.getLlm ? runtime.getLlm() : null,
        route: resolveSessionRoute(session),
        config: runtime.getMemoryConfig ? runtime.getMemoryConfig() : {},
      })
        .then(async (r) => {
          // 仅源码/配置结构发生变化时重建架构；内容未变时 fingerprint 会复用旧图，
          // 避免重复调用 LLM。失败只记录日志，不影响 Session 关闭。
          const files = (r && r.files) || [];
          const refreshRuntime = {
            getMemoryConfig: runtime.getMemoryConfig,
            getLlm: runtime.getLlm,
            llmRoute: resolveSessionRoute(session),
            sessionId,
            triggerFiles: files.slice(0, 20),
          };
          if (files.length && sourceChangeFiles(files)) {
            try {
              const light = await scanAndWrite(fs, sandboxPolicy, { path: projectPath, dryRun: false }, "auto_light_refresh", Object.assign({}, refreshRuntime, { architectureMode: "light" }));
              if (!light || !light.ok) log("warn", "summarizer: light refresh failed");
            } catch (e) {
              log("warn", "summarizer: light refresh failed: " + String((e && e.message) || e));
            }
          }
          const triggerOptions = { changes: (r && r.changes) || [], entrypoints: (r && r.entrypoints) || [] };
          if (files.length && architectureTriggerFiles(files, triggerOptions)) {
            // 触发了就必须给出结论：刷新成功 → scanAndWrite 自己把 architectureStale 清掉；
            // 刷新失败 → 显式置过期，第一屏和注入都会说"架构可能过期"，而不是拿旧泳道当真理。
            let refreshedOk = false;
            try {
              const refreshed = await scanAndWrite(
                fs,
                sandboxPolicy,
                { path: projectPath, dryRun: false },
                "auto_architecture_refresh",
                Object.assign({}, refreshRuntime, { architectureMode: "full" }),
              );
              refreshedOk = Boolean(refreshed && refreshed.ok && !(refreshed.data && refreshed.data.architecture && refreshed.data.architecture.error));
              if (!refreshedOk) log("warn", "summarizer: architecture auto-refresh failed");
            } catch (e) {
              log("warn", "summarizer: architecture auto-refresh failed: " + String((e && e.message) || e));
            }
            if (!refreshedOk) {
              const marked = await markArchitectureStale(fs, sandboxPolicy, projectPath, true);
              log(marked ? "info" : "warn", "summarizer: architectureStale=true " + (marked ? "written" : "write FAILED"));
            }
          }
          // emit preview.changed 触发 rebuild
          try {
            if (ctx && typeof ctx.emit === "function") {
              ctx.emit("project_brain/preview.changed", { projectPath });
            }
          } catch (e) {}
          return r;
        })
        .catch((e) => log("warn", "summarizer: failed: " + String((e && e.message) || e)));
      if (typeof ctx.effect === "function") {
        try { ctx.effect(() => work, "dsh-project-brain:summarizer"); } catch (e) {}
      }
    } catch (e) {
      log("warn", "summarizer: run failed: " + String((e && e.message) || e));
    }
  }
}
