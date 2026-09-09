// scripts/dev-reload.mjs — 本地开发一键 reload
//
// 用途：改完 src/ 后跑一次，自动 build lib/ + 检查 DSH Desktop 进程 + 提示下一步。
// 不会自动重启 DSH Desktop（破坏用户会话，只提示用户手动重启）。
//
// 用法：
//   node scripts/dev-reload.mjs
//   或：npm run dev:reload

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");

console.log("[dev-reload] start\n");

// 1) npm run build
console.log("[dev-reload] step 1/3: building lib/ ...");
try {
  execFileSync(process.execPath, [join(PKG_ROOT, "build.js")], {
    cwd: PKG_ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
} catch (e) {
  console.error("[dev-reload] build FAILED:", e.message);
  process.exit(1);
}

// 2) 确认 bundle 产物存在
const hostBundle = join(PKG_ROOT, "dsh-project-brain", "lib", "index.js");
const clientBundle = join(PKG_ROOT, "dsh-project-brain", "lib", "client.js");
console.log("\n[dev-reload] step 2/3: verifying bundles ...");
if (!existsSync(hostBundle) || !existsSync(clientBundle)) {
  console.error(`[dev-reload] FAIL: missing bundle(s):
  ${existsSync(hostBundle) ? "✓" : "✗"} ${hostBundle}
  ${existsSync(clientBundle) ? "✓" : "✗"} ${clientBundle}`);
  process.exit(1);
}
const hostSize = (statSync(hostBundle).size / 1024).toFixed(1);
const clientSize = (statSync(clientBundle).size / 1024).toFixed(1);
console.log(`[dev-reload]   ✓ lib/index.js  ${hostSize}KB`);
console.log(`[dev-reload]   ✓ lib/client.js ${clientSize}KB`);

// 3) 检查 DSH Desktop 进程（仅检测，不重启）
console.log("\n[dev-reload] step 3/3: checking DSH Desktop processes ...");
let dshRunning = false;
try {
  const ps = execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-Process -Name 'DSH Desktop' -ErrorAction SilentlyContinue | Select-Object Id, StartTime | ConvertTo-Json -Compress",
  ], { encoding: "utf8" }).trim();
  if (ps && ps !== "null") {
    const procs = JSON.parse(ps);
    const list = Array.isArray(procs) ? procs : [procs];
    dshRunning = true;
    console.log(`[dev-reload]   ✓ DSH Desktop running (${list.length} process(es)):`);
    for (const p of list) console.log(`[dev-reload]     - PID ${p.Id}  started ${p.StartTime}`);
  }
} catch (e) {
  // ignore
}

if (!dshRunning) {
  console.log("[dev-reload]   ℹ DSH Desktop NOT running. 启动方式：");
  console.log("[dev-reload]     - 双击桌面 DSH Desktop 图标");
  console.log("[dev-reload]     - 或：C:\\Users\\liuzp16\\AppData\\Local\\Programs\\DSH Desktop\\DSH Desktop.exe");
}

console.log("\n[dev-reload] done.\n");
console.log("─────────────────────────────────────────────────────────────");
console.log("下一步操作：");
if (dshRunning) {
  console.log("  ⮕ 完全退出 DSH Desktop（右键托盘 → Quit，不要只关窗口）");
  console.log("  ⮕ 重新启动 DSH Desktop（cordis-loader 会重新加载 host bundle）");
} else {
  console.log("  ⮕ 启动 DSH Desktop");
}
console.log("  ⮕ 打开任意 workspace → 顶部「项目」Tab → 「启动项目大脑」");
console.log("  ⮕ 验证 4 个 Dashboard Tab（概览 / 架构 / 任务动态 / 项目记忆）");
console.log("  ⮕ 如果失败，DSH Desktop 终端窗口会输出 [dsh-project-brain] 日志");
console.log("─────────────────────────────────────────────────────────────");
