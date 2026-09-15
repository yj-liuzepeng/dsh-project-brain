// admit.js — Durable Core 唯一事实写入入口。
// 生产路径里只有这里可以对 memory.jsonl 做 appendJsonl。

import { createHash } from "node:crypto";

import { streamLlmText } from "../architecture/analyzer.js";
import { appendJsonl, brainPath, readBrain, writeJsonl } from "../store/brain-files.js";
import {
  estimateTokens,
  isCoreMemory,
  isRetrievableMemory,
  makeId,
  makeMemoryEntry,
  makeTodoEntry,
  normalizeMemoryType,
} from "../store/brain-logic.js";

export const CORE_MAX_ITEMS = 15;
export const CORE_MAX_TOKENS = 800;
export const TITLE_JACCARD_SUGGEST = 0.85;

const DURABLE_TYPES = new Set(["decision", "requirement", "architecture", "bug", "lesson"]);

export function memoryFingerprint(item) {
  const type = String((item && item.type) || "").toLowerCase();
  const title = String((item && item.title) || "");
  const content = String((item && item.content) || "");
  const normalized = (type + "\n" + title + "\n" + content).toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 24);
}

export function isMockLlmPayload(text) {
  const s = String(text || "");
  return /\[MOCK_LLM\]/.test(s) || /\[parse-fallback\]/.test(s);
}

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

export function titleJaccard(a, b) {
  return jaccard(titleBigrams(a), titleBigrams(b));
}

function fileListHeavy(content) {
  const lines = String(content || "").split(/\n/).map((l) => l.trim()).filter(Boolean);
  const pathLines = lines.filter((l) => /^[-*]\s+\S+/.test(l) && /[./\\]/.test(l));
  const prose = String(content || "").replace(/^[-*].*$/gm, "").replace(/\s+/g, "");
  return pathLines.length >= 3 && prose.length < 40;
}

export function isActivityReport(title, content) {
  const t = String(title || "");
  const c = String(content || "");
  const blob = t + "\n" + c;
  if (/改了\s*\d+\s*个文件/.test(blob)) return true;
  if (/本次\s*session\s*改动/i.test(blob)) return true;
  if (fileListHeavy(c)) return true;
  if (/^(本次完成|本次工作|完成情况|验收清单|工作总结)/.test(t.trim()) && /(验收|PASS|git 快进|改了)/.test(c)) return true;
  const reportHits = (blob.match(/验收\s*\d+\s*\/\s*\d+|全套 smoke|git 快进|同步至 v\d/gi) || []).length;
  if (reportHits >= 3) return true;
  if (reportHits >= 2 && !/根因/.test(c) && !/以后/.test(c)) return true;
  return false;
}

export function isChangelogGenre(title, content) {
  const t = String(title || "");
  const c = String(content || "");
  const versionLed = /^\s*v?\d+\.\d+(?:\.\d+)?\b/i.test(t);
  if (fileListHeavy(c)) return true;
  if (/改了\s*\d+\s*个文件/.test(t) || /改了\s*\d+\s*个文件/.test(c)) return true;
  if (/本次\s*session\s*改动/i.test(t) || /本次\s*session\s*改动/i.test(c)) return true;
  if (/^(git\s+)?commit\b/i.test(t.trim()) || /^PR\s*#\s*\d+/i.test(t.trim())) return true;
  if (/\b(changelog|release notes)\b/i.test(t)) return true;
  // patch #N is release-notes genre even if the body has a lesson.
  if (/\bpatch\s*#\s*\d+/i.test(t)) return true;
  // Version-led "release / 改动 / 验收" titles are changelog only when the body is a report.
  if (versionLed && /(release|改动|验收)/i.test(t) && isActivityReport(t, c)) return true;
  if (isActivityReport(t, c)) return true;
  return false;
}

export function compactMemoryText(text, maxChars) {
  const raw = String(text || "").trim();
  const limit = Math.max(40, Number(maxChars) || 400);
  if (raw.length <= limit) return raw;
  const parts = raw.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  let acc = "";
  for (const part of parts) {
    const next = acc ? acc + part : part;
    if (next.length > limit) break;
    acc = next;
  }
  if (!acc) acc = raw.slice(0, limit);
  return acc.trim();
}

function compactCandidate(candidate, channel) {
  const next = Object.assign({}, candidate);
  const max = channel === "user_explicit" ? 800 : 400;
  next.title = String(next.title || "").trim().slice(0, 120);
  next.content = compactMemoryText(next.content, max);
  if (channel !== "user_explicit" && typeof next.importance === "number") {
    next.importance = Math.min(next.importance, 0.85);
  }
  return next;
}

export function ruleGate(candidate) {
  const type = normalizeMemoryType(candidate && candidate.type) || String((candidate && candidate.type) || "").toLowerCase();
  const title = String((candidate && candidate.title) || "").trim();
  const content = String((candidate && candidate.content) || "").trim();
  const sourceKind = candidate && candidate.source && candidate.source.kind;

  if (type === "change") {
    return { ok: false, code: "E_ADMIT_RULE", reason: "type_change", route: "timeline" };
  }
  if (type === "issue") {
    return { ok: false, code: "E_ADMIT_RULE", reason: "type_issue", route: "todo" };
  }
  if (type === "context") {
    if (sourceKind !== "user_explicit") {
      return { ok: false, code: "E_ADMIT_RULE", reason: "context_not_user_explicit" };
    }
  } else if (!DURABLE_TYPES.has(type)) {
    return { ok: false, code: "E_ADMIT_RULE", reason: "type_forbidden" };
  }
  if (content.length < 20) {
    return { ok: false, code: "E_ADMIT_RULE", reason: "content_too_short" };
  }
  if (isChangelogGenre(title, content)) {
    return { ok: false, code: "E_ADMIT_RULE", reason: "changelog_genre", route: "timeline" };
  }
  return { ok: true };
}

function coreTokenSum(rows) {
  return (rows || []).filter(isCoreMemory).reduce((sum, m) => {
    return sum + estimateTokens(String(m.title || "") + String(m.content || ""));
  }, 0);
}

export function enforceCoreCap(rows, { pinnedIds = [], now = Date.now() } = {}) {
  const list = (rows || []).map((m) => Object.assign({}, m));
  const pinned = new Set(pinnedIds || []);
  let changed = false;

  function actives() {
    return list.filter(isCoreMemory);
  }

  function pickVictim(active) {
    const unpinned = active.filter((m) => !pinned.has(m.id));
    const pool = unpinned.length ? unpinned.slice() : active.slice();
    pool.sort((a, b) => {
      const ia = Math.round((Number(a.importance) || 0) * 10);
      const ib = Math.round((Number(b.importance) || 0) * 10);
      if (ia !== ib) return ia - ib;
      return (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
    });
    return pool[0] || null;
  }

  while (true) {
    const active = actives();
    if (active.length <= CORE_MAX_ITEMS && coreTokenSum(active) <= CORE_MAX_TOKENS) break;
    if (!active.length) break;
    const victim = pickVictim(active);
    if (!victim) break;
    const idx = list.findIndex((m) => m.id === victim.id);
    if (idx < 0) break;
    list[idx] = Object.assign({}, list[idx], { status: "dormant", updatedAt: now });
    changed = true;
  }
  return { rows: list, changed };
}

export function backfillMemoryStatuses(rows, now = Date.now()) {
  let changed = false;
  const next = (rows || []).map((m) => {
    if (!m) return m;
    let status = m.status;
    let archiveReason = m.archiveReason;
    if (!status || status === "reinforced") status = "active";
    if (status === "deleted") status = "archived";
    const changelog = m.type === "change" || isChangelogGenre(m.title, m.content);
    if (changelog && status !== "archived" && status !== "superseded") {
      status = "archived";
      archiveReason = "backfill_rule";
    }
    if (status === m.status && archiveReason === m.archiveReason) return m;
    changed = true;
    return Object.assign({}, m, {
      status,
      ...(archiveReason && archiveReason !== m.archiveReason ? { archiveReason, updatedAt: now } : status !== m.status ? { updatedAt: now } : {}),
    });
  });
  return { rows: next, changed };
}

function collectSuggestSupersede(rows) {
  const items = (rows || []).filter(isRetrievableMemory);
  const actions = [];
  const seen = new Set();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!a || !b || a.type !== b.type) continue;
      if (titleJaccard(a.title, b.title) < TITLE_JACCARD_SUGGEST) continue;
      const key = [a.id, b.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      actions.push({
        action: "suggest_supersede",
        ids: [a.id, b.id],
        titles: [a.title, b.title],
        note: "title Jaccard ≥ " + TITLE_JACCARD_SUGGEST + "；需显式 supersede，自动路径不合并",
      });
    }
  }
  return actions;
}

export function housekeepMemories(rows, { now = Date.now(), pinnedIds = [] } = {}) {
  const before = (rows || []).slice();
  const bf = backfillMemoryStatuses(before, now);
  const cap = enforceCoreCap(bf.rows, { pinnedIds, now });
  const suggestions = collectSuggestSupersede(cap.rows);
  const changed = bf.changed || cap.changed;
  const actions = [];
  const prev = new Map(before.map((m) => [m && m.id, m]));
  for (const m of cap.rows) {
    const o = prev.get(m.id);
    if (!o) continue;
    if (o.status !== m.status && m.status === "archived" && m.archiveReason === "backfill_rule") {
      actions.push({ action: "archive_rule", id: m.id, title: m.title });
    } else if (o.status !== m.status && m.status === "dormant") {
      actions.push({ action: "evict_to_dormant", id: m.id, title: m.title });
    }
  }
  return {
    rows: cap.rows,
    changed,
    actions: actions.concat(suggestions),
  };
}

function findFingerprintHit(memories, fingerprint) {
  return (memories || []).find((m) => {
    if (!m || !m.source || m.source.fingerprint !== fingerprint) return false;
    return m.status !== "archived" && m.status !== "superseded" && m.status !== "deleted";
  }) || null;
}

export function evaluateAdmit(candidate, ctx) {
  const now = ctx && typeof ctx.now === "number" ? ctx.now : Date.now();
  const memories = (ctx && ctx.memories) || [];
  const channel = (ctx && ctx.channel) || "automatic";
  if (ctx && ctx.initialized === false) {
    return { action: "reject", code: "E_NOT_INITIALIZED", reason: "project not initialized" };
  }
  const working = compactCandidate(Object.assign({}, candidate), channel);
  const gated = ruleGate(candidate);
  if (!gated.ok) {
    return { action: "reject", code: gated.code, reason: gated.reason, route: gated.route };
  }
  if (channel !== "user_explicit") {
    const llm = ctx && ctx.llm;
    if (!llm) return { action: "reject", code: "E_ADMIT_LLM_UNAVAILABLE", reason: "llm confirm required" };
    if (llm.unavailable) return { action: "reject", code: "E_ADMIT_LLM_UNAVAILABLE", reason: llm.reason || "llm unavailable" };
    if (llm.admit !== true) return { action: "reject", code: "E_ADMIT_REJECTED", reason: (llm && llm.reason) || "admit false" };
    if (llm.type) {
      const nextType = normalizeMemoryType(llm.type);
      if (nextType) working.type = nextType;
    }
  }
  const fingerprint = memoryFingerprint(working);
  const existing = findFingerprintHit(memories, fingerprint);
  if (existing) {
    return { action: "skip", existingId: existing.id, fingerprint, candidate: working };
  }
  const explicitSupersedes = (ctx && ctx.llm && ctx.llm.supersedes)
    || working.supersedes
    || (working.source && working.source.supersedes)
    || null;
  let supersedesId = null;
  if (explicitSupersedes) {
    const old = memories.find((m) => m && m.id === explicitSupersedes);
    if (old && isRetrievableMemory(old)) supersedesId = old.id;
  }
  const suggestions = [];
  for (const m of memories) {
    if (!isRetrievableMemory(m) || m.type !== working.type) continue;
    if (titleJaccard(m.title, working.title) >= TITLE_JACCARD_SUGGEST) {
      suggestions.push({
        action: "suggest_supersede",
        ids: [m.id],
        titles: [m.title, working.title],
      });
    }
  }
  return {
    action: "insert",
    fingerprint,
    supersedesId,
    suggestions,
    candidate: working,
    now,
  };
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim(),
  ];
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const c of candidates) {
    try { return JSON.parse(c); } catch (e) {}
  }
  return null;
}

export function parseAdmitConfirm(text) {
  if (isMockLlmPayload(text)) return { unavailable: true, reason: "mock llm" };
  const parsed = parseJsonObject(text);
  if (!parsed || typeof parsed !== "object" || typeof parsed.admit !== "boolean") {
    return { unavailable: true, reason: "unparseable confirm" };
  }
  return {
    admit: parsed.admit === true,
    type: parsed.type || null,
    reason: parsed.reason || "",
    supersedes: parsed.supersedes || null,
  };
}

function admitPrompt(candidate) {
  return [
    "判断下面这条候选是否应写入项目长期记忆（跨会话仍为真的决策/约束/架构事实/教训）。",
    "changelog、本次改了哪些文件、会话流水账不要 admit。",
    "只输出严格 JSON：" + JSON.stringify({ admit: true, type: "decision", reason: "why", supersedes: null }),
    "候选：" + JSON.stringify({
      type: candidate.type,
      title: candidate.title,
      content: String(candidate.content || "").slice(0, 800),
    }),
  ].join("\n");
}

export async function confirmWithSessionLlm({ llm, route, sessionId, candidate }) {
  if (!llm || typeof llm.stream !== "function" || !route || !route.provider || !route.model) {
    return { unavailable: true, reason: "llm or route missing" };
  }
  try {
    const text = await streamLlmText(llm, route, admitPrompt(candidate), sessionId, 15000, {
      system: "Return strict JSON only. admit=true only for durable project facts, never changelogs.",
      maxTokens: 400,
      purpose: "project-memory-admit",
    });
    return parseAdmitConfirm(text);
  } catch (e) {
    return { unavailable: true, reason: String((e && e.message) || e) };
  }
}

async function persistAdmitted({ fs, projectPath, memories, entry, supersedesId, now, pinnedIds }) {
  let rows = (memories || []).slice();
  if (supersedesId) {
    rows = rows.map((m) => {
      if (m.id !== supersedesId) return m;
      return Object.assign({}, m, {
        status: "superseded",
        updatedAt: now,
        lastAccessedAt: now,
        supersededBy: entry.id,
      });
    });
  }
  rows.push(entry);
  const capped = enforceCoreCap(rows, { pinnedIds: [...(pinnedIds || []), entry.id], now });
  const needRewrite = Boolean(supersedesId) || capped.changed;
  if (needRewrite) {
    const ok = await writeJsonl(fs, brainPath(projectPath, "memory.jsonl"), capped.rows);
    if (!ok) return { ok: false, code: "E_WRITE_FAILED" };
    return { ok: true, entry, rows: capped.rows };
  }
  const ok = await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry);
  if (!ok) return { ok: false, code: "E_WRITE_FAILED" };
  return { ok: true, entry, rows: capped.rows };
}

export async function admitMemory({
  fs,
  projectPath,
  candidate,
  channel = "automatic",
  llmConfirm,
  now = Date.now(),
  pinnedIds,
} = {}) {
  if (!fs || !projectPath) {
    return { ok: false, code: "E_NOT_INITIALIZED", message: "missing fs/projectPath" };
  }
  const brain = await readBrain(fs, projectPath);
  if (!brain.project || brain.project.__error) {
    return { ok: false, code: "E_NOT_INITIALIZED", message: "project not initialized" };
  }

  let llm = null;
  if (channel !== "user_explicit") {
    if (typeof llmConfirm === "function") {
      try {
        llm = await llmConfirm(candidate);
      } catch (e) {
        return { ok: false, code: "E_ADMIT_LLM_UNAVAILABLE", message: String((e && e.message) || e) };
      }
    } else if (llmConfirm && typeof llmConfirm === "object") {
      llm = llmConfirm;
    }
  }

  const decision = evaluateAdmit(candidate, {
    memories: brain.memories,
    channel,
    now,
    initialized: true,
    llm,
  });

  if (decision.action === "reject") {
    if (decision.route === "todo") {
      const title = String((candidate && candidate.title) || "").trim();
      if (title) {
        const todo = makeTodoEntry({
          title,
          description: String((candidate && candidate.content) || ""),
        }, now);
        await appendJsonl(fs, brainPath(projectPath, "todo.jsonl"), todo);
        return { ok: false, code: decision.code, reason: decision.reason, routed: "todo", todoId: todo.id };
      }
    }
    if (decision.route === "timeline") {
      await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
        id: makeId("evt", now),
        title: String((candidate && candidate.title) || "rejected change"),
        eventType: "change",
        occurredAt: now,
        detail: "admit rejected: " + (decision.reason || ""),
      });
      return { ok: false, code: decision.code, reason: decision.reason, routed: "timeline" };
    }
    return { ok: false, code: decision.code, reason: decision.reason, message: decision.reason };
  }

  if (decision.action === "skip") {
    return { ok: true, action: "skip", id: decision.existingId, fingerprint: decision.fingerprint };
  }

  const working = decision.candidate;
  const fingerprint = decision.fingerprint;
  const source = Object.assign({}, working.source || {}, {
    kind: (working.source && working.source.kind) || (channel === "user_explicit" ? "user_explicit" : "agent"),
    fingerprint,
  });
  const entry = makeMemoryEntry({
    type: working.type,
    title: working.title,
    content: working.content,
    importance: working.importance,
    confidence: working.confidence,
    relatedFiles: working.relatedFiles,
    tags: working.tags,
    source,
  }, now);
  if (decision.supersedesId) {
    entry.source = Object.assign({}, entry.source, { supersedes: decision.supersedesId });
  }

  const persisted = await persistAdmitted({
    fs,
    projectPath,
    memories: brain.memories,
    entry,
    supersedesId: decision.supersedesId,
    now,
    pinnedIds: pinnedIds || [entry.id],
  });
  if (!persisted.ok) return { ok: false, code: persisted.code || "E_WRITE_FAILED", message: "failed to write memory.jsonl" };
  return {
    ok: true,
    action: "insert",
    id: entry.id,
    entry,
    supersedesId: decision.supersedesId || null,
    suggestions: decision.suggestions || [],
  };
}

export async function persistHousekeep(fs, projectPath, { now = Date.now(), pinnedIds = [], writeTimeline = true } = {}) {
  const brain = await readBrain(fs, projectPath);
  if (!brain.project || brain.project.__error) {
    return { ok: false, code: "E_NOT_INITIALIZED", changed: false };
  }
  const hk = housekeepMemories(brain.memories || [], { now, pinnedIds });
  if (!hk.changed) return { ok: true, changed: false, actions: hk.actions, rows: hk.rows };
  const wrote = await writeJsonl(fs, brainPath(projectPath, "memory.jsonl"), hk.rows);
  if (!wrote) return { ok: false, code: "E_WRITE_FAILED", changed: false, actions: hk.actions };
  if (writeTimeline) {
    const archived = hk.actions.filter((a) => a.action === "archive_rule").length;
    const evicted = hk.actions.filter((a) => a.action === "evict_to_dormant").length;
    await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
      id: makeId("evt", now),
      title: "记忆整理完成（归档 " + archived + " · 休眠 " + evicted + "）",
      eventType: "dream",
      occurredAt: now,
      detail: "trigger=housekeep archived=" + archived + " evicted=" + evicted,
    });
  }
  return { ok: true, changed: true, actions: hk.actions, rows: hk.rows };
}

export async function ensureHousekeepOnRead(fs, projectPath) {
  try {
    return await persistHousekeep(fs, projectPath, { writeTimeline: false, pinnedIds: [] });
  } catch (e) {
    return { ok: false, changed: false, error: String((e && e.message) || e) };
  }
}
