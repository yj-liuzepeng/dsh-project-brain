import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { scanProject } from "../src/scanner.js";
import { resolveProjectPath } from "../src/host/store/path-resolver.js";
import { setupInjector } from "../src/host/injector.js";
import { summarizeOne } from "../src/host/summarizer.js";
import { evidenceMatchesTranscript, extractSessionMemories } from "../src/host/memory/session-extractor.js";
import { detectSignal } from "../src/host/realtime-memory.js";
import { buildMemoryArchiveTool, buildMemorySupersedeTool } from "../src/tools/memory.js";
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
const sameSession = await summarizeOne({ fs: fsAdapter, projectPath: projectA, sessionId: "summary-1" });
assert.equal(sameSession.skipped, "session_already_summarized");
const secondSession = await summarizeOne({ fs: fsAdapter, projectPath: projectA, sessionId: "summary-2" });
assert.equal(secondSession.deduplicated, true);
const semanticJson = JSON.stringify({ memories: [
  { type: "decision", title: "选择事务数据库", content: "项目决定使用支持事务的数据库，以保障订单写入一致性。", importance: 0.8, confidence: 0.9 },
  { type: "requirement", title: "订单必须保持一致", content: "订单创建流程必须保证跨表写入的一致性和可恢复性。", importance: 0.85, confidence: 0.9 },
] });
const semanticSession = { deriveMessages() { return [{ role: "user", content: [{ type: "text", text: "我们经过方案评审，决定业务数据库必须支持事务能力，用于保证订单创建时跨表写入的一致性和故障恢复。请把这个长期约束记录下来。" }] }]; } };
const semanticLlm = { async *stream() { yield { type: "text-delta", index: 0, text: semanticJson }; yield { type: "finish", reason: { kind: "stop" } }; } };
const semanticResult = await summarizeOne({
  fs: fsAdapter, projectPath: projectA, sessionId: "summary-3", session: semanticSession,
  llm: semanticLlm, route: { provider: "test", model: "test-model" },
});
assert.equal(semanticResult.semanticMemories, 2);
const memories = readFileSync(join(projectA, ".project-brain", "memory.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.equal(memories.filter((item) => item.source && item.source.kind === "session_summary").length, 1);
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
assert.equal(neg1, null, "git 假阳性 → null");

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
  { type: "decision", title: "支持事务的数据库", content: "项目决定业务数据库必须支持事务能力，用于保障订单写入一致性。", evidence: "业务数据库必须支持事务能力", importance: 0.9, confidence: 0.9 },
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
  { type: "decision", title: "使用 MongoDB", content: "项目决定使用 MongoDB 替代关系数据库。", evidence: "MongoDB 性能比 PostgreSQL 好三倍", importance: 0.8, confidence: 0.95 },
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
  { type: "lesson", title: "测试很重要", content: "每次发版前都应该跑全套测试覆盖，否则可能出生产事故。", importance: 0.7, confidence: 0.9 },
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
assert.match(renderedC, /最近决策链/, "injector 必须渲染「最近决策链」段");
// 验证决策链段只取最近 3 条（按 createdAt 倒序：a1 > d3 > d2，含 1 条 architecture + 2 条 decision）
const decisionSection = renderedC.match(/### 最近决策链[\s\S]*?(?=\n### |\n## )/);
assert.ok(decisionSection, "能定位到「最近决策链」段");
const decisionSectionContent = decisionSection[0];
assert.match(decisionSectionContent, /分层架构/, "决策链含最近的 architecture（a1）");
assert.match(decisionSectionContent, /前端用 Vue 3/, "决策链含最近的 decision（d3）");
assert.match(decisionSectionContent, /API 用 Fastify/, "决策链含次新的 decision（d2）");
// 最早的 d1 和非 decision/architecture 的 b1 不应进入决策链
assert.doesNotMatch(decisionSectionContent, /使用 PostgreSQL 14/, "决策链不混入最早的 d1（超出 Top3）");
assert.doesNotMatch(decisionSectionContent, /修复某个 bug/, "决策链不混入 bug 类型（b1）");
// 决策链数量上限：<=3 条
const decisionItemCount = (decisionSectionContent.match(/^- /gm) || []).length;
assert.ok(decisionItemCount <= 3, `决策链 ≤ 3 条 (实际 ${decisionItemCount})`);

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
assert.equal(autoDreamResult.autoDream.triggered, true, "auto-dream 触发（≥ 30）");
assert.ok(autoDreamResult.autoDream.beforeCount >= 30, "beforeCount ≥ 30");
assert.ok(autoDreamResult.autoDream.merged > 0, "auto-dream 合并了重复 title（merged > 0）");
assert.ok(autoDreamResult.autoDream.afterCount < autoDreamResult.autoDream.beforeCount, "合并后 memory 数明显下降");

// 验证 timeline 写了 dream 事件
const dreamTimeline = readFileSync(join(projectD, ".project-brain", "timeline.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
assert.ok(dreamTimeline.some((e) => e.eventType === "dream" && /自动 Dream/.test(e.title)), "timeline 写了自动 Dream 事件");

// 第二次 summarizeOne → memory 数已低于阈值，auto-dream 不应触发
const afterDream = await summarizeOne({
  fs: fsAdapter, projectPath: projectD, sessionId: "dream-2",
  llm: null, route: null, config: {},
});
assert.ok(afterDream.autoDream, "autoDream 字段存在");
assert.equal(afterDream.autoDream.triggered, false, "auto-dream 不触发（已清理到阈值以下）");

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

rmSync(root, { recursive: true, force: true });
console.log("project memory isolation: 56 assertions PASS");
