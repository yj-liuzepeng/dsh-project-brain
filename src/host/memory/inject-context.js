// Shared Core injection assembler — injector and project_continue must render the same markdown.

import { activeTodos, estimateTokens, isCoreMemory, techStackToType } from "../store/brain-logic.js";

const SUMMARY_MAX_TOKENS = 400;

export function truncateSummaryToTokens(text, maxTokens) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (estimateTokens(raw) <= maxTokens) return raw;
  const parts = raw.split(/(?<=[。！？.!?])\s*/).filter(Boolean);
  let acc = "";
  const suffix = "（摘要已截断）";
  for (const part of parts) {
    const next = acc + part;
    if (estimateTokens(next + suffix) > maxTokens) break;
    acc = next;
  }
  if (!acc) {
    let cut = raw;
    while (cut.length > 8 && estimateTokens(cut + suffix) > maxTokens) {
      cut = cut.slice(0, Math.floor(cut.length * 0.85));
    }
    acc = cut.trim();
  }
  return acc.replace(/\s+$/, "") + suffix;
}

export function latestDisposedSessionSummary(timeline) {
  const summaries = (timeline || [])
    .filter((e) => e && e.eventType === "session_summary" && e.summary && String(e.summary).trim())
    .sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
  return summaries.length ? String(summaries[0].summary).trim() : "";
}

function renderTechStack(techStack) {
  if (!techStack || typeof techStack !== "object") return "";
  const parts = [];
  for (const [k, v] of Object.entries(techStack)) {
    if (Array.isArray(v)) {
      if (v.length) parts.push(k + "=" + v.join("/"));
    } else if (v) {
      parts.push(k + "=" + v);
    }
  }
  return parts.join(", ");
}

export function buildInjectionContext(brain) {
  if (!brain || !brain.project || brain.project.__error) return "";
  const project = brain.project;
  const memories = ((brain.memories || []).filter(isCoreMemory)).slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const todos = activeTodos(brain.todos || []);
  const lastSummary = truncateSummaryToTokens(latestDisposedSessionSummary(brain.timeline), SUMMARY_MAX_TOKENS);

  const lines = [];
  lines.push("## Project Brain");
  lines.push("");

  lines.push("### 项目概况");
  lines.push("- 名称: " + (project.name || "(未命名)"));
  const type = project.type || techStackToType(project.techStack);
  if (type) lines.push("- 类型: " + type);
  const ts = renderTechStack(project.techStack);
  if (ts) lines.push("- 技术栈: " + ts);
  if (project.description) lines.push("- 简介: " + String(project.description).slice(0, 300));
  lines.push("");

  if (memories.length > 0) {
    lines.push("### Core 记忆");
    for (const m of memories) {
      const tag = m.type ? "[" + m.type + "] " : "";
      lines.push("- " + tag + m.title);
      if (m.content) {
        lines.push("  " + String(m.content).replace(/\n+/g, " "));
      }
    }
    lines.push("");
  }

  if (lastSummary) {
    lines.push("### 上次会话");
    lines.push("> " + lastSummary.replace(/\n+/g, " "));
    lines.push("");
  }

  if (todos.length > 0) {
    lines.push("### 活跃 TODO");
    for (const t of todos.slice(0, 12)) {
      const prio = t.priority ? "[" + t.priority + "] " : "";
      const status = t.status === "in_progress" ? "⏳ " : "";
      lines.push("- " + status + prio + t.title);
    }
    lines.push("");
  }

  lines.push("### 项目记忆约定");
  lines.push("- 只对跨会话仍为真的决策、约束、架构事实或教训调用 `project_memory_add`；标题写成站立事实句，不要写成 v1.2.0 patch / 验收清单。");
  lines.push("- 工具可能拒绝，不要把 changelog / 本次改了哪些文件再写一遍。正文保持 2–4 句。");
  lines.push("- 进行中的工作用 `project_todo_add` / `project_todo_update` / `project_todo_done` 跟踪，续接依赖 TODO，而不是把会话流水账塞进记忆。");
  lines.push("- 项目结构明显变化后调用 `project_rescan`；需要理解最近代码变化时调用 `project_diff`（默认 dry-run）。");

  return lines.join("\n");
}
