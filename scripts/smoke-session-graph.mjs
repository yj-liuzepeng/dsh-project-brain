import assert from "node:assert/strict";
import { buildSessionGraph } from "../src/host/memory/session-graph.js";

const empty = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "s0", summary: "  ", occurredAt: 1 }],
  todos: [],
  memories: [],
});
assert.equal(empty.nodes.length, 0);
assert.ok(empty.collapsedEmptyCount >= 1);

const talk = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "s1", summary: "We chose RPC over embed.", occurredAt: 2, files: [] }],
  todos: [],
  memories: [],
});
assert.equal(talk.nodes.length, 1);
assert.match(talk.nodes[0].label, /RPC/);
assert.equal(talk.edges.length, 0);

const g = buildSessionGraph({
  timeline: [
    { eventType: "session_summary", sessionId: "a", summary: "Added inject briefing.", occurredAt: 1, files: ["src/a.js"] },
    { eventType: "todo", sessionId: "a", todoId: "t1", occurredAt: 1 },
    { eventType: "session_summary", sessionId: "b", summary: "Finished inject briefing.", occurredAt: 2, files: ["src/b.js"] },
    { eventType: "todo", sessionId: "b", todoId: "t1", todoStatus: "done", occurredAt: 2 },
  ],
  todos: [{ id: "t1", status: "done" }],
  memories: [],
});
assert.equal(g.nodes.length, 2);
assert.ok(g.edges.some((e) => e.kind === "time"));
assert.ok(g.edges.some((e) => e.kind === "evidence" && e.reason === "todo"));

const chain = buildSessionGraph({
  timeline: [
    { eventType: "session_summary", sessionId: "a", summary: "One.", occurredAt: 1 },
    { eventType: "session_summary", sessionId: "b", summary: "Two.", occurredAt: 2 },
  ],
  todos: [],
  memories: [],
});
assert.ok(chain.edges.every((e) => e.kind === "time"));
assert.equal(chain.edges.length, 1);

const cl = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "c", summary: "改了 8 个文件", occurredAt: 1, files: ["src/x.js"] }],
  todos: [],
  memories: [],
});
assert.equal(cl.nodes[0].label, "代码有变更（无摘要）");

const hist = buildSessionGraph({
  timeline: [
    { id: "i", eventType: "init", occurredAt: 1 },
    { id: "r", eventType: "rescan", occurredAt: 2, detail: "architecture=hybrid" },
    { id: "m", eventType: "memory", occurredAt: 3, title: "新增记忆[decision]：路径以 session cwd 为准" },
    { id: "t-open", eventType: "todo", occurredAt: 4, title: "新增待办[todo-t1]：Fix inject" },
    { id: "t-done", eventType: "todo", occurredAt: 86_400_000 + 5, title: "完成待办[todo-t1]：Fix inject" },
  ],
  todos: [{ id: "todo-t1", status: "done" }],
  memories: [],
});
assert.ok(hist.nodes.length >= 2, "orphan timeline should still form a trunk");
assert.ok(!hist.nodes.some((n) => /重扫/.test(n.label || "")), "rescans are not trunk nodes");
assert.ok(hist.nodes.some((n) => /cwd|Fix inject/.test(n.label || "")));
assert.ok(hist.edges.some((e) => e.kind === "evidence" && e.reason === "todo"));

const nullSafe = buildSessionGraph({ timeline: [null], memories: [null], todos: [] });
assert.equal(nullSafe.nodes.length, 0);

const versions = buildSessionGraph({
  timeline: [
    { eventType: "memory", occurredAt: 1, title: "新增记忆[decision]：v0.4.13 补丁说明" },
    { eventType: "memory", occurredAt: 86_400_000 + 1, title: "新增记忆[decision]：记忆机制六大维度优化完善 (v0.4.13)" },
    { eventType: "session_summary", sessionId: "s-ver", occurredAt: 86_400_000 * 2, summary: "Shipped v0.4.13 injector fix.", files: ["src/host/injector.js"] },
  ],
  todos: [],
  memories: [],
});
assert.ok(!versions.nodes.some((n) => /v0\.$/.test(String(n.label || "").trim()) || String(n.label || "").trim() === "v0."), "version dots are not sentence breaks");
assert.ok(!versions.nodes.some((n) => /^\s*v?\d+(?:\.\d+)+\b/.test(String(n.label || ""))), "version-led patch titles stay off the trunk");
assert.ok(versions.nodes.some((n) => /记忆机制六大维度优化完善/.test(n.label || "") && /v0\.4\.13/.test(n.label || "")));
assert.ok(versions.nodes.some((n) => /Shipped v0\.4\.13 injector/.test(n.label || "")));

const twoSent = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "s-two", summary: "We chose RPC over embed. Keep session cwd.", occurredAt: 4 }],
  todos: [],
  memories: [],
});
assert.match(twoSent.nodes[0].label, /RPC/);
assert.match(twoSent.nodes[0].detail, /cwd/);
assert.notEqual(twoSent.nodes[0].detail, twoSent.nodes[0].label);

const memDup = buildSessionGraph({
  timeline: [{ eventType: "memory", occurredAt: 5, title: "新增记忆[decision]：记忆详情弹框 markdown 渲染 + 复制原文 (v1.2.0 patch)" }],
  todos: [],
  memories: [{
    type: "decision",
    status: "active",
    title: "记忆详情弹框 markdown 渲染 + 复制原文 (v1.2.0 patch)",
    content: "记忆详情弹框 markdown 渲染 + 复制原文 (v1.2.0 patch)",
    createdAt: 5,
    updatedAt: 5,
  }],
});
assert.match(memDup.nodes[0].label, /记忆详情弹框/);
assert.equal(String(memDup.nodes[0].detail || "").trim(), "");

const memBody = buildSessionGraph({
  timeline: [{ eventType: "memory", occurredAt: 6, title: "新增记忆[decision]：记忆详情弹框 markdown 渲染 + 复制原文 (v1.2.0 patch)" }],
  todos: [],
  memories: [{
    type: "decision",
    status: "active",
    title: "记忆详情弹框 markdown 渲染 + 复制原文 (v1.2.0 patch)",
    content: "弹框用轻量 markdown 渲染正文，复制按钮只复制原始 markdown。",
    createdAt: 6,
    updatedAt: 6,
  }],
});
assert.match(memBody.nodes[0].label, /记忆详情弹框/);
assert.match(memBody.nodes[0].detail, /轻量 markdown/);
assert.notEqual(memBody.nodes[0].detail, memBody.nodes[0].label);

// 版本号开头的「补丁记忆」要挡，但以编号开头的正常标题不能误杀
const numbered = buildSessionGraph({
  timeline: [
    { eventType: "memory", occurredAt: 7, title: "新增记忆[decision]：2.0 版本规划：拆出独立注入层" },
    { eventType: "memory", occurredAt: 86_400_000 + 7, title: "新增记忆[decision]：v1.2.0 patch：修复弹框渲染" },
  ],
  todos: [],
  memories: [],
});
assert.ok(numbered.nodes.some((n) => /2\.0 版本规划/.test(n.label || "")), "编号开头的正常标题不该被当成补丁记忆丢掉");
assert.ok(!numbered.nodes.some((n) => /修复弹框渲染/.test(n.label || "")), "v1.2.0 patch 仍然挡在主干外");

// TODO 证据边：只有「开 → 关」算因果，重复 done 不能连出假边
const dupDone = buildSessionGraph({
  timeline: [
    { eventType: "todo", sessionId: "d1", todoId: "t9", todoStatus: "done", occurredAt: 1, files: ["src/a.js"] },
    { eventType: "todo", sessionId: "d2", todoId: "t9", todoStatus: "done", occurredAt: 2, files: ["src/b.js"] },
  ],
  todos: [],
  memories: [],
});
assert.ok(!dupDone.edges.some((e) => e.kind === "evidence" && e.reason === "todo"), "两次 done 之间没有因果");

// 抽稀保底：超过阈值也不能把主干清空
const many = { timeline: [], todos: [], memories: [] };
for (let i = 0; i < 60; i++) {
  many.timeline.push({ eventType: "memory", occurredAt: (i + 1) * 86_400_000, title: "新增记忆[decision]：第 " + i + " 次结论落地" });
}
const thinned = buildSessionGraph(many);
assert.ok(thinned.nodes.length > 40, "节点本身不删");
const shown = thinned.nodes.filter((n) => !n.hidden);
assert.ok(shown.length >= 12, "默认视图至少保留一批节点，不能全藏起来，实际=" + shown.length);
assert.equal(thinned.hiddenCount, thinned.nodes.length - shown.length);
assert.equal(shown[shown.length - 1].id, thinned.nodes[thinned.nodes.length - 1].id, "最新节点必须可见");

// 排序口径统一：同一个桶取最后一次活动时间
const ordering = buildSessionGraph({
  timeline: [
    { eventType: "session_summary", sessionId: "s-early", summary: "Early work.", occurredAt: 10 },
    { eventType: "session_summary", sessionId: "s-late", summary: "Late work.", occurredAt: 100 },
  ],
  todos: [],
  memories: [
    { type: "decision", status: "active", title: "早期结论", content: "内容不同于标题的一段话。", createdAt: 20, updatedAt: 20, source: { sessionId: "s-early" } },
    { type: "decision", status: "active", title: "后期结论", content: "另一段不同于标题的内容。", createdAt: 200, updatedAt: 200, source: { sessionId: "s-late" } },
  ],
});
assert.deepEqual(ordering.nodes.map((n) => n.id), ["s-early", "s-late"]);
assert.ok(ordering.nodes[0].occurredAt < ordering.nodes[1].occurredAt);

// 展开区正文是给人读的纯文本：不能把 markdown 符号原样丢出来
const md = buildSessionGraph({
  timeline: [{ eventType: "memory", occurredAt: 8, title: "新增记忆[decision]：Dashboard 设置入口" }],
  todos: [],
  memories: [{
    type: "decision",
    status: "active",
    title: "Dashboard 设置入口",
    content: [
      "## 背景",
      "用户原话：「embedding endpoint 可以去配置」。",
      "核心需求：**给插件一个显式的设置入口**，配了就用、不配就降级。",
      "## 现状核实",
      "- ✅ **降级逻辑已实现**（`config.js` 里的 `resolveEmbeddingApiKey`）",
      "- [参考文档](https://example.com/docs) 里有说明",
      "> 引用一句旁白",
    ].join("\n"),
    createdAt: 8,
    updatedAt: 8,
  }],
});
const mdDetail = md.nodes[0].detail || "";
assert.ok(mdDetail, "应当有正文");
assert.doesNotMatch(mdDetail, /##/, "标题符号要去掉");
assert.doesNotMatch(mdDetail, /\*\*/, "加粗符号要去掉");
assert.doesNotMatch(mdDetail, /`/, "反引号要去掉");
assert.doesNotMatch(mdDetail, /\]\(/, "链接语法要去掉");
assert.doesNotMatch(mdDetail, /(?:^|\s)>\s/, "引用符号要去掉");
assert.doesNotMatch(mdDetail, /(?:^|\s)-\s\u2705/, "列表符号要去掉");
assert.match(mdDetail, /背景/);
assert.match(mdDetail, /降级逻辑已实现/);
assert.match(mdDetail, /resolveEmbeddingApiKey/, "去符号但不丢内容");
assert.match(mdDetail, /参考文档/);

// 不该在几十字处就砍断；真的超长时要有明确省略号，而不是断在半个词上
const longBody = "这是一段足够长的项目结论说明。".repeat(100);
const longNode = buildSessionGraph({
  timeline: [{ eventType: "memory", occurredAt: 9, title: "新增记忆[decision]：超长结论" }],
  todos: [],
  memories: [{ type: "decision", status: "active", title: "超长结论", content: longBody, createdAt: 9, updatedAt: 9 }],
});
const longDetail = longNode.nodes[0].detail || "";
assert.ok(longDetail.length > 280, "正文上限要放宽，实际=" + longDetail.length);
assert.ok(longDetail.length <= 1000);
assert.ok(longDetail.endsWith("…"), "截断必须显式给省略号");

const shortNode = buildSessionGraph({
  timeline: [{ eventType: "memory", occurredAt: 10, title: "新增记忆[decision]：短结论" }],
  todos: [],
  memories: [{ type: "decision", status: "active", title: "短结论", content: "一句话就说完了。", createdAt: 10, updatedAt: 10 }],
});
assert.equal(shortNode.nodes[0].detail, "一句话就说完了。");

// init/rescan 的 detail 里 files= 后面是**文件数量**，不是文件列表。
// 旧的 parseFiles 会把 "1975" 当成一个文件名，节点因此变成「代码有变更（无摘要）」并挂一个假文件。
const initEvt = buildSessionGraph({
  timeline: [{
    eventType: "init",
    occurredAt: 1,
    title: "完成 project_init 扫描",
    detail: "languages=javascript/typescript files=1975 architectureMode=full modules=12 edges=18 architecture=hybrid",
  }],
  todos: [],
  memories: [],
});
assert.equal(initEvt.nodes.length, 1);
assert.deepEqual(initEvt.nodes[0].files, [], "文件计数不是文件名");
assert.notEqual(initEvt.nodes[0].label, "代码有变更（无摘要）");
assert.match(initEvt.nodes[0].label, /初始化/);

// 真正的文件列表仍然要解析出来
const realFiles = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "sf", occurredAt: 2, summary: "Did a thing.", detail: "sessionId=sf changedFiles=2 files=src/a.js,docs/b.md" }],
  todos: [],
  memories: [],
});
assert.deepEqual(realFiles.nodes[0].files, ["src/a.js", "docs/b.md"]);

console.log("smoke-session-graph: PASS");
