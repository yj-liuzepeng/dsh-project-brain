// 跨 Session smoke test（v0.3.12）
//
// 模拟完整生命周期：
//   1. 准备 fixture 项目（package.json + 2 src/*.js）
//   2. 跑 scanner → 生成 .project-brain/project.json + init timeline
//   3. project_memory_add（决策/教训）
//   4. project_todo_add / project_todo_list
//   5. 模拟 session/disposed → setupSummarizer 写 change memory + session_summary 事件
//   6. 模拟 agent/session-start → setupInjector 读 project.jsonl 注入 context
//   7. 验证：
//      - project.json 正确生成
//      - memory.jsonl 含 init/decision/lesson/change/session_summary
//      - todo.jsonl 含 todo + session_start 列出来了
//      - injector 输出 markdown 含 Top-K memories + 活跃 TODO
//
// 退出码：0 = PASS，1 = FAIL

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 1. 准备 fixture 项目
const TMP = mkdtempSync(join(tmpdir(), "dsh-pb-session-"));
const PKG_DIR = join(TMP, "my-app");
mkdirSync(join(PKG_DIR, "src"), { recursive: true });
writeFileSync(join(PKG_DIR, "package.json"), JSON.stringify({
  name: "my-app", version: "0.1.0",
  dependencies: { express: "^4.18.0" },
}, null, 2), "utf8");
writeFileSync(join(PKG_DIR, "src", "index.js"), "const app = require('express')();\nmodule.exports = app;\n", "utf8");
writeFileSync(join(PKG_DIR, "src", "routes.js"), "module.exports = function (app) { app.get('/', (req, res) => res.send('hi')); };\n", "utf8");
mkdirSync(join(PKG_DIR, ".project-brain"), { recursive: true });

// 初始化 git 仓库（summarizer 需要 git diff 才能写 change memory）
import { spawnSync } from "node:child_process";
try {
  spawnSync("git", ["init", "--quiet"], { cwd: PKG_DIR });
  spawnSync("git", ["config", "user.email", "test@local"], { cwd: PKG_DIR });
  spawnSync("git", ["config", "user.name", "test"], { cwd: PKG_DIR });
  // baseline commit
  spawnSync("git", ["add", "-A"], { cwd: PKG_DIR });
  spawnSync("git", ["commit", "--quiet", "-m", "init"], { cwd: PKG_DIR });
  // 再加一个新文件作为"上次 session 之后"的变更 → HEAD~1 对比会有 diff
  writeFileSync(join(PKG_DIR, "src", "utils.js"), "module.exports = { greet: () => 'hi' };\n", "utf8");
  spawnSync("git", ["add", "-A"], { cwd: PKG_DIR });
  spawnSync("git", ["commit", "--quiet", "-m", "add utils"], { cwd: PKG_DIR });
} catch (e) {
  console.log("[warn] git init failed:", e.message, "— summarizer change memory step will be skipped");
}

// 2. node-fs adapter
import * as nodefs from "node:fs";
const fsAdapter = {
  resolve: async (p, opts) => {
    if (opts && opts.cwd) return join(opts.cwd, p);
    return p;
  },
  listDir: async (target) => {
    const dir = typeof target === "string" ? target : (target && target.path) || String(target);
    const entries = nodefs.readdirSync(dir, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : (e.isFile() ? "file" : "other"),
      target: join(dir, e.name),
    }));
  },
  readText: async (target) => {
    try { return nodefs.readFileSync(target, "utf8"); } catch { return null; }
  },
  writeText: async (target, content) => {
    try {
      const dir = String(target).replace(/[\\/][^\\/]*$/, "");
      nodefs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
    nodefs.writeFileSync(target, content, "utf8");
    return true;
  },
};

// 3. mock ctx（emit + on + logger + shell service）
const emitCalls = [];
const eventHandlers = {};
import { spawn as childSpawn } from "node:child_process";
const shellService = {
  resolve: (spec) => spec,
  run: (spec) => {
    return new Promise((resolve) => {
      try {
        const child = childSpawn(spec.command, spec.args, { cwd: spec.cwd, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => { out += d.toString(); });
        child.stderr.on("data", (d) => { err += d.toString(); });
        child.on("close", (code) => resolve({ exitCode: code, stdout: out, stderr: err }));
        child.on("error", (e) => resolve({ exitCode: -1, stdout: "", stderr: String(e) }));
      } catch (e) {
        resolve({ exitCode: -1, stdout: "", stderr: String(e) });
      }
    });
  },
};
const ctx = {
  logger: { info: (m) => console.log("[ctx.info]", m), warn: (m) => console.log("[ctx.warn]", m), error: (m) => console.log("[ctx.error]", m), debug: () => {} },
  on: (event, handler) => { (eventHandlers[event] = eventHandlers[event] || []).push(handler); },
  emit: (event, payload) => { emitCalls.push({ event, payload }); const hs = eventHandlers[event]; if (hs) for (const h of hs) try { h(payload); } catch (e) { console.log("emit handler error:", e.message); } },
  get: (name) => {
    if (name === "shell") return shellService;
    return undefined;
  },
};
const sandboxPolicy = { workspaceRoot: PKG_DIR };

let pass = 0;
let fail = 0;
const check = (name, ok) => { if (ok) { console.log(`  [PASS] ${name}`); pass++; } else { console.log(`  [FAIL] ${name}`); fail++; } };

// ─── Step 2: scanner ───
console.log("\n=== Step 2: scanner ===");
const { scanProject } = await import("../src/scanner.js");
const scan = await scanProject(fsAdapter, PKG_DIR);
console.log("languages:", scan.languages);
console.log("techStack:", scan.techStack);
console.log("entrypoints:", scan.entrypoints);
console.log("fileCount:", scan.fileCount);
check("scanner 识别 javascript 语言", scan.languages.javascript === 2 || scan.languages.javascript > 0);
check("scanner 识别 express 技术栈", scan.techStack.backend && /express/i.test(String(scan.techStack.backend)));
check("scanner entrypoints 字段存在（数组）", Array.isArray(scan.entrypoints));
check("scanner fileCount 包含 src/*.js", scan.fileCount >= 2);

// 写 project.json
const projectId = "test-" + Date.now().toString(36);
const projectJson = {
  id: projectId,
  name: "my-app",
  rootPath: PKG_DIR,
  techStack: scan.techStack,
  languages: scan.languages,
  size: { files: scan.fileCount, loc: 0 },
  entrypoints: scan.entrypoints,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastScannedAt: Date.now(),
};
writeFileSync(join(PKG_DIR, ".project-brain", "project.json"), JSON.stringify(projectJson, null, 2), "utf8");
check("project.json 写入成功", existsSync(join(PKG_DIR, ".project-brain", "project.json")));

// 写 init timeline
writeFileSync(join(PKG_DIR, ".project-brain", "timeline.jsonl"),
  JSON.stringify({
    id: "evt-init-1",
    title: "完成 project_init 扫描",
    eventType: "init",
    occurredAt: Date.now(),
    detail: "files=" + scan.fileCount,
  }) + "\n",
  "utf8",
);

// ─── Step 3: project_memory_add（直接用 brain-files + brain-logic，避开 dsh-tools） ───
console.log("\n=== Step 3: memory_add ===");
const { brainPath, appendJsonl } = await import("../src/host/store/brain-files.js");
const { makeMemoryEntry } = await import("../src/host/store/brain-logic.js");

const now = Date.now();
const mem1 = makeMemoryEntry({ type: "decision", title: "采用 Express 框架", content: "选择 Express 因为生态最成熟", importance: 0.8, relatedFiles: ["package.json"] }, now);
const mem2 = makeMemoryEntry({ type: "lesson", title: "DSH host bundle 不会自动热重载", content: "改 host 代码必须重启 DSH", importance: 0.85 }, now + 1);
await appendJsonl(fsAdapter, brainPath(PKG_DIR, "memory.jsonl"), mem1);
await appendJsonl(fsAdapter, brainPath(PKG_DIR, "memory.jsonl"), mem2);

const memFile = readFileSync(join(PKG_DIR, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("memory.jsonl 写入 2 条", memFile.length === 2);
check("mem1 type = decision", memFile[0].type === "decision");
check("mem1.importance = 0.8", memFile[0].importance === 0.8);

// ─── Step 4: project_todo_add ───
console.log("\n=== Step 4: todo_add ===");
const { makeTodoEntry } = await import("../src/host/store/brain-logic.js");
const todo1 = makeTodoEntry({ title: "实现用户注册 API", description: "POST /api/register", priority: "high", relatedFiles: ["src/routes.js"] }, now);
const todo2 = makeTodoEntry({ title: "添加单元测试", priority: "medium" }, now + 1);
await appendJsonl(fsAdapter, brainPath(PKG_DIR, "todo.jsonl"), todo1);
await appendJsonl(fsAdapter, brainPath(PKG_DIR, "todo.jsonl"), todo2);
const todoFile = readFileSync(join(PKG_DIR, ".project-brain", "todo.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("todo.jsonl 写入 2 条", todoFile.length === 2);
check("todo1 priority = high", todoFile[0].priority === "high");
check("todo1 status = pending", todoFile[0].status === "pending");

// ─── Step 5: 模拟 session/disposed → summarizer ───
console.log("\n=== Step 5: summarizer ===");
const { setupSummarizer } = await import("../src/host/summarizer.js");
const { setupInjector } = await import("../src/host/injector.js");

// 先注册 summarizer（订阅 session/disposed）
setupSummarizer(ctx, fsAdapter, sandboxPolicy);

// 模拟 session 离开
ctx.emit("session/disposed", {
  id: "session-test-1",
  meta: { cwd: PKG_DIR, id: "session-test-1" },
});

// 给 summarizer 异步时间（git diff + 写文件 + emit preview.changed）
await new Promise((r) => setTimeout(r, 1000));

const memAfterSummary = readFileSync(join(PKG_DIR, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const tlAfterSummary = readFileSync(join(PKG_DIR, ".project-brain", "timeline.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("summarizer 后 memory.jsonl 含 change 类型", memAfterSummary.some((m) => m.type === "change"));
check("summarizer 后 timeline.jsonl 含 session_summary", tlAfterSummary.some((e) => e.eventType === "session_summary"));
console.log("  (memory rows:", memAfterSummary.length, ", timeline entries:", tlAfterSummary.length, ")");

// ─── Step 6: agent/session-start → injector 注入 ───
console.log("\n=== Step 6: injector ===");
// 模拟 systemPrompt service（injector 注册的 section render 需要）
const sections = [];
const systemPromptMock = {
  section: (s) => { sections.push(s); return () => {}; },
};
// 替换 ctx.get 让 systemPrompt service 可用（保留 shell）
ctx.get = (name) => {
  if (name === "systemPrompt") return systemPromptMock;
  if (name === "shell") return shellService;
  if (name === "sessions") return { list: () => [] };
  return undefined;
};

// 先 setupInjector（注册 section + 订阅 agent/session-start）
setupInjector(ctx, fsAdapter, sandboxPolicy);
// 等注册完成
await new Promise((r) => setTimeout(r, 50));
const ourSection = sections.find((s) => s.name === "project-brain-context");
check("systemPrompt section 注册成功", !!ourSection);

// 然后 emit session-start（injector handler 才会被调到 + refreshCache）
ctx.emit("agent/session-start", {
  agent: { session: { meta: { cwd: PKG_DIR }, cwd: PKG_DIR, header: { cwd: PKG_DIR } } },
});
await new Promise((r) => setTimeout(r, 300));  // 等 refreshCache (async read file)

// 调 render
if (ourSection) {
  const md = typeof ourSection.text === "function" ? ourSection.text({}) : ourSection.text;
  console.log("\n--- injected context ---\n" + md + "\n---");
  check("injected context 包含 'Project Brain Context'", /Project Brain Context/.test(md));
  check("injected context 包含 project name 'my-app'", /my-app/.test(md));
  check("injected context 包含 decision memory '采用 Express'", /采用 Express/.test(md));
  check("injected context 包含 lesson memory 'DSH host bundle'", /DSH host bundle/.test(md));
  check("injected context 包含 active TODO '实现用户注册'", /实现用户注册/.test(md));
}

// ─── Step 7: build-time embed（build.js loadProjectData）───
console.log("\n=== Step 7: build-time embed ===");
const { loadProjectData } = await import("../build.js");
const preview = loadProjectData(PKG_DIR);
console.log("preview.initialized:", preview.initialized);
console.log("preview.project.name:", preview.project && preview.project.name);
console.log("preview.memories:", preview.memories.length);
console.log("preview.todos:", preview.todos.length);
console.log("preview.stats:", preview.stats);
check("build embed initialized=true", preview.initialized === true);
check("build embed project.name='my-app'", preview.project && preview.project.name === "my-app");
check("build embed memories count >= 2", preview.memories.length >= 2);
check("build embed todos count >= 2", preview.todos.length >= 2);
check("build embed stats.pendingTodos >= 2", preview.stats.pendingTodos >= 2);
check("build embed stats.decisions >= 1", preview.stats.decisions >= 1);

console.log(`\n${pass} PASS / ${fail} FAIL`);

// 清理
rmSync(TMP, { recursive: true, force: true });

process.exit(fail === 0 ? 0 : 1);