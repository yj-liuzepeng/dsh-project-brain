import { isAbsolute, normalize, sep } from "node:path";

import { parseArchitectureJson, streamLlmText } from "../architecture/analyzer.js";
import { isRetrievableMemory, makeMemoryEntry, normalizeMemoryType } from "../store/brain-logic.js";
import { memoryFingerprint } from "./admit.js";

const ALLOWED_TYPES = new Set(["decision", "requirement", "architecture", "bug", "lesson", "context"]);

function clean(value, limit) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, limit);
}

export function redactSessionText(value) {
  return clean(value, 200000)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)\s*[:=]\s*["']?[^\s"']{6,}["']?/gi, "$1=[REDACTED]")
    .replace(/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g, "[REDACTED_TOKEN]");
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((block) => block && block.type === "text").map((block) => block.text || "").join("\n");
}

export function boundedSessionTranscript(session, maxChars = 16000) {
  let messages = [];
  try {
    messages = session && typeof session.deriveMessages === "function" ? session.deriveMessages() : [];
  } catch (e) { return ""; }
  const parts = (Array.isArray(messages) ? messages : []).map((message) => {
    const role = message && message.role;
    if (role !== "user" && role !== "assistant") return "";
    const value = redactSessionText(textFromContent(message.content));
    return value ? `${role.toUpperCase()}: ${value.slice(0, 6000)}` : "";
  }).filter(Boolean);
  const selected = [];
  let used = 0;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    selected.unshift(part.slice(Math.max(0, part.length - remaining)));
    used += Math.min(part.length, remaining) + 2;
  }
  return selected.join("\n\n");
}

function safeRelatedFile(value) {
  const file = clean(value, 240).replace(/\\/g, "/");
  if (!file || isAbsolute(file) || file.startsWith("../") || file === "..") return null;
  const normalized = normalize(file).split(sep).join("/");
  return normalized.startsWith("../") || normalized === ".." ? null : normalized;
}

function fingerprint(item) {
  return memoryFingerprint(item);
}

// Grounding check：模糊匹配 evidence 字符串是否真实存在于 transcript 里
//   目的：阻止 LLM 把临时讨论幻觉成决策落盘
//   实现：去掉空格/标点后做 substring 匹配（容忍少量字符差异），允许 evidence 截断到 80 字
export function evidenceMatchesTranscript(evidence, transcript) {
  if (!evidence || typeof evidence !== "string") return false;
  const evidenceText = evidence.trim().slice(0, 200);
  if (evidenceText.length < 6) return false;
  const normalize = (s) => String(s || "").replace(/\s+/g, "").replace(/[\s\p{P}]/gu, "").toLowerCase();
  const normEvidence = normalize(evidenceText);
  const normTranscript = normalize(transcript);
  if (normEvidence.length < 6) return false;
  // 直接 substring 匹配（容忍标点和大小写差异）
  if (normTranscript.includes(normEvidence)) return true;
  // 滑动窗口：如果 evidence 较长，按 30 字符窗口部分匹配（容忍 LLM 轻微改写）
  if (normEvidence.length > 30) {
    const windowSize = 30;
    for (let i = 0; i <= normEvidence.length - windowSize; i += 15) {
      if (normTranscript.includes(normEvidence.slice(i, i + windowSize))) return true;
    }
  }
  return false;
}

function sessionMemoryPrompt(transcript, maxItems, diffEvidence) {
  const parts = [
    "从下面的软件开发 Session 中提取值得跨会话长期保存的项目知识，并总结本次会话做了什么。",
    "只保留有明确证据的架构决策、稳定需求、Bug 根因与修复、可复用教训、长期问题或重要项目背景。",
    "忽略寒暄、临时步骤、命令输出、未确认猜测、个人信息、凭据；没有稳定知识时 memories 返回空数组。",
    "summary 用 2-4 句话客观概括本次会话的开发意图、主要动作与产出（作为下一个 Session 的续接上下文，不编造）。",
    `最多 ${maxItems} 条记忆。只输出严格 JSON 对象，不要 Markdown。`,
    "每条记忆必须带 evidence：原文中能直接验证该记忆的连续片段（建议 8-60 字），用于 grounding 校验。",
    "如果某条记忆无法在原文中找到对应证据，请降低 confidence 或不输出。",
    "durable=true 仅当该事实去掉日期/版本号后仍为真；changelog、本次改了哪些文件、会话流水账必须 durable=false。",
    "title 写成站立事实句（例如「路径以 session cwd 为准」），不要写成 v1.2.0 patch 或验收清单。content 用 2–4 句把 what+why 写完。",
    "格式：" + JSON.stringify({ summary: "本次会话总结（2-4 句话）", memories: [{ type: "decision|requirement|architecture|bug|lesson", title: "简洁标题", content: "自包含的事实与理由", evidence: "原文片段（8-60 字）", durable: true, importance: 0.8, confidence: 0.9, relatedFiles: ["相对路径"], tags: ["标签"], supersedes: null }] }),
  ];
  if (diffEvidence && String(diffEvidence).trim()) {
    parts.push("【git diff 参考证据（仅辅助核对文件级事实，不要逐条复述为记忆）】\n" + String(diffEvidence).trim());
  }
  parts.push("Session 对话：\n" + transcript);
  return parts.join("\n");
}

export async function extractSessionMemories({ session, llm, route, sessionId, existingMemories = [], config = {}, now = Date.now(), diffEvidence = "" } = {}) {
  if (config.sessionSemanticMemoryEnabled === false) return { status: "disabled", memories: [], summary: "" };
  if (!llm || typeof llm.stream !== "function") return { status: "llm_unavailable", memories: [], summary: "" };
  if (!route || !route.provider || !route.model) return { status: "route_unavailable", memories: [], summary: "" };
  const maxChars = Math.max(2000, Math.min(40000, Number(config.sessionSemanticMaxChars) || 16000));
  const maxItems = Math.max(1, Math.min(8, Number(config.sessionSemanticMaxItems) || 4));
  const transcript = boundedSessionTranscript(session, maxChars);
  if (transcript.length < 40) return { status: "empty_transcript", memories: [], summary: "" };

  const text = await streamLlmText(llm, route, sessionMemoryPrompt(transcript, maxItems, diffEvidence), sessionId, Number(config.sessionSemanticTimeoutMs) || 30000, {
    system: "Extract durable, evidence-based software-project memory as strict JSON only. Never reproduce credentials or personal data.",
    maxTokens: 2600,
    purpose: "project-session-memory",
  });
  const parsed = parseArchitectureJson(text);
  const summary = clean(parsed && parsed.summary, 2000);
  const raw = Array.isArray(parsed && parsed.memories) ? parsed.memories : [];
  const known = new Set((existingMemories || []).filter(isRetrievableMemory).map((item) =>
    item && item.source && item.source.fingerprint ? String(item.source.fingerprint) : fingerprint(item || {})
  ));
  const memories = [];
  let groundedCount = 0;
  let ungroundedCount = 0;
  for (const item of raw.slice(0, maxItems)) {
    const type = normalizeMemoryType(item && item.type);
    const title = clean(item && item.title, 200);
    const content = redactSessionText(clean(item && item.content, 400));
    const evidence = clean(item && item.evidence, 200);
    if (!ALLOWED_TYPES.has(type) || !title || content.length < 20) continue;
    if (item && item.durable !== true) continue;
    const candidate = { type, title, content };
    const hash = fingerprint(candidate);
    if (known.has(hash)) continue;
    known.add(hash);

    // Grounding check：evidence 必须能在 transcript 里找到，否则降级 confidence
    let groundingConfidence = typeof item.confidence === "number" ? item.confidence : 0.7;
    let groundingPassed = true;
    if (evidence && evidence.length >= 6) {
      if (evidenceMatchesTranscript(evidence, transcript)) {
        groundedCount += 1;
      } else {
        // evidence 给出但无法在 transcript 找到 → 高度疑似幻觉，confidence 大幅降级
        groundingConfidence = Math.min(groundingConfidence, 0.4);
        ungroundedCount += 1;
        groundingPassed = false;
      }
    } else {
      // 没给 evidence：无法校验，降级 confidence 但保留记忆（中等怀疑）
      groundingConfidence = Math.min(groundingConfidence, 0.55);
      ungroundedCount += 1;
      groundingPassed = false;
    }

    memories.push(makeMemoryEntry({
      ...candidate,
      importance: item.importance,
      confidence: groundingConfidence,
      relatedFiles: (Array.isArray(item.relatedFiles) ? item.relatedFiles : []).map(safeRelatedFile).filter(Boolean),
      tags: (Array.isArray(item.tags) ? item.tags : []).map((tag) => clean(tag, 50)).filter(Boolean),
      source: {
        kind: "session_semantic",
        fingerprint: hash,
        sessionId: sessionId || null,
        provider: route.provider,
        model: route.model,
        grounded: groundingPassed,
        evidence: evidence || null,
        ...(item && item.supersedes ? { supersedes: String(item.supersedes) } : {}),
      },
    }, now));
  }
  return { status: "completed", memories, summary, transcriptChars: transcript.length, grounded: groundedCount, ungrounded: ungroundedCount };
}
