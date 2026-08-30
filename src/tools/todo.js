// project_todo_add / project_todo_list / project_todo_done Tools
// P0.7-lite 工具面：TODO CRUD（add/list/done），数据在 .project-brain/todo.jsonl。
// SidebarPreview 的 Phase 进度与 Stats 待办数由 build.js 从 todo.jsonl 统计（build-time embed）。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, appendJsonl, readJsonl, writeText, serializeJsonl } from "../host/store/brain-files.js";
import { TODO_PRIORITIES, TODO_STATUSES, makeTodoEntry, activeTodos, todoStats, findTodo, normalizePriority, normalizeStatus } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

function emitPreviewChanged(exec, projectPath) {
  try {
    const executor = (exec && exec.ctx) || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath: projectPath });
    }
  } catch (e) { /* ignore */ }
}

export function buildTodoAddTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_todo_add",
    description:
      "dsh-project-brain: 为当前项目添加一条开发待办（写入 .project-brain/todo.jsonl）。" +
      "规划出下一步任务、或用户提出新需求时调用；完成时用 project_todo_done 关闭。",
    parameters: {
      title: { type: "string", description: "待办标题（一句话）" },
      description: { type: "string", description: "详情（可选）" },
      priority: { type: "string", description: "优先级：urgent | high | medium（默认） | low" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "相关文件（可选）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断；不传会用当前工作区）" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
        },
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          return [{ type: "text", text: `dsh-project-brain: todo added [${d.priority}] ${d.title} (${d.id})，活跃待办 ${d.activeCount}` }];
        }
        return [{ type: "text", text: `dsh-project-brain: todo add FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (!args || !args.title || !String(args.title).trim()) {
          return { ok: false, code: "E_NO_TITLE", message: "title 必填" };
        }
        const now = Date.now();
        const entry = makeTodoEntry({ title: args.title, description: args.description, priority: args.priority, relatedFiles: args.relatedFiles }, now);
        const wrote = await appendJsonl(fs, brainPath(projectPath, "todo.jsonl"), entry);
        if (!wrote) return { ok: false, code: "E_WRITE_FAILED", message: "failed to write todo.jsonl" };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "新增待办：" + entry.title,
          eventType: "todo",
          occurredAt: now,
        });
        emitPreviewChanged(exec, projectPath);
        const todos = await readJsonl(fs, brainPath(projectPath, "todo.jsonl"));
        return { ok: true, data: { id: entry.id, title: entry.title, priority: entry.priority, activeCount: todoStats(todos).pendingTodos } };
      } catch (e) {
        return { ok: false, code: "E_TODO_ADD_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}

export function buildTodoListTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_todo_list",
    description:
      "dsh-project-brain: 读取当前项目待办列表（默认活跃项，按优先级排序）。" +
      "恢复开发上下文、确定下一步时调用。",
    parameters: {
      status: { type: "string", description: "过滤状态（可选）：pending | in_progress | blocked | done | cancelled | all（默认活跃项）" },
      limit: { type: "number", description: "返回条数上限，默认 20" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
        },
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          const lines = [{ type: "text", text: `dsh-project-brain: todos - ${d.active} active / ${d.done} done` }];
          for (const t of d.todos || []) {
            lines.push({ type: "text", text: `  [${t.priority}/${t.status}] ${t.title} (${t.id})` });
          }
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: todo list FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const todos = await readJsonl(fs, brainPath(projectPath, "todo.jsonl"));
        const stats = todoStats(todos);
        const statusFilter = normalizeStatus(args && args.status);
        const wantAll = args && args.status === "all";
        let list;
        if (wantAll || statusFilter) {
          list = todos.filter((t) => (wantAll ? true : t.status === statusFilter));
          list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        } else {
          list = activeTodos(todos);
        }
        const limit = Math.max(1, Math.min(100, Number((args && args.limit) || 20)));
        return {
          ok: true,
          data: {
            active: stats.pendingTodos,
            done: stats.completedTodos,
            total: stats.total,
            todos: list.slice(0, limit).map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, updatedAt: t.updatedAt })),
          },
        };
      } catch (e) {
        return { ok: false, code: "E_TODO_LIST_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}

export function buildTodoDoneTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_todo_done",
    description:
      "dsh-project-brain: 关闭一条待办（status -> done，写 timeline 事件）。" +
      "按 todo id（支持前缀）或标题精确匹配。",
    parameters: {
      id: { type: "string", description: "todo id 或其前缀（与 title 二选一）" },
      title: { type: "string", description: "todo 标题精确匹配（与 id 二选一）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
        },
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          return [{ type: "text", text: `dsh-project-brain: todo done ✓ ${d.title}，剩余活跃 ${d.activeCount}` }];
        }
        return [{ type: "text", text: `dsh-project-brain: todo done FAILED - ${value && value.code}: ${value && value.message}` }];
      },
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const ref = (args && (args.id || args.title)) || "";
        if (!ref) return { ok: false, code: "E_NO_REF", message: "id 或 title 必填一项" };
        const todoPath = brainPath(projectPath, "todo.jsonl");
        const todos = await readJsonl(fs, todoPath);
        const target = findTodo(todos, ref);
        if (!target) {
          return { ok: false, code: "E_NOT_FOUND", message: "未找到匹配的活跃待办：" + ref };
        }
        const now = Date.now();
        for (const t of todos) {
          if (t.id === target.id) {
            t.status = "done";
            t.updatedAt = now;
          }
        }
        const wrote = await writeText(fs, todoPath, serializeJsonl(todos));
        if (!wrote) return { ok: false, code: "E_WRITE_FAILED", message: "failed to rewrite todo.jsonl" };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "完成待办：" + target.title,
          eventType: "todo",
          occurredAt: now,
        });
        emitPreviewChanged(exec, projectPath);
        return { ok: true, data: { id: target.id, title: target.title, activeCount: todoStats(todos).pendingTodos } };
      } catch (e) {
        return { ok: false, code: "E_TODO_DONE_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}
