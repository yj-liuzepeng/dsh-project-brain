// rebuild-sync.js - v0.3.18 工具层同步 rebuild
//
// 目的：放弃 host bundle "被动监听" 模式（v0.3.4-v0.3.17 连续 5 次失败），
//      改为工具层 "主动触发" — 工具写完 jsonl 后立即同步 execFileSync('node', ['build.js'])。
//
// 已知能跑：v0.3.6 已验证 child_process.execFileSync 在 DSH host bundle 里能跑（summarizer 走 shell service 跑 git diff 同源机制）。
//
// 不依赖：
// - dsh-tools（让多个工具文件都能 import）
// - ctx.timer / ctx.effect / ctx.on（避免再次 silent failure）
// - 子进程 / spawn（不再依赖 host fiber 行为）
//
// 失败处理：所有 catch 都吞（不能因为 rebuild 失败影响工具本身的返回值）。

import { execFileSync } from "node:child_process";
import { existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_DIR = join(__dirname, "..", "..");  // src/host/..→src/..→plugins/
const BUILD_SCRIPT = join(PLUGIN_DIR, "build.js");
const SKIP_FILE = join(PLUGIN_DIR, ".project-brain", ".dsh-project-brain-skip-sync");
const LOG_FILE = join(PLUGIN_DIR, ".project-brain", ".dsh-project-brain-sync.log");

// v0.3.18：写文件 log（绕过 DSH Desktop 黑盒调试）
function log(level, msg) {
  try {
    appendFileSync(LOG_FILE, "[" + new Date().toISOString() + "] [" + level + "] " + msg + "\n", "utf8");
  } catch (e) {
    try { process.stderr.write("[dsh-project-brain:sync] " + msg + "\n"); } catch (e2) {}
  }
}

// v0.3.18：备用 log 路径 — 如果 PLUGIN_DIR/.project-brain/ 写不了，写到 process.cwd()/.project-brain/ 或用户 HOME
const FALLBACK_LOG_PATHS = [
  LOG_FILE,
  join(process.cwd(), ".dsh-project-brain-sync.log"),
  join(process.env.USERPROFILE || process.env.HOME || ".", ".dsh-project-brain-sync.log"),
];
function logFallback(level, msg) {
  // 多路径尝试，找到第一个能写的
  for (const p of FALLBACK_LOG_PATHS) {
    try {
      appendFileSync(p, "[" + new Date().toISOString() + "] [" + level + "] " + msg + "\n", "utf8");
      return p;
    } catch (e) {}
  }
  return null;
}

// 是否启用（默认启用；可通过 .dsh-project-brain-skip-sync 文件临时关闭）
function isEnabled() {
  try {
    return !existsSync(SKIP_FILE);
  } catch (e) {
    return true;
  }
}

// 同步 rebuild（吞所有错误）
// reason: 简短描述写入 stderr（DSH Desktop 可能不可见，但 stdout 至少能透传）
let rebuildCount = 0;
let lastError = null;

export function runSyncRebuild(reason) {
  // 多路径 log 写入（绕开 sandbox 拦截）
  const fallbackLogWrittenTo = logFallback("info", "runSyncRebuild called: reason=" + reason + " enabled=" + isEnabled() + " PLUGIN_DIR=" + PLUGIN_DIR + " BUILD_SCRIPT=" + BUILD_SCRIPT + " process.cwd=" + process.cwd());
  log("info", "fallback log written to: " + fallbackLogWrittenTo);
  if (!isEnabled()) return;
  rebuildCount += 1;
  const t0 = Date.now();
  try {
    const stdout = execFileSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PLUGIN_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
      windowsHide: true,
    });
    const elapsed = Date.now() - t0;
    const out = String(stdout || "").slice(0, 200).replace(/\n/g, " ");
    log("info", "rebuild #" + rebuildCount + " (" + reason + ") OK in " + elapsed + "ms | " + out);
    logFallback("info", "rebuild #" + rebuildCount + " (" + reason + ") OK in " + elapsed + "ms | " + out);
    try { process.stderr.write("[dsh-project-brain] sync rebuild #" + rebuildCount + " (" + reason + ") OK in " + elapsed + "ms\n"); } catch (e) {}
  } catch (e) {
    const elapsed = Date.now() - t0;
    const errMsg = String((e && e.message) || e).slice(0, 500);
    lastError = errMsg;
    log("error", "rebuild #" + rebuildCount + " (" + reason + ") FAILED in " + elapsed + "ms: " + errMsg);
    logFallback("error", "rebuild #" + rebuildCount + " (" + reason + ") FAILED in " + elapsed + "ms: " + errMsg + " | stderr=" + String((e && e.stderr) || "").slice(0, 300) + " | stdout=" + String((e && e.stdout) || "").slice(0, 300));
    try { process.stderr.write("[dsh-project-brain] sync rebuild #" + rebuildCount + " (" + reason + ") FAILED: " + errMsg + "\n"); } catch (e2) {}
  }
}

// 诊断接口（让 agent / 用户能查询 rebuild 状态）
export function getSyncRebuildStats() {
  return { rebuildCount, lastError };
}