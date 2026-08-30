// smoke-multi-workspace.mjs - 跨 workspace 隔离实测（v0.3.13 / P0.8 第二波）
//
// 验证 path-resolver + brain-files + build-time embed 三个层面在多个 workspace 之间互不串台。
// 不依赖 dsh-tools runtime（只 import brain-files / brain-logic / path-resolver / build.js）。
//
// 覆盖：
//   1) resolveProjectPath 显式 args.path 隔离
//   2) resolveProjectPath session cwd 隔离
//   3) resolveProjectPath DSH Desktop 安装路径过滤（v0.3.8 修复点）
//   4) 写入隔离：todo.jsonl A vs B（brain-files + makeTodoEntry）
//   5) build-time embed 隔离：loadProjectData(A) vs loadProjectData(B)
//
// 退出码：0 = PASS，1 = FAIL

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP = mkdtempSync(join(tmpdir(), "dsh-pb-multiws-"));
const PROJ_A = join(TMP, "app-express");
const PROJ_B = join(TMP, "app-python");

function makeFixture(dir, pkg) {
  mkdirSync(join(dir, ".project-brain"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2), "utf8");
  writeFileSync(join(dir, ".project-brain", "project.json"), JSON.stringify({
    id: "proj-" + dir.split(/[\\/]/).pop() + "-" + Date.now().toString(36),
    name: pkg.name,
    rootPath: dir,
    techStack: pkg.techStack || {},
    languages: pkg.languages || {},
    createdAt: Date.now(), updatedAt: Date.now(), lastScannedAt: Date.now(),
  }, null, 2), "utf8");
}
makeFixture(PROJ_A, { name: "app-express", dependencies: { express: "^4.18.0" }, techStack: { backend: "Express" }, languages: { javascript: 3 } });
makeFixture(PROJ_B, { name: "app-python", dependencies: {}, techStack: { backend: "FastAPI" }, languages: { python: 5 } });

// node fs adapter（与 src 内使用面一致）
import * as nodefs from "node:fs";
const fsAdapter = {
  resolve: async (p, opts) => (opts && opts.cwd ? join(opts.cwd, p) : p),
  listDir: async (target) => {
    const dir = typeof target === "string" ? target : (target && target.path) || String(target);
    return nodefs.readdirSync(dir, { withFileTypes: true }).map((e) => ({
      name: e.name, type: e.isDirectory() ? "directory" : (e.isFile() ? "file" : "other"), target: join(dir, e.name),
    }));
  },
  readText: async (target) => { try { return nodefs.readFileSync(target, "utf8"); } catch { return null; } },
  writeText: async (target, content) => {
    try { nodefs.mkdirSync(String(target).replace(/[\\/][^\\/]*$/, ""), { recursive: true }); } catch (e) {}
    nodefs.writeFileSync(target, content, "utf8"); return true;
  },
};

let pass = 0;
let fail = 0;
const check = (name, ok) => { if (ok) { console.log(`  [PASS] ${name}`); pass++; } else { console.log(`  [FAIL] ${name}`); fail++; } };

// ─── 1) resolveProjectPath 显式 path 隔离 ───
console.log("\n=== 1: resolveProjectPath 显式 path ===");
const { resolveProjectPath } = await import("../src/host/store/path-resolver.js");
const noSession = { session: null, ctx: null, sessionId: null };
const spA = { workspaceRoot: PROJ_A };
const spB = { workspaceRoot: PROJ_B };

check("args.path=A → A", resolveProjectPath({ path: PROJ_A }, noSession, spA) === PROJ_A);
check("args.path=B → B", resolveProjectPath({ path: PROJ_B }, noSession, spB) === PROJ_B);
check("args.path=A 不受 sp=B 干扰", resolveProjectPath({ path: PROJ_A }, noSession, spB) === PROJ_A);
check("args.path=B 不受 sp=A 干扰", resolveProjectPath({ path: PROJ_B }, noSession, spA) === PROJ_B);

// ─── 2) resolveProjectPath session cwd 隔离 ───
console.log("\n=== 2: resolveProjectPath session cwd ===");
const execA = { session: { cwd: PROJ_A }, ctx: null, sessionId: "sess-a" };
const execB = { session: { cwd: PROJ_B }, ctx: null, sessionId: "sess-b" };
check("session.cwd=A → A", resolveProjectPath({}, execA, spA) === PROJ_A);
check("session.cwd=B → B", resolveProjectPath({}, execB, spB) === PROJ_B);
check("session.cwd=A 优先于 sp=B", resolveProjectPath({}, execA, spB) === PROJ_A);
check("session.cwd=B 优先于 sp=A", resolveProjectPath({}, execB, spA) === PROJ_B);

// ─── 3) DSH Desktop 安装路径过滤 ───
console.log("\n=== 3: DSH Desktop 安装路径过滤 ===");
const dshInstall = "C:\\Users\\tester\\AppData\\Local\\Programs\\DSH Desktop";
const spDsh = { workspaceRoot: dshInstall };
check("DSH Desktop workspaceRoot 被过滤 → 返回 '.'", resolveProjectPath({}, noSession, spDsh) === ".");
check("DSH Desktop + 显式 path=A → 仍返回 A", resolveProjectPath({ path: PROJ_A }, noSession, spDsh) === PROJ_A);
// Mac 风格
const spDshMac = { workspaceRoot: "/Applications/DSH Desktop.app/Contents/Resources" };
check("Mac DSH Desktop 路径被过滤 → '.'", resolveProjectPath({}, noSession, spDshMac) === ".");

// ─── 4) 写入隔离（todo.jsonl）───
console.log("\n=== 4: 写入隔离（todo.jsonl A vs B）===");
const { brainPath, appendJsonl, readJsonl } = await import("../src/host/store/brain-files.js");
const { makeTodoEntry } = await import("../src/host/store/brain-logic.js");

const now = Date.now();
await appendJsonl(fsAdapter, brainPath(PROJ_A, "todo.jsonl"), makeTodoEntry({ title: "A-todo-1", priority: "high" }, now));
await appendJsonl(fsAdapter, brainPath(PROJ_A, "todo.jsonl"), makeTodoEntry({ title: "A-todo-2", priority: "medium" }, now + 1));
await appendJsonl(fsAdapter, brainPath(PROJ_B, "todo.jsonl"), makeTodoEntry({ title: "B-todo-1", priority: "low" }, now));

const todosA = await readJsonl(fsAdapter, brainPath(PROJ_A, "todo.jsonl"));
const todosB = await readJsonl(fsAdapter, brainPath(PROJ_B, "todo.jsonl"));
check("A 有 2 条 todo", todosA.length === 2);
check("B 有 1 条 todo", todosB.length === 1);
check("A 不含 B 的 todo", todosA.every((t) => t.title.startsWith("A-")));
check("B 不含 A 的 todo", todosB.every((t) => t.title.startsWith("B-")));
check("A 的 todo 文件存在", existsSync(brainPath(PROJ_A, "todo.jsonl")));
check("B 的 todo 文件存在（各自独立文件）", existsSync(brainPath(PROJ_B, "todo.jsonl")));

// ─── 5) build-time embed 隔离 ───
console.log("\n=== 5: build-time embed 隔离（loadProjectData）===");
const { loadProjectData } = await import("../build.js");
const previewA = loadProjectData(PROJ_A);
const previewB = loadProjectData(PROJ_B);

check("A preview.name = app-express", previewA.project && previewA.project.name === "app-express");
check("B preview.name = app-python", previewB.project && previewB.project.name === "app-python");
check("A preview.todos 只有 A（2 条）", previewA.todos.length === 2 && previewA.todos.every((t) => t.title.startsWith("A-")));
check("B preview.todos 只有 B（1 条）", previewB.todos.length === 1 && previewB.todos.every((t) => t.title.startsWith("B-")));
check("A preview.stats.pendingTodos = 2", previewA.stats.pendingTodos === 2);
check("B preview.stats.pendingTodos = 1", previewB.stats.pendingTodos === 1);

// ─── 6) memory 隔离（额外验证）───
console.log("\n=== 6: memory 隔离 ===");
const { makeMemoryEntry } = await import("../src/host/store/brain-logic.js");
await appendJsonl(fsAdapter, brainPath(PROJ_A, "memory.jsonl"), makeMemoryEntry({ type: "decision", title: "A 用 Express", importance: 0.7 }, now));
await appendJsonl(fsAdapter, brainPath(PROJ_B, "memory.jsonl"), makeMemoryEntry({ type: "decision", title: "B 用 FastAPI", importance: 0.7 }, now));
const previewA2 = loadProjectData(PROJ_A);
const previewB2 = loadProjectData(PROJ_B);
check("A memories 只有 A 的", previewA2.memories.length === 1 && previewA2.memories[0].title === "A 用 Express");
check("B memories 只有 B 的", previewB2.memories.length === 1 && previewB2.memories[0].title === "B 用 FastAPI");

console.log(`\n${pass} PASS / ${fail} FAIL`);

// 清理
rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);