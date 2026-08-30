// project_continue Tool - P0.6 最小实现
// 读取 .project-brain/ 四类数据（project/timeline/memory/todo），组装跨 Session 恢复上下文。
// Top-K 记忆选择：importance*0.5 + recency*0.3 + typeBoost*0.2（brain-logic.memoryScore）。
// Context Injector（会话启动自动注入）属于后续 P0.6 完整版，本工具先提供 Agent 主动调用通道。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { readBrain } from "../host/store/brain-files.js";
import { buildContinueData } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

export function buildContinueTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_continue",
    description:
      "dsh-project-brain: 恢复当前项目的开发上下文（用户说「继续上次的开发」时调用）。" +
      "返回项目概要、最近活动、Top-5 记忆（按重要度+时间排序）、活跃待办与建议下一步，" +
      "据此可直接续接开发，无需用户重新描述项目。",
    parameters: {
      path: { type: "string", description: "项目根路径（绝对路径），默认 sandboxPolicy.workspaceRoot" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          const lines = [{ type: "text", text: `dsh-project-brain: continue context` }];
          if (d.project) {
            lines.push({ type: "text", text: `  Project: ${d.project.name} (${d.project.type})` });
          }
          lines.push({ type: "text", text: `  Suggested next: ${d.suggestedNextStep}` });
          lines.push({ type: "text", text: `  Stats: pending ${d.stats.pendingTodos} / done ${d.stats.completedTodos} / decisions ${d.stats.decisions} / memories ${d.stats.memories}` });
          for (const m of d.topMemories || []) {
            lines.push({ type: "text", text: `  mem[${m.type}] ${m.title}` });
          }
          for (const t of d.pendingTodos || []) {
            lines.push({ type: "text", text: `  todo[${t.priority}] ${t.title} (${t.status})` });
          }
          if (d.warning) lines.push({ type: "text", text: `  warning: ${d.warning}` });
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: continue FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const brain = await readBrain(fs, projectPath);
        const data = buildContinueData(brain, Date.now());
        if (!data.initialized) {
          return {
            ok: false,
            code: "E_NOT_INITIALIZED",
            message: "该项目还没有 .project-brain/project.json，请先调用 project_init",
          };
        }
        return { ok: true, data: data };
      } catch (e) {
        return { ok: false, code: "E_CONTINUE_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}
