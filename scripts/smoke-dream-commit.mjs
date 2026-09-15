// Dream / housekeep：禁止 Jaccard merge-and-drop；changelog 归档但保留行；超额 Core → dormant。

import { housekeepMemories } from "../src/host/memory/admit.js";
import { isCoreMemory, makeMemoryEntry } from "../src/host/store/brain-logic.js";

const now = Date.now();
const old = now - 60 * 86400000;

let pass = 0;
let fail = 0;
const check = (name, ok) => { if (ok) { console.log(`  [PASS] ${name}`); pass++; } else { console.log(`  [FAIL] ${name}`); fail++; } };

const similar = [
  makeMemoryEntry({ id: "mem-m1", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "webServer live fetch 在 static plugin fiber 下不可用，详细分析见设计文档。", importance: 0.7 }, now - 86400000),
  makeMemoryEntry({ id: "mem-m2", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "同样的长期架构约束，第二条正文也足够长以通过规则门。", importance: 0.5 }, now - 86400000),
  makeMemoryEntry({ id: "mem-m3", type: "decision", title: "采用 build-time embed 走静态 client 架构", content: "第三条仍然是同一条架构决策的重复表述，自动路径不得删除。", importance: 0.6 }, now - 86400000),
];
const changelog = makeMemoryEntry({
  id: "mem-c1", type: "change",
  title: "v1.2.0 patch #3：同步仓库",
  content: "git 快进 main 并验收 156/156，这是 changelog 不是长期事实。",
}, now);
const durable = makeMemoryEntry({
  id: "mem-h1", type: "lesson",
  title: "DSH host bundle 不会自动热重载",
  content: "改 host 代码必须重启 DSH Desktop，不要指望热更新。",
  importance: 0.85,
}, now - 7 * 86400000);

console.log("=== similar titles are not deleted ===");
const similarHk = housekeepMemories(similar.concat([durable]), { now });
const similarIds = new Set(similarHk.rows.map((m) => m.id));
check("all similar rows kept", similarIds.has("mem-m1") && similarIds.has("mem-m2") && similarIds.has("mem-m3"));
check("no merge action applied", !(similarHk.actions || []).some((a) => a.action === "merge"));
check("similar titles reported as suggest_supersede", (similarHk.actions || []).some((a) => a.action === "suggest_supersede"));

console.log("=== changelog archived, row kept ===");
const ch = housekeepMemories([changelog, durable], { now });
const c1 = ch.rows.find((m) => m.id === "mem-c1");
check("changelog row still present", Boolean(c1));
check("changelog status archived", c1 && c1.status === "archived");
check("archiveReason backfill_rule", c1 && c1.archiveReason === "backfill_rule");
check("durable lesson stays core", isCoreMemory(ch.rows.find((m) => m.id === "mem-h1")));

console.log("=== cap evicts excess active, never deletes ===");
const many = [];
for (let i = 0; i < 16; i++) {
  many.push(makeMemoryEntry({
    id: "mem-cap-" + i,
    type: "decision",
    title: "长期决策 " + i,
    content: "这是一条仍然成立的项目决策，用来撑满 Core 上限。编号 " + i,
    importance: i === 0 ? 0.2 : 0.8,
  }, now - (16 - i) * 86400000));
}
const capped = housekeepMemories(many, { now });
check("row count unchanged", capped.rows.length === 16);
check("some dormant", capped.rows.some((m) => m.status === "dormant"));
check("core <= 15", capped.rows.filter(isCoreMemory).length <= 15);
check("lowest importance evicted", capped.rows.find((m) => m.id === "mem-cap-0").status === "dormant");

console.log("=== no-op does not claim change ===");
const again = housekeepMemories(capped.rows, { now });
check("second housekeep unchanged", again.changed === false);

console.log("=== full mode must not vacuum archived ===");
const afterFull = housekeepMemories(ch.rows, { now });
check("archived changelog still on disk after housekeep", afterFull.rows.some((m) => m.id === "mem-c1" && m.status === "archived"));

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
