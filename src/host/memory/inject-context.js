// Shared Core injection assembler — injector and project_continue must render the same markdown.

import { isCoreMemory } from "../store/brain-logic.js";
import { buildProjectBriefing, truncateSummaryToTokens, latestDisposedSessionSummary } from "./briefing.js";

export { truncateSummaryToTokens, latestDisposedSessionSummary, buildProjectBriefing };

export function buildInjectionContext(brain) {
  if (!brain || !brain.project || brain.project.__error) return "";
  const briefing = buildProjectBriefing(brain);
  const memories = ((brain.memories || []).filter(isCoreMemory)).slice()
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  const lines = [];
  lines.push("## Project Brain");
  lines.push("");
  if (briefing.markdown) {
    lines.push(briefing.markdown);
    lines.push("");
  }

  // 活跃待办单独成段：续接靠 TODO，不能只在「记忆约定」里空口叮嘱，也不能混进「最近做什么」。
  const stuck = Array.isArray(briefing.stuck) ? briefing.stuck : [];
  if (stuck.length > 0) {
    lines.push("### 活跃待办");
    for (const todo of stuck) {
      const status = todo.status === "in_progress" ? "进行中" : (todo.status === "blocked" ? "阻塞" : "待办");
      lines.push("- [" + status + "] " + todo.title);
    }
    lines.push("");
  }

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

  lines.push("### 项目记忆约定");
  lines.push("- 只对跨会话仍为真的决策、约束、架构事实或教训调用 `project_memory_add`；标题写成站立事实句，不要写成 v1.2.0 patch / 验收清单。");
  lines.push("- 工具可能拒绝，不要把 changelog / 本次改了哪些文件再写一遍。正文保持 2–4 句。");
  lines.push("- 进行中的工作用 `project_todo_add` / `project_todo_update` / `project_todo_done` 跟踪，续接依赖 TODO，而不是把会话流水账塞进记忆。");
  lines.push("- 项目结构明显变化后调用 `project_rescan`；需要理解最近代码变化时调用 `project_diff`（默认 dry-run）。");

  return lines.join("\n");
}
