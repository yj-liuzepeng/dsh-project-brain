// realtime-memory.js - 实时交互记忆（决策 1）
//
// 目标：监听 DSH 会话中的用户消息，检测"长期意图信号"（记住 X / 以后 Y / 不要 Z / 记一下 等），
// 自动落盘一条 type=context 记忆。会话结束摘要（summarizer.js）作为兜底，双通道。
//
// 设计原则：
//   - 纯 Host 侧，不依赖 LLM（避免每条消息都调模型，成本不可控）
//   - 规则检测 + 关键词匹配，只识别明确的长期意图信号，避免噪音
//   - 同一 fingerprint 去重（不重复落盘同一信号）
//   - 每个 project 限速（每次 session 最多落 N 条，防止异常消息轰炸）
//   - 监听 agent/inbox/claimed（每条用户消息进入 open turn 时触发，最直接）
//
// 信号模式（保守，只识别强长期意图）：
//   1. "记住 X / 记一下 X / 备忘 X / 别忘了 X / 长期记住 X"
//   2. "以后 Y 要 / 不要 / 别" + 明确的长期指令
//   3. 英文 "remember X / don't forget X / note that X / always X / never X"

import { createHash } from "node:crypto";
import { brainPath, appendJsonl } from "./store/brain-files.js";
import { makeMemoryEntry } from "./store/brain-logic.js";

// 强意图信号正则（中文 + 英文）—— 明确"记住X/以后要..." 类强长期指令
const STRONG_SIGNAL_PATTERNS = [
  // 中文强信号
  /(?:记住|记一下|备忘|别忘了|长期记住)\s*[:：]?\s*([^。\n]{4,200})/,
  // "以后...要..." 或 "以后...不要..." 长期指令
  /以后\s*([^。\n]{2,80})\s*(?:要|请|一定)?\s*(?:做|处理|记得|注意)/,
  // 英文强信号
  /(?:remember|note that|don't forget|never forget|long-term remember)\s*[:：]?\s*([^.\n]{4,200})/i,
  // 英文 always / never 长期规则
  /\b(always|never)\s+([a-z][^.\n]{4,150})/i,
];

// 弱意图信号正则（中文 + 英文）—— 时间指示词 + 重要内容
//   置信度比强信号低，落盘时 confidence 自动降到 0.5
//   模式："以后都..."/"下次记得..."/"约定..."/"规则是..."/"从今往后..."/"going forward..."/"henceforth..."
const WEAK_SIGNAL_PATTERNS = [
  // 中文弱信号
  /(?:以后都|以后请|以后记得|下次记得|下次注意|约定|规则是|从今往后|今后)\s*[:：,，]?\s*([^。\n]{4,150})/,
  /(?:记住这个|注意这个|留意一下|请注意)\s*[:：,，]?\s*([^。\n]{4,150})/,
  // 英文弱信号
  /\b(going forward|from now on|henceforth|note this|bear in mind|keep in mind)\b\s*[:：,，]?\s*([^.]{4,150})/i,
  /\b(let'?s (?:always|never))\b\s+([^.]{4,150})/i,
];

// 不应触发的"假阳性"上下文（包含这些词就跳过，避免误报开发指令）
//   全文匹配，不限于开头：用户可能说"记住：commit 时不要 force push"，这是 git 开发指令，
//   不是真正的"记住 X"。
const NEGATIVE_CONTEXTS = [
  /\b(?:eslint|prettier|type:|noqa|tsconfig|build\s*error|报错|编译|运行)\b/i,
  /\b(?:commit|push|pr|merge|git|分支)\b/i,  // 任何地方出现 git/commit 关键字 → 可能是开发指令
];

function fingerprint(text) {
  return createHash("sha256").update(text.trim().toLowerCase(), "utf8").digest("hex").slice(0, 16);
}

export function detectSignal(messageText) {
  const text = String(messageText || "").trim();
  if (text.length < 6 || text.length > 2000) return null;
  // 黑名单词过滤
  if (NEGATIVE_CONTEXTS.some((re) => re.test(text))) return null;
  // 先匹配强信号（高优先级）
  for (const re of STRONG_SIGNAL_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    let content = (m[1] || m[2] || m[0]).toString().trim();
    content = content.replace(/^[:：\s"']+|[:：\s"']+$/g, "");
    if (content.length < 4 || content.length > 500) continue;
    return { kind: "explicit_intent", strength: "strong", content, fullText: text };
  }
  // 再匹配弱信号（落盘时 confidence 降权）
  for (const re of WEAK_SIGNAL_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    let content = (m[1] || m[2] || m[0]).toString().trim();
    content = content.replace(/^[:：\s"']+|[:：\s"']+$/g, "");
    if (content.length < 4 || content.length > 500) continue;
    return { kind: "explicit_intent", strength: "weak", content, fullText: text };
  }
  return null;
}

function messageToText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block && (block.type === "text" || typeof block.text === "string"))
      .map((block) => String(block.text || ""))
      .join("\n");
  }
  return "";
}

function sessionCwd(session) {
  if (!session) return null;
  try {
    if (typeof session.cwd === "string" && session.cwd.trim()) return session.cwd.trim();
    if (session.meta && typeof session.meta.cwd === "string" && session.meta.cwd.trim()) return session.meta.cwd.trim();
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd.trim()) return session.header.cwd.trim();
    if (session.header && session.header.meta && typeof session.header.meta.cwd === "string" && session.header.meta.cwd.trim()) return session.header.meta.cwd.trim();
  } catch (e) {}
  return null;
}

// 每个 projectPath 的去重缓存 + 限速
const projectState = new Map(); // projectPath -> { seenFingerprints: Set, count, sessionStartAt }

const MAX_PER_SESSION = 5;
const SEEN_CACHE_LIMIT = 50;

function getProjectState(projectPath) {
  let st = projectState.get(projectPath);
  if (!st) {
    st = { seenFingerprints: new Set(), count: 0, sessionStartAt: Date.now() };
    projectState.set(projectPath, st);
  }
  // 跨 session 重置限速计数（30 分钟无活动视为新 session）
  if (Date.now() - st.sessionStartAt > 30 * 60 * 1000) {
    st.seenFingerprints.clear();
    st.count = 0;
    st.sessionStartAt = Date.now();
  }
  return st;
}

// 单条消息处理：检测信号 → 落盘
async function handleOne({ fs, projectPath, sessionId, signal, logger }) {
  const log = (level, msg) => {
    try {
      if (logger && typeof logger[level] === "function") logger[level]("[dsh-project-brain] " + msg);
    } catch (e) {}
  };

  const st = getProjectState(projectPath);
  if (st.count >= MAX_PER_SESSION) {
    log("info", "realtime-memory: rate limit reached for " + projectPath + ", skip");
    return { skipped: "rate_limit" };
  }

  const fp = fingerprint(signal.content);
  if (st.seenFingerprints.has(fp)) {
    log("info", "realtime-memory: duplicate signal, skip");
    return { skipped: "duplicate" };
  }
  st.seenFingerprints.add(fp);
  // 限流 seenFingerprints 大小
  if (st.seenFingerprints.size > SEEN_CACHE_LIMIT) {
    const arr = Array.from(st.seenFingerprints);
    st.seenFingerprints = new Set(arr.slice(arr.length - SEEN_CACHE_LIMIT));
  }

  const now = Date.now();
  const title = "实时记忆：" + (signal.content.length > 40 ? signal.content.slice(0, 40) + "…" : signal.content);
  // 弱信号（"以后都.../下次记得..."）confidence 自动降到 0.5，避免弱信号污染强信号检索排序
  const isWeak = signal.strength === "weak";
  const entry = makeMemoryEntry({
    type: "context",
    title,
    content: signal.content,
    importance: isWeak ? 0.5 : 0.6,
    confidence: isWeak ? 0.5 : 0.7,
    tags: ["realtime", "user_intent", isWeak ? "weak_signal" : "strong_signal"],
    source: {
      kind: "realtime_memory",
      fingerprint: fp,
      sessionId: sessionId || null,
      signalKind: signal.kind,
      signalStrength: signal.strength || "strong",
    },
  }, now);

  try {
    const ok = await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry);
    st.count += 1;
    log(ok ? "info" : "warn", `realtime-memory: ${ok ? "appended" : "FAILED"} "${title}"`);
    // 触发 preview.changed，让 injector + aggregator 立即看到
    return { appended: ok, entry };
  } catch (e) {
    log("warn", "realtime-memory: append failed: " + String((e && e.message) || e));
    return { error: String((e && e.message) || e) };
  }
}

// 主入口：监听 agent/inbox/claimed
export function setupRealtimeMemory(ctx, fs, sandboxPolicy, runtime = {}) {
  if (!ctx || typeof ctx.on !== "function") return;

  let logger = null;
  try { logger = ctx.logger || null; } catch (e) {}
  const log = (level, msg) => {
    try {
      if (logger && typeof logger[level] === "function") logger[level]("[dsh-project-brain] " + msg);
      else if (typeof console !== "undefined") console.log("[dsh-project-brain] " + msg);
    } catch (e) {}
  };

  log("info", "realtime-memory: subscribed to agent/inbox/claimed");

  ctx.on("agent/inbox/claimed", (payload) => {
    try {
      const message = payload && payload.message;
      if (!message || message.role !== "user") return;
      const text = messageToText(message);
      if (!text) return;

      const session = payload.agent && payload.agent.session;
      const projectPath = sessionCwd(session);
      if (!projectPath) return;

      const sessionId = session && (session.id || (session.meta && session.meta.id));
      const signal = detectSignal(text);
      if (!signal) return;

      // 落盘（fire-and-forget，不阻塞会话）
      const work = handleOne({ fs, projectPath, sessionId, signal, logger })
        .then(async (result) => {
          if (result && result.appended && ctx && typeof ctx.emit === "function") {
            try { ctx.emit("project_brain/preview.changed", { projectPath }); } catch (e) {}
          }
          return result;
        })
        .catch((e) => log("warn", "realtime-memory: handler failed: " + String((e && e.message) || e)));
      if (typeof ctx.effect === "function") {
        try { ctx.effect(() => work, "dsh-project-brain:realtime-memory"); } catch (e) {}
      }
    } catch (e) {
      log("warn", "realtime-memory: listener failed: " + String((e && e.message) || e));
    }
  });
}