// summarizer.js - P0.5 Session 摘要（v0.4.3 改为纯 node git 客户端）
//
// 目标：监听 session/disposed，自动把本 session 的开发活动落到项目脑。
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

import { brainPath, appendJsonl, readBrain, readJsonl, writeJsonl } from "./store/brain-files.js";
import { makeMemoryEntry } from "./store/brain-logic.js";
import { detectChanges } from "./diff/detector.js";
import { scanAndWrite } from "./scan-and-write.js";
import { architectureRelevantFiles, resolveSessionRoute } from "./architecture/analyzer.js";
import { extractSessionMemories } from "./memory/session-extractor.js";
import { computeDreamActions, applyDreamCommit } from "./store/brain-logic.js";

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
  if (sessionId && (brain.timeline || []).some((e) => e && e.eventType === "session_summary" && e.sessionId === sessionId)) {
    log("info", "summarizer: session already summarized, skip " + sessionId);
    return { skipped: "session_already_summarized", changedFiles: 0, files: [] };
  }

  // 1) git diff（仅作参考证据，不再作为主路径独立生成 change 记忆）
  let diff;
  try {
    diff = await detectChanges({ projectPath, since: "1" });
  } catch (e) {
    diff = { files: [], stat: "", error: String((e && e.message) || e) };
  }
  if (diff.error) {
    log("info", "summarizer: no git diff (" + diff.error + ")");
  }
  const changedFiles = (diff.files || []).filter(Boolean);
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

  // 2) LLM 对话总结为主（决策 2）：从会话对话文本抽取稳定语义记忆 + 会话总结，
  //    git diff 仅作为参考证据喂给 LLM。任何错误都降级，不影响 Session 关闭。
  try {
    semantic = await extractSessionMemories({ session, llm, route, sessionId, existingMemories: brain.memories, config, now: now + 1, diffEvidence });
    for (const entry of semantic.memories) {
      writes.push(() => appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry));
    }
    if (semantic.memories.length) log("info", `summarizer: appended ${semantic.memories.length} semantic memories`);
    if (semantic.summary) log("info", "summarizer: session summary generated (" + semantic.summary.length + " chars)");
  } catch (e) {
    semantic = { status: "failed", memories: [], summary: "", error: String((e && e.message) || e) };
    log("warn", "summarizer: semantic extraction degraded: " + semantic.error);
  }

  // 3) fallback：LLM 不可用 / 无输出时，才用 git diff 生成一条 change 记忆兜底
  if (semantic.memories.length === 0 && changedFiles.length > 0 && !duplicateChange) {
    const title = `本次 session 改动 ${changedFiles.length} 个文件`;
    const content = "改动的文件：\n" + changedFiles.map((f) => "- " + f).join("\n") +
      (diff.stat ? "\n\ngit diff --stat:\n" + diff.stat : "");
    const entry = makeMemoryEntry({
      type: "change",
      title,
      content,
      importance: 0.55,
      relatedFiles: changedFiles.slice(0, 20),
      source: { kind: "session_summary", fingerprint, sessionId: sessionId || null },
    }, now);
    writes.push(async () => {
      const ok = await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry);
      log(ok ? "info" : "warn", `summarizer: change memory fallback ${ok ? "appended" : "FAILED"} (${entry.id})`);
    });
    log("info", `summarizer: git diff fallback recorded ${changedFiles.length} changed files (no LLM memories)`);
  } else if (duplicateChange) {
    log("info", "summarizer: unchanged git window already recorded (" + fingerprint + ")");
  } else if (changedFiles.length === 0) {
    log("info", "summarizer: no git diff (non-git repo or no changes)");
  }

  // 4) timeline 事件：session_summary（含会话总结 summary，供下个 Session 续接）
  const timelineEntry = {
    id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    title: "Session 摘要完成" + (changedFiles.length > 0
      ? "（" + changedFiles.length + " 文件变更，" + semantic.memories.length + " 条语义记忆）"
      : "（" + semantic.memories.length + " 条语义记忆）"),
    eventType: "session_summary",
    occurredAt: now,
    detail: "sessionId=" + (sessionId || "?") + " changedFiles=" + changedFiles.length + " semanticMemories=" + semantic.memories.length + " semanticStatus=" + semantic.status,
    sessionId: sessionId || null,
    summary: semantic.summary || "",
    changeFingerprint: fingerprint,
    deduplicated: duplicateChange,
    semanticStatus: semantic.status,
    semanticMemories: semantic.memories.length,
  };
  writes.push(async () => {
    const ok = await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), timelineEntry);
    log(ok ? "info" : "warn", `summarizer: timeline event ${ok ? "appended" : "FAILED"} (${timelineEntry.id})`);
  });

  // DSH fs does not expose an atomic append primitive. Serialize writes so
  // multiple semantic memories cannot read the same old JSONL and overwrite
  // one another.
  for (const write of writes) await write();

  // 4.5) Auto-Dream：memory.jsonl 超过阈值时自动跑 light dream，去重 + 归档低 importance
  //      保证长期使用下记忆库不无限膨胀、不污染检索
  const autoDreamThreshold = (config && Number(config.autoDreamThreshold)) || 30;
  let autoDreamResult = null;
  try {
    const allMemories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
    if (Array.isArray(allMemories) && allMemories.length >= autoDreamThreshold) {
      const before = allMemories.length;
      const opts = {
        now: Date.now(),
        mergeThreshold: 0.92,
        archiveImportance: 0.15,
        archiveAgeDays: 30,
      };
      const computed = computeDreamActions(allMemories, opts);
      const nextMemories = applyDreamCommit(allMemories, computed.plannedActions, opts.now, "light");
      const wroteDream = await writeJsonl(fs, brainPath(projectPath, "memory.jsonl"), nextMemories);
      if (wroteDream) {
        autoDreamResult = {
          triggered: true,
          beforeCount: before,
          afterCount: nextMemories.length,
          merged: computed.mergeCount,
          archived: computed.archiveCount,
          threshold: autoDreamThreshold,
        };
        log("info", `summarizer: auto-dream triggered (${before}→${nextMemories.length}, merge=${computed.mergeCount} archive=${computed.archiveCount})`);
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "自动 Dream 完成（" + computed.mergeCount + " 合并 · " + computed.archiveCount + " 归档）",
          eventType: "dream",
          occurredAt: Date.now(),
          detail: "trigger=auto_summary threshold=" + autoDreamThreshold + " before=" + before + " after=" + nextMemories.length,
        });
      }
    } else {
      autoDreamResult = { triggered: false, currentCount: Array.isArray(allMemories) ? allMemories.length : 0, threshold: autoDreamThreshold };
    }
  } catch (e) {
    log("warn", "summarizer: auto-dream failed: " + String((e && e.message) || e));
  }

  // 5) emit preview.changed（让 aggregator 清缓存 + rebuild 触发）
  try {
    if (typeof require !== "undefined") {
      // no-op; emit 在下面统一处理
    }
  } catch (e) {}

  return { changedFiles: changedFiles.length, files: changedFiles, fingerprint, deduplicated: duplicateChange, semanticStatus: semantic.status, semanticMemories: semantic.memories.length, summary: semantic.summary || "", autoDream: autoDreamResult };
}

// 主入口：在 apply() 里调用，订阅 session/disposed
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

  log("info", "summarizer: subscribed to session/disposed (pure-node git, no shell)");

  ctx.on("session/disposed", (session) => {
    // fire-and-forget：summarizer 抛错不能让 DSH 崩
    try {
      const sessionId = session && (session.id || (session.meta && session.meta.id));
      const projectPath = sessionCwd(session);
      if (!projectPath) {
        log("info", "summarizer: session/disposed without cwd, skip");
        return;
      }
      log("info", `summarizer: session/disposed cwd=${projectPath}`);
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
          if (r && r.changedFiles > 0 && architectureRelevantFiles(r.files)) {
            const refreshed = await scanAndWrite(
              fs,
              sandboxPolicy,
              { path: projectPath, dryRun: false },
              "auto_architecture_refresh",
              {
                getMemoryConfig: runtime.getMemoryConfig,
                getLlm: runtime.getLlm,
                llmRoute: resolveSessionRoute(session),
                sessionId,
              },
            );
            if (!refreshed || !refreshed.ok) log("warn", "summarizer: architecture auto-refresh failed");
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
      log("warn", "summarizer: listener failed: " + String((e && e.message) || e));
    }
  });
}
