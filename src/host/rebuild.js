// rebuild.js - 监听 .project-brain/ 变化自动重新构建 bundle
// 目的：让 LLM 调 project_* 工具后，DSH client bundle 自动更新（host bundle 仍需重启 DSH 加载）
//
// v0.3.14 重大改动：放弃 `ctx.on("project_brain/preview.changed")` 跨 fiber 事件订阅
//   根因：Cordis 4 Scoped<Context> 模型 ctx.emit/on 默认只在同 fiber 内 dispatch；
//   dsh-project-brain host bundle 在 host fiber 注册，工具 exec.ctx 是 agent fiber —— 跨 fiber 不通。
//   修复：用 ctx.timer.periodic 5 秒轮询 .project-brain/{project,memory,todo,timeline}.json* 的 mtime，
//   任意一个变化触发 runBuild()。跨 fiber 稳定，不依赖自定义事件名。
// 保留原 ctx.on() 作为 fallback（如果未来 DSH 提供跨 fiber 路由能工作）。

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Source runs from <plugin>/src/host, while the packaged bundle runs from
// <plugin>/dsh-project-brain/lib/host. Resolve the outer plugin root in both
// layouts so build.js and the workspace data are addressed consistently.
const CANDIDATE_PLUGIN_DIR = join(__dirname, "..", "..");
const PLUGIN_DIR = existsSync(join(CANDIDATE_PLUGIN_DIR, "build.js"))
  ? CANDIDATE_PLUGIN_DIR
  : join(CANDIDATE_PLUGIN_DIR, "..");

// v0.3.14：监听文件列表（每个 workspace 的 .project-brain/ 四个核心文件）
//   多 workspace 场景：监听 sandboxPolicy.workspaceRoot 下的 .project-brain/ + 轮询期间发现的其它 workspace
const WATCH_FILES = ["project.json", "memory.jsonl", "todo.jsonl", "timeline.jsonl"];

let rebuilding = false;
let pending = false;

async function runBuild() {
  if (rebuilding) { pending = true; return; }
  rebuilding = true;
  try {
    // v0.5.1：只走 DSH ctxShell.run（框架官方通道），彻底撤掉 fallback child_process.spawn
    //   历史原因：v0.3.6 引入 fallback spawn 是为了应对 DSH 浏览器模式，但 DSH Desktop
    //   模式下 ctxShell 始终可用；fallback spawn 让 host bundle 持有大量短生命周期子进程，
    //   在 DSH Desktop 关闭时与主进程 pipe 关联，间接触发 EPIPE/auto-quit。撤掉以根除。
    if (ctxShell && typeof ctxShell.resolve === "function" && typeof ctxShell.run === "function") {
      try {
        const spec = ctxShell.resolve({
          command: process.execPath,
          args: [join(PLUGIN_DIR, "build.js")],
          cwd: PLUGIN_DIR,
        });
        const result = await ctxShell.run(spec);
        if (ctxLog) {
          if (result && result.exitCode === 0) ctxLog("info", "[dsh-project-brain] auto-rebuild OK via shell: " + String(result.stdout || "").slice(0, 200));
          else ctxLog("warn", "[dsh-project-brain] auto-rebuild failed via shell code=" + (result && result.exitCode) + ": " + String((result && (result.stderr || result.stdout)) || "").slice(0, 200));
        }
      } catch (e) {
        if (ctxLog) ctxLog("warn", "[dsh-project-brain] shell.run failed: " + String((e && e.message) || e));
      }
    } else {
      // ctxShell 不可用 → 放弃自动 rebuild，让 v0.3.18 的工具层同步 rebuild 兜底
      if (ctxLog) ctxLog("warn", "[dsh-project-brain] ctxShell unavailable, skip auto-rebuild (tools.js has sync rebuild fallback)");
    }
    if (pending) {
      pending = false;
      setTimeout(() => runBuild(), 100);
    }
  } finally {
    rebuilding = false;
  }
}

let ctxLog = null;
let ctxShell = null;
let rebuiltCb = null;
// v0.3.14：上次 mtime 快照（path -> mtimeMs）；轮询对比触发 rebuild
let lastMtimeSnapshot = new Map();
// v0.3.14：上次扫描到的 watch 路径集合（来自 sessions / workspaceRegistry 探测）
let watchedPaths = [];
// v0.3.14：ctx.timer interval 的 disposer
let timerDisposer = null;

// v0.3.14：拿 fs adapter（DSH fs service，不走 node:fs；sandbox 友好）
function getFs(ctx) {
  try {
    if (ctx && typeof ctx.get === "function") {
      const f = ctx.get("fs");
      if (f && typeof f.stat === "function") return f;
    }
  } catch (e) {}
  return null;
}

// v0.3.14：探测用户当前 workspace 的路径（不依赖 sessionCwd；用 sandboxPolicy.workspaceRoot + agents/sessions）
//   单 workspace MVP：取 sandboxPolicy.workspaceRoot（v0.3.8 已过滤 DSH Desktop 安装路径）
//   多 workspace MVP：扩展时再考虑 workspaceRegistry.list()，但当前大多数场景单 workspace 足够
function resolveWatchPaths(ctx, sandboxPolicy) {
  const out = new Set();
  // 1) sandboxPolicy.workspaceRoot（v0.3.8 已 safeCwd 过滤 DSH Desktop）
  try {
    if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === "string" && sandboxPolicy.workspaceRoot.trim()) {
      out.add(sandboxPolicy.workspaceRoot);
    }
  } catch (e) {}
  // 2) workspaceRegistry.list()（DSH 注册的所有 workspace）
  try {
    const wr = ctx && typeof ctx.get === "function" ? ctx.get("workspaceRegistry") : null;
    if (wr && typeof wr.list === "function") {
      const list = wr.list() || [];
      for (const w of list) {
        if (w && typeof w.path === "string" && w.path.trim()) out.add(w.path);
      }
    }
  } catch (e) {}
  // 3) sessions.list()：拿所有 session 的 cwd（DSH 已知活跃 session）
  try {
    const sessions = ctx && typeof ctx.get === "function" ? ctx.get("sessions") : null;
    if (sessions && typeof sessions.list === "function") {
      const list = sessions.list() || [];
      for (const s of list) {
        const cwd = s && (s.cwd || (s.meta && s.meta.cwd));
        if (typeof cwd === "string" && cwd.trim()) out.add(cwd);
      }
    }
  } catch (e) {}
  // 4) agents.currentInitiator()（当前发起 agent 的 session cwd）
  try {
    const agents = ctx && typeof ctx.get === "function" ? ctx.get("agents") : null;
    if (agents && typeof agents.currentInitiator === "function") {
      const a = agents.currentInitiator();
      if (a && a.session) {
        const cwd = a.session.cwd || (a.session.meta && a.session.meta.cwd);
        if (typeof cwd === "string" && cwd.trim()) out.add(cwd);
      }
    }
  } catch (e) {}
  // 过滤 DSH Desktop 安装路径
  return Array.from(out).filter((p) => {
    if (!p) return false;
    if (/[\\/]Programs[\\/]DSH Desktop$/i.test(p)) return false;
    if (/[\\/]DSH Desktop\.app/.test(p)) return false;
    return true;
  });
}

// v0.3.14：用 DSH fs.stat 读一个文件的 mtime（毫秒）；失败返回 0
async function statMtimeMs(fs, path) {
  try {
    if (!fs || typeof fs.stat !== "function") return 0;
    const target = await fs.resolve(path);
    const info = await fs.stat(target);
    if (!info) return 0;
    // FsInfo 通常有 mtimeMs / mtime（Date）；兼容两种
    if (typeof info.mtimeMs === "number") return info.mtimeMs;
    if (info.mtime instanceof Date) return info.mtime.getTime();
    return 0;
  } catch (e) {
    return 0;
  }
}

// v0.3.14：扫一遍所有 watch 路径的 .project-brain/* 文件 mtime，任意变化就 rebuild
async function pollMtime() {
  const fs = getFs(currentCtx);
  if (!fs) return;  // fs 不可用就跳过（不阻塞 host）

  // 1) 探测当前 watch 路径集（可能新增 workspace）
  const paths = resolveWatchPaths(currentCtx, currentSandbox);
  // 路径集变化时也清掉 snapshot 中消失的项
  const pathKey = paths.join("|");
  const prevPathKey = watchedPaths.join("|");
  if (pathKey !== prevPathKey) {
    if (ctxLog) ctxLog("info", "[dsh-project-brain] watch paths changed: " + paths.length + " workspace(s)");
    watchedPaths = paths;
    // 新增路径初始化 mtime snapshot（立即触发一次 rebuild，让新 workspace 首次出现时 sidebar 显示）
    const newSnapshot = new Map();
    for (const ws of paths) {
      for (const f of WATCH_FILES) {
        const p = join(ws, ".project-brain", f);
        newSnapshot.set(p, await statMtimeMs(fs, p));
      }
    }
    lastMtimeSnapshot = newSnapshot;
    scheduleRebuild("paths changed");
    return;
  }

  // 2) 比对 mtime
  let changed = false;
  for (const ws of paths) {
    for (const f of WATCH_FILES) {
      const p = join(ws, ".project-brain", f);
      const cur = await statMtimeMs(fs, p);
      const prev = lastMtimeSnapshot.get(p) || 0;
      if (cur !== prev && cur > 0) {
        if (ctxLog) ctxLog("info", "[dsh-project-brain] mtime change detected: " + p + " (" + prev + " -> " + cur + ")");
        lastMtimeSnapshot.set(p, cur);
        changed = true;
      } else if (cur > 0 && prev === 0) {
        // 新出现的文件（之前 mtime=0，现在有 mtime）
        lastMtimeSnapshot.set(p, cur);
        changed = true;
      }
    }
  }
  if (changed) scheduleRebuild("mtime change");
}

// v0.3.14：调度 rebuild（带 debounce；防止连续 poll 多次触发）
let scheduleTimer = null;
function scheduleRebuild(reason) {
  if (scheduleTimer) return;  // 已经调度过，等下次 debounce 触发
  if (ctxLog) ctxLog("info", "[dsh-project-brain] rebuild scheduled (" + reason + ")");
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    runBuild().then(() => { if (rebuiltCb) rebuiltCb(); });
  }, 100);
}

let currentCtx = null;
let currentSandbox = null;

// v0.3.17：彻底脱离 Cordis 抽象（v0.3.14-v0.3.16 连续三次失败）
//   改用 child_process.spawn 启动独立 watcher 子进程跑 rebuild-watcher.mjs
//   完全脱离 ctx.timer / ctx.effect / ctx.on / ctx.logger（所有 silent failure 都被吃）
//   （spawn 已从顶部 import）

let watcherProc = null;  // 当前 spawn 的 watcher 子进程
let watcherDisposer = null;

function tryStartWatcherSubprocess(workspacePaths) {
  if (watcherProc && !watcherProc.killed) {
    return watcherProc;
  }
  // The packaged watcher is emitted beside this module; the source watcher
  // is also beside the source module.
  const scriptPath = existsSync(join(__dirname, "rebuild-watcher.mjs"))
    ? join(__dirname, "rebuild-watcher.mjs")
    : join(__dirname, "host", "rebuild-watcher.mjs");
  if (!existsSync(scriptPath)) {
    if (ctxLog) ctxLog("warn", "[dsh-project-brain] rebuild-watcher.mjs not found: " + scriptPath);
    return null;
  }
  // 准备 argv：node <script> --workspace=<p1> --workspace=<p2> ...
  const args = [scriptPath];
  for (const p of workspacePaths) {
    if (typeof p === "string" && p.trim()) args.push("--workspace=" + p);
  }
  // 优先用 DSH shell service 跑（sandbox 友好）；fallback 用 child_process.spawn
  let proc = null;
  if (ctxShell && typeof ctxShell.start === "function") {
    // shell.start 异步返回 ShellProcess，不适合作为 watcher 常驻
    // fallback 到 spawn
  }
  try {
    proc = spawn(process.execPath, args, {
      cwd: PLUGIN_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: false,
    });
    if (ctxLog) ctxLog("info", "[dsh-project-brain] watcher subprocess spawned: pid=" + (proc.pid || "?") + " script=" + scriptPath);
    proc.stdout && proc.stdout.on("data", (d) => {
      try { process.stdout.write("[watcher.stdout] " + d.toString()); } catch (e) {}
    });
    proc.stderr && proc.stderr.on("data", (d) => {
      try { process.stderr.write("[watcher.stderr] " + d.toString()); } catch (e) {}
    });
    proc.on("exit", (code, signal) => {
      if (ctxLog) ctxLog("warn", "[dsh-project-brain] watcher subprocess exited code=" + code + " signal=" + signal);
      watcherProc = null;
    });
    proc.on("error", (err) => {
      if (ctxLog) ctxLog("warn", "[dsh-project-brain] watcher subprocess spawn error: " + String((err && err.message) || err));
      watcherProc = null;
    });
    watcherProc = proc;
    return proc;
  } catch (e) {
    if (ctxLog) ctxLog("warn", "[dsh-project-brain] spawn watcher subprocess failed: " + String((e && e.message) || e));
    return null;
  }
}

function stopWatcherSubprocess() {
  if (watcherProc && !watcherProc.killed) {
    try {
      watcherProc.kill("SIGTERM");
      if (ctxLog) ctxLog("info", "[dsh-project-brain] watcher subprocess SIGTERM sent");
    } catch (e) {}
    watcherProc = null;
  }
}

export function setupAutoRebuild(ctx, fs, sandboxPolicy) {
  if (!ctx) return;
  currentCtx = ctx;
  currentSandbox = sandboxPolicy;
  // v0.3.6：探测 shell service（DSH 提供，sandbox 友好）
  try { ctxShell = ctx.get ? ctx.get("shell") : ctx.shell; } catch (e) { ctxShell = null; }
  ctxLog = (level, msg) => {
    try { if (ctx.logger && typeof ctx.logger[level] === "function") ctx.logger[level]("[dsh-project-brain] " + msg); } catch (e) {}
  };
  rebuiltCb = async () => {
    // 计算 client bundle 的 hash（dsh-project-brain/lib/client.js），用于 clientModules.rebuilt
    try {
      const clientPath = join(PLUGIN_DIR, "dsh-project-brain", "lib", "client.js");
      if (existsSync(clientPath) && ctx.clientModules && typeof ctx.clientModules.rebuilt === "function") {
        const buf = readFileSync(clientPath);
        const hash = createHash("sha256").update(buf).digest("hex").slice(0, 12);
        const newRev = hash;
        const got = ctxModulesRebuilt(ctx, "dsh-project-brain", newRev);
        if (ctxLog) ctxLog("info", "[dsh-project-brain] clientModules.rebuilt('dsh-project-brain', " + newRev + ") => " + (got || "(none)"));
      }
    } catch (e) {
      if (ctxLog) ctxLog("warn", "[dsh-project-brain] clientModules.rebuilt failed: " + String((e && e.message) || e));
    }
  };

  // ───── v0.5.1 紧急修复：撤回 spawn watcher 子进程（v0.3.17）─────
  //   v0.3.17 的 spawn 独立 watcher 子进程（src/host/rebuild-watcher.mjs）是导致
  //   DSH Desktop "自动退出"的根因：
  //   1) DSH Desktop 关闭时主进程 stdout pipe 关闭
  //   2) watcher 子进程的 stdout pipe 跟主进程关联（stdio: ["ignore", "pipe", "pipe"]）
  //   3) 子进程持续往自己的 stdout 写日志 → 触发主进程的 stdout EPIPE → IPC 链异常
  //   4) 主进程 Electron 检测到 spawn child pipe 异常 → 主动退出整个 DSH
  //
  //   修复：完全删除 spawn watcher 子进程。所有 rebuild 触发改为：
  //   - v0.3.18 已有的"工具层同步 rebuild"（tools.js / tools/*.js 写完 jsonl 后立即
  //     sync execFileSync('node', ['build.js'])）—— 已知在 DSH sandbox 下能跑
  //   - 手动 `node build.js` —— 用户主动 build，1 秒完成，client bundle 自动热重载
  //
  //   接受"DSH Desktop 不再主动 spawn 任何后台进程"作为 v0.5.1 长期架构约束。
  if (ctxLog) ctxLog("info", "[dsh-project-brain] v0.5.1: host bundle does NOT spawn watcher subprocess (was causing DSH auto-quit)");

  // ───── 兜底：v0.3.4 旧路径 ctx.on("preview.changed") ─────
  //   自定义事件名跨 fiber 可能不通，但保留以防 DSH 未来支持
  if (ctx.on) {
    try {
      ctx.on("project_brain/preview.changed", () => {
        if (ctxLog) ctxLog("info", "[dsh-project-brain] preview.changed received (fallback), scheduling rebuild");
        runBuild().then(() => { if (rebuiltCb) rebuiltCb(); });
      });
    } catch (e) {}
  }
}

// v0.3.14：ctx.clientModules.rebuilt 可能在不同 fiber（更稳的探测）
function ctxModulesRebuilt(ctx, id, rev) {
  try {
    if (ctx.clientModules && typeof ctx.clientModules.rebuilt === "function") {
      return ctx.clientModules.rebuilt(id, rev);
    }
  } catch (e) {}
  return null;
}
