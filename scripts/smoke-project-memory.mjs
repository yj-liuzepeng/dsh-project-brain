import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { scanProject } from "../src/scanner.js";
import { resolveProjectPath } from "../src/host/store/path-resolver.js";
import { setupInjector } from "../src/host/injector.js";
import { summarizeOne } from "../src/host/summarizer.js";

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

rmSync(root, { recursive: true, force: true });
console.log("project memory isolation: 20 assertions PASS");
