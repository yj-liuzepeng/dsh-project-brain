// build-inline.js: 不依赖 esbuild，纯 Node FS 拼接
// v0.5.0-fix: sandbox 阻止 esbuild spawn 子进程（EPERM）→ 退路方案
// 1) client bundle: IIFE wrap + __PLACEHOLDER__ 替换（lib/client.js）
// 2) host bundle: 把整个 src/ 镜像到 lib/（保证 ESM import ./tools.js 等能解析到 lib/tools.js）
//    - lib/index.js 是 src/index.js 的副本
//    - lib/tools.js, lib/scanner.js, lib/host/*.js 等子模块也都复制到 lib/ 相同位置
//    DSH 加载 lib/index.js 时，import "./tools.js" 解析到 lib/tools.js ✅
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from "node:fs";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, "dsh-project-brain");
const projectRoot = __dirname;

function getWorkspaceArg() {
  const arg = process.argv.find((a) => a.startsWith("--workspace="));
  if (!arg) return null;
  return arg.slice("--workspace=".length);
}
const workspacePath = getWorkspaceArg();

function getWorkspaceRootArg() {
  const arg = process.argv.find((a) => a.startsWith("--workspace-root="));
  if (!arg) return null;
  return arg.slice("--workspace-root=".length);
}
const workspaceRoot = getWorkspaceRootArg() || join(homedir(), ".dsh");

function readJsonlFile(filePath) {
  if (!existsSync(filePath)) return [];
  const out = [];
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (e) { /* skip */ }
  }
  return out;
}
function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf8")); } catch (e) { return null; }
}

function loadProjectData(workspace) {
  const root = workspace || projectRoot;
  const brainDir = join(root, ".project-brain");
  const projPath = join(brainDir, "project.json");
  if (!existsSync(projPath)) {
    return {
      generatedAt: Date.now(),
      initialized: false,
      project: null,
      phase: null,
      recentActivity: [],
      memories: [],
      memoriesAll: [],
      todos: [],
      timelineAll: [],
      architecture: null,
      stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 },
    };
  }
  const raw = readJsonFile(projPath);
  if (!raw) throw new Error("empty project.json");
  const architecture = readJsonFile(join(brainDir, "architecture.json"));
  const timelineAll = readJsonlFile(join(brainDir, "timeline.jsonl"))
    .slice().sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0)).slice(0, 50);
  const recentActivity = timelineAll.slice(0, 5).map((e) => ({ id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType }));
  const memoriesAll = readJsonlFile(join(brainDir, "memory.jsonl"))
    .filter((m) => m && m.status !== "archived" && m.status !== "superseded" && m.status !== "deleted")
    .slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 50);
  const memories = memoriesAll.slice(0, 3);
  const todosAll = readJsonlFile(join(brainDir, "todo.jsonl"));
  const pendingTodos = todosAll.filter((t) => t && t.status !== "done" && t.status !== "cancelled").length;
  const completedTodos = todosAll.filter((t) => t && t.status === "done").length;
  return {
    generatedAt: Date.now(),
    initialized: true,
    project: {
      id: raw.id, name: raw.name || "(unnamed)",
      type: raw.techStack ? Object.keys(raw.techStack)[0] : "",
      description: raw.description || "", techStack: raw.techStack || {},
      languages: raw.languages || {}, entrypoints: raw.entrypoints || [],
      lastUpdateAt: raw.updatedAt || raw.lastScannedAt || Date.now(),
    },
    phase: { title: "已扫描（" + (raw.entrypoints ? raw.entrypoints.length : 0) + " 个入口）", progress: { done: 1, total: 1 } },
    recentActivity, memories, memoriesAll,
    todos: todosAll.slice(0, 50),
    timelineAll,
    architecture,
    stats: { pendingTodos, completedTodos, decisions: memoriesAll.filter((m) => m.type === "decision").length },
  };
}

const projectData = workspacePath ? loadProjectData(workspacePath) : {
  generatedAt: Date.now(), initialized: false, project: null, phase: null,
  recentActivity: [], memories: [], memoriesAll: [], todos: [], timelineAll: [],
  architecture: null,
  stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 },
};
const allWorkspaces = { sessionToWorkspaceId: {}, workspaceProjects: {}, workspacePaths: {}, dshRoot: workspaceRoot };

console.log("[dsh-project-brain:build-inline] workspace:", workspacePath || "(none)");
console.log("[dsh-project-brain:build-inline] project data: initialized=" + projectData.initialized);

// ─── 1) client bundle: IIFE wrap + placeholder 替换 ───
const clientSrc = readFileSync(resolve(__dirname, "src/client.js"), "utf8");
const projectDataJson = JSON.stringify(JSON.stringify(projectData));
const allWorkspacesJson = JSON.stringify(JSON.stringify(allWorkspaces));

const clientOut = clientSrc
  .replace(/__PROJECT_DATA_JSON__/g, projectDataJson)
  .replace(/__CODEGRAPH_JSON__/g, JSON.stringify(JSON.stringify(null)))
  .replace(/__ALL_WORKSPACES_JSON__/g, allWorkspacesJson);

const clientFinal = "\uFEFF/* dsh-project-brain client bundle (build-inline.js) */\n" +
  "(() => {\n" + clientOut + "\n})();\n";
writeFileSync(resolve(pkgDir, "lib/client.js"), clientFinal);
console.log("[dsh-project-brain:build-inline] client bundle -> " + clientFinal.length + " bytes");

// ─── 2) host bundle: 镜像 src/ → lib/ ───
//    lib/index.js 是 src/index.js 副本（顶层入口）
//    lib/tools.js, lib/scanner.js, lib/host/... 等所有子模块也复制到 lib/ 相同位置
//    这样 DSH 加载 lib/index.js 时，import "./tools.js" 解析到 lib/tools.js ✅
//
//    注意：lib/ 是 DSH 实际加载位置（package.json "main": "./dsh-project-brain/lib/index.js"）
//    保留 lib/client.js（构建产物，不在 src 镜像范围）
const libDir = resolve(pkgDir, "lib");
const srcDir = resolve(__dirname, "src");
mkdirSync(libDir, { recursive: true });

// 清理 lib/ 下旧的 src 镜像（保留 client.js / client.js.map 等构建产物 + .map 文件）
function cleanLibOfSrc() {
  function walk(dir) {
    let names;
    try { names = readdirSync(dir); } catch (e) { return; }
    for (const name of names) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) {
        walk(p);
        try { const r = readdirSync(p); if (r.length === 0) rmSync(p, { recursive: true, force: true }); } catch (e) {}
      } else if (st.isFile() && /\.(js|mjs)$/i.test(name)) {
        // 保留 client.js（构建产物，IIFE bundle）
        // 保留 .map（sourcemap 关联文件）
        if (/^client\.js$/i.test(name)) continue;
        if (/\.map$/i.test(name)) continue;
        rmSync(p, { force: true });
      }
    }
  }
  walk(libDir);
}

// 复制 src/ → lib/（保留目录结构 + 所有 .js/.mjs 文件；跳过 src/client.js，避免覆盖 IIFE bundle）
function copyTree(from, to) {
  const st = statSync(from);
  if (st.isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      copyTree(join(from, name), join(to, name));
    }
  } else if (st.isFile() && /\.(js|mjs)$/i.test(from)) {
    // 关键：跳过 src/client.js — 它对应构建产物 lib/client.js（IIFE wrap），
    //   保留 lib/client.js，不要被 src 原文件覆盖
    if (/[/\\]client\.js$/i.test(from)) return;
    writeFileSync(to, readFileSync(from));
  }
}

cleanLibOfSrc();
copyTree(srcDir, libDir);

const indexSrc = readFileSync(resolve(libDir, "index.js"), "utf8");
const indexMap = resolve(libDir, "index.js.map");
try { rmSync(indexMap, { force: true }); } catch (e) {}
console.log("[dsh-project-brain:build-inline] host bundle -> lib/index.js " + indexSrc.length + " bytes + 子模块已镜像");

// 验证关键子模块存在
const needChecks = ["tools.js", "scanner.js", "host/sidebar/aggregator.js", "host/rpc/sidebar.js"];
for (const rel of needChecks) {
  const p = join(libDir, rel);
  console.log("  check lib/" + rel + ": " + (existsSync(p) ? "OK" : "MISSING"));
}

// 验证 lib/client.js 是 IIFE bundle（不是 src/client.js 镜像）
const clientHead = readFileSync(resolve(libDir, "client.js"), "utf8").slice(0, 100);
console.log("[dsh-project-brain:build-inline] client.js head: " + clientHead.replace(/\n/g, " | ").slice(0, 80));

console.log("[dsh-project-brain:build-inline] DONE");
