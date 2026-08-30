// summarizer.js - P0.5 Session 摘要（v0.4.3 改为纯 node git 客户端）
//
// 目标：监听 session/disposed，自动把本 session 的开发活动落到项目脑。
//
// 数据收集（按成本由低到高，任一失败立刻降级）：
//   1) git diff（v0.4.3 起用 v0.4.2 的 detector 纯 node git 客户端，不再依赖 DSH shell service）
//      → 至少能写出本次改了哪些文件，进而生成一条 type=change 的 Memory
//   2) （TODO）LLM 流式抽取：按 JSON Schema 输出 [{type, title, content, importance}]
//      用 llm.stream + 30s timeout；现在留接口位，先打 try/catch 占位，避免在
//      LLM 不可用/合约未确认时把整个 summarizer 拖垮
//
// 写入：
//   - .project-brain/memory.jsonl：append 一条 change/lesson/bug 等结构化记忆
//   - .project-brain/timeline.jsonl：append 一条 eventType=session_summary 事件
//   - emit('project_brain/preview.changed') → 清 aggregator 缓存 + 触发 bundle rebuild
//
// 全部 try/catch + swallow：summarizer 抛错不能让 DSH 崩。

import { brainPath, appendJsonl, readBrain } from "./store/brain-files.js";
import { makeMemoryEntry } from "./store/brain-logic.js";
import { detectChanges } from "./diff/detector.js";

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

export async function summarizeOne({ fs, projectPath, sessionId, logger }) {
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
    return { skipped: "not_initialized", changedFiles: 0 };
  }
  if (sessionId && (brain.timeline || []).some((e) => e && e.eventType === "session_summary" && e.sessionId === sessionId)) {
    log("info", "summarizer: session already summarized, skip " + sessionId);
    return { skipped: "session_already_summarized", changedFiles: 0 };
  }

  // 1) git diff（v0.4.3：纯 node git 客户端，不依赖 DSH shell service）
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

  const now = Date.now();
  const writes = [];

  if (changedFiles.length > 0 && !duplicateChange) {
    // change 记忆：本次改了什么
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
    writes.push(
      appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry)
        .then((ok) => log(ok ? "info" : "warn", `summarizer: change memory ${ok ? "appended" : "FAILED"} (${entry.id})`))
    );
    log("info", `summarizer: detected ${changedFiles.length} changed files`);
  } else if (duplicateChange) {
    log("info", "summarizer: unchanged git window already recorded (" + fingerprint + ")");
  } else {
    log("info", "summarizer: no git diff (non-git repo or no changes)");
  }

  // 2) timeline 事件：session_summary
  const timelineEntry = {
    id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    title: "Session 摘要完成" + (changedFiles.length > 0 ? "（" + changedFiles.length + " 文件变更）" : "（无变更）"),
    eventType: "session_summary",
    occurredAt: now,
    detail: "sessionId=" + (sessionId || "?") + " changedFiles=" + changedFiles.length,
    sessionId: sessionId || null,
    changeFingerprint: fingerprint,
    deduplicated: duplicateChange,
  };
  writes.push(
    appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), timelineEntry)
      .then((ok) => log(ok ? "info" : "warn", `summarizer: timeline event ${ok ? "appended" : "FAILED"} (${timelineEntry.id})`))
  );

  await Promise.all(writes);

  // 3) emit preview.changed（让 aggregator 清缓存 + rebuild 触发）
  try {
    if (typeof require !== "undefined") {
      // no-op; emit 在下面统一处理
    }
  } catch (e) {}

  return { changedFiles: changedFiles.length, fingerprint, deduplicated: duplicateChange };
}

// 主入口：在 apply() 里调用，订阅 session/disposed
export function setupSummarizer(ctx, fs, sandboxPolicy) {
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
      const work = summarizeOne({ fs, projectPath, sessionId, logger })
        .then((r) => {
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
