import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { scanProject } from "../src/scanner.js";
import { resolveProjectPath } from "../src/host/store/path-resolver.js";
import { setupInjector } from "../src/host/injector.js";
import {
  MIN_NEW_MESSAGES,
  countSessionMessages,
  createIdleSummaryScheduler,
  lastSummarizedMessageCount,
  summarizeOne,
} from "../src/host/summarizer.js";
import { evidenceMatchesTranscript, extractSessionMemories } from "../src/host/memory/session-extractor.js";
import { contextWindow, detectSignal, fallbackCandidate, handleOne } from "../src/host/realtime-memory.js";
import { admitMemory, enforceCoreCap, getCoreLimits, hasUnresolvedReference, maxPinnedCount } from "../src/host/memory/admit.js";
import { applyMemoryDelete, applyMemoryEdit, applyMemoryStatus } from "../src/host/memory/edit.js";
import { ACCESS_THROTTLE_MS, applyAccessTouch } from "../src/host/memory/access.js";
import { planMemoryVacuum, planTimelineTrim, vacuumBrain } from "../src/host/memory/vacuum.js";
import { retrieveMemories, trustFactor } from "../src/host/memory/retrieval.js";
import { appendJsonl, readJsonl, writeJsonl } from "../src/host/store/brain-files.js";
import { brainTxKey, pendingLockCount, withWriteLock } from "../src/host/store/write-lock.js";
import { isCoreMemory } from "../src/host/store/brain-logic.js";
import { buildMemoryArchiveTool, buildMemorySupersedeTool } from "../src/tools/memory.js";
import { buildDreamTool } from "../src/tools/dream.js";
import { handleMemoryMutation } from "../src/host/rpc/sidebar.js";
import { createMemoryConfigRuntime } from "../src/host/memory/config.js";

const root = mkdtempSync(join(tmpdir(), "dsh-brain-memory-"));
const projectA = join(root, "project-a");
const projectB = join(root, "project-b");
const uninitialized = join(root, "plain-project");

function target(path) { return { path: resolve(path) }; }
const fsAdapter = {
  async resolve(path, options) {
    const base = options && options.cwd ? (options.cwd.path || String(options.cwd)) : process.cwd();
    return target(resolve(base, path));
  },
  processPath(value) { return value.path; },
  async listDir(value) {
    return readdirSync(value.path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
      target: target(join(value.path, entry.name)),
    }));
  },
  async readText(value) { try { return readFileSync(value.path, "utf8"); } catch { return null; } },
  async writeText(value, text) {
    mkdirSync(dirname(value.path), { recursive: true });
    writeFileSync(value.path, text, "utf8");
    return true;
  },
  async stat(value) { return statSync(value.path); },
};

function writeBrain(projectPath, name, memoryTitle) {
  mkdirSync(join(projectPath, ".project-brain"), { recursive: true });
  writeFileSync(join(projectPath, ".project-brain", "project.json"), JSON.stringify({
    id: "brain-" + name, name, techStack: { backend: "Node.js" }, createdAt: Date.now(), updatedAt: Date.now(),
  }));
  writeFileSync(join(projectPath, ".project-brain", "memory.jsonl"), JSON.stringify({
    id: "mem-" + name, type: "decision", title: memoryTitle, content: memoryTitle, importance: 0.9, createdAt: Date.now(),
  }) + "\n");
  writeFileSync(join(projectPath, ".project-brain", "todo.jsonl"), "");
  writeFileSync(join(projectPath, ".project-brain", "timeline.jsonl"), "");
}

mkdirSync(join(projectA, "src"), { recursive: true });
mkdirSync(projectB, { recursive: true });
mkdirSync(uninitialized, { recursive: true });
writeFileSync(join(projectA, "package.json"), JSON.stringify({
  name: "publishable-app", description: "A reusable project memory service", dependencies: { fastify: "latest" }, devDependencies: { typescript: "latest" },
}));
writeFileSync(join(projectA, "src", "main.ts"), "export const app = true;\n");
writeFileSync(join(projectA, "script.rb"), "puts 'ok'\n");
writeBrain(projectA, "project-a", "A only decision");
writeBrain(projectB, "project-b", "B only decision");

const scan = await scanProject(fsAdapter, projectA);
assert.equal(scan.projectName, "publishable-app");
assert.equal(scan.description, "A reusable project memory service");
assert.equal(scan.entrypoints.some((entry) => entry.path === "src/main.ts"), true);
assert.equal(scan.languages.ruby, 1);
assert.equal(scan.tooling.includes("TypeScript"), true);

assert.equal(resolveProjectPath(
  { path: projectB },
  { session: { header: { cwd: projectA } } },
  { workspaceRoot: projectB },
), projectA, "live session workspace must win over model-provided path");

// 回归保护：dsh-tools 的 ToolRunContext 只暴露 { agent?, ... }，没有 session/ctx/sessionId。
// 必须能从 exec.agent.session.header.cwd 解析当前项目，否则工具在不显式传 path 时全部报错。
assert.equal(resolveProjectPath(
  { path: projectB },
  { agent: { session: { header: { cwd: projectA } } } },
  { workspaceRoot: projectB },
), projectA, "exec.agent.session.header.cwd (ToolRunContext shape) must resolve project");

// sessionId 走 sessions service 也兼容 exec.agent.id
assert.equal(resolveProjectPath(
  { path: projectB },
  { agent: { id: "sess-a", session: { header: { cwd: projectA } } } },
  { workspaceRoot: projectB },
), projectA, "exec.agent with id+session both must resolve");

// 无显式 path、session cwd 和 workspaceRoot 都是 DSH Desktop 安装路径 → 安全降级到 "."
//   （不是静默串写到 DSH Desktop 安装目录）
assert.equal(resolveProjectPath(
  {},
  { agent: { session: { header: { cwd: "/Users/x/AppData/Local/Programs/DSH Desktop" } } } },
  { workspaceRoot: "/Users/x/AppData/Local/Programs/DSH Desktop" },
), ".", "DSH Desktop install paths must not be silently used as project cwd");

const handlers = new Map();
const sections = [];
const ctx = {
  get(name) {
    if (name === "systemPrompt") return { section(section) { sections.push(section); return () => {}; } };
    if (name === "sessions") return { get() { return null; } };
    return null;
  },
  on(event, handler) { const list = handlers.get(event) || []; list.push(handler); handlers.set(event, list); },
  emit(event, payload) { for (const handler of handlers.get(event) || []) handler(payload); },
  logger: { info() {}, warn() {} },
};
setupInjector(ctx, fsAdapter, null);
ctx.emit("agent/session-start", { agent: { session: { id: "session-a", header: { cwd: projectA } } } });
ctx.emit("agent/session-start", { agent: { session: { id: "session-b", header: { cwd: projectB } } } });
await new Promise((resolveWait) => setTimeout(resolveWait, 80));
const section = sections.find((item) => item.name === "project-brain-context");
assert.ok(section);
const contextA = section.text({ sessionId: "session-a" });
const contextB = section.text({ sessionId: "session-b" });
assert.match(contextA, /A only decision/);
assert.doesNotMatch(contextA, /B only decision/);
assert.match(contextB, /B only decision/);
assert.doesNotMatch(contextB, /A only decision/);

const skipped = await summarizeOne({ fs: fsAdapter, projectPath: uninitialized, sessionId: "plain-session" });
assert.equal(skipped.skipped, "not_initialized");
assert.equal(existsSync(join(uninitialized, ".project-brain")), false);

spawnSync("git", ["init", "--quiet"], { cwd: projectA });
spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: projectA });
spawnSync("git", ["config", "user.name", "Test"], { cwd: projectA });
spawnSync("git", ["add", "-A"], { cwd: projectA });
spawnSync("git", ["commit", "--quiet", "-m", "baseline"], { cwd: projectA });
writeFileSync(join(projectA, "src", "feature.ts"), "export const feature = true;\n");
spawnSync("git", ["add", "-A"], { cwd: projectA });
spawnSync("git", ["commit", "--quiet", "-m", "feature"], { cwd: projectA });

const first = await summarizeOne({ fs: fsAdapter, projectPath: projectA, sessionId: "summary-1" });
assert.equal(first.changedFiles > 0, true);
// 同一会话没有新消息 → 跳过（幂等按消息增量算，不再是「这个 session 摘过就永不再摘」）
const sameSession = await summarizeOne({ fs: fsAdapter, projectPath: projectA, sessionId: "summary-1" });
assert.equal(sameSession.skipped, "no_new_messages");
// 同一会话又聊了若干轮 → 必须能再沉淀一次，否则长会话第一次之后的工作全丢
const grownSession = await summarizeOne({
  fs: fsAdapter, projectPath: projectA, sessionId: "summary-1",
  session: { deriveMessages: () => Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i })) },
});
assert.equal(grownSession.skipped == null, true, "同一会话有足够新消息时可以再次摘要");
const secondSession = await summarizeOne({ fs: fsAdapter, projectPath: projectA, sessionId: "summary-2" });
assert.equal(secondSession.skipped == null, true, "不同 session 仍会写 timeline 摘要");
assert.equal(secondSession.semanticMemories || 0, 0, "无 LLM 时 git diff 不写 change 记忆");
const semanticJson = JSON.stringify({ memories: [
  { type: "decision", title: "选择事务数据库", content: "项目决定使用支持事务的数据库，以保障订单写入一致性。", evidence: "业务数据库必须支持事务能力", durable: true, importance: 0.8, confidence: 0.9 },
  { type: "requirement", title: "订单必须保持一致", content: "订单创建流程必须保证跨表写入的一致性和可恢复性。", evidence: "跨表写入的一致性和故障恢复", durable: true, importance: 0.85, confidence: 0.9 },
] });
const semanticSession = { deriveMessages() { return [{ role: "user", content: [{ type: "text", text: "我们经过方案评审，决定业务数据库必须支持事务能力，用于保证订单创建时跨表写入的一致性和故障恢复。请把这个长期约束记录下来。" }] }]; } };
const semanticLlm = { async *stream() { yield { type: "text-delta", index: 0, text: semanticJson }; yield { type: "finish", reason: { kind: "stop" } }; } };
const semanticResult = await summarizeOne({
  fs: fsAdapter, projectPath: projectA, sessionId: "summary-3", session: semanticSession,
  llm: semanticLlm, route: { provider: "test", model: "test-model" },
});
assert.equal(semanticResult.semanticMemories, 2);
const memories = readFileSync(join(projectA, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(memories.filter((item) => item.source && item.source.kind === "session_summary").length, 0);
assert.equal(memories.filter((item) => item.source && item.source.kind === "session_semantic").length, 2);

// ───────── 改动 6: 实时记忆弱信号检测 ─────────
const weak1 = detectSignal("以后都用 PostgreSQL，别再用 MySQL 了");
assert.ok(weak1 && weak1.strength === "weak", "以后都... → weak signal");
assert.match(weak1.content, /PostgreSQL/);
const weak2 = detectSignal("下次记得先跑测试再提交");
assert.ok(weak2 && weak2.strength === "weak", "下次记得... → weak signal");
const weak3 = detectSignal("约定所有 API 必须用 POST");
assert.ok(weak3 && weak3.strength === "weak", "约定... → weak signal");
const weak4 = detectSignal("going forward, use TypeScript for all new modules");
assert.ok(weak4 && weak4.strength === "weak", "going forward... → weak signal");
const strong1 = detectSignal("记住：PostgreSQL 是首选数据库");
assert.ok(strong1 && strong1.strength === "strong", "记住：... → strong signal");
const strong2 = detectSignal("以后都要做事务处理");
assert.ok(strong2 && strong2.strength === "strong", "以后要... → strong signal");
const none1 = detectSignal("今天天气不错");
assert.equal(none1, null, "无信号 → null");
const neg1 = detectSignal("记住：commit 时不要 force push");
assert.ok(neg1 && neg1.strength === "strong", "记住 + git 词仍是强信号");
const spokenComma = detectSignal("帮我记住，我喜欢简洁高效，言简意赅的回答方式");
assert.ok(spokenComma && spokenComma.strength === "strong", "帮我记住，… → strong");
assert.equal(String(spokenComma.content).startsWith("，"), false, "记住后的中文逗号不能进正文");
assert.match(spokenComma.content, /^我喜欢简洁高效/);

// ───────── 改动 3: Grounding check ─────────
const transcript = "USER: 我们经过方案评审，决定业务数据库必须支持事务能力。\nASSISTANT: 好的，记录下来。";
assert.equal(evidenceMatchesTranscript("业务数据库必须支持事务能力", transcript), true, "evidence 完全匹配");
assert.equal(evidenceMatchesTranscript("使用 PostgreSQL 14", transcript), false, "evidence 完全不匹配");
assert.equal(evidenceMatchesTranscript("业务数据库必须", transcript), true, "evidence 子串匹配");
assert.equal(evidenceMatchesTranscript("记", transcript), false, "evidence 太短 → false");
assert.equal(evidenceMatchesTranscript("", transcript), false, "空 evidence → false");
assert.equal(evidenceMatchesTranscript(null, transcript), false, "null evidence → false");

// extractSessionMemories: evidence 正确 → grounded=true + 正常 confidence
const longTranscript = "我们决定业务数据库必须支持事务能力，用于保障订单写入一致性和故障恢复。请把这个长期约束记录下来并应用到所有订单相关的开发任务。";
const goodEvidenceJson = JSON.stringify({ summary: "s", memories: [
  { type: "decision", title: "支持事务的数据库", content: "项目决定业务数据库必须支持事务能力，用于保障订单写入一致性。", evidence: "业务数据库必须支持事务能力", durable: true, importance: 0.9, confidence: 0.9 },
] });
const goodLlm = { async *stream() { yield { type: "text-delta", index: 0, text: goodEvidenceJson }; yield { type: "finish", reason: { kind: "stop" } }; } };
const goodResult = await extractSessionMemories({
  session: { deriveMessages() { return [{ role: "user", content: [{ type: "text", text: longTranscript }] }]; } },
  llm: goodLlm, route: { provider: "test", model: "test-model" }, sessionId: "g-1",
});
assert.equal(goodResult.grounded, 1, "grounded 计数 = 1");
assert.equal(goodResult.ungrounded, 0, "ungrounded 计数 = 0");
assert.equal(goodResult.memories[0].source.grounded, true, "source.grounded = true");
assert.equal(goodResult.memories[0].confidence, 0.9, "grounded confidence 保持 0.9");

// extractSessionMemories: evidence 错误 → confidence 被压低 + source.grounded=false
const badTranscript = "我们讨论了数据库选型，经过评审一致认为应该选用 PostgreSQL 14，支持事务能力与 JSONB 数据类型。";
const badEvidenceJson = JSON.stringify({ summary: "s", memories: [
  { type: "decision", title: "使用 MongoDB", content: "项目决定使用 MongoDB 替代关系数据库。", evidence: "MongoDB 性能比 PostgreSQL 好三倍", durable: true, importance: 0.8, confidence: 0.95 },
] });
const badLlm = { async *stream() { yield { type: "text-delta", index: 0, text: badEvidenceJson }; yield { type: "finish", reason: { kind: "stop" } }; } };
const badResult = await extractSessionMemories({
  session: { deriveMessages() { return [{ role: "user", content: [{ type: "text", text: badTranscript }] }]; } },
  llm: badLlm, route: { provider: "test", model: "test-model" }, sessionId: "g-2",
});
assert.equal(badResult.grounded, 0, "grounded 计数 = 0（evidence 是幻觉）");
assert.equal(badResult.ungrounded, 1, "ungrounded 计数 = 1");
assert.equal(badResult.memories[0].source.grounded, false, "source.grounded = false");
assert.ok(badResult.memories[0].confidence <= 0.4, "grounding 失败的 confidence 必 ≤ 0.4（避免幻觉污染）");

// extractSessionMemories: 没给 evidence → confidence 压到 0.55
const noEvTranscript = "我学到了测试很重要，每次发版前都应该跑全套测试覆盖，否则会出生产事故。";
const noEvidenceJson = JSON.stringify({ summary: "s", memories: [
  { type: "lesson", title: "测试很重要", content: "每次发版前都应该跑全套测试覆盖，否则可能出生产事故。", durable: true, importance: 0.7, confidence: 0.9 },
] });
const noEvLlm = { async *stream() { yield { type: "text-delta", index: 0, text: noEvidenceJson }; yield { type: "finish", reason: { kind: "stop" } }; } };
const noEvResult = await extractSessionMemories({
  session: { deriveMessages() { return [{ role: "user", content: [{ type: "text", text: noEvTranscript }] }]; } },
  llm: noEvLlm, route: { provider: "test", model: "test-model" }, sessionId: "g-3",
});
assert.equal(noEvResult.memories[0].source.grounded, false, "无 evidence → grounded=false");
assert.ok(noEvResult.memories[0].confidence <= 0.55, "无 evidence → confidence ≤ 0.55");

// ───────── 改动 4: 注入器决策链段 ─────────
const projectC = join(root, "project-c");
mkdirSync(projectC, { recursive: true });
writeBrain(projectC, "project-c", "基础决策");
mkdirSync(join(projectC, ".project-brain"), { recursive: true });
// 写入多条 decision/architecture/其他类型记忆
const nowTs = Date.now();
const decisionMemories = [
  { id: "mem-d1", type: "decision", title: "使用 PostgreSQL 14", content: "选用 PG 14，支持事务 + JSONB。", importance: 0.95, createdAt: nowTs - 3000 },
  { id: "mem-d2", type: "decision", title: "API 用 Fastify", content: "Fastify 性能优于 Express。", importance: 0.85, createdAt: nowTs - 2000 },
  { id: "mem-d3", type: "decision", title: "前端用 Vue 3", content: "团队熟悉 Vue，迁移成本低。", importance: 0.80, createdAt: nowTs - 1000 },
  { id: "mem-a1", type: "architecture", title: "分层架构", content: "Router → Service → Repository", importance: 0.75, createdAt: nowTs - 500 },
  { id: "mem-b1", type: "bug", title: "修复某个 bug", content: "修了某处的内存泄漏。", importance: 0.5, createdAt: nowTs },
];
writeFileSync(join(projectC, ".project-brain", "memory.jsonl"), decisionMemories.map((m) => JSON.stringify(m)).join("\n") + "\n");
const handlersC = new Map();
const sectionsC = [];
const ctxC = {
  get(name) {
    if (name === "systemPrompt") return { section(section) { sectionsC.push(section); return () => {}; } };
    if (name === "sessions") return { get() { return null; } };
    return null;
  },
  on(event, handler) { const list = handlersC.get(event) || []; list.push(handler); handlersC.set(event, list); },
  emit(event, payload) { for (const handler of handlersC.get(event) || []) handler(payload); },
  logger: { info() {}, warn() {} },
};
setupInjector(ctxC, fsAdapter, null);
ctxC.emit("agent/session-start", { agent: { session: { id: "session-c", header: { cwd: projectC } } } });
await new Promise((resolveWait) => setTimeout(resolveWait, 80));
const sectionC = sectionsC.find((item) => item.name === "project-brain-context");
const renderedC = sectionC.text({ agent: { session: { id: "session-c", header: { cwd: projectC } } } });
assert.match(renderedC, /### Core 记忆/, "injector 必须渲染 Core 记忆");
assert.match(renderedC, /使用 PostgreSQL 14/, "Core 含全部 active，包括较早的决策");
assert.match(renderedC, /前端用 Vue 3/);
assert.match(renderedC, /API 用 Fastify/);
assert.match(renderedC, /分层架构/);
assert.match(renderedC, /修复某个 bug/, "Core 含 bug 类型，不再用决策链 Top-3 截断");
assert.doesNotMatch(renderedC, /最近决策链/, "已移除最近决策链段");
assert.doesNotMatch(renderedC, /无需再次确认/, "不得再提示记住就调 memory_add");

// ───────── 改动 5: project_memory_archive / project_memory_supersede ─────────
const archiveExec = { sessionId: "arch-1", session: { id: "arch-1", header: { cwd: projectC } } };
const archiveTool = buildMemoryArchiveTool({ fs: fsAdapter, sandboxPolicy: null });
const archiveResult = await archiveTool.execute({ id: "mem-d1", reason: "已经迁移到新方案", path: projectC }, archiveExec);
assert.equal(archiveResult.ok, true, "archive tool 成功");
assert.equal(archiveResult.data.id, "mem-d1");
const archivedBrain = readFileSync(join(projectC, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const d1 = archivedBrain.find((m) => m.id === "mem-d1");
assert.equal(d1.status, "archived", "mem-d1.status = archived");
assert.equal(d1.archiveReason, "已经迁移到新方案");
// 重复 archive 已 archived 的 → 应该失败
const reArchive = await archiveTool.execute({ id: "mem-d1", path: projectC }, archiveExec);
assert.equal(reArchive.ok, false, "重复 archive 已 archived → 失败");
assert.equal(reArchive.code, "E_NOT_FOUND");

// supersede
const supersedeTool = buildMemorySupersedeTool({ fs: fsAdapter, sandboxPolicy: null });
const supResult = await supersedeTool.execute({
  oldId: "mem-d2",
  type: "decision",
  title: "API 用 Hono",
  content: "经过性能评估，Hono 比 Fastify 快 2x，更适合边缘计算场景。",
  importance: 0.9,
  confidence: 0.85,
  reason: "Fastify 在边缘环境表现不佳",
  path: projectC,
}, archiveExec);
assert.equal(supResult.ok, true, "supersede tool 成功");
assert.ok(supResult.data.newId, "返回 newId");
const afterSup = readFileSync(join(projectC, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const oldD2 = afterSup.find((m) => m.id === "mem-d2");
const newD2 = afterSup.find((m) => m.id === supResult.data.newId);
assert.equal(oldD2.status, "superseded", "旧 mem-d2 → superseded");
assert.equal(oldD2.supersededBy, supResult.data.newId, "supersededBy 指向 newId");
assert.equal(oldD2.supersededReason, "Fastify 在边缘环境表现不佳");
assert.equal(newD2.type, "decision");
assert.match(newD2.title, /Hono/);
assert.equal(newD2.source.supersedes, "mem-d2", "新记忆 source.supersedes 指向旧 id");

// ambiguous id
const ambiResult = await archiveTool.execute({ id: "mem", path: projectC }, archiveExec);
assert.equal(ambiResult.ok, false, "前缀匹配多条 → 拒绝");
assert.equal(ambiResult.code, "E_AMBIGUOUS_ID");

// ───────── 改动 2: summarizer auto-dream ─────────
const projectD = join(root, "project-d");
mkdirSync(join(projectD, ".project-brain"), { recursive: true });
mkdirSync(join(projectD, "src"), { recursive: true });
writeFileSync(join(projectD, "package.json"), JSON.stringify({ name: "p-d", description: "d" }));
// 写入 32 条重复 title 的 decision 记忆（超过默认阈值 30，且 Jaccard 可合并）
let allMemLines = [];
for (let i = 0; i < 32; i++) {
  const nowMs = Date.now() - i * 60000;
  allMemLines.push(JSON.stringify({
    id: "mem-d-" + i, type: "decision",
    title: "重复的决策标题用于触发合并",
    content: "内容 " + i,
    importance: 0.9, confidence: 0.8, status: "active", createdAt: nowMs, updatedAt: nowMs,
  }));
}
writeFileSync(join(projectD, ".project-brain", "memory.jsonl"), allMemLines.join("\n") + "\n");
writeFileSync(join(projectD, ".project-brain", "project.json"), JSON.stringify({
  id: "p-d", name: "p-d", techStack: { backend: "Node.js" }, createdAt: Date.now(), updatedAt: Date.now(),
}));
writeFileSync(join(projectD, ".project-brain", "todo.jsonl"), "");
writeFileSync(join(projectD, ".project-brain", "timeline.jsonl"), "");

// 第一次 summarizeOne → auto-dream 应触发（32 >= 30）
const initGit = spawnSync("git", ["init", "--quiet"], { cwd: projectD });
spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: projectD });
spawnSync("git", ["config", "user.name", "Test"], { cwd: projectD });
spawnSync("git", ["add", "-A"], { cwd: projectD });
spawnSync("git", ["commit", "--quiet", "--allow-empty", "-m", "baseline"], { cwd: projectD });
writeFileSync(join(projectD, "src", "feature.ts"), "export const x = 1;\n");
spawnSync("git", ["add", "-A"], { cwd: projectD });
spawnSync("git", ["commit", "--quiet", "-m", "feat"], { cwd: projectD });
const autoDreamResult = await summarizeOne({
  fs: fsAdapter, projectPath: projectD, sessionId: "dream-1",
  llm: null, route: null, config: {},
});
assert.ok(autoDreamResult.autoDream, "autoDream 字段存在");
assert.equal(autoDreamResult.autoDream.triggered, true, "housekeep 因 Core cap 触发写盘");
assert.ok(autoDreamResult.autoDream.evicted > 0, "超额 active 被标 dormant");
const afterHousekeep = readFileSync(join(projectD, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(afterHousekeep.length, 32, "housekeep 不得因标题相似删除行");
assert.ok(afterHousekeep.filter((m) => isCoreMemory(m)).length <= getCoreLimits().maxItems, "Core 条数不超过配置上限");
assert.ok(afterHousekeep.filter((m) => m.status === "dormant").length >= 32 - getCoreLimits().maxItems, "超出上限的 Core 进入 dormant");
assert.equal(afterHousekeep.filter((m) => m.status === "deleted").length, 0);

const dreamTimeline = readFileSync(join(projectD, ".project-brain", "timeline.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.ok(dreamTimeline.some((e) => e.eventType === "dream" && /记忆整理完成/.test(e.title)), "timeline 写了 housekeep 事件");

const afterDream = await summarizeOne({
  fs: fsAdapter, projectPath: projectD, sessionId: "dream-2",
  llm: null, route: null, config: {},
});
assert.ok(afterDream.autoDream, "autoDream 字段存在");
assert.equal(afterDream.autoDream.triggered, false, "第二次 housekeep 无变化不写盘");

// ───────── 改动 7: Settings runtime — Dashboard 设置入口底层 ─────────
// 无 settings 服务（hotMount/不可用环境）：writable=false, updateSettings 抛 SETTINGS_UNAVAILABLE
const runtimeNoSettings = createMemoryConfigRuntime({}, { retrievalMode: "hybrid", vectorEnabled: true, embeddingBaseURL: "https://x.test/v1", embeddingModel: "m", embeddingDimensions: 8 });
assert.equal(typeof runtimeNoSettings.get, "function", "runtime 提供 get()");
assert.equal(typeof runtimeNoSettings.updateSettings, "function", "runtime 提供 updateSettings()");
assert.equal(runtimeNoSettings.settingsWritable(), false, "无 settings 服务 → writable=false");
let threwNoSettings = false;
try { await runtimeNoSettings.updateSettings({ vectorEnabled: false }); } catch (e) { threwNoSettings = true; assert.equal(e.code, "SETTINGS_UNAVAILABLE", "updateSettings 在无 settings 时抛 SETTINGS_UNAVAILABLE"); }
assert.ok(threwNoSettings, "updateSettings 必须抛错（无 settings）");
assert.equal(runtimeNoSettings.get().embeddingDimensions, 8, "无 settings 时仍用 entryConfig 初始化");
// 验证 getSettingsService/getSettingsScope 都是 null（可安全调用）
assert.equal(runtimeNoSettings.getSettingsService(), null, "无 settings 时 getSettingsService() = null");
assert.equal(runtimeNoSettings.getSettingsScope(), null, "无 settings 时 getSettingsScope() = null");

// Mock settings 服务（结构正确）：writable=true, updateSettings 调用 settings.update
const mockStore = { current: { retrievalMode: "hybrid", vectorEnabled: false, embeddingBaseURL: "", embeddingModel: "", embeddingApiKeyEnv: "PROJECT_BRAIN_EMBEDDING_API_KEY", embeddingDimensions: 0 } };
let mockWatcher = null;
const mockSettings = {
  writable: true,
  register() {
    return {
      get: () => mockStore.current,
      watch: (cb) => { mockWatcher = cb; cb(mockStore.current); },
    };
  },
  get() { return mockStore.current; },
  async update(_ns, patch) {
    mockStore.current = Object.assign({}, mockStore.current, patch);
    // 真实 settings.update commit 后会 emit `settings/updated`，scope.watch 会被调用
    if (typeof mockWatcher === "function") mockWatcher(mockStore.current);
  },
};
const mockCtxSettings = { inject(names, cb) { cb({ get(k) { return k === "settings" ? mockSettings : null; } }); } };
const runtimeWithSettings = createMemoryConfigRuntime(mockCtxSettings, { retrievalMode: "keyword" });
assert.equal(runtimeWithSettings.settingsWritable(), true, "有 settings 服务且 writable=true → settingsWritable()=true");
const next = await runtimeWithSettings.updateSettings({ vectorEnabled: true, embeddingBaseURL: "https://api.openai.com/v1", embeddingModel: "text-embedding-3-small" });
assert.equal(next.vectorEnabled, true, "updateSettings 后 vectorEnabled=true");
assert.equal(next.embeddingBaseURL, "https://api.openai.com/v1");
assert.equal(next.embeddingModel, "text-embedding-3-small");
assert.equal(next.retrievalMode, "hybrid", "base entryConfig 在 mock 里被 user layer 覆盖");
// getMemoryConfig 应反映新值（scope.watch 已挂上）
assert.equal(runtimeWithSettings.get().vectorEnabled, true, "get() 反映 user layer 新值");

// readonly settings：updateSettings 抛 SETTINGS_READONLY（需要 writable=false 但 update 方法存在）
const readonlySettings = { writable: false, register() { return { get: () => ({}), watch: () => {} }; }, get() { return {}; }, async update() {} };
const readonlyCtx = { inject(names, cb) { cb({ get(k) { return k === "settings" ? readonlySettings : null; } }); } };
const readonlyRuntime = createMemoryConfigRuntime(readonlyCtx, {});
assert.equal(readonlyRuntime.settingsWritable(), false, "writable=false 时 settingsWritable()=false");
let threwReadonly = false;
try { await readonlyRuntime.updateSettings({ vectorEnabled: true }); } catch (e) { threwReadonly = true; assert.equal(e.code, "SETTINGS_READONLY"); }
assert.ok(threwReadonly, "writable=false 必须抛错");

// ───────── 实时记忆：指代消解 ─────────
// 复现真实缺陷：用户说「把这个记住」，真正的内容在上一轮（且是 assistant 说的），
// 旧实现把正则捕获到的残句「以后对话要从这个角度出发」当成了记忆正文。
const projectRt = join(root, "project-c");
writeBrain(projectRt, "realtime", "初始决策");

const priorTurns = [
  { role: "user", content: [{ type: "text", text: "我要以面试的角度，去沉淀这些项目，把平常工作中的一些项目经历及时沉淀总结，为以后跳槽面试准备" }] },
  { role: "assistant", content: [{ type: "text", text: "目标：面试素材库（AI 应用 / Agent 工程师方向）。结构：STAR 法则 + 技术亮点 + 可深挖点。身份：主要开发者。" }] },
];
const triggerText = "需要你把我这个需求点记住，以后对话要从这个角度出发";
const realtimeSession = { id: "rt-1", cwd: projectRt, deriveMessages() { return priorTurns; } };
const realtimeRoute = { provider: "test", model: "test-model" };
const mockLlm = (payload) => ({ async *stream() {
  yield { type: "text-delta", index: 0, text: payload };
  yield { type: "finish", reason: { kind: "stop" } };
} });

const triggerSignal = detectSignal(triggerText);
assert.ok(triggerSignal && triggerSignal.strength === "strong", "「把这个记住」是强信号");
assert.equal(triggerSignal.content, "以后对话要从这个角度出发", "正则捕获到的仍然是那句残句");
assert.equal(hasUnresolvedReference(triggerSignal.content, triggerSignal.content), true, "残句被判定为未消解指代");
assert.equal(fallbackCandidate(triggerSignal), null, "指代未消解时兜底不产出候选，且不再凑字数");

// LLM 不可用 → 不写入，留给会话结束的 session-extractor
const noLlm = await handleOne({ fs: fsAdapter, projectPath: projectRt, sessionId: "rt-1", signal: triggerSignal, session: realtimeSession, llm: null, route: null });
assert.equal(noLlm.skipped, "needs_context", "无 LLM 且指代未消解 → 不落盘");
assert.equal(readFileSync(join(projectRt, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").length, 1, "无 LLM 时 memory.jsonl 没有新增行");

// LLM 说解不开 → 同样不写入，不退回原话
const unresolved = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-1", signal: triggerSignal, session: realtimeSession,
  llm: mockLlm(JSON.stringify({ resolved: false })), route: realtimeRoute,
});
assert.equal(unresolved.skipped, "unresolved_reference", "模型判定解不开 → 不落盘");

// 用户说了「记住」却没记成，必须在 timeline 里留痕，否则用户以为已经记下了
assert.equal(unresolved.noted, true, "未记住的情况被记录下来");
const rtTimeline = readFileSync(join(projectRt, ".project-brain", "timeline.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const rejectEvents = rtTimeline.filter((e) => e.eventType === "memory_rejected");
assert.equal(rejectEvents.length, 2, "无 LLM 和解不开指代各留一条「未记住」");
assert.match(rejectEvents[0].title, /^未记住：/, "标题一眼能看出没记成");
assert.match(rejectEvents[0].title, /以后对话要从这个角度出发/, "标题带上用户的原话");
assert.equal(rejectEvents[1].rejectReason, "unresolved_reference", "记录了具体原因");
assert.match(rejectEvents[1].detail, /指的是什么/, "原因写成人话而不是错误码");

// 正常路径：带上下文消解成自包含的 preference
const refinedPayload = JSON.stringify({
  resolved: true,
  type: "preference",
  title: "项目沉淀一律按面试素材库的口径组织",
  content: "所有项目沉淀的目标是面试素材库，方向为 AI 应用 / Agent 工程师。结构默认 STAR 法则加技术亮点与可深挖点，突出本人角色、难点、决策与量化结果，不写成项目复盘或团队交接文档。",
  importance: 0.9,
});
const refined = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-1", signal: triggerSignal, session: realtimeSession,
  llm: mockLlm(refinedPayload), route: realtimeRoute,
});
assert.equal(refined.appended, true, "带上下文消解后成功落盘");
assert.equal(refined.refineStatus, "refined", "走的是 LLM 提炼路径");
const rtRows = readFileSync(join(projectRt, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const rtEntry = rtRows[rtRows.length - 1];
assert.equal(rtEntry.type, "preference", "用户工作偏好落成 preference 类型");
assert.match(rtEntry.content, /面试素材库/, "正文带上了上一轮里的真实指代对象");
assert.match(rtEntry.content, /STAR/, "正文带上了 assistant 那轮说的结构口径");
assert.equal(/这个角度/.test(rtEntry.content), false, "正文不再包含未消解的指代");
assert.equal(/这是用户明确要求记住的长期偏好/.test(rtEntry.content), false, "不再用套话凑长度");
assert.equal(rtEntry.source.refined, true, "source 标记为已提炼");
assert.equal(rtEntry.source.trigger, triggerText, "source 保留用户触发原话");

// 重申同一条偏好 → supersede 旧条目，而不是在 Core 里堆同义项
const restatedPayload = JSON.stringify({
  resolved: true,
  type: "preference",
  title: "项目沉淀一律按面试素材库的口径组织",
  content: "所有项目沉淀的目标是面试素材库，方向为 AI 应用 / Agent 工程师。结构默认 STAR 法则加技术亮点与可深挖点，并补充难点与踩坑复盘。",
  importance: 0.9,
});
const restated = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-2", signal: detectSignal("记住：沉淀口径不要变"), session: realtimeSession,
  llm: mockLlm(restatedPayload), route: realtimeRoute,
});
assert.equal(restated.appended, true, "重申时仍然落盘");
assert.equal(restated.supersedesId, rtEntry.id, "重申走 supersede 而不是新增同义条目");
const afterRestate = readFileSync(join(projectRt, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(afterRestate.find((m) => m.id === rtEntry.id).status, "superseded", "旧条目被标记 superseded");
assert.equal(afterRestate.filter((m) => m.type === "preference" && isCoreMemory(m)).length, 1, "Core 里只剩一条偏好");

// 模型没按格式返回 JSON 时要重试一次，而不是一次失败就放弃
let refineCalls = 0;
const flakyJsonLlm = { async *stream() {
  refineCalls += 1;
  const payload = refineCalls === 1
    ? "好的，我来整理一下：\n这条记忆讲的是回答风格要求。"   // 第一次答成自然语言
    : JSON.stringify({ resolved: true, type: "preference", title: "回答须言简意赅直击重点", content: "用户要求所有回答言简意赅、直击重点，不铺垫不啰嗦，适用于全部对话场景。", importance: 0.85 });
  yield { type: "text-delta", index: 0, text: payload };
  yield { type: "finish", reason: { kind: "stop" } };
} };
const retriedSignal = detectSignal("帮我记住我说的首句");
const retried = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-retry", signal: retriedSignal, session: realtimeSession,
  llm: flakyJsonLlm, route: realtimeRoute,
});
assert.equal(refineCalls, 2, "第一次输出不是 JSON 时会重排一次");
assert.equal(retried.appended, true, "重试成功后正常落盘，而不是报「未记住」");

// 两次都不是 JSON → 放弃，但失败原因要说准，并留下模型的原始输出供排查
const badJsonLlm = { async *stream() {
  yield { type: "text-delta", index: 0, text: "我觉得这条不用记吧，你看呢？" };
  yield { type: "finish", reason: { kind: "stop" } };
} };
const badJson = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-badjson", signal: detectSignal("帮我记住我说的准则"), session: realtimeSession,
  llm: badJsonLlm, route: realtimeRoute,
});
assert.equal(badJson.refineStatus, "refine_unparseable", "两次都解析不了才放弃");
const badJsonTimeline = readFileSync(join(projectRt, ".project-brain", "timeline.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const badJsonEvent = badJsonTimeline.filter((e) => e.eventType === "memory_rejected").pop();
assert.match(badJsonEvent.detail, /没按要求返回 JSON/, "原因写的是格式问题，不是「缺少模型」");
assert.doesNotMatch(badJsonEvent.detail, /缺少可用的.*模型/, "模型明明可用，不能把人引去查配置");
assert.match(badJsonEvent.sample, /我觉得这条不用记吧/, "留下模型的原始输出，排查时比任何描述都有用");

// 弱信号（「以后都…」）现在也会落盘，但门槛更严、标记不同
const weakSignal = detectSignal("以后都用 PostgreSQL，别再用 MySQL 了");
assert.equal(weakSignal.strength, "weak", "「以后都…」仍归为弱信号");

// 弱信号 + 无 LLM → 安静跳过，不写「未记住」（用户并没要求记）
const weakNoLlm = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-w0", signal: weakSignal, session: realtimeSession,
  llm: null, route: null,
});
assert.equal(weakNoLlm.skipped, "weak_unresolved", "弱信号解不开就跳过");
assert.equal(weakNoLlm.noted, undefined, "弱信号失败不写「未记住」，避免报没人要求的事");

const weakPayload = JSON.stringify({
  resolved: true,
  type: "decision",
  title: "订单库统一用 PostgreSQL",
  content: "项目约定订单相关数据一律存 PostgreSQL，不再新增 MySQL 依赖，理由是需要事务能力。",
  importance: 0.95,
});
const weakAdmitted = await handleOne({
  fs: fsAdapter, projectPath: projectRt, sessionId: "rt-w1", signal: weakSignal, session: realtimeSession,
  llm: mockLlm(weakPayload), route: realtimeRoute,
});
assert.equal(weakAdmitted.appended, true, "弱信号经 LLM 消解后可以落盘");
const weakRows = readFileSync(join(projectRt, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const weakEntry = weakRows[weakRows.length - 1];
assert.equal(weakEntry.source.kind, "user_intent_weak", "弱信号不冒充 user_explicit");
assert.ok(weakEntry.tags.includes("weak_signal"), "打上 weak_signal 标签");
assert.ok(weakEntry.importance <= 0.7, "弱信号重要性被压一档，不能靠模型自报 0.95");
assert.ok(weakEntry.confidence <= 0.7, "弱信号可信度被压一档");

// 上下文窗口必须带上 assistant 消息，否则指代永远解不开
const window = contextWindow(realtimeSession);
assert.match(window, /ASSISTANT: /, "上下文窗口包含 assistant 消息");
assert.match(window, /面试素材库/, "上下文窗口带上了真正的指代对象");

// 长对话里「这个对话的第一句」也要能解开：只取末尾 N 条的话，开头永远在窗口外
const longSession = { deriveMessages() {
  const msgs = [{ role: "user", content: [{ type: "text", text: "开场白：这个项目要沉淀成面试素材库" }] }];
  for (let i = 0; i < 40; i++) {
    msgs.push({ role: i % 2 === 0 ? "assistant" : "user", content: [{ type: "text", text: "中间第 " + i + " 轮的闲聊内容" }] });
  }
  msgs.push({ role: "user", content: [{ type: "text", text: "最后一句：收尾确认" }] });
  return msgs;
} };
const longWindow = contextWindow(longSession);
assert.match(longWindow, /开场白：这个项目要沉淀成面试素材库/, "长对话里开头那句仍在窗口内");
assert.match(longWindow, /最后一句：收尾确认/, "最近的消息也在窗口内");
assert.match(longWindow, /中间省略/, "中间轮次被省略时有明确标记");
assert.equal(longWindow.includes("中间第 20 轮"), false, "中间大段确实被省略，不会撑爆预算");
assert.ok(longWindow.length <= 7000, "窗口不超过字符预算");

// 带锚点的正文不该被指代门误伤
assert.equal(hasUnresolvedReference("网关约定", "所有对外 API 必须走这个网关，内网调用不走。"), false, "含标识符锚点的短正文不算未消解");
assert.equal(hasUnresolvedReference("事务约定", "业务数据库必须支持事务能力，用于保障订单写入一致性和故障恢复。"), false, "无指代词的正文直接放行");

// ───────── 人工维护记忆：编辑 / 归档 / 恢复 / 永久删除 ─────────
const editRows = [
  { id: "mem-edit-1", type: "context", title: "旧标题", content: "这条记忆的内容需要被人工修正，原文写得不清楚。", importance: 0.5, status: "active", tags: ["realtime"], source: { kind: "user_explicit", fingerprint: "stale-fingerprint" }, createdAt: 1000, updatedAt: 1000 },
  { id: "mem-edit-2", type: "decision", title: "另一条决策", content: "项目决定用 PostgreSQL 承载订单数据，因为需要事务能力。", importance: 0.8, status: "active", createdAt: 2000, updatedAt: 2000 },
];

// 编辑：原地改，id 与 createdAt 不变
const edited = applyMemoryEdit(editRows, {
  id: "mem-edit-1",
  patch: { title: "项目沉淀按面试素材库口径组织", content: "所有项目沉淀的目标是面试素材库，结构默认 STAR 加技术亮点。", type: "preference", importance: 0.9, status: "active", tags: ["preference", "user"] },
  now: 5000,
});
assert.equal(edited.ok, true, "编辑成功");
assert.equal(edited.changed, true, "编辑标记为已改动");
assert.equal(edited.entry.id, "mem-edit-1", "编辑保留原 id");
assert.equal(edited.entry.createdAt, 1000, "编辑保留原 createdAt");
assert.equal(edited.entry.updatedAt, 5000, "编辑刷新 updatedAt");
assert.equal(edited.entry.type, "preference", "类型可改");
assert.equal(edited.entry.importance, 0.9, "重要性可改");
assert.deepEqual(edited.entry.tags, ["preference", "user"], "标签可改");
assert.equal(edited.entry.source.kind, "user_explicit", "来源 kind 保留");
assert.notEqual(edited.entry.source.fingerprint, "stale-fingerprint", "正文改了必须重算 fingerprint");
assert.equal(edited.entry.source.editedBy, "user", "留下人工编辑痕迹");
assert.equal(edited.rows.length, 2, "编辑不新增行");

// 编辑校验
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { title: "   " } }).code, "E_NO_TITLE", "空标题被拒");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { content: "太短" } }).code, "E_CONTENT_TOO_SHORT", "正文过短被拒");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { type: "nonsense" } }).code, "E_INVALID_TYPE", "非法类型被拒");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { importance: 3 } }).code, "E_INVALID_IMPORTANCE", "越界重要性被拒");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { status: "archived" } }).code, "E_INVALID_STATUS", "归档不能走编辑表单");
assert.equal(applyMemoryEdit(editRows, { id: "mem-nope", patch: { title: "x" } }).code, "E_NOT_FOUND", "id 不存在");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit", patch: { title: "x" } }).code, "E_AMBIGUOUS_ID", "前缀命中多条要报歧义");
assert.equal(applyMemoryEdit(editRows, { id: "mem-edit-1", patch: { title: "旧标题" }, now: 5000 }).changed, false, "没有实际变化 → changed=false");

// 归档 → 从 Core 消失但行还在
const archived = applyMemoryStatus(editRows, { id: "mem-edit-1", status: "archived", reason: "内容空洞", now: 6000 });
assert.equal(archived.ok, true, "归档成功");
assert.equal(archived.rows.length, 2, "归档保留行");
assert.equal(archived.entry.status, "archived", "状态变 archived");
assert.equal(archived.entry.archiveReason, "内容空洞", "归档理由被记下");
assert.equal(archived.rows.filter(isCoreMemory).length, 1, "归档后不再算 Core");

// 恢复 → 清掉归档痕迹，否则 housekeep 下轮又按旧理由归回去
const restored = applyMemoryStatus(archived.rows, { id: "mem-edit-1", status: "active", now: 7000 });
assert.equal(restored.ok, true, "恢复成功");
assert.equal(restored.entry.status, "active", "状态回到 active");
assert.equal(restored.entry.archiveReason, undefined, "恢复清掉 archiveReason");
assert.equal(restored.rows.filter(isCoreMemory).length, 2, "恢复后重新进 Core");

// 归档态的记忆仍可被 id 命中并恢复；但重复归档是 no-op
assert.equal(applyMemoryStatus(archived.rows, { id: "mem-edit-1", status: "archived", now: 8000 }).changed, false, "重复归档 → changed=false");

// 永久删除 → 物理删行，并清理指向它的悬空 supersededBy
const withPointer = archived.rows.map((m) => (m.id === "mem-edit-2" ? Object.assign({}, m, { supersededBy: "mem-edit-1" }) : m));
const deleted = applyMemoryDelete(withPointer, { id: "mem-edit-1" });
assert.equal(deleted.ok, true, "删除成功");
assert.equal(deleted.rows.length, 1, "删除后物理少一行");
assert.equal(deleted.rows.find((m) => m.id === "mem-edit-1"), undefined, "目标行已消失");
assert.equal(deleted.rows[0].supersededBy, undefined, "指向被删条目的悬空指针被清理");
assert.equal(applyMemoryDelete(editRows, { id: "mem-nope" }).code, "E_NOT_FOUND", "删除不存在的 id 会报错");

// ───────── 空闲触发摘要（原先挂 session/disposed，线上一次都没派发过）─────────
const idleJobs = [];
const sched = createIdleSummaryScheduler((job) => idleJobs.push(job), 40);

// 会话还在动 → 闹钟一直往后推，不该摘要
sched.schedule({ projectPath: "/p", session: { id: "s1" }, sessionId: "s1" });
await new Promise((r) => setTimeout(r, 25));
sched.schedule({ projectPath: "/p", session: { id: "s1" }, sessionId: "s1" });
await new Promise((r) => setTimeout(r, 25));
assert.equal(idleJobs.length, 0, "会话持续有动静时不触发摘要");

// 安静够久 → 触发一次
await new Promise((r) => setTimeout(r, 60));
assert.equal(idleJobs.length, 1, "空闲满时长后触发一次摘要");
assert.equal(idleJobs[0].projectPath, "/p", "带上正确的 workspace");
assert.equal(sched.size(), 0, "触发后队列清空");

// 不同 workspace 各自排队，互不干扰
sched.schedule({ projectPath: "/a", sessionId: "sa" });
sched.schedule({ projectPath: "/b", sessionId: "sb" });
assert.equal(sched.size(), 2, "两个 workspace 各排各的");
await new Promise((r) => setTimeout(r, 70));
assert.equal(idleJobs.length, 3, "两个 workspace 都触发了");

// disposed 真发生时要能取消待触发的闹钟，避免重复摘要
sched.schedule({ projectPath: "/c", sessionId: "sc" });
sched.cancel("/c");
await new Promise((r) => setTimeout(r, 60));
assert.equal(idleJobs.filter((j) => j.projectPath === "/c").length, 0, "取消后不再触发");

// flushAll 必须带上排队时的 session，不能只剩 sessionId
const keptSession = { id: "s-keep", cwd: "/keep" };
sched.schedule({ projectPath: "/keep", session: keptSession, sessionId: "s-keep" });
assert.equal(sched.size(), 1, "flushAll 前队列里有这一条");
sched.flushAll();
assert.equal(sched.size(), 0, "flushAll 后队列清空");
const flushed = idleJobs.find((j) => j.projectPath === "/keep");
assert.ok(flushed, "flushAll 会立刻跑摘要");
assert.equal(flushed.session, keptSession, "flushAll 带上排队时的 session");
assert.equal(flushed.sessionId, "s-keep", "flushAll 带上 sessionId");
await new Promise((r) => setTimeout(r, 60));
assert.equal(idleJobs.filter((j) => j.projectPath === "/keep").length, 1, "flushAll 取消了闹钟，不会再触发第二次");

// 幂等改成按消息增量算：长会话必须能多次沉淀
const fakeSession = (n) => ({ deriveMessages: () => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i })) });
assert.equal(countSessionMessages(fakeSession(7)), 7, "能数出会话消息数");
assert.equal(countSessionMessages(null), 0, "拿不到会话时返回 0 而不是炸");

const tlWithSummary = [
  { eventType: "session_summary", sessionId: "s1", messageCount: 10 },
  { eventType: "session_summary", sessionId: "s1", messageCount: 26 },
  { eventType: "session_summary", sessionId: "other", messageCount: 99 },
];
assert.equal(lastSummarizedMessageCount(tlWithSummary, "s1"), 26, "取该会话最新一次的覆盖点");
assert.equal(lastSummarizedMessageCount(tlWithSummary, "never"), null, "没摘过返回 null");
assert.equal(lastSummarizedMessageCount([{ eventType: "session_summary", sessionId: "s1" }], "s1"), 0, "老数据缺字段时当 0，让它还能再摘一次");
assert.ok(MIN_NEW_MESSAGES > 0, "增量门槛是正数");

// ───────── 热度回升：命中即「用过」 ─────────
const accessRows = [
  { id: "mem-hot", type: "decision", title: "常被查到的决策", content: "这条会被反复命中，用来验证热度回升。", importance: 0.5, status: "dormant", createdAt: 1000, updatedAt: 1000 },
  { id: "mem-cold", type: "decision", title: "没人查的决策", content: "这条从来没被命中过，用来做对照组。", importance: 0.5, status: "active", createdAt: 1000, updatedAt: 1000 },
];
const touched = applyAccessTouch(accessRows, ["mem-hot"], 500000);
assert.equal(touched.changed, true, "首次命中会写 lastAccessedAt");
assert.equal(touched.rows.find((m) => m.id === "mem-hot").lastAccessedAt, 500000, "记录命中时间");
assert.equal(touched.rows.find((m) => m.id === "mem-hot").accessCount, 1, "命中次数从 1 开始");
assert.equal(touched.rows.find((m) => m.id === "mem-cold").lastAccessedAt, undefined, "没命中的不动");

// 节流：一轮对话里连续 ask 不该把整表重写好几遍
const throttled = applyAccessTouch(touched.rows, ["mem-hot"], 500000 + 60_000);
assert.equal(throttled.changed, false, "节流窗口内重复命中不再写盘");
const afterWindow = applyAccessTouch(touched.rows, ["mem-hot"], 500000 + ACCESS_THROTTLE_MS + 1);
assert.equal(afterWindow.changed, true, "超过节流窗口后重新记一次");
assert.equal(afterWindow.rows.find((m) => m.id === "mem-hot").accessCount, 2, "命中次数累加");

// 排序：常被查到的记忆不该因为很久没改就沉下去
const hotNow = Date.now();
const rankRows = [
  { id: "r-hot", type: "decision", title: "事务一致性约定", content: "订单写入必须走事务，用于保障跨表一致性。", importance: 0.6, confidence: 0.8, status: "active", createdAt: hotNow - 200 * 86400000, updatedAt: hotNow - 200 * 86400000, lastAccessedAt: hotNow },
  { id: "r-cold", type: "decision", title: "事务一致性备注", content: "订单写入必须走事务，用于保障跨表一致性。", importance: 0.6, confidence: 0.8, status: "active", createdAt: hotNow - 200 * 86400000, updatedAt: hotNow - 200 * 86400000 },
];
const ranked = retrieveMemories({ memories: rankRows, query: "事务", topK: 2, now: hotNow });
assert.equal(ranked[0].memory.id, "r-hot", "近期被命中过的排在前面");

// 淘汰：最近用过的比没人用的更晚被挤出 Core
const evictRows = [
  { id: "e-used", type: "decision", title: "用过的", content: "最近被检索命中过的记忆，应该更晚被淘汰。", importance: 0.5, status: "active", createdAt: 1, updatedAt: 1, lastAccessedAt: hotNow, source: { kind: "agent" } },
  { id: "e-idle", type: "decision", title: "没用过的", content: "从来没被命中过的记忆，应该先被挤出 Core。", importance: 0.5, status: "active", createdAt: 9000, updatedAt: 9000, source: { kind: "agent" } },
];
const evicted = enforceCoreCap(evictRows, { limits: { maxItems: 1, maxTokens: 100000 }, now: hotNow });
assert.equal(evicted.rows.find((m) => m.id === "e-used").status, "active", "最近用过的留在 Core");
assert.equal(evicted.rows.find((m) => m.id === "e-idle").status, "dormant", "没人用的先被挤成 dormant");

// ───────── 低可信度记忆要被打折 ─────────
assert.equal(trustFactor(0.9), 1, "可信度达标不打折");
assert.equal(trustFactor(0.6), 1, "刚好到阈值不打折");
assert.ok(trustFactor(0.4) < 0.7, "grounding 失败（0.4）明显打折");
assert.ok(trustFactor(0.4) > trustFactor(0.2), "可信度越低折扣越狠");
assert.ok(trustFactor(0.01) >= 0.35, "打折有下限，不会把记忆完全抹掉");

const trustNow = Date.now();
const trustRows = [
  { id: "t-solid", type: "decision", title: "数据库选型", content: "订单库选 PostgreSQL，因为需要事务能力。", importance: 0.7, confidence: 0.9, status: "active", createdAt: trustNow, updatedAt: trustNow },
  { id: "t-shaky", type: "decision", title: "数据库选型备选", content: "订单库选 PostgreSQL，因为需要事务能力。", importance: 0.75, confidence: 0.4, status: "active", createdAt: trustNow, updatedAt: trustNow },
];
const trustRanked = retrieveMemories({ memories: trustRows, query: "数据库", topK: 2, now: trustNow });
assert.equal(trustRanked[0].memory.id, "t-solid", "重要性略低但可信的，排在疑似幻觉前面");

// ───────── Core 保障：置顶 / 容量 / 来源优先级 ─────────
const capLimits = { maxItems: 3, maxTokens: 100000 };
const makeRow = (id, extra) => Object.assign({
  id,
  type: "decision",
  title: "记忆 " + id,
  content: "用来验证 Core 容量淘汰顺序的占位正文，长度足够通过校验。",
  importance: 0.5,
  status: "active",
  createdAt: 1000,
  updatedAt: 1000,
}, extra || {});

// 置顶的不被挤掉，哪怕它重要性最低、最旧
const pinRows = [
  makeRow("m-pinned", { pinned: true, importance: 0.1, updatedAt: 1 }),
  makeRow("m-a", { importance: 0.9, updatedAt: 9000 }),
  makeRow("m-b", { importance: 0.8, updatedAt: 8000 }),
  makeRow("m-c", { importance: 0.7, updatedAt: 7000 }),
  makeRow("m-d", { importance: 0.6, updatedAt: 6000 }),
];
const pinCapped = enforceCoreCap(pinRows, { limits: capLimits, now: 10000 });
assert.equal(pinCapped.rows.find((m) => m.id === "m-pinned").status, "active", "置顶的记忆不会被容量淘汰挤掉");
assert.equal(pinCapped.rows.filter(isCoreMemory).length, 3, "淘汰到配置上限为止");

// 用户亲手写的比自动抓的更晚被淘汰
const authorRows = [
  makeRow("m-auto-1", { importance: 0.5, updatedAt: 9000, source: { kind: "agent" } }),
  makeRow("m-auto-2", { importance: 0.5, updatedAt: 8000, source: { kind: "session_semantic" } }),
  makeRow("m-user", { importance: 0.5, updatedAt: 1, source: { kind: "user_explicit" } }),
  makeRow("m-edited", { importance: 0.5, updatedAt: 2, source: { kind: "agent", editedBy: "user" } }),
];
const authorCapped = enforceCoreCap(authorRows, { limits: { maxItems: 2, maxTokens: 100000 }, now: 10000 });
assert.equal(authorCapped.rows.find((m) => m.id === "m-user").status, "active", "user_explicit 的记忆最后才被淘汰");
assert.equal(authorCapped.rows.find((m) => m.id === "m-edited").status, "active", "人工编辑过的记忆最后才被淘汰");
assert.equal(authorCapped.rows.find((m) => m.id === "m-auto-1").status, "dormant", "自动抓的先被挤成 dormant");

// 置顶有数量上限：全部置顶等于没有置顶
const pinLimit = maxPinnedCount(capLimits);
assert.equal(pinLimit, 1, "置顶上限 = 容量的一半（向下取整，至少 1）");
const alreadyPinned = [
  makeRow("p-1", { pinned: true }),
  makeRow("p-2"),
];
const pinRejected = applyMemoryEdit(alreadyPinned, { id: "p-2", patch: { pinned: true }, limits: capLimits });
assert.equal(pinRejected.code, "E_PIN_LIMIT", "超出置顶上限时拒绝并给出原因");
const pinAccepted = applyMemoryEdit(alreadyPinned, { id: "p-1", patch: { pinned: false }, limits: capLimits });
assert.equal(pinAccepted.ok, true, "取消置顶不受上限限制");
assert.equal(pinAccepted.entry.pinned, undefined, "取消置顶后字段被移除而不是留 false");

// ───────── vacuum：主文件瘦身，但绝不真删 ─────────
const vacNow = Date.now();
const old = (days) => vacNow - days * 86400000;
const vacConfig = { vacuumMemoryRetainDays: 90, vacuumMemoryMinRetained: 0, vacuumTimelineMaxEvents: 3, vacuumTimelineRetainDays: 180 };
const vacRows = [
  { id: "v-active", type: "decision", title: "活跃决策", content: "还在用的决策，任何情况下都不该被搬走。", status: "active", updatedAt: old(999) },
  { id: "v-dormant", type: "decision", title: "休眠决策", content: "休眠只是不注入，仍然可检索，不该被搬走。", status: "dormant", updatedAt: old(999) },
  { id: "v-old", type: "decision", title: "过期归档", content: "归档很久且没人引用，可以搬到 archive。", status: "archived", updatedAt: old(200) },
  { id: "v-fresh", type: "decision", title: "新归档", content: "刚归档不久，还在保留期内，先留着。", status: "archived", updatedAt: old(10) },
  { id: "v-pinned", type: "decision", title: "置顶但已归档", content: "用户置顶过的条目，即使归档也别动。", status: "archived", pinned: true, updatedAt: old(300) },
  { id: "v-referenced", type: "decision", title: "被引用的旧版", content: "它是某条现行记忆的前身，证据链要留着。", status: "superseded", updatedAt: old(300) },
  { id: "v-successor", type: "decision", title: "现行版本", content: "取代了上面那条旧版，指向它作为证据链。", status: "active", supersededBy: null, source: { supersedes: "v-referenced" }, updatedAt: vacNow },
];
const vacPlan = planMemoryVacuum(vacRows, { now: vacNow, config: vacConfig });
const evictedIds = vacPlan.evict.map((m) => m.id);
assert.deepEqual(evictedIds, ["v-old"], "只搬走过期、无人引用、非置顶的归档行");
assert.equal(vacPlan.keep.length, 6, "其余全部留在主文件");
assert.equal(vacPlan.keep.some((m) => m.id === "v-active"), true, "活跃记忆绝不被搬走");
assert.equal(vacPlan.keep.some((m) => m.id === "v-dormant"), true, "dormant 仍可检索，不被搬走");
assert.equal(vacPlan.keep.some((m) => m.id === "v-pinned"), true, "置顶的即使归档也不搬");
assert.equal(vacPlan.keep.some((m) => m.id === "v-referenced"), true, "被 supersedes 指向的证据链留着");

// 保留下限：宁可不瘦身也别把归档区一次清空
const floorPlan = planMemoryVacuum(vacRows, { now: vacNow, config: Object.assign({}, vacConfig, { vacuumMemoryMinRetained: 200 }) });
assert.equal(floorPlan.evict.length, 0, "归档总数没超过保留下限时一行都不搬");

// timeline 截断要留住第一屏依赖的锚点
const vacEvents = [
  { id: "e-init", eventType: "init", title: "项目初始化", occurredAt: old(900) },
  { id: "e-sum-old", eventType: "session_summary", title: "旧摘要", occurredAt: old(800) },
  { id: "e-sum-new", eventType: "session_summary", title: "最新摘要", occurredAt: old(400) },
  { id: "e-noise-1", eventType: "memory", title: "杂项 1", occurredAt: old(500) },
  { id: "e-noise-2", eventType: "memory", title: "杂项 2", occurredAt: old(3) },
  { id: "e-noise-3", eventType: "memory", title: "杂项 3", occurredAt: old(2) },
  { id: "e-noise-4", eventType: "memory", title: "杂项 4", occurredAt: old(1) },
];
const trimPlan = planTimelineTrim(vacEvents, { now: vacNow, config: vacConfig });
const trimKeptIds = trimPlan.keep.map((e) => e.id);
assert.ok(trimKeptIds.includes("e-init"), "init 是任务动态的主干起点，再旧也留");
assert.ok(trimKeptIds.includes("e-sum-new"), "最新 session_summary 是第一屏「最近做什么」的来源，必须留");
assert.equal(trimKeptIds.includes("e-sum-old"), false, "旧摘要超出保留窗口，可以搬走");
assert.equal(trimKeptIds.includes("e-noise-1"), false, "超出保留天数的杂项被搬走");
assert.ok(trimPlan.evict.length > 0, "确实有事件被搬走");
assert.equal(trimPlan.keep.length + trimPlan.evict.length, vacEvents.length, "搬走的加留下的等于总数，没有凭空消失");

// 端到端：先写 archive 再缩主文件，数据找得回来
const vacProject = join(root, "vacuum");
writeBrain(vacProject, "vacuum", "基线决策");
writeFileSync(join(vacProject, ".project-brain", "memory.jsonl"), vacRows.map((m) => JSON.stringify(m)).join("\n") + "\n");
writeFileSync(join(vacProject, ".project-brain", "timeline.jsonl"), vacEvents.map((e) => JSON.stringify(e)).join("\n") + "\n");

const vacDry = await vacuumBrain({ fs: fsAdapter, projectPath: vacProject, config: vacConfig, now: vacNow, dryRun: true });
assert.equal(vacDry.dryRun, true, "dryRun 默认只出计划");
assert.equal(vacDry.plan.memory.evicted, 1, "计划里报了会搬走多少条记忆");
assert.equal(readFileSync(join(vacProject, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").length, 7, "dryRun 不碰文件");

const vacRun = await vacuumBrain({ fs: fsAdapter, projectPath: vacProject, config: vacConfig, now: vacNow, dryRun: false });
assert.equal(vacRun.ok, true, "vacuum 执行成功");
assert.equal(vacRun.changed, true, "确实做了改动");
const vacMain = readFileSync(join(vacProject, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(vacMain.length, 6, "主文件真的变小了");
assert.equal(vacMain.some((m) => m.id === "v-old"), false, "过期归档已移出主文件");

const memArchive = vacRun.archives.find((a) => a.kind === "memory");
assert.ok(memArchive, "记录了归档文件路径");
const archivedRows = readFileSync(join(vacProject, ".project-brain", memArchive.path), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(archivedRows.length, 1, "被搬走的行完整落在 archive 里");
assert.equal(archivedRows[0].id, "v-old", "搬走的就是那条过期归档，数据没丢");

// 重复跑不该再动任何东西
const vacAgain = await vacuumBrain({ fs: fsAdapter, projectPath: vacProject, config: vacConfig, now: vacNow, dryRun: false });
assert.equal(vacAgain.changed, false, "已经没有可搬的行时不再写文件");
assert.equal(vacAgain.archives.length, 0, "空跑不产生新的 archive 文件");

// project_dream 工具层：light 不碰主文件体积，full 才 vacuum
const dreamProject = join(root, "dream-full");
writeBrain(dreamProject, "dream-full", "基线决策");
writeFileSync(join(dreamProject, ".project-brain", "memory.jsonl"), vacRows.map((m) => JSON.stringify(m)).join("\n") + "\n");
writeFileSync(join(dreamProject, ".project-brain", "timeline.jsonl"), vacEvents.map((e) => JSON.stringify(e)).join("\n") + "\n");
const dreamTool = buildDreamTool({ fs: fsAdapter, sandboxPolicy: null, getMemoryConfig: () => vacConfig });
const dreamExec = { sessionId: "dream-1", session: { id: "dream-1", header: { cwd: dreamProject } } };

const lightRun = await dreamTool.execute({ mode: "light", dryRun: false, path: dreamProject }, dreamExec);
assert.equal(lightRun.ok, true, "light 模式执行成功");
assert.equal(lightRun.data.vacuum, undefined, "light 模式不做 vacuum");
assert.equal(readFileSync(join(dreamProject, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").length, 7, "light 不减少主文件行数");

const fullDry = await dreamTool.execute({ mode: "full", dryRun: true, path: dreamProject }, dreamExec);
assert.ok(fullDry.data.vacuum, "full + dryRun 会给出 vacuum 计划");
assert.equal(fullDry.data.summary.vacuumCandidates > 0, true, "计划里报了待搬行数");
assert.equal(readFileSync(join(dreamProject, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").length, 7, "full + dryRun 仍然不碰文件");

const fullRun = await dreamTool.execute({ mode: "full", dryRun: false, path: dreamProject }, dreamExec);
assert.equal(fullRun.ok, true, "full 模式执行成功");
assert.ok(fullRun.data.committed.vacuumed > 0, "报告了实际搬走多少行");
assert.ok(fullRun.data.archives.length > 0, "返回 archive 文件路径供用户查找");
const dreamMain = readFileSync(join(dreamProject, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n");
assert.ok(dreamMain.length < 7, "full 模式让主文件真的变小");
assert.match(fullRun.data.note, /archive/, "note 里说明数据搬到哪了");

// ───────── 并发写入不丢数据 ─────────
// fs 只有覆盖写，append 是「读全文 → 拼接 → 写全文」。没有串行化时，
// 并发的 append 会各自基于旧快照写回，后写的把先写的抹掉。
const concurrentDir = join(root, "concurrent");
mkdirSync(join(concurrentDir, ".project-brain"), { recursive: true });
const concurrentFile = join(concurrentDir, ".project-brain", "timeline.jsonl");
writeFileSync(concurrentFile, "");

const APPEND_N = 40;
await Promise.all(
  Array.from({ length: APPEND_N }, (_, i) =>
    appendJsonl(fsAdapter, concurrentFile, { id: "evt-" + i, seq: i })),
);
const appendedRows = readFileSync(concurrentFile, "utf8").trim().split("\n").map(JSON.parse);
assert.equal(appendedRows.length, APPEND_N, APPEND_N + " 条并发 append 全部落盘，一条都不丢");
assert.equal(new Set(appendedRows.map((r) => r.seq)).size, APPEND_N, "并发 append 没有重复或覆盖");

// 并发 admit：两条不同记忆同时写入，必须都在
const concurrentBrain = join(root, "concurrent-admit");
writeBrain(concurrentBrain, "concurrent", "基线决策");
const admitCandidate = (n) => ({
  type: "decision",
  title: "并发决策 " + n,
  content: "第 " + n + " 条并发写入的决策，用于验证读整表到写回之间没有被别的序列插进来。",
  importance: 0.6,
  source: { kind: "agent" },
});
const admitResults = await Promise.all(
  Array.from({ length: 6 }, (_, i) =>
    admitMemory({
      fs: fsAdapter,
      projectPath: concurrentBrain,
      candidate: admitCandidate(i),
      channel: "automatic",
      llmConfirm: { admit: true },
    })),
);
assert.equal(admitResults.filter((r) => r.ok && r.action === "insert").length, 6, "6 条并发 admit 全部 insert");
const admitRows = readFileSync(join(concurrentBrain, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(admitRows.filter((m) => /^并发决策/.test(m.title)).length, 6, "并发 admit 的 6 条都在文件里");

// admit 与整表重写（归档）并发：两边的结果都必须保留
const mixedTarget = admitRows.find((m) => m.title === "并发决策 0");
await Promise.all([
  admitMemory({
    fs: fsAdapter,
    projectPath: concurrentBrain,
    candidate: admitCandidate(99),
    channel: "automatic",
    llmConfirm: { admit: true },
  }),
  withWriteLock(brainTxKey(concurrentBrain, "memory.jsonl"), async () => {
    const rows = await readJsonl(fsAdapter, join(concurrentBrain, ".project-brain", "memory.jsonl"));
    const next = applyMemoryStatus(rows, { id: mixedTarget.id, status: "archived", reason: "并发验证" });
    return writeJsonl(fsAdapter, join(concurrentBrain, ".project-brain", "memory.jsonl"), next.rows);
  }),
]);
const mixedRows = readFileSync(join(concurrentBrain, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(mixedRows.filter((m) => m.title === "并发决策 99").length, 1, "整表重写没有吞掉并发 append 的新记忆");
assert.equal(mixedRows.find((m) => m.id === mixedTarget.id).status, "archived", "append 没有回滚掉并发的整表重写");
assert.equal(pendingLockCount(), 0, "所有写入完成后锁队列应排空，不泄漏");

// 重入检测：持锁期间再取同一把锁必须当场报错，而不是自己等自己
await assert.rejects(
  withWriteLock("reentry-key", () => withWriteLock("reentry-key", async () => "inner")),
  (e) => e.code === "E_WRITE_LOCK_REENTRY",
  "嵌套获取同一把锁立刻抛 E_WRITE_LOCK_REENTRY，不挂起",
);
// 不同 key 的嵌套是合法的（事务锁套文件锁就是这么用的）
assert.equal(
  await withWriteLock("outer-key", () => withWriteLock("inner-key", async () => "ok")),
  "ok",
  "不同 key 的嵌套正常放行",
);
// 报错之后锁要正常释放，不能把后续任务堵死
assert.equal(await withWriteLock("reentry-key", async () => "after"), "after", "重入报错不影响后续取锁");

// 人工维护的完整链路必须真的返回。这条曾经因为在锁内调 buildWorkspacePreview
// （内部会再取同一把事务锁）而永远不 settle：数据写进去了，前端一直转圈。
const rpcProject = join(root, "rpc-mutation");
writeBrain(rpcProject, "rpc-mutation", "基线决策");
writeFileSync(join(rpcProject, ".project-brain", "memory.jsonl"), JSON.stringify({
  id: "mem-rpc-1", type: "decision", title: "会被归档的决策",
  content: "用来验证归档 RPC 能在锁释放后正常返回，而不是挂起。",
  importance: 0.6, status: "active", createdAt: Date.now(), updatedAt: Date.now(),
}) + "\n");

const mutationArgs = (endpoint, payload) => ({
  endpoint, payload, projectPath: rpcProject, fs: fsAdapter, ctx: null, getMemoryConfig: () => ({}),
});
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout: " + label)), ms)),
]);

const archiveRpc = await withTimeout(
  handleMemoryMutation(mutationArgs("memory.status", { id: "mem-rpc-1", status: "archived" })),
  5000,
  "归档 RPC 未在 5 秒内返回（疑似死锁）",
);
assert.equal(archiveRpc.ok, true, "归档 RPC 正常返回");
assert.equal(archiveRpc.value.changed, true, "归档确实生效");
assert.ok(archiveRpc.value.preview, "返回里带上了最新 preview");

const restoreRpc = await withTimeout(
  handleMemoryMutation(mutationArgs("memory.status", { id: "mem-rpc-1", status: "active" })),
  5000,
  "恢复 RPC 未在 5 秒内返回（疑似死锁）",
);
assert.equal(restoreRpc.ok, true, "恢复 RPC 正常返回");
assert.equal(restoreRpc.value.memory.status, "active", "恢复后状态回到 active");

const editRpc = await withTimeout(
  handleMemoryMutation(mutationArgs("memory.update", { id: "mem-rpc-1", patch: { title: "改过标题的决策" } })),
  5000,
  "编辑 RPC 未在 5 秒内返回（疑似死锁）",
);
assert.equal(editRpc.value.memory.title, "改过标题的决策", "编辑 RPC 正常返回并生效");

const deleteRpc = await withTimeout(
  handleMemoryMutation(mutationArgs("memory.delete", { id: "mem-rpc-1", confirm: true })),
  5000,
  "删除 RPC 未在 5 秒内返回（疑似死锁）",
);
assert.equal(deleteRpc.value.deletedId, "mem-rpc-1", "删除 RPC 正常返回被删 id");
assert.equal(pendingLockCount(), 0, "RPC 跑完锁队列排空");

rmSync(root, { recursive: true, force: true });
console.log("project memory isolation: 230 assertions PASS");
