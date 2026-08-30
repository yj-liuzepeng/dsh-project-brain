// project_todo_update Tool - 更新一条待办（status / title / description / priority）
// 按 todo id（前缀）或 title 精确匹配。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, readJsonl, writeText, appendJsonl, serializeJsonl } from "../host/store/brain-files.js";
import { TODO_STATUSES, TODO_PRIORITIES, findTodo, normalizeStatus, normalizePriority, todoStats } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

function emitPreviewChanged(exec, projectPath) {
  try {
    const executor = (exec && exec.ctx) || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {}
}

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
};

export function buildTodoUpdateTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_todo_update",
    description:
      "dsh-project-brain: 更新一条待办（按 id 或 title 匹配）。" +
      "可改 status（pending/in_progress/blocked/done/cancelled）、title、description、priority（low/medium/high/urgent）。" +
      "完成后写 timeline 事件并触发 preview 刷新。",
    parameters: {
      id: { type: "string", description: "todo id 或其前缀（与 title 二选一）" },
      title: { type: "string", description: "todo 标题精确匹配（与 id 二选一）" },
      status: { type: "string", description: "新状态：" + TODO_STATUSES.join(" | ") },
      newTitle: { type: "string", description: "新标题（可选）" },
      description: { type: "string", description: "新描述（可选）" },
      priority: { type: "string", description: "新优先级：" + TODO_PRIORITIES.join(" | ") },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderTodoUpdate(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const ref = (args && (args.id || args.title)) || "";
        if (!ref) return { ok: false, data: { error: { code: "E_NO_REF", message: "id 或 title 必填一项" } } };
        const todoPath = brainPath(projectPath, "todo.jsonl");
        const todos = await readJsonl(fs, todoPath);
        const target = findTodo(todos, ref);
        if (!target) return { ok: false, data: { error: { code: "E_NOT_FOUND", message: "未找到匹配的活跃待办：" + ref } } };

        const now = Date.now();
        let changed = [];
        for (const t of todos) {
          if (t.id !== target.id) continue;
          if (args.status != null) {
            const ns = normalizeStatus(args.status);
            if (!ns) return { ok: false, data: { error: { code: "E_INVALID_STATUS", message: "status 必须是 " + TODO_STATUSES.join("/") } } };
            if (t.status !== ns) { t.status = ns; changed.push("status=" + ns); }
          }
          if (args.priority != null) {
            const np = normalizePriority(args.priority);
            if (!np) return { ok: false, data: { error: { code: "E_INVALID_PRIORITY", message: "priority 必须是 " + TODO_PRIORITIES.join("/") } } };
            if (t.priority !== np) { t.priority = np; changed.push("priority=" + np); }
          }
          if (args.newTitle != null && String(args.newTitle).trim()) {
            t.title = String(args.newTitle).slice(0, 200);
            changed.push("title");
          }
          if (args.description != null) {
            t.description = String(args.description);
            changed.push("description");
          }
          t.updatedAt = now;
        }
        const wrote = await writeText(fs, todoPath, serializeJsonl(todos));
        if (!wrote) return { ok: false, data: { error: { code: "E_WRITE_FAILED", message: "failed to rewrite todo.jsonl" } } };

        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "更新待办[" + target.id + "]：" + target.title + (changed.length ? "（" + changed.join(",") + "）" : ""),
          eventType: "todo_update",
          occurredAt: now,
        });
        emitPreviewChanged(exec, projectPath);

        const stats = todoStats(todos);
        return { ok: true, data: { id: target.id, title: target.title, status: target.status, priority: target.priority, changed, activeCount: stats.pendingTodos } };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_TODO_UPDATE_FAILED", message: String((e && e.message) || e) } } };
      }
    },
  });
}

async function appendTimelineSafe(fs, path, entry) {
  // kept for backwards compat (unused after refactor)
  return appendJsonl(fs, path, entry);
}

function renderTodoUpdate(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: todo update FAILED - non-object result: " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    if (d.error) return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + d.error.code + ": " + d.error.message }];
    return [{ type: "text", text: `dsh-project-brain: todo updated [${d.priority}/${d.status}] ${d.title} (${d.id})${d.changed && d.changed.length ? " — changed: " + d.changed.join(",") : ""}` }];
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + JSON.stringify(value) }];
}