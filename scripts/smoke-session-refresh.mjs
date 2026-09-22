// smoke-session-refresh.mjs — 关会话全链路（DSH 触发的就是这条路径）
//
// 用真实 setupSummarizer + 伪 ctx 模拟 session/disposed，覆盖三种场景：
//   A) 只改普通源码  → 写 session_summary + 轻扫；**不得**跑 full 架构
//   B) 新增源码文件  → 结构变化 → 跑 full 架构 → architectureStale=false
//   C) full 架构失败 → markArchitectureStale 兜底写 architectureStale=true
//
// 同时校验 session_summary.files 是真实路径（不是 init detail 里的文件计数）。

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scanAndWrite } from "../src/host/scan-and-write.js";
import { setupSummarizer } from "../src/host/summarizer.js";

const HOUR = 3600_000;
const NOW = Date.now();
const root = mkdtempSync(join(tmpdir(), "dsh-pb-refresh-"));
const brainDir = join(root, ".project-brain");
const SENTINEL = { version: "sentinel", overview: { purpose: "keep me" }, keyFiles: [] };

let blockArchitectureWrite = false;

const fsAdapter = {
  async resolve(p, opts) { return opts && opts.cwd ? join(opts.cwd, p) : p; },
  async readText(target) { return readFileSync(target, "utf8"); },
  async writeText(target, content) {
    // fs 适配层的契约是「失败抛错」（brain-files.writeText 只 catch 异常），桩必须照做
    if (blockArchitectureWrite && String(target).endsWith("architecture.json")) {
      throw new Error("EACCES: simulated architecture.json write failure");
    }
    const dir = target.slice(0, Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\")));
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, content, "utf8");
    return true;
  },
  async listDir(target) {
    return readdirSync(target, { withFileTypes: true })
      .map((e) => ({ name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory() }));
  },
};

const write = (rel, body, atMs) => {
  const full = join(root, rel);
  mkdirSync(full.slice(0, Math.max(full.lastIndexOf("/"), full.lastIndexOf("\\"))), { recursive: true });
  writeFileSync(full, body, "utf8");
  if (atMs) utimesSync(full, atMs / 1000, atMs / 1000);
};

const readProject = () => JSON.parse(readFileSync(join(brainDir, "project.json"), "utf8"));
const readArchitecture = () => JSON.parse(readFileSync(join(brainDir, "architecture.json"), "utf8"));
const timeline = () => readFileSync(join(brainDir, "timeline.jsonl"), "utf8")
  .trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

// ── fixture ──
write("package.json", JSON.stringify({ name: "refresh-fixture", dependencies: { express: "4.19.0" } }));
write("src/index.js", "module.exports = require('./host/thing');\n");
write("src/host/thing.js", "module.exports = 1;\n");

const init = await scanAndWrite(fsAdapter, null, { path: root }, "project_init", {});
assert.equal(init.ok, true, JSON.stringify(init));

// fixture 文件的「出生时间」就是刚刚，没法改。所以窗口锚点必须取在 fixture 建好之后，
// 这样已有文件才算「窗口前就存在」（modified），本轮新建的才算 added。
const FIXTURE_DONE_AT = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pastAll = () => {
  for (const rel of ["package.json", "src/index.js", "src/host/thing.js", "src/host/new-module.js"]) {
    const full = join(root, rel);
    if (existsSync(full)) {
      const at = (FIXTURE_DONE_AT - HOUR) / 1000;
      utimesSync(full, at, at);
    }
  }
};
const setWindowAnchor = () => {
  const p = readProject();
  p.lastScannedAt = FIXTURE_DONE_AT + 5;
  writeFileSync(join(brainDir, "project.json"), JSON.stringify(p), "utf8");
};

// LLM 桩：产出一条 durable 记忆 + 一句人话摘要
const llmResponse = JSON.stringify({
  summary: "把注入上下文收敛成一份 briefing，避免每轮重复介绍项目。",
  memories: [{
    type: "decision",
    title: "注入统一走 briefing 组装",
    content: "人第一屏与 Agent 注入共用同一个组装函数，避免两套文案各写各的。",
    evidence: "统一 briefing",
    durable: true,
    importance: 0.8,
    confidence: 0.9,
  }],
});
const llm = {
  async *stream() {
    yield { type: "text-delta", index: 0, text: llmResponse };
    yield { type: "finish", reason: { kind: "stop" } };
  },
};

function makeSession(id) {
  return {
    id,
    cwd: root,
    meta: { cwd: root },
    header: { cwd: root },
    requestContext() { return { provider: "stub", model: "stub-model" }; },
    deriveMessages() {
      return [
        { role: "user", content: [{ type: "text", text: "统一 briefing，把注入和第一屏合成一份。" }] },
        { role: "assistant", content: [{ type: "text", text: "已完成，原因是两套文案会漂移。" }] },
      ];
    },
  };
}

// 真实 setupSummarizer + 伪 ctx（DSH 侧就是这样注册和触发的）
async function disposeSession(id) {
  let handler = null;
  const pending = [];
  const ctx = {
    logger: { info() {}, warn() {} },
    on(evt, cb) { if (evt === "session/disposed") handler = cb; },
    emit() {},
    effect(fn) { pending.push(fn()); },
  };
  setupSummarizer(ctx, fsAdapter, null, {
    getLlm: () => llm,
    getMemoryConfig: () => ({}),
  });
  assert.ok(handler, "summarizer 必须订阅 session/disposed");
  handler(makeSession(id));
  await Promise.all(pending);
}

// ── 场景 A：只改普通源码 → 轻扫，不跑 full 架构 ──
writeFileSync(join(brainDir, "architecture.json"), JSON.stringify(SENTINEL), "utf8");
pastAll();
setWindowAnchor();
await sleep(60);
write("src/host/thing.js", "module.exports = 2; // touched\n", Date.now());

await disposeSession("sess-a");

const summaryOf = (sid) => timeline().find((e) => e.eventType === "session_summary" && e.sessionId === sid);
const evA = summaryOf("sess-a");
assert.ok(evA, "关会话必须写 session_summary");
// 轻扫会在摘要之后再追加一条 rescan，所以摘要不一定是最后一条
assert.ok(timeline().some((e) => e.eventType === "rescan" && e.architectureMode === "light"), "改源码应触发轻扫");
assert.match(evA.summary, /briefing/, "人话摘要应写入 timeline：" + JSON.stringify(evA.summary));
assert.ok(evA.files.includes("src/host/thing.js"), "改动文件应进 files：" + JSON.stringify(evA.files));
assert.ok(!evA.files.some((f) => /^\d+$/.test(f)), "files 里不能出现文件计数");
assert.ok(!evA.files.includes("src/index.js"), "窗口外的文件不该被算进来");
assert.ok(evA.changes.some((c) => c.path === "src/host/thing.js" && c.type === "modified"));
assert.equal(readArchitecture().version, "sentinel", "改普通源码不得触发 full 架构");

// ── 场景 B：新增源码文件 → 结构变化 → 跑 full 架构 ──
pastAll();
setWindowAnchor();
await sleep(60);
write("src/host/new-module.js", "module.exports = 'new';\n", Date.now());

await disposeSession("sess-b");

const archB = readArchitecture();
assert.notEqual(archB.version, "sentinel", "新增源码文件必须触发 full 架构重分析");
assert.ok(archB.stats && typeof archB.stats.modules === "number", "应产出真实架构：" + JSON.stringify(Object.keys(archB)));
assert.equal(readProject().architectureStale, false, "full 成功后必须清除过期标记");

// ── 场景 C：full 架构写失败 → 必须显式置过期 ──
writeFileSync(join(brainDir, "architecture.json"), JSON.stringify(SENTINEL), "utf8");
pastAll();
setWindowAnchor();
await sleep(60);
write("src/host/another-module.js", "module.exports = 'another';\n", Date.now());
blockArchitectureWrite = true;

await disposeSession("sess-c");

blockArchitectureWrite = false;
assert.equal(readProject().architectureStale, true, "full 失败必须置 architectureStale=true，不能拿旧泳道当真理");
assert.equal(readArchitecture().version, "sentinel", "失败时不得破坏已有 architecture.json");

// 同一个 session 不重复摘要
const before = timeline().length;
await disposeSession("sess-c");
assert.equal(timeline().length, before, "同一 sessionId 不应写第二条摘要");

rmSync(root, { recursive: true, force: true });
console.log("smoke-session-refresh: PASS");
