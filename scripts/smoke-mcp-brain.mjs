import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const REPO = join(__dirname, "..");
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

console.log("=== uninit write must not create brain ===");
{
  const { createBrainSession } = await import(fileUrl("mcp/session.js"));
  const root = mkdtempSync(join(tmpdir(), "dsh-mcp-uninit-todo-"));
  const session = createBrainSession({ projectPath: root });
  const added = await session.dispatch("project_todo_add", { path: root, title: "未初始化不应写入", priority: "high" });
  check("uninit todo_add not ok", added && added.ok === false, JSON.stringify(added));
  check("uninit todo_add E_NOT_INITIALIZED", added && added.code === "E_NOT_INITIALIZED", JSON.stringify(added));
  check("uninit todo_add does not mkdir .project-brain", !existsSync(join(root, ".project-brain")));
  rmSync(root, { recursive: true, force: true });
}

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
    path: root, type: "decision", title: "采用 Express", content: "选择 Express 因为生态成熟稳定。", importance: 0.8,
  });
  check("memory_add ok", !!(addMem && addMem.ok), JSON.stringify(addMem));
  const memFile = readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8");
  check("memory.jsonl contains title", memFile.indexOf("采用 Express") >= 0);
  const addLesson = await session.dispatch("project_memory_add", {
    path: root, type: "lesson", title: "MCP type preserve", content: "Caller type must survive always-admit fallback.", importance: 0.7,
  });
  check("memory_add lesson ok", !!(addLesson && addLesson.ok), JSON.stringify(addLesson));
  const memRows = readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  check("memory.jsonl preserves lesson type", memRows.some((row) => row.type === "lesson"));
  const memBefore = existsSync(join(root, ".project-brain", "memory.jsonl"))
    ? readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8") : "";
  await session.dispatch("project_status", { path: root });
  await session.dispatch("project_continue", { path: root });
  await session.dispatch("project_ask", { path: root, question: "项目用什么框架" });
  const memAfter = existsSync(join(root, ".project-brain", "memory.jsonl"))
    ? readFileSync(join(root, ".project-brain", "memory.jsonl"), "utf8") : "";
  check("read tools do not change memory.jsonl", memBefore === memAfter);
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
  const cancelled = await handleMcpRequest({ jsonrpc: "2.0", method: "notifications/cancelled" }, session);
  check("notifications/cancelled returns null", cancelled === null);
  const ping = await handleMcpRequest({ jsonrpc: "2.0", id: 7, method: "ping" }, session);
  check("ping result empty object", !!(ping && ping.result && Object.keys(ping.result).length === 0 && ping.id === 7));
  const unknownReq = await handleMcpRequest({ jsonrpc: "2.0", id: 8, method: "tools/unknown" }, session);
  check("unknown request still -32601", !!(unknownReq && unknownReq.error && unknownReq.error.code === -32601 && unknownReq.id === 8));
  rmSync(root, { recursive: true, force: true });
}

console.log("=== client MCP configs ===");
{
  function forbidden(text) {
    return text.indexOf("C:") >= 0 || text.indexOf("/Users/") >= 0 || text.indexOf("API_KEY") >= 0;
  }
  function argsOk(args) {
    return Array.isArray(args) && args.length === 1 && args[0] === "src/mcp/server.js";
  }

  const cursorPath = join(REPO, ".cursor", "mcp.json");
  const cursorRaw = readFileSync(cursorPath, "utf8");
  const cursor = JSON.parse(cursorRaw);
  const cursorSrv = cursor && cursor.mcpServers && cursor.mcpServers["dsh-project-brain"];
  check("cursor mcp exists", !!(cursorSrv && cursorSrv.command === "node" && argsOk(cursorSrv.args)));
  check("cursor mcp no secrets/abs", !forbidden(JSON.stringify(cursor)));

  const ccPath = join(REPO, ".mcp.json");
  check("claude .mcp.json exists", existsSync(ccPath));
  if (existsSync(ccPath)) {
    const ccRaw = readFileSync(ccPath, "utf8");
    const cc = JSON.parse(ccRaw);
    const srv = cc && cc.mcpServers && cc.mcpServers["dsh-project-brain"];
    check("claude command/args", !!(srv && srv.command === "node" && argsOk(srv.args)));
    check("claude type stdio or omitted", !srv.type || srv.type === "stdio");
    check("claude no secrets/abs", !forbidden(JSON.stringify(cc)));
  }

  const codexPath = join(REPO, ".codex", "config.toml");
  check("codex config.toml exists", existsSync(codexPath));
  if (existsSync(codexPath)) {
    const toml = readFileSync(codexPath, "utf8");
    check("codex section", toml.indexOf("[mcp_servers.dsh-project-brain]") >= 0);
    check("codex command node", /command\s*=\s*"node"/.test(toml));
    check("codex args", toml.indexOf('args = ["src/mcp/server.js"]') >= 0);
    check("codex no secrets/abs", !forbidden(toml));
  }
}

console.log(`\n=== Smoke summary: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
