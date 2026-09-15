// realtime-memory.js - 实时交互记忆
// 强「记住」信号：规则门 + user_explicit，不经 LLM。弱信号只检测、不在 ingest 写入。

import { admitMemory } from "./memory/admit.js";
import { readBrain } from "./store/brain-files.js";

const STRONG_SIGNAL_PATTERNS = [
  /(?:记住|记一下|备忘|别忘了|长期记住)\s*[:：]?\s*([^。\n]{4,200})/,
  /以后\s*([^。\n]{2,80})\s*(?:要|请|一定)?\s*(?:做|处理|记得|注意)/,
  /(?:remember|note that|don't forget|never forget|long-term remember)\s*[:：]?\s*([^.\n]{4,200})/i,
  /\b(always|never)\s+([a-z][^.\n]{4,150})/i,
];

const WEAK_SIGNAL_PATTERNS = [
  /(?:以后都|以后请|以后记得|下次记得|下次注意|约定|规则是|从今往后|今后)\s*[:：,，]?\s*([^。\n]{4,150})/,
  /(?:记住这个|注意这个|留意一下|请注意)\s*[:：,，]?\s*([^。\n]{4,150})/,
  /\b(going forward|from now on|henceforth|note this|bear in mind|keep in mind)\b\s*[:：,，]?\s*([^.]{4,150})/i,
  /\b(let'?s (?:always|never))\b\s+([^.]{4,150})/i,
];

const NEGATIVE_CONTEXTS = [
  /\b(?:eslint|prettier|type:|noqa|tsconfig|build\s*error|报错|编译|运行)\b/i,
  /\b(?:commit|push|pr|merge|git|分支)\b/i,
];

export function cleanRememberContent(text) {
  return String(text || "").replace(/^[,，、;；:：\s]+/, "").replace(/[,，、;；:：\s]+$/, "").trim();
}

export function rememberTitle(content) {
  const t = cleanRememberContent(content);
  if (!t) return "用户记住的长期约束";
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

export function detectSignal(messageText) {
  const text = String(messageText || "").trim();
  if (text.length < 6 || text.length > 2000) return null;
  for (const re of STRONG_SIGNAL_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    let content = cleanRememberContent(m[1] || m[2] || m[0]);
    if (content.length < 4 || content.length > 500) continue;
    return { kind: "explicit_intent", strength: "strong", content, fullText: text };
  }
  if (NEGATIVE_CONTEXTS.some((re) => re.test(text))) return null;
  for (const re of WEAK_SIGNAL_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    let content = cleanRememberContent(m[1] || m[2] || m[0]);
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

const projectState = new Map();
const MAX_PER_SESSION = 5;
const SEEN_CACHE_LIMIT = 50;

function getProjectState(projectPath) {
  let st = projectState.get(projectPath);
  if (!st) {
    st = { seenFingerprints: new Set(), count: 0, sessionStartAt: Date.now() };
    projectState.set(projectPath, st);
  }
  if (Date.now() - st.sessionStartAt > 30 * 60 * 1000) {
    st.seenFingerprints.clear();
    st.count = 0;
    st.sessionStartAt = Date.now();
  }
  return st;
}

async function handleOne({ fs, projectPath, sessionId, signal, logger }) {
  const log = (level, msg) => {
    try {
      if (logger && typeof logger[level] === "function") logger[level]("[dsh-project-brain] " + msg);
    } catch (e) {}
  };

  if (!signal || signal.strength !== "strong") {
    return { skipped: "weak_signal" };
  }

  const brain = await readBrain(fs, projectPath);
  if (!brain.project || brain.project.__error) {
    log("info", "realtime-memory: project not initialized, skip");
    return { skipped: "not_initialized" };
  }

  const st = getProjectState(projectPath);
  if (st.count >= MAX_PER_SESSION) {
    log("info", "realtime-memory: rate limit reached for " + projectPath + ", skip");
    return { skipped: "rate_limit" };
  }

  const cleaned = cleanRememberContent(signal.content);
  const fact = cleaned.length >= 20 ? cleaned : (cleaned + "。这是用户明确要求记住的长期偏好。");
  const title = rememberTitle(cleaned);

  const result = await admitMemory({
    fs,
    projectPath,
    candidate: {
      type: "context",
      title,
      content: fact.length >= 20 ? fact : (fact + "（用户明确要求记住的长期约束）"),
      importance: 0.7,
      confidence: 0.85,
      tags: ["realtime", "user_intent", "strong_signal"],
      source: { kind: "user_explicit", sessionId: sessionId || null, signalKind: signal.kind },
    },
    channel: "user_explicit",
    now: Date.now(),
  });

  if (!result.ok) {
    log("info", "realtime-memory: admit refused " + (result.code || "") + " " + (result.reason || ""));
    return { skipped: result.code || "rejected", result };
  }
  if (result.action === "skip") {
    return { skipped: "duplicate", id: result.id };
  }
  st.count += 1;
  log("info", 'realtime-memory: admitted "' + title + '"');
  return { appended: true, entry: result.entry, id: result.id };
}

export function setupRealtimeMemory(ctx, fs, sandboxPolicy, runtime = {}) {
  if (!ctx || typeof ctx.on !== "function") return;
  void runtime;
  void sandboxPolicy;

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
