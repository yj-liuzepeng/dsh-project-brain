import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attachFamiliarity } from "../src/host/sidebar/aggregator.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "src", "client.js");
const BUNDLE = join(ROOT, "dsh-project-brain", "lib", "client.js");

const src = readFileSync(CLIENT, "utf8");
assert.match(src, /"data-block":\s*"briefing"/);
assert.match(src, /"data-block":\s*"session-graph"/);
assert.match(src, /"data-graph-kind"/);
assert.match(src, /node\.detail/);
assert.match(src, /"data-graph-detail"/, "展开区正文要能完整滚动查看，不能被视觉截断");
assert.match(src, /b\.recentWorkAt/, "第一屏必须显示近况的时间");
assert.match(src, /b\.recentWorkStale/, "过旧的近况要标注");
assert.ok(src.includes("briefing.recent.outdated"));
assert.ok(src.includes("briefing.what"));
assert.ok(src.includes("briefing.recent"));
assert.ok(!src.includes("briefing.stuck"));
assert.ok(src.includes("graph.expandAll"));

const data = { initialized: true };
attachFamiliarity(data, {
  project: { name: "demo", architectureStale: true, entrypoints: ["src/index.js"] },
  architecture: { overview: { purpose: "Persistent project brain" }, keyFiles: [{ path: "src/host/injector.js" }] },
  timeline: [{ eventType: "session_summary", sessionId: "s1", summary: "Chose RPC over embed.", occurredAt: 2 }],
  memories: [],
  todos: [{ id: "t1", title: "Fix inject", status: "in_progress", priority: "high" }],
});
assert.equal(data.briefing.stale, true);
assert.equal(data.briefing.purpose, "Persistent project brain");
assert.match(data.briefing.recentWork, /RPC/);
assert.ok(data.briefing.startHere.includes("src/index.js"));
assert.ok(!data.briefing.startHere.includes("src/host/injector.js"));
assert.equal(data.sessionGraph.nodes.length, 1);
assert.match(data.sessionGraph.nodes[0].label, /RPC/);

if (existsSync(BUNDLE)) {
  const bundle = readFileSync(BUNDLE, "utf8");
  assert.ok(bundle.includes('"data-block"') && bundle.includes("briefing"));
  assert.ok(bundle.includes("session-graph"));
  assert.ok(bundle.includes("data-graph-kind"));
}

console.log("smoke-familiarity-client: PASS");
