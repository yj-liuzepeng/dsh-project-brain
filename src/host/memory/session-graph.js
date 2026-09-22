import { isChangelogGenre } from "./admit.js";

const FILE_SHOW = 5;
const THIN_AFTER = 40;
const KEEP_RECENT = 20;
const DETAIL_MAX_CHARS = 900;
const NO_SUMMARY_LABEL = "代码有变更（无摘要）";
const INIT_LABEL = "项目初始化";

function qualifiedSummary(text) {
  const summary = String(text || "").trim();
  if (!summary) return "";
  if (isChangelogGenre("", summary) || isChangelogGenre(summary, summary)) return "";
  return summary;
}

function firstSentence(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const versions = [];
  const masked = raw.replace(/\bv?\d+(?:\.\d+)+\b/gi, (m) => {
    versions.push(m);
    return "\u0001" + (versions.length - 1) + "\u0001";
  });
  const parts = masked.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  const first = (parts[0] || masked).trim();
  return first.replace(/\u0001(\d+)\u0001/g, (_, i) => versions[Number(i)] || "");
}

// 以版本号开头 **且** 是补丁/发布语气的标题才算「不值得成为主干节点」。
// 只看开头是不是数字会误杀「2.0 版本规划」「3.2 数据层重构」这类正常标题。
const PATCH_TONE = /(?:\bpatch\b|\bhotfix\b|\brelease[-\s]?(?:fix|notes)?\b|\bfix(?:es|ed)?\b|修复|补丁|发版|验收|改动说明|变更说明)/i;
function isVersionLedTitle(text) {
  const t = String(text || "").trim();
  const m = t.match(/^v?\d+(?:\.\d+)+\b(.*)$/i);
  if (!m) return false;
  const rest = String(m[1] || "").trim();
  // 「v0.4.13」后面什么都没有，等于没信息量，同样不进主干
  if (!rest) return true;
  return PATCH_TONE.test(rest);
}

function isWeakGraphTitle(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (isChangelogGenre("", t) || isChangelogGenre(t, t)) return true;
  if (isVersionLedTitle(t)) return true;
  return false;
}

function usableTitleLabel(text) {
  if (isWeakGraphTitle(text)) return "";
  const sentence = firstSentence(text);
  const trimmed = String(sentence || "").trim();
  if (!trimmed) return "";
  if (/^v?\d+\.$/i.test(trimmed) || /v0\.$/.test(trimmed)) return "";
  return trimmed;
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

// 节点展开区是纯文本，不渲染 markdown。记忆正文常带 ## / ** / ` / 列表 / 链接，
// 原样丢出来既难读又像坏掉了，这里统一剥成人话。
function stripMarkdown(text) {
  let out = String(text || "");
  out = out.replace(/```[\s\S]*?```/g, " ");           // 代码块
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "");         // 标题
  out = out.replace(/^\s{0,3}>\s?/gm, "");              // 引用
  out = out.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, ""); // 列表项
  out = out.replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, " ");   // 分割线
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");   // 图片
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");    // 链接
  out = out.replace(/`+([^`]*)`+/g, "$1");              // 行内代码
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");          // 加粗
  out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?!\w)/g, "$1"); // 斜体
  out = out.replace(/(?<![\w_])__([^_]+)__(?![\w_])/g, "$1");
  out = out.replace(/~~([^~]+)~~/g, "$1");              // 删除线
  return normalizeText(out);
}

function clipDetail(text, limit) {
  const raw = normalizeText(text);
  if (raw.length <= limit) return raw;
  // 优先在句末断开，断不了再硬切；无论哪种都显式给省略号，不要装作说完了
  const head = raw.slice(0, limit);
  const lastStop = Math.max(
    head.lastIndexOf("。"), head.lastIndexOf("！"), head.lastIndexOf("？"),
    head.lastIndexOf("；"), head.lastIndexOf("."), head.lastIndexOf("!"), head.lastIndexOf("?"),
  );
  const cut = lastStop >= limit * 0.6 ? head.slice(0, lastStop + 1) : head.replace(/\s+\S*$/, "");
  return (cut || head).replace(/\s+$/, "") + "…";
}

function restAfterFirstSentence(text) {
  const raw = String(text || "").trim();
  const first = firstSentence(raw);
  if (!first || raw === first) return "";
  if (raw.startsWith(first)) return raw.slice(first.length).trim();
  return "";
}

function bodyWithoutTitle(content, title, label) {
  let c = String(content || "").trim();
  for (const head of [title, label]) {
    const h = String(head || "").trim();
    if (!h) continue;
    if (normalizeText(c) === normalizeText(h)) return "";
    if (c.startsWith(h)) c = c.slice(h.length).replace(/^[\s:：.\-—]+/, "").trim();
  }
  return c;
}

function pickDetail(g, label, summary) {
  const rest = restAfterFirstSentence(summary);
  if (rest && normalizeText(rest) !== normalizeText(label)) {
    return clipDetail(stripMarkdown(rest), DETAIL_MAX_CHARS);
  }
  const lab = String(label || "").trim();
  const details = (g.details || []).slice().sort((a, b) => {
    const score = (d) => (usableTitleLabel(d.title) === lab || d.title === lab ? 1 : 0);
    return score(b) - score(a);
  });
  for (const d of details) {
    const body = stripMarkdown(bodyWithoutTitle(d.content, d.title, label));
    if (!body) continue;
    return clipDetail(body, DETAIL_MAX_CHARS);
  }
  return "";
}

const SKIP_EVENT_TYPES = new Set(["rescan", "export", "import", "rollback"]);
const SUBSTANTIVE_EVENT_TYPES = new Set(["session_summary", "todo", "todo_update", "memory", "memory_supersede"]);

function dayKey(ts) {
  const n = Number(ts) || 0;
  if (!n) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x) => (x < 10 ? "0" + x : "" + x);
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function parseTodoId(event) {
  if (event && event.todoId) return String(event.todoId);
  const detail = String((event && event.detail) || "");
  const fromDetail = detail.match(/(?:todoId|id)=(todo-[A-Za-z0-9._:-]+|[A-Za-z0-9._:-]+)/);
  if (fromDetail) return fromDetail[1];
  const title = String((event && event.title) || "");
  const fromTitle = title.match(/\[(todo-[^\]]+)\]/);
  return fromTitle ? fromTitle[1] : "";
}

function isTodoDone(event) {
  if (event && event.todoStatus === "done") return true;
  if (/status=done/.test(String((event && event.detail) || ""))) return true;
  return /^完成待办/.test(String((event && event.title) || ""));
}

function displayTitle(event) {
  let title = String((event && event.title) || "").trim();
  title = title.replace(/^新增记忆\[[^\]]+\]：/, "");
  title = title.replace(/^新增待办(?:\[[^\]]+\])?：/, "");
  title = title.replace(/^完成待办(?:\[[^\]]+\])?：/, "");
  title = title.replace(/^更新待办\[[^\]]+\]：/, "");
  return title.trim();
}

function sessionKey(event) {
  if (event && event.sessionId) return String(event.sessionId);
  if (event && event.eventType === "init") return "init";
  if (!event || SKIP_EVENT_TYPES.has(event.eventType)) return "";
  if (SUBSTANTIVE_EVENT_TYPES.has(event.eventType)) {
    const day = dayKey(event.occurredAt);
    return day ? "day:" + day : "";
  }
  return "";
}

// init/rescan 的 detail 写的是 `files=1975`（文件**数量**），summarizer 写的才是
// `files=src/a.js,src/b.js`（文件列表）。同一个 key 两种含义，必须靠形态区分，
// 否则计数会被当成文件名画到节点上。
function looksLikePath(token) {
  const t = String(token || "").trim();
  if (!t || /^\d+$/.test(t)) return false;
  return t.includes("/") || /\.[A-Za-z0-9]{1,8}$/.test(t);
}

function parseFiles(event) {
  if (Array.isArray(event && event.files)) {
    return event.files.map((f) => String(f).replace(/\\/g, "/")).filter(looksLikePath);
  }
  const detail = String((event && event.detail) || "");
  const m = detail.match(/\bfiles=([^\s]+)/);
  if (!m) return [];
  return m[1].split(",").map((f) => f.trim()).filter(looksLikePath);
}

function parseTriggerFiles(event) {
  if (Array.isArray(event && event.triggerFiles)) {
    return event.triggerFiles.map((f) => String(f).replace(/\\/g, "/")).filter(Boolean);
  }
  return [];
}

function intersect(a, b) {
  const set = new Set(b);
  return a.some((x) => set.has(x));
}

export function buildSessionGraph(brain) {
  const timeline = Array.isArray(brain && brain.timeline) ? brain.timeline.filter(Boolean) : [];
  const memories = Array.isArray(brain && brain.memories) ? brain.memories.filter(Boolean) : [];
  const groups = new Map();

  function bucket(sessionId) {
    if (!sessionId) return null;
    let g = groups.get(sessionId);
    if (!g) {
      g = {
        sessionId,
        occurredAt: 0,
        summaries: [],
        files: [],
        titles: [],
        details: [],
        todoIds: new Set(),
        todoOpened: new Set(),
        todoDone: new Set(),
        hasMemory: false,
        triggerFiles: [],
        architectureFull: false,
      };
      groups.set(sessionId, g);
    }
    return g;
  }

  for (const event of timeline) {
    const sid = sessionKey(event);
    const g = bucket(sid);
    if (!g) continue;
    const at = Number(event.occurredAt) || 0;
    if (at && (!g.occurredAt || at < g.occurredAt)) g.occurredAt = at;
    if (at > (g.latestAt || 0)) g.latestAt = at;
    const files = parseFiles(event);
    for (const f of files) if (!g.files.includes(f)) g.files.push(f);
    if (event.eventType === "session_summary") {
      const q = qualifiedSummary(event.summary);
      if (q) g.summaries.push({ text: q, occurredAt: at });
    }
    if (event.eventType === "todo" || event.eventType === "todo_update") {
      const id = parseTodoId(event);
      if (id) {
        g.todoIds.add(id);
        // 「开 → 关」才是因果。把 done 事件也算成起点，会在重复标记完成时连出假边。
        if (isTodoDone(event)) g.todoDone.add(id);
        else g.todoOpened.add(id);
      }
      const todoTitle = displayTitle(event);
      if (todoTitle) g.titles.push(todoTitle);
    }
    if (event.eventType === "memory" || event.eventType === "memory_supersede") {
      const memTitle = displayTitle(event);
      if (memTitle && !isWeakGraphTitle(memTitle)) {
        g.hasMemory = true;
        g.titles.push(memTitle);
      }
    }
    if (event.eventType === "rescan" || event.architectureMode === "full") {
      const triggers = parseTriggerFiles(event);
      g.triggerFiles = g.triggerFiles.concat(triggers);
      if (event.architectureMode === "full" || /architecture=/.test(String(event.detail || ""))) g.architectureFull = true;
    }
  }

  for (const m of memories) {
    if (!m) continue;
    const weak = isWeakGraphTitle(String(m.title || "")) || isChangelogGenre(String(m.title || ""), String((m.content || m.title) || ""));
    let sid = m && m.source && m.source.sessionId ? String(m.source.sessionId) : "";
    if (!sid) {
      if (weak) continue;
      const day = dayKey(m.createdAt || m.updatedAt);
      sid = day ? "day:" + day : "";
    }
    const g = bucket(sid);
    if (!g) continue;
    const at = Number(m.createdAt || m.updatedAt) || 0;
    if (!weak) {
      g.hasMemory = true;
      if (m.title) g.titles.push(String(m.title));
      const content = String(m.content || "").trim();
      if (content) g.details.push({ title: String(m.title || ""), content, occurredAt: at });
    }
    if (at && (!g.occurredAt || at < g.occurredAt)) g.occurredAt = at;
    // 排序统一用「桶内最后一次活动」，否则纯记忆桶按最早时间排、timeline 桶按最晚时间排，先后会错。
    if (at > (g.latestAt || 0)) g.latestAt = at;
  }

  let collapsedEmptyCount = 0;
  const trunk = [];
  for (const g of groups.values()) {
    g.summaries.sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
    const summary = g.summaries.length ? g.summaries[0].text : "";
    const hasFiles = g.files.length > 0;
    const hasTodo = g.todoIds.size > 0;
    // init 是主干的起点锚：它确实发生过，且是「这条开发线从哪开始」的答案。
    const trunkOk = Boolean(summary || hasFiles || hasTodo || g.hasMemory || g.sessionId === "init");
    if (!trunkOk) {
      collapsedEmptyCount += 1;
      continue;
    }
    let label = firstSentence(summary);
    let labelFromSummary = Boolean(label);
    if (!label) {
      for (const t of g.titles || []) {
        const titled = usableTitleLabel(t);
        if (titled) {
          label = titled;
          break;
        }
      }
    }
    if (!label && g.sessionId === "init") label = INIT_LABEL;
    if (!label && hasFiles) label = NO_SUMMARY_LABEL;
    if (!label) label = firstSentence(summary) || g.sessionId;
    const detail = pickDetail(g, label, summary);
    const files = g.files.slice(0, FILE_SHOW);
    trunk.push({
      id: g.sessionId,
      sessionId: g.sessionId,
      occurredAt: g.latestAt || g.occurredAt || 0,
      label,
      detail,
      files,
      filesMore: Math.max(0, g.files.length - files.length),
      important: Boolean(labelFromSummary || hasFiles || g.todoDone.size || g.architectureFull),
      trunk: true,
      hidden: false,
      _todoOpened: g.todoOpened,
      _todoDone: g.todoDone,
      _allFiles: g.files,
      _triggerFiles: g.triggerFiles,
      _architectureFull: g.architectureFull,
      _labelFromSummary: labelFromSummary,
    });
  }

  trunk.sort((a, b) => (a.occurredAt || 0) - (b.occurredAt || 0));
  const edges = [];
  for (let i = 1; i < trunk.length; i++) {
    edges.push({ from: trunk[i - 1].id, to: trunk[i].id, kind: "time", reason: "time" });
  }

  const byId = new Map(trunk.map((n) => [n.id, n]));

  // TODO 闭环：某个 todo 在 a 打开、在之后的 b 关闭。用倒排索引代替全对遍历。
  const doneAt = new Map();
  trunk.forEach((node, index) => {
    for (const todoId of node._todoDone) {
      if (!doneAt.has(todoId)) doneAt.set(todoId, []);
      doneAt.get(todoId).push(index);
    }
  });
  trunk.forEach((node, index) => {
    for (const todoId of node._todoOpened) {
      for (const j of doneAt.get(todoId) || []) {
        if (j > index) edges.push({ from: node.id, to: trunk[j].id, kind: "evidence", reason: "todo" });
      }
    }
  });

  // 架构重扫：只与紧邻的上一个主干节点比对（spec §8.2），不跨节点连远边。
  for (let i = 1; i < trunk.length; i++) {
    const prev = trunk[i - 1];
    const cur = trunk[i];
    if (!cur._architectureFull) continue;
    if (intersect(cur._triggerFiles.length ? cur._triggerFiles : cur._allFiles, prev._allFiles)) {
      edges.push({ from: prev.id, to: cur.id, kind: "evidence", reason: "architecture" });
    }
  }

  for (const m of memories) {
    const newSid = m && m.source && m.source.sessionId ? String(m.source.sessionId) : "";
    const oldId = m && (m.source && m.source.supersedes || m.supersedes);
    if (!newSid || !oldId) continue;
    const old = memories.find((x) => x && x.id === oldId);
    const oldSid = old && old.source && old.source.sessionId ? String(old.source.sessionId) : "";
    if (oldSid && oldSid !== newSid && byId.has(oldSid) && byId.has(newSid)) {
      edges.push({ from: oldSid, to: newSid, kind: "evidence", reason: "supersede" });
    }
  }

  const seenEdge = new Set();
  const uniqueEdges = [];
  for (const e of edges) {
    const key = e.kind + ":" + e.reason + ":" + e.from + "->" + e.to;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    uniqueEdges.push(e);
  }

  const evidenceEnds = new Set();
  for (const e of uniqueEdges) {
    if (e.kind === "evidence") {
      evidenceEnds.add(e.from);
      evidenceEnds.add(e.to);
    }
  }
  for (const n of trunk) {
    n.important = Boolean(n.important || evidenceEnds.has(n.id));
  }

  // 抽稀：只在节点确实过多时生效，且永远保底显示最近 KEEP_RECENT 个。
  // 旧实现会把所有 important=false 的节点一次性藏光，历史上只有记忆没有摘要的项目
  // 默认视图会几乎空白，反而更像"断开"。
  let hiddenCount = 0;
  if (trunk.length > THIN_AFTER) {
    const keepFrom = Math.max(0, trunk.length - KEEP_RECENT);
    trunk.forEach((n, index) => {
      if (n.important || index >= keepFrom) return;
      n.hidden = true;
      hiddenCount += 1;
    });
  }

  const nodes = trunk.map((n) => {
    const copy = Object.assign({}, n);
    delete copy._todoOpened;
    delete copy._todoDone;
    delete copy._allFiles;
    delete copy._triggerFiles;
    delete copy._architectureFull;
    delete copy._labelFromSummary;
    delete copy.titles;
    delete copy.details;
    return copy;
  });

  return {
    nodes,
    edges: uniqueEdges,
    collapsedEmptyCount,
    hiddenCount,
  };
}
