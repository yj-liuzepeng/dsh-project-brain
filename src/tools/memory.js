// project_memory_add / project_memory_list Tools
// P0.4 工具面补全：此前 memory 只有 CLI（brain-memory.mjs），Agent 无法在会话内写入。
// 数据格式与 CLI 一致（memory.jsonl 每行一个 JSON）。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, appendJsonl, readJsonl, writeJsonl } from "../host/store/brain-files.js";
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

// ─── project_memory_archive ───
// 软删除一条记忆（status → archived）。isActiveMemory 会过滤掉，injector / retrieval 都不再看到它。
// 但 .project-brain/memory.jsonl 中保留这条记录，便于追溯。
// 使用场景：用户/agent 发现记忆错误、过时或与现实冲突时主动清理。
export function buildMemoryArchiveTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_memory_archive",
    description:
      "dsh-project-brain: 归档一条项目记忆（status → archived，从检索/注入中移除但保留记录）。" +
      "用于修正错误/过时/与现实冲突的记忆。需传入 id 前缀或精确 id。",
    parameters: {
      id: { type: "string", description: "记忆 id 或其前缀（唯一匹配）" },
      reason: { type: "string", description: "归档原因（记入 source 字段用于追溯）" },
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
          return [{ type: "text", text: `dsh-project-brain: memory archived [${d.type}] ${d.title} (${d.id}) reason="${d.reason || "(none)"}"` }];
        }
        return [{ type: "text", text: `dsh-project-brain: memory archive FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const idPrefix = args && typeof args.id === "string" ? args.id.trim() : "";
        const reason = args && typeof args.reason === "string" ? args.reason.trim().slice(0, 500) : "";
        if (!idPrefix) {
          return { ok: false, code: "E_NO_ID", message: "id 必填" };
        }
        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        // 唯一匹配：id 等于或以 prefix 开头
        const matches = memories.filter((m) => m && m.id && (m.id === idPrefix || m.id.indexOf(idPrefix) === 0) && isActiveMemory(m));
        if (matches.length === 0) {
          return { ok: false, code: "E_NOT_FOUND", message: `未找到 id=${idPrefix} 的活跃记忆` };
        }
        if (matches.length > 1) {
          return { ok: false, code: "E_AMBIGUOUS_ID", message: `id=${idPrefix} 匹配到 ${matches.length} 条，请提供更精确的 id` };
        }
        const target = matches[0];
        const now = Date.now();
        const updated = memories.map((m) => {
          if (m.id !== target.id) return m;
          return Object.assign({}, m, {
            status: "archived",
            updatedAt: now,
            lastAccessedAt: now,
            ...(reason ? { archiveReason: reason } : {}),
          });
        });
        const wrote = await writeJsonl(fs, brainPath(projectPath, "memory.jsonl"), updated);
        if (!wrote) {
          return { ok: false, code: "E_WRITE_FAILED", message: "failed to write memory.jsonl" };
        }
        // timeline 事件
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "归档记忆[" + target.type + "]：" + target.title + (reason ? "（" + reason + "）" : ""),
          eventType: "memory_archive",
          occurredAt: now,
          detail: "id=" + target.id + (reason ? " reason=" + reason : ""),
        });
        emitPreviewChanged(exec, projectPath);
        return { ok: true, data: { id: target.id, type: target.type, title: target.title, reason: reason || null } };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_ARCHIVE_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}

// ─── project_memory_supersede ───
// 用一条新记忆替换一条旧记忆。旧记忆 status → superseded，source.supersededBy 指向新记忆。
// 新记忆正常 append。fingerprint 去重：若已有相同 fingerprint 的记忆，会被去重跳过。
export function buildMemorySupersedeTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_memory_supersede",
    description:
      "dsh-project-brain: 用新记忆替换旧记忆（旧记忆 → superseded，新记忆正常 append）。" +
      "用于决策更新、架构变更等场景。新记忆可由 type/title/content 完整指定。",
    parameters: {
      oldId: { type: "string", description: "被替换的旧记忆 id 或前缀" },
      type: { type: "string", description: "新记忆类型（必填）" },
      title: { type: "string", description: "新记忆标题（必填）" },
      content: { type: "string", description: "新记忆正文（必填）" },
      importance: { type: "number", description: "重要性 0~1" },
      confidence: { type: "number", description: "可信度 0~1" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "相关文件路径" },
      tags: { type: "array", items: { type: "string" }, description: "标签" },
      reason: { type: "string", description: "替换原因（写入旧记忆的 supersededReason）" },
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
          return [{ type: "text", text: `dsh-project-brain: memory superseded ${d.oldId} → ${d.newId} reason="${d.reason || "(none)"}"` }];
        }
        return [{ type: "text", text: `dsh-project-brain: memory supersede FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const oldId = args && typeof args.oldId === "string" ? args.oldId.trim() : "";
        const type = normalizeMemoryType(args && args.type);
        const title = args && typeof args.title === "string" ? args.title.trim() : "";
        const content = args && typeof args.content === "string" ? args.content : "";
        if (!oldId) return { ok: false, code: "E_NO_OLD_ID", message: "oldId 必填" };
        if (!type) return { ok: false, code: "E_INVALID_TYPE", message: "type 必须是 " + MEMORY_TYPES.join("/") + " 之一" };
        if (!title) return { ok: false, code: "E_NO_TITLE", message: "title 必填" };
        if (!content || String(content).length < 20) return { ok: false, code: "E_NO_CONTENT", message: "content 必填且 ≥ 20 字" };
        const reason = args && typeof args.reason === "string" ? args.reason.trim().slice(0, 500) : "";
        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        const matches = memories.filter((m) => m && m.id && (m.id === oldId || m.id.indexOf(oldId) === 0) && isActiveMemory(m));
        if (matches.length === 0) return { ok: false, code: "E_OLD_NOT_FOUND", message: `未找到 id=${oldId} 的活跃记忆` };
        if (matches.length > 1) return { ok: false, code: "E_AMBIGUOUS_ID", message: `oldId=${oldId} 匹配到 ${matches.length} 条，请提供更精确的 id` };
        const oldTarget = matches[0];
        const now = Date.now();
        const sessionId = exec && (exec.sessionId || (exec.session && exec.session.id));
        // 写新记忆
        const newEntry = makeMemoryEntry({
          type, title, content,
          importance: args.importance,
          confidence: args.confidence,
          relatedFiles: args.relatedFiles,
          tags: args.tags,
          source: { kind: "agent", ...(sessionId ? { sessionId: String(sessionId) } : {}), supersedes: oldTarget.id },
        }, now);
        // 旧记忆标记 superseded
        const updated = memories.map((m) => {
          if (m.id !== oldTarget.id) return m;
          return Object.assign({}, m, {
            status: "superseded",
            updatedAt: now,
            lastAccessedAt: now,
            supersededBy: newEntry.id,
            ...(reason ? { supersededReason: reason } : {}),
          });
        });
        updated.push(newEntry);
        const wrote = await writeJsonl(fs, brainPath(projectPath, "memory.jsonl"), updated);
        if (!wrote) return { ok: false, code: "E_WRITE_FAILED", message: "failed to write memory.jsonl" };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "替换记忆[" + oldTarget.type + "→" + newEntry.type + "]：" + newEntry.title + (reason ? "（" + reason + "）" : ""),
          eventType: "memory_supersede",
          occurredAt: now,
          detail: "oldId=" + oldTarget.id + " newId=" + newEntry.id + (reason ? " reason=" + reason : ""),
        });
        emitPreviewChanged(exec, projectPath);
        return { ok: true, data: { oldId: oldTarget.id, newId: newEntry.id, type: newEntry.type, title: newEntry.title, reason: reason || null } };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_SUPERSEDE_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}
