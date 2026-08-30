// project_status Tool - 当前项目状态快照（project + memoryCounts + todoCounts + lastActivity）

import { defineTool } from "@deepseek-ai/dsh-tools";
import { readBrain } from "../host/store/brain-files.js";
import { todoStats, recentTimeline, techStackToType } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { activeMemories } from "../host/memory/retrieval.js";
import { publicMemoryConfig } from "../host/memory/config.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
};

export function buildStatusTool({ fs, sandboxPolicy, getMemoryConfig }) {
  return defineTool({
    name: "project_status",
    description:
      "dsh-project-brain: 返回当前项目的快速状态快照（项目元信息 + 各类型 Memory 计数 + " +
      "TODO 统计 + 最近活动 + 是否初始化）。比 project_continue 更轻、不需要排序算法。",
    parameters: {
      path: { type: "string", description: "项目根路径（绝对路径），默认从 session cwd 推断" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderStatus(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const brain = await readBrain(fs, projectPath);
        const p = brain && brain.project;
        if (!p || p.__error) {
          return { ok: false, data: { error: { code: "E_NOT_INITIALIZED", message: "该项目尚未初始化，请先调用 project_init", projectPath }, projectPath } };
        }

        const tStats = todoStats(brain.todos);
        const visibleMemories = activeMemories(brain.memories);
        const memoryCounts = {};
        for (const m of visibleMemories) {
          const k = m.type || "context";
          memoryCounts[k] = (memoryCounts[k] || 0) + 1;
        }
        const recent = recentTimeline(brain.timeline, 3).map((e) => ({
          id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType,
        }));

        const now = Date.now();
        const lastActivityAt = recent.length > 0 ? recent[0].occurredAt : (p.updatedAt || p.lastScannedAt || null);

        return {
          ok: true,
          data: {
            projectPath,
            initialized: true,
            project: {
              id: p.id, name: p.name, rootPath: p.rootPath,
              type: techStackToType(p.techStack),
              lastUpdateAt: p.updatedAt || p.lastScannedAt || null,
              lastScannedAt: p.lastScannedAt || null,
            },
            stats: {
              files: (p.size && p.size.files) || null,
              memories: visibleMemories.length,
              archivedMemories: (brain.memories || []).length - visibleMemories.length,
              todos: tStats.total,
              pendingTodos: tStats.pendingTodos,
              completedTodos: tStats.completedTodos,
              timelineEvents: (brain.timeline || []).length,
              lastActivityAt,
              uptimeMs: lastActivityAt ? (now - lastActivityAt) : null,
            },
            memoryCounts,
            retrieval: publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {}),
            recentActivity: recent,
          },
        };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_STATUS_FAILED", message: String((e && e.message) || e) } } };
      }
    },
  });
}

function renderStatus(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: status FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: project status` }];
    if (d.project) lines.push({ type: "text", text: `  Project: ${d.project.name} (${d.project.type})` });
    lines.push({ type: "text", text: `  Memories: ${d.stats.memories} (${Object.entries(d.memoryCounts).map(([k, v]) => k + ":" + v).join(", ")})` });
    lines.push({ type: "text", text: `  Todos: pending ${d.stats.pendingTodos} / done ${d.stats.completedTodos} / total ${d.stats.todos}` });
    lines.push({ type: "text", text: `  Timeline: ${d.stats.timelineEvents} events` });
    if (d.retrieval) {
      lines.push({ type: "text", text: `  Retrieval: ${d.retrieval.configuredMode === "hybrid" ? "hybrid configured (fallback: keyword)" : "local keyword"}` });
    }
    if (d.stats.lastActivityAt) {
      const ageMin = Math.round((Date.now() - d.stats.lastActivityAt) / 60000);
      lines.push({ type: "text", text: `  Last activity: ${ageMin} min ago` });
    }
    for (const e of d.recentActivity || []) {
      lines.push({ type: "text", text: `  activity: ${e.title}` });
    }
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: status FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: status FAILED - " + JSON.stringify(value) }];
}
