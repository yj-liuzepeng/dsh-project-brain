// realtime-memory.js - 实时交互记忆
//
// 分工：正则只负责「要不要记」，LLM 负责「记什么」。
//   用户说「把这个记住」时，真正的知识几乎总在上几轮里（而且常常是 assistant 说的），
//   正则捕获组拿到的只是触发语后面的残句。所以命中强信号后必须带最近若干轮上下文
//   去做一次指代消解，产出能脱离本次对话独立阅读的正文。
// 弱信号只检测、不在 ingest 写入。无法消解指代时宁可不写，交给会话结束的 session-extractor 兜底。

import { admitMemory, hasUnresolvedReference, isMockLlmPayload, titleJaccard } from "./memory/admit.js";
import { sessionMessageLines } from "./memory/session-extractor.js";
import { parseArchitectureJson, resolveSessionRoute, streamLlmText } from "./architecture/analyzer.js";
import { isRetrievableMemory, makeId, normalizeMemoryType } from "./store/brain-logic.js";
import { appendJsonl, brainPath, readBrain } from "./store/brain-files.js";

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
// 同一个 30 分钟窗口内最多做这么多次提炼（含失败的）。
const MAX_REFINE_CALLS = 12;
const SEEN_CACHE_LIMIT = 50;

// 指代消解用的上下文窗口：必须包含 assistant 消息，用户说的「这个角度」十有八九是助手刚写的东西。
//
// 头尾都要取。只留最近 N 条的话，「这个对话的第一句」「最开始说的」这类往回指的
// 表达永远落在窗口外，模型只能诚实地回答解不开——而那看起来就像插件没记住。
const CONTEXT_HEAD_MESSAGES = 4;
const CONTEXT_TAIL_MESSAGES = 10;
const CONTEXT_MAX_CHARS = 7000;
const CONTEXT_PER_MESSAGE_CHARS = 1200;
const CONTEXT_GAP_MARK = "（……中间省略若干轮……）";
const REFINE_TIMEOUT_MS = 20000;
// 同一条偏好被反复重申时走 supersede，否则 Core 里会堆一排同义条目。
const SUPERSEDE_JACCARD = 0.72;
const REFINE_TYPES = new Set(["preference", "decision", "requirement", "architecture", "bug", "lesson"]);

export function contextWindow(session) {
  try {
    const lines = sessionMessageLines(session, CONTEXT_PER_MESSAGE_CHARS);
    if (lines.length === 0) return "";

    let selected;
    if (lines.length <= CONTEXT_HEAD_MESSAGES + CONTEXT_TAIL_MESSAGES) {
      selected = lines;
    } else {
      selected = lines.slice(0, CONTEXT_HEAD_MESSAGES)
        .concat([CONTEXT_GAP_MARK])
        .concat(lines.slice(-CONTEXT_TAIL_MESSAGES));
    }

    // 还是超预算就整体再压一档，而不是丢消息——丢掉哪一条都可能正是用户指的那条。
    let text = selected.join("\n\n");
    if (text.length > CONTEXT_MAX_CHARS) {
      const budget = Math.max(200, Math.floor(CONTEXT_MAX_CHARS / selected.length) - 8);
      text = selected
        .map((line) => (line.length > budget ? line.slice(0, budget) + "…" : line))
        .join("\n\n");
    }
    return text;
  } catch (e) {
    return "";
  }
}

function refinePrompt(triggerText, transcript) {
  return [
    "用户在对话里明确要求「记住」某件事。把它整理成一条能脱离本次对话独立阅读的长期记忆。",
    "",
    "用户原话（触发语）：",
    triggerText,
    "",
    "对话上下文（按时间先后排列；若出现省略标记，说明中间轮次未提供，但首尾都在）：",
    transcript || "（无上下文）",
    "",
    "要求：",
    "1. 消解全部指代。正文里不允许出现「这个 / 那个 / 上面说的 / 这样 / this / that」，一律替换成上下文里它真正指的东西（目标、口径、技术选型、文件名等）。",
    "2. 正文写 what + why：用户要求的是什么、适用范围和原因，2–4 句，自包含。",
    "3. 用户说「这个对话的第一句」「最开始说的」时，指的就是上面上下文里最早那条 USER 消息；说「刚才说的」则指最后几条。按这个理解去取内容。",
    "4. 只有上下文里确实没有可对应的内容时，resolved 才返回 false。不要因为不确定就放弃，也不要编造。",
    "5. title 写成站立事实句，不要写成「记住 XXX」「用户要求 XXX」。",
    "6. type：对协作方式、输出结构、长期口径的要求用 preference；技术选型用 decision；其余按语义选。",
    "",
    "输出格式（严格遵守）：第一个字符必须是 {，最后一个字符必须是 }。",
    "不要写任何解释、前言、结语，不要用 Markdown 代码块包裹。",
    JSON.stringify({ resolved: true, type: "preference", title: "站立事实句", content: "自包含的 what + why", importance: 0.8 }),
  ].join("\n");
}

// 模型偶尔会在 JSON 前后带上解释文字或直接用自然语言作答。与其丢掉这次提炼，
// 不如把它自己的输出丢回去让它重排一遍——只要一次就够，再失败就认了。
function repairPrompt(rawText) {
  return [
    "下面这段输出本应是严格 JSON，但无法解析。请原样提取其中的信息，重新输出为合法 JSON。",
    "第一个字符必须是 {，最后一个字符必须是 }，不要任何解释或代码块标记。",
    "字段：" + JSON.stringify({ resolved: true, type: "preference", title: "", content: "", importance: 0.8 }),
    "",
    "原始输出：",
    String(rawText || "").slice(0, 2000),
  ].join("\n");
}

async function refineSignal({ llm, route, sessionId, signal, transcript, timeoutMs, log }) {
  if (!llm || typeof llm.stream !== "function" || !route || !route.provider || !route.model) {
    return { status: "llm_unavailable", candidate: null };
  }
  const ask = (prompt) => streamLlmText(llm, route, prompt, sessionId, timeoutMs || REFINE_TIMEOUT_MS, {
    system: "Resolve every deictic reference using the provided conversation. Return strict JSON only, with no prose before or after.",
    maxTokens: 1000,
    purpose: "project-memory-realtime-refine",
  });

  let text;
  try {
    text = await ask(refinePrompt(signal.fullText || signal.content, transcript));
  } catch (e) {
    log("warn", "realtime-memory: refine failed: " + String((e && e.message) || e));
    return { status: "refine_failed", candidate: null };
  }
  if (isMockLlmPayload(text)) return { status: "llm_unavailable", candidate: null };

  let parsed;
  try {
    parsed = parseArchitectureJson(text);
  } catch (e) {
    // 第一次没给出合法 JSON，把它的原始输出丢回去重排一次再放弃。
    log("info", "realtime-memory: refine output unparseable, retrying once");
    try {
      parsed = parseArchitectureJson(await ask(repairPrompt(text)));
    } catch (retryError) {
      return { status: "refine_unparseable", candidate: null, sample: String(text || "").slice(0, 160) };
    }
  }
  if (!parsed || parsed.resolved !== true) {
    // 模型说它解不开。把窗口规模记下来——多数情况是窗口里确实没有用户指的那段。
    return {
      status: "unresolved",
      candidate: null,
      sample: "模型判定无法消解；上下文窗口 " + String(transcript || "").length + " 字符",
    };
  }

  const type = normalizeMemoryType(parsed.type);
  const title = cleanRememberContent(parsed.title).slice(0, 120);
  const content = cleanRememberContent(parsed.content).slice(0, 800);
  if (!REFINE_TYPES.has(type) || !title || content.length < 12) {
    return { status: "refine_invalid", candidate: null };
  }
  // 模型自称 resolved 但正文还带着指代词 —— 以正文为准。
  if (hasUnresolvedReference(title, content, { maxSelfContainedChars: 0 })) {
    return { status: "unresolved", candidate: null };
  }
  const importance = Number(parsed.importance);
  return {
    status: "refined",
    candidate: {
      type,
      title,
      content,
      importance: Number.isFinite(importance) ? Math.min(0.95, Math.max(0.5, importance)) : 0.8,
      confidence: 0.85,
      resolved: true,
    },
  };
}

// LLM 不可用时的保守兜底：只有用户原话本身就自包含才落盘，绝不靠补一句套话凑长度。
export function fallbackCandidate(signal) {
  const cleaned = cleanRememberContent(signal && signal.content);
  if (cleaned.length < 12) return null;
  if (hasUnresolvedReference(rememberTitle(cleaned), cleaned, { maxSelfContainedChars: 0 })) return null;
  return {
    type: "preference",
    title: rememberTitle(cleaned),
    content: cleaned,
    importance: 0.7,
    confidence: 0.6,
    resolved: false,
  };
}

// 失败原因要说准：把「模型返回格式不对」写成「缺少模型」，会让人跑去查配置。
// refineStatus 比笼统的 reason 更接近真相，优先用它。
const REJECT_REASON_TEXT = {
  unresolved_reference: "没能从上下文里认出「这个 / 那个」指的是什么",
  needs_context: "缺少可用的上下文，无法整理成自包含的记忆",
};

const REFINE_STATUS_TEXT = {
  llm_unavailable: "当前 Session 还没有可复用的模型路由，先完成一次正常对话再试",
  refine_failed: "整理记忆时模型调用失败（超时或中断）",
  refine_unparseable: "模型两次都没按要求返回 JSON",
  refine_invalid: "模型返回的内容不完整，缺少标题或正文",
};

const REJECT_NEXT_STEP = "可以补一句更具体的说法，或等本次会话结束后自动归纳。";

// 用户明确说了「记住」却没记成，是最容易让人误以为已经记下的场景。
// 留一条 timeline，在侧边栏「任务动态」里看得到；Agent 通道的常规拒绝不记，避免刷屏。
async function noteRejection({ fs, projectPath, sessionId, signal, reason, refineStatus, sample }) {
  const now = Date.now();
  const trigger = String(signal.fullText || signal.content || "").slice(0, 120);
  const why = REFINE_STATUS_TEXT[refineStatus] || REJECT_REASON_TEXT[reason] || reason;
  try {
    await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
      id: makeId("evt", now),
      title: "未记住：" + trigger,
      eventType: "memory_rejected",
      occurredAt: now,
      sessionId: sessionId || null,
      detail: why + "。" + REJECT_NEXT_STEP,
      rejectReason: reason,
      refineStatus: refineStatus || null,
      // 模型到底返回了什么，排查时比任何描述都有用。
      ...(sample ? { sample } : {}),
    });
  } catch (e) { /* 记录失败不影响主流程 */ }
}

export const WEAK_SOURCE_KIND = "user_intent_weak";
const REALTIME_SOURCE_KINDS = new Set(["user_explicit", WEAK_SOURCE_KIND]);

// 同类型、同样来自实时通道、标题高度重合 → 视为对旧口径的重申，走 supersede。
export function findSupersedable(memories, candidate) {
  let best = null;
  let bestScore = 0;
  for (const m of memories || []) {
    if (!isRetrievableMemory(m) || m.type !== candidate.type) continue;
    if (!(m.source && REALTIME_SOURCE_KINDS.has(m.source.kind))) continue;
    const score = titleJaccard(m.title, candidate.title);
    if (score >= SUPERSEDE_JACCARD && score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

function getProjectState(projectPath) {
  let st = projectState.get(projectPath);
  if (!st) {
    st = { seenFingerprints: new Set(), count: 0, refineCalls: 0, sessionStartAt: Date.now() };
    projectState.set(projectPath, st);
  }
  if (Date.now() - st.sessionStartAt > 30 * 60 * 1000) {
    st.seenFingerprints.clear();
    st.count = 0;
    st.refineCalls = 0;
    st.sessionStartAt = Date.now();
  }
  return st;
}

export async function handleOne({ fs, projectPath, sessionId, signal, session, llm, route, config = {}, logger }) {
  const log = (level, msg) => {
    try {
      if (logger && typeof logger[level] === "function") logger[level]("[dsh-project-brain] " + msg);
    } catch (e) {}
  };

  if (!signal) return { skipped: "no_signal" };
  const weak = signal.strength !== "strong";

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
  // 落盘额度只在写成功时消耗，挡不住「反复触发但都提炼失败」。模型调用另算一份额度，
  // 否则一段全是「以后都…」的对话会把模型打爆。
  if (st.refineCalls >= MAX_REFINE_CALLS) {
    log("info", "realtime-memory: refine budget exhausted for " + projectPath + ", skip");
    return { skipped: "refine_budget" };
  }
  st.refineCalls += 1;

  const transcript = contextWindow(session);
  const refined = await refineSignal({
    llm,
    route,
    sessionId,
    signal,
    transcript,
    timeoutMs: Number(config.realtimeMemoryTimeoutMs) || REFINE_TIMEOUT_MS,
    log,
  });

  let candidate = refined.candidate;
  if (!candidate) {
    // 弱信号（「以后都…」「约定…」）用户并没有明确要求记住，模型解不开就安静跳过：
    // 既不退回原话，也不写「未记住」——那会把没人要求的事报成失败。
    if (weak) {
      log("info", "realtime-memory: weak signal not resolvable (" + refined.status + "), skip");
      return { skipped: "weak_unresolved", refineStatus: refined.status };
    }
    // 模型明确说解不开指代时不要退回原话——那条原话就是解不开的那条。
    const reason = refined.status === "unresolved" ? "unresolved_reference" : null;
    if (reason) {
      log("info", "realtime-memory: reference unresolved, deferring to session summary");
      await noteRejection({
        fs, projectPath, sessionId, signal, reason,
        refineStatus: refined.status, sample: refined.sample,
      });
      return { skipped: reason, refineStatus: refined.status, noted: true };
    }
    candidate = fallbackCandidate(signal);
    if (!candidate) {
      log("info", "realtime-memory: no self-contained fact (" + refined.status + "), deferring to session summary");
      await noteRejection({
        fs, projectPath, sessionId, signal,
        reason: "needs_context", refineStatus: refined.status, sample: refined.sample,
      });
      return { skipped: "needs_context", refineStatus: refined.status, noted: true };
    }
  }
  if (weak) {
    // 弱信号是从语气里推断出来的，不是用户点名要记的，可信度和重要性都要压一档。
    candidate = Object.assign({}, candidate, {
      confidence: Math.min(candidate.confidence, 0.7),
      importance: Math.min(candidate.importance, 0.7),
    });
  }

  const prior = findSupersedable(brain.memories, candidate);
  const result = await admitMemory({
    fs,
    projectPath,
    candidate: {
      type: candidate.type,
      title: candidate.title,
      content: candidate.content,
      importance: candidate.importance,
      confidence: candidate.confidence,
      tags: ["realtime", "user_intent", weak ? "weak_signal" : "strong_signal"],
      source: {
        kind: weak ? WEAK_SOURCE_KIND : "user_explicit",
        sessionId: sessionId || null,
        signalKind: signal.kind,
        refined: candidate.resolved === true,
        trigger: String(signal.fullText || signal.content).slice(0, 200),
        ...(prior ? { supersedes: prior.id } : {}),
      },
    },
    // 强信号是用户点名要记的，准入没得商量；弱信号是从语气里推断的，走常规通道，
    // 但内容已经由上面那次提炼产出，不再重复问一遍模型。
    channel: weak ? "automatic" : "user_explicit",
    ...(weak ? { llmConfirm: { admit: true, type: candidate.type } } : {}),
    now: Date.now(),
  });

  if (!result.ok) {
    log("info", "realtime-memory: admit refused " + (result.code || "") + " " + (result.reason || ""));
    await noteRejection({
      fs, projectPath, sessionId, signal,
      reason: result.reason || result.code || "rejected",
      refineStatus: refined.status,
    });
    return { skipped: result.code || "rejected", refineStatus: refined.status, result, noted: true };
  }
  if (result.action === "skip") {
    return { skipped: "duplicate", id: result.id };
  }
  st.count += 1;
  log("info", 'realtime-memory: admitted [' + candidate.type + '] "' + candidate.title + '"'
    + (refined.status === "refined" ? " (refined)" : " (verbatim)")
    + (result.supersedesId ? " supersedes=" + result.supersedesId : ""));
  return { appended: true, entry: result.entry, id: result.id, refineStatus: refined.status, supersedesId: result.supersedesId || null };
}

export function setupRealtimeMemory(ctx, fs, sandboxPolicy, runtime = {}) {
  if (!ctx || typeof ctx.on !== "function") return;
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

      const config = runtime.getMemoryConfig ? runtime.getMemoryConfig() : {};
      if (config.realtimeMemoryEnabled === false) return;

      const work = handleOne({
        fs,
        projectPath,
        sessionId,
        signal,
        session,
        logger,
        config,
        llm: runtime.getLlm ? runtime.getLlm() : null,
        route: resolveSessionRoute(session),
      })
        .then(async (result) => {
          // 落盘和「记了一条未记住」都会改变侧边栏内容，两种都要通知。
          if (result && (result.appended || result.noted) && ctx && typeof ctx.emit === "function") {
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
