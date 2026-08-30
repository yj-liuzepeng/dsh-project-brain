import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { registerConnectionRpc } from "../src/host/rpc/sidebar.js";

const root = mkdtempSync(join(tmpdir(), "dsh-brain-runtime-"));
writeFileSync(join(root, "package.json"), JSON.stringify({
  dependencies: { react: "latest", express: "latest" },
  scripts: { dev: "node src/index.js" },
}));
mkdirSync(join(root, "src"));
writeFileSync(join(root, "src", "index.js"), "export const ok = true;\n");

function target(path) { return { path: resolve(path) }; }
const fsAdapter = {
  async resolve(path, options) {
    const base = options && options.cwd ? (options.cwd.path || String(options.cwd)) : process.cwd();
    return target(resolve(base, path));
  },
  processPath(value) { return value.path; },
  async listDir(value) {
    return readdirSync(value.path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
      target: target(join(value.path, entry.name)),
    }));
  },
  async readText(value) { return readFileSync(value.path, "utf8"); },
  async writeText(value, text) {
    mkdirSync(dirname(value.path), { recursive: true });
    writeFileSync(value.path, text, "utf8");
    return true;
  },
  async stat(value) { return statSync(value.path); },
};

const liveSessions = new Map();
let rpcHandler;
let rpcOptions;
const connection = {
  rpc: {
    handle(channel, handler, options) {
      assert.equal(channel, "/project-brain");
      rpcHandler = handler;
      rpcOptions = options;
    },
  },
};
const ctx = {
  sessions: { get: (id) => liveSessions.get(id) },
  get(name) { return name === "sessions" ? this.sessions : undefined; },
};
const toolCalls = [];
const tools = {
  async execute(request) {
    toolCalls.push(request);
    if (request.name === "project_todo_list") {
      return { ok: true, data: { active: 2, done: 1, total: 3, todos: [] } };
    }
    if (request.name === "project_dream") {
      return {
        ok: true,
        data: {
          dryRun: request.args.dryRun,
          summary: { mergeCandidates: 1, archiveCandidates: 0 },
          committed: request.args.dryRun ? undefined : { beforeCount: 3, afterCount: 2 },
        },
      };
    }
    if (request.name === "project_continue") {
      return { ok: true, data: { suggestedNextStep: "ship it" } };
    }
    throw new Error("unexpected tool " + request.name);
  },
};

assert.equal(registerConnectionRpc({
  connection,
  ctx,
  fs: fsAdapter,
  sandboxPolicy: null,
  tools,
  logger: console,
}), true);
assert.equal(rpcOptions.authority, "loopback");

// The Session is intentionally created after RPC registration. This is the
// regression: no build-time sessionId map contains it.
liveSessions.set("session-new", { header: { cwd: root } });

const before = await rpcHandler("preview", { sessionId: "session-new" });
assert.equal(before.ok, true);
assert.equal(before.value.projectPath, root);
assert.equal(before.value.preview.initialized, false);

const initialized = await rpcHandler("init", { sessionId: "session-new" });
assert.equal(initialized.ok, true);
assert.equal(initialized.value.projectPath, root);
assert.equal(initialized.value.preview.initialized, true);
assert.equal(initialized.value.preview.project.name, root.split("/").pop());
assert.equal(statSync(join(root, ".project-brain", "project.json")).isFile(), true);

const missing = await rpcHandler("preview", { sessionId: "session-missing" });
assert.equal(missing.ok, false);
assert.equal(missing.error.code, "WORKSPACE_NOT_FOUND");

const rescanned = await rpcHandler("action", { sessionId: "session-new", action: "rescan", path: "/tmp/hostile" });
assert.equal(rescanned.ok, true);
assert.equal(rescanned.value.projectPath, root);
assert.equal(rescanned.value.action, "rescan");

const todos = await rpcHandler("action", { sessionId: "session-new", action: "todos", path: "/tmp/hostile" });
assert.equal(todos.ok, true);
assert.equal(toolCalls.at(-1).name, "project_todo_list");
assert.equal(toolCalls.at(-1).args.path, root);
assert.equal(toolCalls.at(-1).args.status, undefined);

const dreamPreview = await rpcHandler("action", { sessionId: "session-new", action: "dream" });
assert.equal(dreamPreview.ok, true);
assert.equal(toolCalls.at(-1).name, "project_dream");
assert.equal(toolCalls.at(-1).args.dryRun, true);

const dreamCommit = await rpcHandler("action", { sessionId: "session-new", action: "dreamCommit" });
assert.equal(dreamCommit.ok, true);
assert.equal(toolCalls.at(-1).args.dryRun, false);

const overview = await rpcHandler("action", { sessionId: "session-new", action: "overview" });
assert.equal(overview.ok, true);
assert.equal(toolCalls.at(-1).name, "project_continue");

const forbidden = await rpcHandler("action", { sessionId: "session-new", action: "project_memory_add" });
assert.equal(forbidden.ok, false);
assert.equal(forbidden.error.code, "ACTION_NOT_ALLOWED");

console.log("runtime workspace RPC: 28 assertions PASS");
