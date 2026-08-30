// smoke-test.mjs - 离线端到端验证（无需 DSH runtime）
// 覆盖：scanner / brain-files / brain-logic / build.loadProjectData
// 用一个临时 fixture 项目跑完整数据流，输出 PASS/FAIL，失败非零退出。
//
// 用法：node scripts/smoke-test.mjs

import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstReadmeParagraph, sanitizeProjectDescription, scanProject } from "../src/scanner.js";
import * as files from "../src/host/store/brain-files.js";
import * as logic from "../src/host/store/brain-logic.js";
import { loadProjectData } from "../build.js";

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failed += 1;
    console.log("  FAIL  " + name + (extra ? "  -> " + extra : ""));
  }
}

// ─── DSH fs 服务适配器（node 实现，接口与 src 内使用面一致） ───
const fsAdapter = {
  async resolve(p, opts) {
    if (opts && opts.cwd) return join(opts.cwd, p);
    return p;
  },
  async readText(target) { return readFileSync(target, "utf8"); },
  async writeText(target, content) {
    const dir = target.slice(0, target.lastIndexOf("/"));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, content, "utf8");
  },
  async listDir(target) {
    return readdirSync(target, { withFileTypes: true }).map((e) => ({
      name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory(),
    }));
  },
  processPath(target) { return target; },
};

// ─── fixture 项目 ───
const root = mkdtempSync(join(tmpdir(), "dsh-brain-smoke-"));
mkdirSync(join(root, "src"), { recursive: true });
writeFileSync(join(root, "package.json"), JSON.stringify({
  name: "smoke-fixture",
  dependencies: { express: "4.19.0", react: "18.3.0" },
  devDependencies: { typescript: "5.4.0" },
  scripts: { dev: "tsx src/index.ts" },
}));
writeFileSync(join(root, "src", "index.js"), "import { app } from './app.js'; app.listen(3000);");
writeFileSync(join(root, "src", "app.js"), "const express = require('express'); module.exports = { app: express() };");
writeFileSync(join(root, "src", "util.js"), "export function h() { return 1; }");
writeFileSync(join(root, "README.md"), "# smoke");

const decorativeReadme = `<p align="center"><a href="https://github.com/example/project">
<img src="logo.png" alt="Project logo">
</a></p>

# Project

[![Build](https://img.shields.io/badge/build-passing.svg)](https://example.com)

Project is a reusable local-first knowledge service for software teams.
`;
check("README 跳过 HTML Logo/徽章并提取自然语言简介", firstReadmeParagraph(decorativeReadme) === "Project is a reusable local-first knowledge service for software teams.", firstReadmeParagraph(decorativeReadme));
check("历史 HTML 描述不会直接进入 UI", sanitizeProjectDescription('<p align="center"> <a href="https://github.com/apconw/Aix-DB">') === null);

console.log("== scanner ==");
const scan = await scanProject(fsAdapter, root);
check("techStack.backend === Express", scan.techStack.backend === "Express", JSON.stringify(scan.techStack));
check("techStack.frontend === React", scan.techStack.frontend === "React", JSON.stringify(scan.techStack));
check("languages.javascript >= 3", (scan.languages.javascript || 0) >= 3, JSON.stringify(scan.languages));
check("entrypoints non-empty", Array.isArray(scan.entrypoints) && scan.entrypoints.length > 0, JSON.stringify(scan.entrypoints));

console.log("== brain-files ==");
const brainP = join(root, ".project-brain");
await files.writeJson(fsAdapter, files.brainPath(root, "project.json"), {
  id: "brain-smoke-1", name: "smoke-fixture", techStack: scan.techStack, createdAt: 1000, updatedAt: 1000, lastScannedAt: 1000,
});
check("project.json written", existsSync(join(brainP, "project.json")));

const t1 = logic.makeId("evt", 2000);
await files.appendJsonl(fsAdapter, files.brainPath(root, "timeline.jsonl"), { id: t1, title: "init", eventType: "init", occurredAt: 2000 });
await files.appendJsonl(fsAdapter, files.brainPath(root, "timeline.jsonl"), { id: "evt-x", title: "later", eventType: "change", occurredAt: 3000 });
const timeline = await files.readJsonl(fsAdapter, files.brainPath(root, "timeline.jsonl"));
check("timeline has 2 entries", timeline.length === 2);
check("jsonl appended preserves content", timeline[1].occurredAt === 3000);

const mem = logic.makeMemoryEntry({ type: "decision", title: "用 build-time embed", content: "why", importance: 0.9 }, 4000);
await files.appendJsonl(fsAdapter, files.brainPath(root, "memory.jsonl"), mem);
const todo = logic.makeTodoEntry({ title: "实现 project_continue", priority: "high" }, 5000);
await files.appendJsonl(fsAdapter, files.brainPath(root, "todo.jsonl"), todo);

console.log("== brain-logic ==");
check("makeMemoryEntry type normalized", mem.type === "decision");
check("makeTodoEntry default status pending", todo.status === "pending");
check("makeTodoEntry priority high", todo.priority === "high");
check("activeTodos returns 1", logic.activeTodos([todo]).length === 1);

const brain = await files.readBrain(fsAdapter, root);
check("readBrain project present", brain.project && brain.project.id === "brain-smoke-1");
check("readBrain timeline 2", brain.timeline.length === 2);
check("readBrain memory 1", brain.memories.length === 1);
check("readBrain todo 1", brain.todos.length === 1);

const cont = logic.buildContinueData(brain, 9000);
check("continue.project.name", cont.project && cont.project.name === "smoke-fixture");
check("continue.pendingTodos 1", cont.pendingTodos.length === 1);
check("continue.suggestedNextStep mentions task", String(cont.suggestedNextStep).indexOf("实现 project_continue") >= 0);
check("continue.topMemories 1", cont.topMemories.length === 1 && cont.topMemories[0].type === "decision");

console.log("== build.loadProjectData ==");
const pd = loadProjectData(root);
check("pd.initialized", pd.initialized === true, String(pd.initialized));
check("pd.project.name", pd.project && pd.project.name === "smoke-fixture");
check("pd.stats.pendingTodos 1", pd.stats.pendingTodos === 1, JSON.stringify(pd.stats));
check("pd.stats.decisions 1", pd.stats.decisions === 1, JSON.stringify(pd.stats));
check("pd.timelineAll 2", pd.timelineAll.length === 2);
check("pd.todos contains todo", pd.todos.length === 1 && pd.todos[0].title === "实现 project_continue");
check("pd.phase.progress.total 1", pd.phase && pd.phase.progress.total === 1, JSON.stringify(pd.phase));
check("pd.generatedAt number", typeof pd.generatedAt === "number");

// 未初始化路径
const pdEmpty = loadProjectData(join(tmpdir(), "dsh-brain-nonexistent-xyz"));
check("loadProjectData uninitialized", pdEmpty.initialized === false);

// todo done 逻辑
const done = logic.findTodo([todo], todo.id);
check("findTodo by id", done && done.id === todo.id);
const done2 = logic.findTodo([todo], "实现 project_continue");
check("findTodo by title", done2 && done2.id === todo.id);

console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);
