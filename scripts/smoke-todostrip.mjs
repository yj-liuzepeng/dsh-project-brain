// 离线验证 build 产物 lib/client.js 在 DSH 静态 client 框架下的 register 流程
// 不启 DSH，纯模拟 slots.register 注册两个 Slot，验证注册参数正确 + 返回值结构合理
//
// 用法：node scripts/smoke-todostrip.mjs
// 退出码：0 = PASS，1 = FAIL

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUNDLE = join(ROOT, "dsh-project-brain", "lib", "client.js");

if (!existsSync(BUNDLE)) {
  console.error("FAIL: bundle not found:", BUNDLE);
  console.error("      run `node build.js` first");
  process.exit(1);
}

const bundle = readFileSync(BUNDLE, "utf8");

const checks = [];

// 1) conversation.view 注册项存在
const viewMatch = bundle.match(/name:\s*"conversation\.view"[\s\S]{0,200}?id:\s*"project-brain"[\s\S]{0,200}?order:\s*35/);
checks.push({ name: "conversation.view / project-brain / order=35", ok: !!viewMatch });

// 2) conversation.input.dock 注册项存在 + id + order
const dockMatch = bundle.match(/name:\s*"conversation\.input\.dock"[\s\S]{0,200}?id:\s*"project-brain-todo-strip"[\s\S]{0,200}?order:\s*10/);
checks.push({ name: "conversation.input.dock / project-brain-todo-strip / order=10", ok: !!dockMatch });

// 3) TodoStrip 函数存在
const fnMatch = /function\s+TodoStrip\s*\(/.test(bundle);
checks.push({ name: "function TodoStrip(props) declared", ok: fnMatch });

// 4) i18n dict 中有 todostrip.* 关键文案
const i18nHits = [
  "todostrip.title",
  "todostrip.viewAll",
  "todostrip.close",
  "todostrip.empty",
].every((k) => bundle.includes(k));
checks.push({ name: "i18n dict has todostrip.title/viewAll/close/empty", ok: i18nHits });

// 5) 发布构建不得嵌入本机 Session；运行时必须走 Connection RPC。
const runtimeRpc = bundle.includes('"/project-brain"')
  && bundle.includes('"preview"')
  && bundle.includes('"init"');
const leakedSession = /"session-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"/.test(bundle);
checks.push({ name: "runtime Connection RPC present and release bundle contains no local session ids", ok: runtimeRpc && !leakedSession });

// 6) active filter（排除 done / cancelled）
const filterCode = bundle.includes('status !== "done"') && bundle.includes('status !== "cancelled"');
checks.push({ name: "active filter excludes done/cancelled", ok: filterCode });

// 7) toggle 按钮 onClick 存在
const onClickMatch = /onClick:\s*onToggle/.test(bundle);
checks.push({ name: "viewAll/close button onClick=onToggle wired", ok: onClickMatch });

// 8) data-todo-item 渲染属性
const dataAttr = bundle.includes('"data-todo-item"');
checks.push({ name: "data-todo-item attribute on todo rows", ok: dataAttr });

// 9) TODO strip empty-state: 当 active.length === 0 返回 null（已包含在 return null 段）
const emptyGuard = /if \(active\.length === 0\) return null/.test(bundle);
checks.push({ name: "empty-state guard (active.length === 0 return null)", ok: emptyGuard });

// 10) uninit guard（项目未初始化时整个 strip 不渲染）
const uninitGuard = /if \(!data \|\| !data\.initialized\) return null/.test(bundle);
checks.push({ name: "uninit guard (data.initialized === false return null)", ok: uninitGuard });

// 11) Dashboard Quick Actions 必须走后台 RPC，不能再复制 prompt。
const quickActionRpc = bundle.includes('"action"')
  && bundle.includes('action: "rescan"')
  && bundle.includes('action: "todos"')
  && bundle.includes('action: "dream"')
  && bundle.includes('action: "overview"');
checks.push({ name: "Dashboard Quick Actions call runtime action RPC", ok: quickActionRpc });

// 12) 卡片有 loading/confirm/success/error 状态与 spinner。
const quickActionStates = bundle.includes('status: "loading"')
  && bundle.includes('status: "confirm"')
  && bundle.includes('status: "success"')
  && bundle.includes('status: "error"')
  && bundle.includes('"data-action-state"');
checks.push({ name: "Quick Actions expose loading/confirm/success/error UI states", ok: quickActionStates });

// 13) 记忆整理先 dry-run，再由独立 dreamCommit 动作确认提交。
const dreamConfirmation = bundle.includes('action === "dreamCommit"')
  && bundle.includes('previous.status === "confirm"');
checks.push({ name: "memory organization requires preview then confirmation", ok: dreamConfirmation });

// 14) Dashboard 架构图使用语义分层，并可点击概念组件查看详情。
const architectureSvg = bundle.includes("function ArchitectureGraphBlock")
  && bundle.includes('"data-block": "architecture-graph"')
  && bundle.includes('"data-architecture-diagram": "semantic-layers"')
  && bundle.includes('"data-architecture-component"')
  && bundle.includes("setSelectedId(component.id)")
  && bundle.includes("architecture.keyFiles");
checks.push({ name: "interactive semantic-layer architecture report is bundled", ok: architectureSvg });

// 15) 架构图明确区分本地分析与当前 DSH LLM 增强结果。
checks.push({ name: "architecture source badges are bundled", ok: bundle.includes('"arch.hybrid"') && bundle.includes('"arch.local"') });

// 16) Dashboard 使用单一页签工作台，避免架构、任务、记忆在首页重复堆叠。
const dashboardTabs = bundle.includes('"data-dashboard-tab"')
  && bundle.includes('"dash.tab.overview"')
  && bundle.includes('"dash.tab.architecture"')
  && bundle.includes('"dash.tab.work"')
  && bundle.includes('"dash.tab.knowledge"')
  && bundle.includes('aria-selected');
checks.push({ name: "Dashboard single-workbench tabs and accessible selection state are bundled", ok: dashboardTabs });

// 17) 顶部摘要采用独立响应式容器，窄窗口下可自动单列。
const responsiveSummary = bundle.includes('"data-block": "summary-grid"')
  && bundle.includes(".dsh-brain-summary-grid")
  && bundle.includes("@media(max-width:760px)");
checks.push({ name: "responsive summary grid is bundled", ok: responsiveSummary });

let pass = 0;
let fail = 0;
console.log("=== dsh-project-brain TodoStrip smoke test ===");
console.log("(offline: build产物静态校验，不启 DSH)\n");
for (const c of checks) {
  if (c.ok) {
    console.log(`  [PASS] ${c.name}`);
    pass++;
  } else {
    console.log(`  [FAIL] ${c.name}`);
    fail++;
  }
}
console.log(`\n${pass} PASS / ${fail} FAIL (${checks.length} checks total)`);
console.log(`bundle: ${BUNDLE}`);
process.exit(fail === 0 ? 0 : 1);
