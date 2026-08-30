// Dream commit 端到端测试（v0.3.12）
//
// 不直接 import dream.js（依赖 @deepseek-ai/dsh-tools runtime，DSH profile 链接里有，裸 node 没有）。
// 改测 brain-logic 的纯函数 computeDreamActions + applyDreamCommit，再模拟 IO 验证 commit 效果。
//
// 覆盖：
//   1) computeDreamActions 正确识别合并候选（3 条近似 title → 1 个 merge 组）
//   2) computeDreamActions 正确识别归档候选（importance < 0.15 + > 30 天）
//   3) applyDreamCommit 移除 dropped 记录
//   4) applyDreamCommit 给 keep 加 status=reinforced + importance +0.05
//   5) applyDreamCommit 把 status=archived 加到归档候选
//   6) 不动的 memory 保持原样
//
// 退出码：0 = PASS，1 = FAIL

import { computeDreamActions, applyDreamCommit } from "../src/host/store/brain-logic.js";

const now = Date.now();
const old = now - 60 * 86400000;  // 60 天前

const fixtures = [
  // 3 条 title：1 完全相同的应被合并；2 条完全相同 + 1 条加尾部（边缘 case：jaccard < 0.92 不合）
  //   为了让 m3 也被合并，3 条用完全相同的 title
  { id: "mem-m1", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "webServer live fetch 在 static plugin fiber 下不可用，详细分析见 SPEC §20 v0.3.4 changelog。", importance: 0.7, createdAt: now - 86400000 },
  { id: "mem-m2", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "同样原因", importance: 0.5, createdAt: now - 86400000 },
  { id: "mem-m3", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "webServer live fetch 在 static fiber 下不可用", importance: 0.6, createdAt: now - 86400000 },
  // 2 条旧 + 低 importance（应归档）
  { id: "mem-a1", type: "context", title: "临时调试笔记", content: "不重要", importance: 0.05, createdAt: old, status: "new" },
  { id: "mem-a2", type: "context", title: "另一个旧笔记", content: "也不重要", importance: 0.10, createdAt: old, status: "new" },
  // 1 条高 importance 新（不动）
  { id: "mem-h1", type: "lesson", title: "DSH host bundle 不会自动热重载", content: "必须重启 DSH", importance: 0.85, createdAt: now - 7 * 86400000 },
];

const computed = computeDreamActions(fixtures, { now, mergeThreshold: 0.92, archiveImportance: 0.15, archiveAgeDays: 30 });

let pass = 0;
let fail = 0;
const check = (name, ok) => { if (ok) { console.log(`  [PASS] ${name}`); pass++; } else { console.log(`  [FAIL] ${name}`); fail++; } };

console.log("=== step 1: computeDreamActions ===");
console.log("mergeCount:", computed.mergeCount);
console.log("archiveCount:", computed.archiveCount);
// 标题几乎完全一致：3 条都应进同一个 group
check("mergeCount == 1（3 条近似 title）", computed.mergeCount === 1);
check("archiveCount == 2", computed.archiveCount === 2);

const mergeAction = computed.plannedActions.find((a) => a.action === "merge");
check("merge.keepId 存在且为 mem-m1（importance 最高）", mergeAction && mergeAction.keepId === "mem-m1");
const dropSet = new Set(mergeAction ? mergeAction.dropIds : []);
check("merge.dropIds 含 mem-m2", dropSet.has("mem-m2"));
check("merge.dropIds 含 mem-m3", dropSet.has("mem-m3"));

const archiveIds = computed.plannedActions.filter((a) => a.action === "archive_candidate").map((a) => a.id).sort();
check("archive 候选是 mem-a1 + mem-a2", JSON.stringify(archiveIds) === JSON.stringify(["mem-a1", "mem-a2"]));

console.log("\n=== step 2: applyDreamCommit ===");
const next = applyDreamCommit(fixtures, computed.plannedActions, now);
console.log("before:", fixtures.length, "after:", next.length);

const ids = new Set(next.map((m) => m.id));
check("mem-m2 已移除", !ids.has("mem-m2"));
check("mem-m3 已移除", !ids.has("mem-m3"));
check("mem-m1 保留", ids.has("mem-m1"));
check("mem-a1 保留（archived 但不删）", ids.has("mem-a1"));
check("mem-a2 保留（archived 但不删）", ids.has("mem-a2"));
check("mem-h1 保留（高 importance 不动）", ids.has("mem-h1"));
check("next.length == 4（6 - 2 dropped）", next.length === 4);

const m1 = next.find((m) => m.id === "mem-m1");
check("mem-m1.status == 'reinforced'", m1 && m1.status === "reinforced");
check("mem-m1.importance == 0.75（原 0.7 + 0.05）", m1 && Math.abs(m1.importance - 0.75) < 1e-9);
check("mem-m1.relatedMemoryIds 含 mem-m2 + mem-m3", m1 && m1.relatedMemoryIds && m1.relatedMemoryIds.includes("mem-m2") && m1.relatedMemoryIds.includes("mem-m3"));
check("mem-m1.lastAccessedAt == now", m1 && m1.lastAccessedAt === now);

const a1 = next.find((m) => m.id === "mem-a1");
check("mem-a1.status == 'archived'", a1 && a1.status === "archived");
check("mem-a1.lastAccessedAt == now", a1 && a1.lastAccessedAt === now);

const h1 = next.find((m) => m.id === "mem-h1");
check("mem-h1.status 未改（无 archived/reinforced）", h1 && (!h1.status || h1.status === "new"));
check("mem-h1.importance 不变（0.85）", h1 && h1.importance === 0.85);
check("mem-h1.lastAccessedAt 未改（不存在）", h1 && h1.lastAccessedAt === undefined);

console.log("\n=== step 3: edge cases ===");
// 边界：空 memory 列表
const emptyComputed = computeDreamActions([], { now });
check("empty memory -> mergeCount=0 archiveCount=0", emptyComputed.mergeCount === 0 && emptyComputed.archiveCount === 0);

// 边界：已 archived 的低 importance 记忆不重复标记
const alreadyArchived = [{ id: "x", type: "context", title: "old", importance: 0.05, createdAt: old, status: "archived" }];
const archivedComputed = computeDreamActions(alreadyArchived, { now });
check("已 archived 的低 importance 不再被列为归档候选", archivedComputed.archiveCount === 0);

// 边界：跨类型不合并
const crossType = [
  { id: "a", type: "decision", title: "build-time embed", importance: 0.7, createdAt: now },
  { id: "b", type: "lesson", title: "build-time embed", importance: 0.7, createdAt: now },
];
const crossTypeComputed = computeDreamActions(crossType, { now });
check("跨类型 title 相似也不合并", crossTypeComputed.mergeCount === 0);

console.log("\n=== step 4: full mode ===");
// 准备 fixture：含 1 条已经被 light 标 archived 的 memory，验证 full mode 是否真删它
const afterLight = applyDreamCommit(fixtures, computed.plannedActions, now, "light");
console.log("after light:", afterLight.length, "rows (含 archived 行)");
check("light 模式保留 archived 行（不删）", afterLight.length === 4 && afterLight.find((m) => m.id === "mem-a1"));

const afterFull = applyDreamCommit(fixtures, computed.plannedActions, now, "full");
console.log("after full:", afterFull.length, "rows (archived 行已清理)");
// fixtures: 6 -> merged 2 dropped -> 4 -> full 清掉 2 archived -> 2 (m1 + h1)
check("full 模式 archived 行被清理（4 -> 2）", afterFull.length === 2);
check("full 模式 mem-m1 保留", afterFull.find((m) => m.id === "mem-m1"));
check("full 模式 mem-a1 不在", !afterFull.find((m) => m.id === "mem-a1"));
check("full 模式 mem-h1 保留", afterFull.find((m) => m.id === "mem-h1"));

// full 模式：按 importance DESC 排序（h1=0.85 应在最前，m1=0.75 第二）
check("full 模式按 importance 排序：mem-h1 在 [0]", afterFull[0].id === "mem-h1");
check("full 模式按 importance 排序：mem-m1 在 [1]", afterFull[1] && afterFull[1].id === "mem-m1");

// mode 参数不传：默认 light（保留 archived）
const noMode = applyDreamCommit(fixtures, computed.plannedActions, now);
check("applyDreamCommit 不传 mode → 默认 light（保留 archived）", noMode.length === 4);

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);