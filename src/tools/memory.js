// project_memory_add / project_memory_list Tools
// P0.4 工具面补全：此前 memory 只有 CLI（brain-memory.mjs），Agent 无法在会话内写入。
// 数据格式与 CLI 一致（memory.jsonl 每行一个 JSON）。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, appendJsonl, readJsonl } from "../host/store/brain-files.js";
import { MEMORY_TYPES, isActiveMemory, makeMemoryEntry, normalizeMemoryType, topMemories } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

function emitPreviewChanged(exec, projectPath) {
  try {
    const executor = (exec && exec.ctx) || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath: projectPath });
    }
  } catch (e) { /* ignore */ }
}

export function buildMemoryAddTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_memory_add",
    description:
      "dsh-project-brain: 为当前项目写入一条结构化项目记忆（" + MEMORY_TYPES.join("/") + "）。" +
      "在做出重要决策、发现 bug/踩坑、架构变化、需求变更后调用； importance 0~1（越高越容易在 continue 时召回）。",
    parameters: {
      type: { type: "string", description: "记忆类型，枚举：" + MEMORY_TYPES.join(" | ") },
      title: { type: "string", description: "标题（一句话，<=200 字符）" },
      content: { type: "string", description: "正文：what + why（决策需含理由与被否方案）" },
      importance: { type: "number", description: "重要性 0~1，默认 0.5" },
      confidence: { type: "number", description: "可信度 0~1，默认 0.7" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "相关文件路径（可选）" },
      tags: { type: "array", items: { type: "string" }, description: "标签（可选）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
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
          return [{ type: "text", text: `dsh-project-brain: memory added [${d.type}] ${d.title} (${d.id})` }];
        }
        return [{ type: "text", text: `dsh-project-brain: memory add FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const type = normalizeMemoryType(args && args.type);
        if (!type) {
          return { ok: false, code: "E_INVALID_TYPE", message: "type 必须是 " + MEMORY_TYPES.join("/") + " 之一" };
        }
        if (!args || !args.title || !String(args.title).trim()) {
          return { ok: false, code: "E_NO_TITLE", message: "title 必填" };
        }
        const now = Date.now();
        const sessionId = exec && (exec.sessionId || (exec.session && exec.session.id));
        const entry = makeMemoryEntry({
          type: type,
          title: args.title,
          content: args.content,
          importance: args.importance,
          confidence: args.confidence,
          relatedFiles: args.relatedFiles,
          tags: args.tags,
          source: { kind: "agent", ...(sessionId ? { sessionId: String(sessionId) } : {}) },
        }, now);
        const wrote = await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry);
        if (!wrote) {
          return { ok: false, code: "E_WRITE_FAILED", message: "failed to write memory.jsonl" };
        }
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "新增记忆[" + type + "]：" + entry.title,
          eventType: "memory",
          occurredAt: now,
        });
        emitPreviewChanged(exec, projectPath);
        return { ok: true, data: { id: entry.id, type: entry.type, title: entry.title, importance: entry.importance, confidence: entry.confidence } };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_ADD_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}

export function buildMemoryListTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_memory_list",
    description:
      "dsh-project-brain: 读取当前项目的项目记忆，按重要度排序返回（可按 type 过滤）。" +
      "回答“为什么这么设计/之前踩过什么坑”类问题前先调用。",
    parameters: {
      type: { type: "string", description: "只看该类型（可选）：" + MEMORY_TYPES.join(" | ") },
      limit: { type: "number", description: "返回条数上限，默认 10" },
      includeArchived: { type: "boolean", description: "是否包含 archived/superseded 记忆，默认 false" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
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
          const lines = [{ type: "text", text: `dsh-project-brain: ${d.total} memories (${d.shown} shown)` }];
          for (const m of d.memories || []) {
            lines.push({ type: "text", text: `  [${m.type}] ${m.title} (imp=${m.importance})` });
          }
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: memory list FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        const visible = args && args.includeArchived ? memories : memories.filter(isActiveMemory);
        const filtered = normalizeMemoryType(args && args.type)
          ? visible.filter((m) => m.type === normalizeMemoryType(args.type))
          : visible;
        const limit = Math.max(1, Math.min(50, Number((args && args.limit) || 10)));
        const sorted = topMemories(filtered, limit);
        return {
          ok: true,
          data: {
            total: filtered.length,
            shown: sorted.length,
            memories: sorted.map((m) => ({
              id: m.id, type: m.type, title: m.title,
              content: String(m.content || "").slice(0, 300),
              importance: m.importance, createdAt: m.createdAt,
            })),
          },
        };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_LIST_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}
