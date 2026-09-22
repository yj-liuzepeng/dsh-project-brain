import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { architectureRelevantFiles, architectureTriggerFiles, sourceChangeFiles } from "../src/host/architecture/analyzer.js";
import { markArchitectureStale, scanAndWrite } from "../src/host/scan-and-write.js";

assert.equal(sourceChangeFiles(["src/index.js"]), true);

// 排除项：文档 / lockfile / 测试
assert.equal(architectureTriggerFiles(["README.md"]), false);
assert.equal(architectureRelevantFiles(["README.md"]), false);
assert.equal(architectureTriggerFiles(["package-lock.json"]), false);
assert.equal(architectureTriggerFiles(["src/foo.test.js"]), false);
assert.equal(architectureTriggerFiles(["CHANGELOG.md"]), false);

// manifest 与约定入口文件
assert.equal(architectureTriggerFiles(["package.json"]), true);
assert.equal(architectureTriggerFiles(["cordis.patch.yml"]), true);
assert.equal(architectureTriggerFiles(["src/index.js"]), true);
assert.equal(architectureTriggerFiles(["cmd/server/main.go"]), true);
assert.equal(architectureTriggerFiles(["app/__init__.py"]), true);

// 普通源码「改内容」不再触发 LLM 架构：规则必须结构化，不能硬编码本仓库路径
assert.equal(architectureTriggerFiles(["src/client.js"]), false);
assert.equal(architectureTriggerFiles(["src/host/memory/briefing.js"]), false);
assert.equal(architectureTriggerFiles(["src/host/injector.js"]), false);
assert.equal(architectureTriggerFiles(["src/host/scan-and-write.js"]), false);
assert.equal(architectureTriggerFiles(["src/host/architecture/analyzer.js"]), false);

// 声明入口（来自 project.json.entrypoints）被改动 → 触发
assert.equal(architectureTriggerFiles(["src/host/injector.js"], { entrypoints: ["src/host/injector.js"] }), true);
assert.equal(architectureTriggerFiles(["src/host/injector.js"], { entrypoints: [{ path: "src/host/injector.js", type: "service" }] }), true);
assert.equal(architectureTriggerFiles(["src/client.js"], { entrypoints: ["npm run build"] }), false);

// 增删源码文件 = 结构变化 → 触发；改内容 → 不触发
const added = [{ path: "src/host/memory/new-module.js", type: "added" }];
const removed = [{ path: "src/host/memory/old-module.js", type: "removed" }];
const modified = [{ path: "src/host/memory/briefing.js", type: "modified" }];
assert.equal(architectureTriggerFiles(["src/host/memory/new-module.js"], { changes: added }), true);
assert.equal(architectureTriggerFiles(["src/host/memory/old-module.js"], { changes: removed }), true);
assert.equal(architectureTriggerFiles(["src/host/memory/briefing.js"], { changes: modified }), false);
assert.equal(architectureTriggerFiles(["docs/a.md"], { changes: [{ path: "docs/a.md", type: "added" }] }), false);
assert.equal(architectureTriggerFiles(["src/foo.test.js"], { changes: [{ path: "src/foo.test.js", type: "added" }] }), false);
assert.equal(architectureTriggerFiles(["node_modules/x/index.js"], { changes: [{ path: "node_modules/x/index.js", type: "added" }] }), false);

const root = mkdtempSync(join(tmpdir(), "dsh-brain-arch-"));
mkdirSync(join(root, "src"), { recursive: true });
mkdirSync(join(root, ".project-brain"), { recursive: true });
writeFileSync(join(root, "package.json"), JSON.stringify({ name: "arch-fixture", dependencies: { express: "4.19.0" } }));
writeFileSync(join(root, "src", "index.js"), "console.log(1);\n");
const archPath = join(root, ".project-brain", "architecture.json");
const sentinel = { version: "sentinel", overview: { purpose: "keep me" }, keyFiles: [] };
writeFileSync(archPath, JSON.stringify(sentinel));
writeFileSync(join(root, ".project-brain", "project.json"), JSON.stringify({
  id: "brain-keep",
  name: "arch-fixture",
  createdAt: 1,
  architectureStale: true,
}));

const fsAdapter = {
  async resolve(p, opts) {
    if (opts && opts.cwd) return join(opts.cwd, p);
    return p;
  },
  async readText(target) { return readFileSync(target, "utf8"); },
  async writeText(target, content) {
    const dir = target.slice(0, Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\")));
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, content, "utf8");
  },
  async listDir(target) {
    return readdirSync(target, { withFileTypes: true }).map((e) => ({
      name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory(),
    }));
  },
};

const light = await scanAndWrite(fsAdapter, null, { path: root }, "auto_light_refresh", { architectureMode: "light" });
assert.equal(light.ok, true, JSON.stringify(light));
const after = JSON.parse(readFileSync(archPath, "utf8"));
assert.equal(after.version, "sentinel");
assert.equal(after.overview.purpose, "keep me");
const project = JSON.parse(readFileSync(join(root, ".project-brain", "project.json"), "utf8"));
assert.equal(project.architectureStale, true);
assert.ok(Array.isArray(project.entrypoints));

// markArchitectureStale：只改标记，不动 architecture.json
assert.equal(await markArchitectureStale(fsAdapter, null, root, false), true);
assert.equal(JSON.parse(readFileSync(join(root, ".project-brain", "project.json"), "utf8")).architectureStale, false);
assert.equal(await markArchitectureStale(fsAdapter, null, root, true), true);
assert.equal(JSON.parse(readFileSync(join(root, ".project-brain", "project.json"), "utf8")).architectureStale, true);
assert.equal(JSON.parse(readFileSync(archPath, "utf8")).version, "sentinel");

console.log("smoke-architecture-triggers: PASS");
