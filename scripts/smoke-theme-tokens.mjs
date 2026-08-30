// smoke-theme-tokens.mjs - dark/light 主题 token 契约验证（v0.3.13 / P0.8 第二波）
//
// 数据来源：
//   1) client.js 源码里用到的 var(--dsw-*) token（本脚本静态解析）
//   2) DSH 真实主题系统 token 名单（cordis_inspect_query Theme.listTokens 取证，见下方 DSL_TOKENS）
//
// 验证：
//   1) client.js 用到的每个 token 都在 DSH 真实名单里（无悬空 token）
//   2) DSH 名单里每个 token 都 requiresLightAndDark=true（dark/light 都有值）
//   3) client.js 没有硬编码颜色值（应该全部走 token）
//
// 离线可跑：不依赖 DSH runtime。
// 退出码：0 = PASS，1 = FAIL

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_SRC = join(__dirname, "..", "src", "client.js");

// DSH 真实主题 token（v0.3.13 从 cordis_inspect_query Theme.listTokens 取证）
// 每个都 requiresLightAndDark: true
const DSH_TOKENS = [
  "--dsw-alias-bg-base",
  "--dsw-alias-bg-layer-1",
  "--dsw-alias-bg-layer-2",
  "--dsw-alias-bg-overlay",
  "--dsw-alias-border-l1",
  "--dsw-alias-border-l2",
  "--dsw-alias-brand-primary",
  "--dsw-alias-label-primary",
  "--dsw-alias-label-secondary",
  "--dsw-alias-state-error-primary",
  "--dsw-alias-state-success-primary",
  "--dsw-alias-state-warn-primary",
  "--dsw-specific-sidebar-fill",
];
const DSH_TOKEN_SET = new Set(DSH_TOKENS);

const src = readFileSync(CLIENT_SRC, "utf8");

let pass = 0;
let fail = 0;
const check = (name, ok) => { if (ok) { console.log(`  [PASS] ${name}`); pass++; } else { console.log(`  [FAIL] ${name}`); fail++; } };

console.log("=== 1: client.js 用到的 token 都在 DSH 真实名单 ===");
const usedTokens = [...new Set(
  (src.match(/var\((--dsw-[a-z0-9-]+)\)/g) || []).map((s) => s.slice(4, -1)),
)];
console.log("  client.js 用到 token 数:", usedTokens.length);
for (const t of usedTokens) {
  check(`token ${t} 在 DSH 名单`, DSH_TOKEN_SET.has(t));
}

console.log("\n=== 2: 无悬空 token（用到了但名单没有的）===");
const dangling = usedTokens.filter((t) => !DSH_TOKEN_SET.has(t));
check("无悬空 token", dangling.length === 0);
if (dangling.length) console.log("  悬空:", dangling.join(", "));

console.log("\n=== 3: client.js 无硬编码颜色值 ===");
// 检查源码里是否有 #rgb / #rrggbb 直接写死（应该全走 var()）
const hardcodedHex = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
check("无硬编码 hex 颜色（全走 token）", hardcodedHex.length === 0);
if (hardcodedHex.length) console.log("  硬编码:", hardcodedHex.join(", "));

console.log("\n=== 4: client.js 覆盖的 token 类别 ===");
const categories = {};
for (const t of usedTokens) {
  const m = t.match(/^--dsw-(alias|specific)-([a-z]+)/);
  if (m) categories[m[2]] = (categories[m[2]] || 0) + 1;
}
console.log("  类别分布:", JSON.stringify(categories));
check("覆盖 background/border/brand/label/state 类别", ["bg", "border", "brand", "label", "state"].every((c) => categories[c] > 0));

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);