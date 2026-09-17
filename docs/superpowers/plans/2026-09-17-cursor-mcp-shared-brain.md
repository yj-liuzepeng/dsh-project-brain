# Cursor MCP 共用项目脑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同一台电脑上，让 Cursor 通过 stdio MCP 读写与 DSH 同一份 `.project-brain/`，不经过 DSH 进程。

**Architecture:** 新增 Node `fs` 适配器 + `createBrainSession` 组装现有 `build*Tool(...).execute`；MCP server 只做 JSON-RPC 翻译。磁盘格式不变。不引入 MCP SDK、不抽 runX（现有 `defineTool` 返回值已有 `.execute`，见 `scripts/smoke-suggest.mjs`）。

**Tech Stack:** Node ESM（已有 `"type": "module"`）、现有 `src/tools/*.js`、手写 MCP stdio JSON-RPC、smoke 脚本。

## Global Constraints

- 不新增 npm 依赖（包括 `@modelcontextprotocol/sdk`）
- 不把 API Key 写入 `.project-brain/`
- MCP 默认 `projectPath` = Cursor workspace cwd；工具可传 `path` 覆盖
- 第一期只注册 spec §4 的 11 个工具名
- 密钥/向量：MCP 用 `normalizeMemoryConfig({})` + 环境变量；不读 DSH settings 服务
- `getLlm` 对 MCP 返回 `null`（ask 走关键词；init/rescan 本地架构）
- 路径安全继续走 `assertSafeProjectPath`
- 实现中文错误码与现有 Tool 一致（`E_NOT_INITIALIZED` 等）
- 对照 spec：`docs/superpowers/specs/2026-09-17-cursor-mcp-shared-brain-design.md`

**Files (map):**

| 文件 | 职责 |
|------|------|
| `src/host/store/node-fs.js` | Node fs ↔ brain-files/scanner 适配 |
| `src/mcp/session.js` | 按项目根创建 `{ fs, sandboxPolicy, exec, dispatch }` |
| `src/mcp/server.js` | stdio JSON-RPC：initialize / tools/list / tools/call |
| `src/mcp/protocol.js` | 读 stdin 行、写 stdout 响应 |
| `.cursor/mcp.json` | 本仓库 Cursor 启动命令（相对路径） |
| `scripts/smoke-mcp-brain.mjs` | 磁盘往返 + 未初始化 + 协议 tools/call |
| `scripts/run-smoke.mjs` | 接入新 smoke |
| `README.md` / `README.zh-CN.md` / `CHANGELOG.md` | Cursor MCP 说明 |
| spec 文件状态 | Draft → Active |

---

### Task 1: Node fs 适配器

**Files:**
- Create: `src/host/store/node-fs.js`
- Test: `scripts/smoke-mcp-brain.mjs`（本任务先写适配器断言段；后续任务往同一文件追加）

**Interfaces:**
- Consumes: `node:fs/promises`, `node:path`
- Produces: `createNodeFs()` → `{ resolve, readText, writeText, mkdir, listDir, processPath }`
  - `resolve(p, opts?)`: 若 `opts.cwd` 且 `p` 非绝对路径则 `path.join(cwd, p)`，否则返回字符串 path
  - `readText(target)`: 读 utf8，失败返回 `null`（不要抛）
  - `writeText(target, content)`: 递归 mkdir 父目录后写入；忽略第 3–5 参数
  - `mkdir(target, { recursive })`: `fs.mkdir`
  - `listDir(target)`: `[{ name, type: 'file'|'directory'|'other', target: absPath }]`
  - `processPath(target)`: `String(target)`

- [ ] **Step 1: Write the failing smoke (adapter only)**

Create `scripts/smoke-mcp-brain.mjs`:

```js
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const fileUrl = (rel) => pathToFileURL(join(SRC, rel)).href;

let pass = 0;
let fail = 0;
function check(name, ok, extra) {
  if (ok) { console.log("  PASS  " + name); pass++; }
  else { console.log("  FAIL  " + name + (extra ? " — " + extra : "")); fail++; }
}

console.log("=== node-fs adapter ===");
{
  const { createNodeFs } = await import(fileUrl("host/store/node-fs.js"));
  const root = mkdtempSync(join(tmpdir(), "dsh-mcp-fs-"));
  const fs = createNodeFs();
  const abs = await fs.resolve("a.txt", { cwd: root });
  check("resolve relative with cwd", abs === join(root, "a.txt") || abs.replace(/\\/g, "/") === join(root, "a.txt").replace(/\\/g, "/"));
  await fs.writeText(join(root, "sub", "b.txt"), "hello");
  const txt = await fs.readText(join(root, "sub", "b.txt"));
  check("writeText+readText", txt === "hello");
  const missing = await fs.readText(join(root, "nope.txt"));
  check("readText missing → null", missing === null);
  mkdirSync(join(root, "dir"));
  writeFileSync(join(root, "dir", "c.txt"), "c");
  const entries = await fs.listDir(join(root, "dir"));
  check("listDir has file", entries.some((e) => e.name === "c.txt" && e.type === "file"));
  rmSync(root, { recursive: true, force: true });
}

console.log(`\n=== Smoke summary: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `host/store/node-fs.js`

- [ ] **Step 3: Write `src/host/store/node-fs.js`**

```js
import { promises as fsp } from "node:fs";
import path from "node:path";

function asPath(target) {
  if (typeof target === "string") return target;
  if (target && typeof target.path === "string") return target.path;
  return String(target);
}

export function createNodeFs() {
  return {
    async resolve(p, opts) {
      const raw = asPath(p);
      if (opts && opts.cwd && typeof opts.cwd === "string" && !path.isAbsolute(raw)) {
        return path.join(opts.cwd, raw);
      }
      return raw;
    },
    processPath(target) {
      return asPath(target);
    },
    async readText(target) {
      try {
        return await fsp.readFile(asPath(target), "utf8");
      } catch (e) {
        return null;
      }
    },
    async writeText(target, content) {
      const abs = asPath(target);
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, content == null ? "" : String(content), "utf8");
      return true;
    },
    async mkdir(target, opts) {
      await fsp.mkdir(asPath(target), { recursive: !!(opts && opts.recursive) });
    },
    async listDir(target) {
      const dir = asPath(target);
      const names = await fsp.readdir(dir, { withFileTypes: true });
      return names.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : (e.isFile() ? "file" : "other"),
        target: path.join(dir, e.name),
      }));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: `Smoke summary: 4 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add src/host/store/node-fs.js scripts/smoke-mcp-brain.mjs
git commit -m "feat(mcp): add Node fs adapter for brain store"
```

（仅在用户要求提交时执行；否则跳过所有 Commit 步。）

---

### Task 2: Brain session + dispatch（调用现有 Tool.execute）

**Files:**
- Create: `src/mcp/session.js`
- Modify: `scripts/smoke-mcp-brain.mjs`

**Interfaces:**
- Consumes: `createNodeFs`, `normalizeMemoryConfig` from `src/host/memory/config.js`, existing `build*Tool` factories
- Produces:
  - `createBrainSession({ projectPath })` → `{ projectPath, fs, sandboxPolicy, exec, getMemoryConfig, getLlm, dispatch }`
  - `sandboxPolicy` = `{ workspaceRoot: projectPath }`（无 `.resolve` 即可，scanAndWrite 会 fallthrough）
  - `exec` = `{ session: { cwd: projectPath }, ctx: null, sessionId: null }`
  - `getMemoryConfig` = `() => normalizeMemoryConfig({})`
  - `getLlm` = `() => null`
  - `dispatch(name, args)` → `Promise<{ ok, data?, code?, message? }>`
  - 未注册名返回 `{ ok: false, code: "E_UNKNOWN_TOOL", message: "未知工具：" + name }`
  - 每次 dispatch 把 `args.path` 默认填成 `projectPath`（调用方已传 path 则保留）

工具注册表（11 个）：

```js
import { buildProjectInitTool, buildProjectRescanTool } from "../tools.js";
import { buildContinueTool } from "../tools/continue.js";
import { buildStatusTool } from "../tools/status.js";
import { buildAskTool } from "../tools/ask.js";
import { buildMemoryAddTool, buildMemoryListTool } from "../tools/memory.js";
import { buildTodoAddTool, buildTodoListTool, buildTodoDoneTool } from "../tools/todo.js";
import { buildTodoUpdateTool } from "../tools/todo-update.js";
```

若 `src/tools.js` 未 export init/rescan 工厂：实际已 export `buildProjectInitTool` / `buildProjectRescanTool`，session 必须用这两个名字，不要再改内部 `buildInitTool`。

- [ ] **Step 1: Extend smoke with uninit + init + memory/todo roundtrip**

Append to `scripts/smoke-mcp-brain.mjs` before the summary:

```js
console.log("=== dispatch init/memory/todo ===");
{
  const { createBrainSession } = await import(fileUrl("mcp/session.js"));
  const root = mkdtempSync(join(tmpdir(), "dsh-mcp-sess-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "mcp-fix", dependencies: { express: "4.18.0" } }), "utf8");
  writeFileSync(join(root, "src", "index.js"), "console.log(1)\n", "utf8");
  const session = createBrainSession({ projectPath: root });
  const st0 = await session.dispatch("project_status", {});
  check("uninit status not ok", st0 && st0.ok === false);
  const uninitCode = (st0 && st0.code) || (st0 && st0.data && st0.data.error && st0.data.error.code);
  check("uninit code E_NOT_INITIALIZED", uninitCode === "E_NOT_INITIALIZED");
  const init = await session.dispatch("project_init", { path: root });
  check("init ok", !!(init && init.ok), JSON.stringify(init && (init.code || init.message || init.data && init.data.error)));
  check("project.json exists", existsSync(join(root, ".project-brain", "project.json")));
  const addMem = await session.dispatch("project_memory_add", {
    path: root, type: "decision", title: "采用 Express", content: "选择 Express 因为生态成熟", importance: 0.8,
  });
  check("memory_add ok", !!(addMem && addMem.ok), JSON.stringify(addMem));
  const memFile = readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8");
  check("memory.jsonl contains title", memFile.indexOf("采用 Express") >= 0);
  const addTodo = await session.dispatch("project_todo_add", { path: root, title: "写注册 API", priority: "high" });
  check("todo_add ok", !!(addTodo && addTodo.ok));
  const todoId = addTodo && addTodo.data && addTodo.data.id;
  const done = await session.dispatch("project_todo_done", { path: root, id: todoId });
  check("todo_done ok", !!(done && done.ok));
  const listed = await session.dispatch("project_todo_list", { path: root, status: "all" });
  const todos = (listed && listed.data && (listed.data.todos || listed.data.items)) || [];
  const hit = todos.find((t) => t.id === todoId);
  check("todo list sees done", !!(hit && (hit.status === "done" || hit.status === "completed")));
  // simulate DSH rewriting todo.jsonl
  const rawTodos = readFileSync(join(root, ".project-brain", "todo.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  rawTodos[0].title = "写注册 API（DSH 改过）";
  writeFileSync(join(root, ".project-brain", "todo.jsonl"), rawTodos.map((t) => JSON.stringify(t)).join("\n") + "\n");
  const listed2 = await session.dispatch("project_todo_list", { path: root, status: "all" });
  const todos2 = (listed2 && listed2.data && (listed2.data.todos || listed2.data.items)) || [];
  check("sees DSH disk edit", todos2.some((t) => String(t.title).indexOf("DSH 改过") >= 0));
  const unknown = await session.dispatch("project_dream", {});
  check("unknown tool", unknown && unknown.ok === false && unknown.code === "E_UNKNOWN_TOOL");
  rmSync(root, { recursive: true, force: true });
}
```

Inspect `project_todo_list` / `project_todo_done` 实际返回字段：若 list 的数组不在 `data.todos`，改断言去读真实字段（`data.items` 或顶层）。`project_todo_done` 参数若不是 `id` 而是 `todoId`，以 `src/tools/todo.js` 为准改 smoke。

- [ ] **Step 2: Run to verify fail**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: FAIL missing `src/mcp/session.js`

- [ ] **Step 3: Implement session.js**

```js
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

export function createBrainSession({ projectPath }) {
  const fs = createNodeFs();
  const sandboxPolicy = { workspaceRoot: projectPath };
  const exec = { session: { cwd: projectPath }, ctx: null, sessionId: null };
  const getMemoryConfig = () => normalizeMemoryConfig({});
  const getLlm = () => null;
  const deps = { fs, sandboxPolicy, getMemoryConfig, getLlm, resolveEmbeddingCredential: async () => null };
  const instances = {
    project_init: buildProjectInitTool(deps),
    project_rescan: buildProjectRescanTool(deps),
    project_continue: buildContinueTool(deps),
    project_status: buildStatusTool(deps),
    project_ask: buildAskTool(deps),
    project_memory_add: buildMemoryAddTool(deps),
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
    return tool.execute(merged, exec);
  }
  return { projectPath, fs, sandboxPolicy, exec, getMemoryConfig, getLlm, dispatch, TOOL_NAMES };
}

export { TOOL_NAMES };
```

`src/tools.js` 已 export `buildProjectInitTool` / `buildProjectRescanTool`，不要改内部未 export 的 `buildInitTool`。

`buildMemoryListTool` / `buildTodoUpdateTool` 已存在，直接 import。

- [ ] **Step 4: Run smoke**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: 全部 PASS。若 `todo_done` 参数名不对，只改 smoke 或 dispatch 入参映射，不要改 jsonl 格式。

- [ ] **Step 5: Commit**

```bash
git add src/mcp/session.js src/tools.js scripts/smoke-mcp-brain.mjs
git commit -m "feat(mcp): dispatch existing brain tools via Node session"
```

---

### Task 3: MCP stdio JSON-RPC

**Files:**
- Create: `src/mcp/protocol.js`
- Create: `src/mcp/server.js`
- Modify: `scripts/smoke-mcp-brain.mjs`

**Interfaces:**
- Consumes: `createBrainSession`, `TOOL_NAMES`
- Produces: stdin 每行一个 JSON-RPC 2.0 对象；stdout 每行一个响应。方法：
  - `initialize` → `{ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "dsh-project-brain", version: "1.3.1" } }`
  - `notifications/initialized` → 无响应（或忽略）
  - `tools/list` → `{ tools: [{ name, description, inputSchema }] }`
  - `tools/call` → `{ content: [{ type: "text", text: JSON.stringify(result) }], isError: !result.ok }`
- `resolveProjectPathFromEnv()`：`process.env.PROJECT_BRAIN_PATH` 非空则用它，否则 `process.cwd()`
- 工具 inputSchema：每个工具 `{ type: "object", additionalProperties: true, properties: { path: { type: "string" } } }`，再为 ask/memory/todo 补上 `question`/`title`/`type`/`id` 等必填 string 字段（与 DSH parameters 对齐即可，不必完美 JSON Schema）

- [ ] **Step 1: Add protocol smoke using in-process handleRequest**

Export from `protocol.js`:

```js
export async function handleMcpRequest(body, session) {
  const method = body && body.method;
  const id = body && body.id;
  if (method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "dsh-project-brain", version: "1.3.1" } } };
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: listToolDefs() } };
  }
  if (method === "tools/call") {
    const name = body.params && body.params.name;
    const args = (body.params && (body.params.arguments || body.params.args)) || {};
    const result = await session.dispatch(name, args);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result || result.ok === false,
      },
    };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
}
```

`listToolDefs()` 返回 11 个 `{ name, description, inputSchema }`，description 从各 tool 的 description 字符串复制（可写在 `src/mcp/tool-defs.js` 以免循环 import defineTool）。

Smoke 追加：

```js
console.log("=== MCP handleRequest ===");
{
  const { createBrainSession } = await import(fileUrl("mcp/session.js"));
  const { handleMcpRequest } = await import(fileUrl("mcp/protocol.js"));
  const root = mkdtempSync(join(tmpdir(), "dsh-mcp-rpc-"));
  writeFileSync(join(root, "package.json"), "{\"name\":\"rpc-fix\"}\n");
  const session = createBrainSession({ projectPath: root });
  const listed = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, session);
  const names = ((listed.result && listed.result.tools) || []).map((t) => t.name);
  check("tools/list has project_init", names.indexOf("project_init") >= 0);
  check("tools/list has 11 tools", names.length === 11);
  const called = await handleMcpRequest({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "project_init", arguments: { path: root } },
  }, session);
  const payload = JSON.parse(called.result.content[0].text);
  check("tools/call init ok", payload && payload.ok === true);
  rmSync(root, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run to verify fail**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: FAIL missing `mcp/protocol.js`

- [ ] **Step 3: Implement protocol.js + tool-defs.js + server.js**

`server.js`：

```js
import { createInterface } from "node:readline";
import { createBrainSession } from "./session.js";
import { handleMcpRequest } from "./protocol.js";

const projectPath = (process.env.PROJECT_BRAIN_PATH || process.cwd()).trim();
const session = createBrainSession({ projectPath });
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async (line) => {
  const trimmed = String(line || "").trim();
  if (!trimmed) return;
  let body;
  try { body = JSON.parse(trimmed); } catch (e) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
    return;
  }
  try {
    const out = await handleMcpRequest(body, session);
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  } catch (e) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: body && body.id, error: { code: -32603, message: String((e && e.message) || e) } }) + "\n");
  }
});
```

注意：部分 MCP 客户端用 **Content-Length 头** 而不是一行一个 JSON。第一期同时支持：

1. 若 stdin 首包匹配 `/^Content-Length:\s*\d+/i`，走 header+body 帧（LSP 风格）
2. 否则走 newline-delimited JSON

在 `protocol.js` 导出 `attachStdio(session, stdin, stdout)` 实现两种帧，`server.js` 只调用它。smoke 继续测 `handleMcpRequest` 即可，不必测帧解析。Cursor 当前常用 header 帧——**必须实现 Content-Length**，否则 Cursor 连不上。

Content-Length 读循环要点：读 header 直到 `\r\n\r\n`，解析长度，再读 N 字节 UTF-8 body，然后 `handleMcpRequest`，响应写成：

```
Content-Length: <byteLength>\r\n\r\n<body>
```

用 `Buffer.byteLength(json, "utf8")`，不要用 `json.length`。

- [ ] **Step 4: Run smoke**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/
git commit -m "feat(mcp): stdio JSON-RPC server for Cursor"
```

---

### Task 4: Cursor 配置、文档、接入 run-smoke

**Files:**
- Create: `.cursor/mcp.json`
- Modify: `scripts/run-smoke.mjs`
- Modify: `README.md`, `README.zh-CN.md`, `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-09-17-cursor-mcp-shared-brain-design.md`（状态改为 Active）

**Interfaces:**
- Consumes: `src/mcp/server.js`
- Produces: Cursor 打开本仓库即可连 MCP；`npm test` 跑到 mcp smoke

- [ ] **Step 1: `.cursor/mcp.json`**

Windows/Mac 通用，用 `node` + 相对 server 路径。Cursor 项目 MCP 格式：

```json
{
  "mcpServers": {
    "dsh-project-brain": {
      "command": "node",
      "args": ["src/mcp/server.js"]
    }
  }
}
```

不要写绝对路径、不要放 Key。`args` 相对 **workspace 根**。

若当前 Cursor 版本要求 `mcp.json` 在 `.cursor/mcp.json` 且顶层键是 `mcpServers`，按上；若官方改为 `mcp.json` 另一种键名，以本机 Cursor 文档为准，但必须仍是相对路径、无密钥。

- [ ] **Step 2: Wire smoke**

In `scripts/run-smoke.mjs` `tests` array, after `"smoke-import-export.mjs"` add `"smoke-mcp-brain.mjs"`.

- [ ] **Step 3: Docs**

`CHANGELOG.md` Unreleased 增加：

```
- Cursor 可通过项目 MCP（`src/mcp/server.js`）读写同一份 `.project-brain/`，无需打开 DSH。
```

`README.md` / `README.zh-CN.md` 在 v1.3.1 特性下加 3–5 行：如何在本仓库用 Cursor 启用 MCP、DSH 与 Cursor 共用目录、密钥仍用环境变量。

Spec 文首改为：`状态：Active`

- [ ] **Step 4: Run full smoke**

Run: `node scripts/run-smoke.mjs`

Expected: 含 `smoke-mcp-brain.mjs` 在内全部 suite PASS

- [ ] **Step 5: Commit**

```bash
git add .cursor/mcp.json scripts/run-smoke.mjs README.md README.zh-CN.md CHANGELOG.md docs/superpowers/specs/2026-09-17-cursor-mcp-shared-brain-design.md
git commit -m "docs: Cursor MCP 接入说明与 smoke 挂入"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| AC-1 init 写出脑 | Task 2 |
| AC-2 memory_add jsonl | Task 2 |
| AC-3 todo add/done | Task 2 |
| AC-4 只读不改文件 | Task 2 smoke 可加 status 前后 mtime；若时间太紧，status/continue/ask 至少不写 memory.jsonl（在 Task 2 加：init 后记 memory.jsonl 长度，dispatch status/continue/ask 后长度不变） |
| AC-5 未初始化 | Task 2 |
| AC-6 run-smoke | Task 4 |
| AC-7 mcp.json | Task 4 |
| AC-8 README/CHANGELOG | Task 4 |
| Content-Length 帧 | Task 3 |
| 不读 DSH settings | Task 2 getMemoryConfig |
| 不做 CC/Codex/跨机器 | 无对应任务（有意） |

**AC-4 补进 Task 2 smoke（实现时必须带上）：**

```js
const memBefore = existsSync(join(root, ".project-brain", "memory.jsonl"))
  ? readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8") : "";
await session.dispatch("project_status", { path: root });
await session.dispatch("project_continue", { path: root });
await session.dispatch("project_ask", { path: root, question: "项目用什么框架" });
const memAfter = existsSync(join(root, ".project-brain", "memory.jsonl"))
  ? readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8") : "";
check("read tools do not change memory.jsonl", memBefore === memAfter);
```
