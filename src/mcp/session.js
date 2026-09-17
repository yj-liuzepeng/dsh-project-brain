import { createNodeFs } from "../host/store/node-fs.js";
import { normalizeMemoryConfig } from "../host/memory/config.js";
import { buildProjectInitTool, buildProjectRescanTool } from "../tools.js";
import { buildContinueTool } from "../tools/continue.js";
import { buildStatusTool } from "../tools/status.js";
import { buildAskTool } from "../tools/ask.js";
import { buildMemoryAddTool, buildMemoryListTool } from "../tools/memory.js";
import { buildTodoAddTool, buildTodoListTool, buildTodoDoneTool } from "../tools/todo.js";
import { buildTodoUpdateTool } from "../tools/todo-update.js";

const TOOL_NAMES = [
  "project_status", "project_continue", "project_ask",
  "project_memory_list", "project_todo_list",
  "project_init", "project_rescan",
  "project_memory_add", "project_todo_add", "project_todo_update", "project_todo_done",
];

const WRITE_REQUIRES_INIT = {
  project_memory_add: true,
  project_todo_add: true,
  project_todo_update: true,
  project_todo_done: true,
  project_rescan: true,
};

// Explicit MCP fallback: session.getLlm stays () => null, which cannot satisfy
// automatic-channel admit. Isolated to project_memory_add so caller type is preserved
// (evaluateAdmit overwrites type only when llm.type is truthy).
function admitAlwaysLlm() {
  return {
    stream() {
      const payload = JSON.stringify({
        admit: true,
        reason: "durable project fact",
        supersedes: null,
      });
      return (async function* () {
        yield { type: "text-delta", index: 0, text: payload };
        yield { type: "finish", reason: { kind: "stop" } };
      })();
    },
  };
}

export function createBrainSession({ projectPath }) {
  const fs = createNodeFs();
  const sandboxPolicy = { workspaceRoot: projectPath };
  const exec = { session: { cwd: projectPath }, ctx: null, sessionId: null };
  const memoryAddExec = {
    session: {
      cwd: projectPath,
      requestContext() { return { provider: "mcp", model: "rulegate-fallback" }; },
    },
    ctx: null,
    sessionId: null,
  };
  const getMemoryConfig = () => normalizeMemoryConfig({});
  const getLlm = () => null;
  const deps = { fs, sandboxPolicy, getMemoryConfig, getLlm, resolveEmbeddingCredential: async () => null };
  const instances = {
    project_init: buildProjectInitTool(deps),
    project_rescan: buildProjectRescanTool(deps),
    project_continue: buildContinueTool(deps),
    project_status: buildStatusTool(deps),
    project_ask: buildAskTool(deps),
    project_memory_add: buildMemoryAddTool(Object.assign({}, deps, { getLlm: admitAlwaysLlm })),
    project_memory_list: buildMemoryListTool(deps),
    project_todo_add: buildTodoAddTool(deps),
    project_todo_list: buildTodoListTool(deps),
    project_todo_update: buildTodoUpdateTool(deps),
    project_todo_done: buildTodoDoneTool(deps),
  };
  async function dispatch(name, args) {
    if (!instances[name]) {
      return { ok: false, code: "E_UNKNOWN_TOOL", message: "未知工具：" + name };
    }
    const merged = Object.assign({}, args || {});
    if (!merged.path) merged.path = projectPath;
    const tool = instances[name];
    if (!tool || typeof tool.execute !== "function") {
      return { ok: false, code: "E_TOOL_SHAPE", message: "tool.execute 不可用：" + name };
    }
    if (WRITE_REQUIRES_INIT[name]) {
      const marker = await fs.resolve(".project-brain/project.json", { cwd: merged.path });
      if ((await fs.readText(marker)) === null) {
        return { ok: false, code: "E_NOT_INITIALIZED", message: "该项目尚未初始化，请先调用 project_init" };
      }
    }
    return tool.execute(merged, name === "project_memory_add" ? memoryAddExec : exec);
  }
  return { projectPath, fs, sandboxPolicy, exec, getMemoryConfig, getLlm, dispatch, TOOL_NAMES };
}

export { TOOL_NAMES };
