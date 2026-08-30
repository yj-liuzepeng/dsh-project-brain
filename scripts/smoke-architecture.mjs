import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { scanProject } from "../src/scanner.js";
import { buildArchitecture, createLlmRuntime, parseArchitectureJson, resolveSessionRoute } from "../src/host/architecture/analyzer.js";
import { scanAndWrite } from "../src/tools.js";

const root = mkdtempSync(join(tmpdir(), "dsh-brain-architecture-"));
mkdirSync(join(root, "src", "ui"), { recursive: true });
mkdirSync(join(root, "src", "api"), { recursive: true });
mkdirSync(join(root, "src", "core"), { recursive: true });
mkdirSync(join(root, "src", "db"), { recursive: true });
mkdirSync(join(root, "node_modules.backup-20260829", "bad-ui"), { recursive: true });
writeFileSync(join(root, "package.json"), JSON.stringify({ name: "architecture-fixture", dependencies: { react: "latest", express: "latest" } }));
writeFileSync(join(root, "src", "ui", "App.tsx"), "import { load } from '../api/client'; export const App = load;\n");
writeFileSync(join(root, "src", "api", "client.ts"), "import { run } from '../core/service'; export const load = run;\n");
writeFileSync(join(root, "src", "core", "service.ts"), "import { db } from '../db/store'; export const run = db;\n");
writeFileSync(join(root, "src", "db", "store.ts"), "export const db = true;\n");
writeFileSync(join(root, "node_modules.backup-20260829", "bad-ui", "index.js"), "export const noise = true;\n");

function target(path) { return { path: resolve(path) }; }
const fsAdapter = {
  async resolve(path, options) {
    const cwd = options && options.cwd ? (options.cwd.path || String(options.cwd)) : process.cwd();
    return target(resolve(cwd, path));
  },
  processPath(value) { return value.path; },
  async listDir(value) {
    return readdirSync(value.path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
      target: target(join(value.path, entry.name)),
    }));
  },
  async readText(value) { return readFileSync(value.path, "utf8"); },
  async writeText(value, text) {
    mkdirSync(dirname(value.path), { recursive: true });
    writeFileSync(value.path, text, "utf8");
    return true;
  },
  async stat(value) { return statSync(value.path); },
};

const scan = await scanProject(fsAdapter, root);
assert.equal(scan.files.includes("src/ui/App.tsx"), true);
assert.equal(scan.files.some((file) => file.includes("node_modules.backup")), false);

const local = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: false },
});
assert.equal(local.source, "local");
assert.equal(local.schemaVersion, 2);
assert.equal(local.stats.modules >= 3, true);
assert.equal(local.stats.edges >= 2, true);
assert.equal(local.layers.some((layer) => layer.name.includes("展示")), true);
assert.equal(local.components.every((component) => !component.name.startsWith("src/")), true);
assert.equal(local.flows.length >= 1, true);

const route = resolveSessionRoute({ requestContext: () => ({ provider: "dsh-provider", model: "dsh-model" }) });
assert.deepEqual(route, { provider: "dsh-provider", model: "dsh-model" });
assert.deepEqual(
  resolveSessionRoute({ requestContext: () => undefined, requestHeader: () => ({ config: { provider: "header-provider", model: "header-model" } }) }),
  { provider: "header-provider", model: "header-model" },
);
assert.equal(parseArchitectureJson("分析如下：\n```json\n{\"layers\":[],}\n```\n完成").layers.length, 0);
assert.deepEqual(
  resolveSessionRoute({ events: [{ type: "request/header", data: { header: { config: { provider: "event-provider", model: "event-model" } } } }] }),
  { provider: "event-provider", model: "event-model" },
);
let streamedOptions;
const llm = {
  async *stream(options) {
    streamedOptions = options;
    yield { type: "text-delta", index: 0, text: JSON.stringify({
      overview: { purpose: "演示分层应用", audience: "开发者", category: "Web 应用", architectureStyle: "分层架构", value: "验证架构分析" },
      summary: "界面通过接口调用业务规则，业务规则访问数据存储。",
      layers: [
        { id: "experience", name: "体验层", responsibility: "处理用户交互" },
        { id: "business", name: "业务层", responsibility: "执行业务规则" },
        { id: "persistence", name: "持久化层", responsibility: "保存项目数据" },
      ],
      components: [
        { id: "workspace-ui", name: "工作区界面", layerId: "experience", type: "ui", responsibility: "呈现项目状态", details: "调用项目接口", importantFiles: ["src/ui/App.tsx"], evidencePaths: ["src/ui/App.tsx"], technologies: ["React"], confidence: 0.9 },
        { id: "rules-engine", name: "规则引擎", layerId: "business", type: "service", responsibility: "执行业务规则", details: "连接接口与数据", importantFiles: ["src/core/service.ts"], evidencePaths: ["src/core/service.ts"], technologies: ["TypeScript"], confidence: 0.88 },
        { id: "project-store", name: "项目数据仓库", layerId: "persistence", type: "data", responsibility: "保存项目数据", details: "提供数据访问", importantFiles: ["src/db/store.ts"], evidencePaths: ["src/db/store.ts"], technologies: ["TypeScript"], confidence: 0.86 },
      ],
      relationships: [
        { from: "workspace-ui", to: "rules-engine", label: "调用", type: "request", description: "发起业务请求", confidence: 0.9 },
        { from: "rules-engine", to: "project-store", label: "读写", type: "data-flow", description: "访问项目数据", confidence: 0.88 },
      ],
      runtimeFlows: [{ name: "主请求流", trigger: "用户操作", outcome: "返回项目数据", steps: [{ componentId: "workspace-ui", action: "发起请求", file: "src/ui/App.tsx" }, { componentId: "rules-engine", action: "处理规则", file: "src/core/service.ts" }, { componentId: "project-store", action: "读取数据", file: "src/db/store.ts" }] }],
      keyFiles: [{ path: "src/core/service.ts", role: "业务入口", whyImportant: "连接接口和数据层", category: "core" }],
      gettingStarted: ["先看规则引擎"],
      designHighlights: ["分层职责清晰"],
      risks: ["核心服务需要保持边界清晰"],
    }) };
    yield { type: "finish", reason: { kind: "stop" } };
  },
};
assert.equal(createLlmRuntime({ get: () => llm }, llm).get(), llm);
let effectFactoryCalled = false;
const lifecycleRuntime = createLlmRuntime({
  get: () => llm,
  inject: (_deps, callback) => callback({
    get: () => llm,
    effect: (factory) => { effectFactoryCalled = true; factory(); },
  }),
});
assert.equal(lifecycleRuntime.get(), llm);
assert.equal(effectFactoryCalled, false);
const hybrid = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: true },
  llm,
  route,
  sessionId: "session-architecture",
});
assert.equal(hybrid.source, "hybrid");
assert.equal(hybrid.llm.used, true);
assert.equal(hybrid.overview.architectureStyle, "分层架构");
assert.equal(hybrid.components.some((item) => item.name === "规则引擎"), true);
assert.equal(hybrid.components.some((item) => item.name.startsWith("src/")), false);
assert.equal(streamedOptions.provider, "dsh-provider");
assert.equal(streamedOptions.model, "dsh-model");
assert.equal(JSON.stringify(streamedOptions).includes("export const run = db"), true);
assert.equal(JSON.stringify(streamedOptions).includes(root), false);

const missingService = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: true },
  llm: null,
  route,
});
assert.equal(missingService.llm.error.code, "ARCHITECTURE_LLM_SERVICE_UNAVAILABLE");

const missingRoute = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: true },
  llm,
  route: null,
  sessionId: "session-without-route",
});
assert.equal(missingRoute.llm.error.code, "ARCHITECTURE_LLM_SESSION_ROUTE_UNAVAILABLE");

const lateRoute = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: true },
  llm,
  route: null,
  getRoute: () => route,
  sessionId: "session-late-route",
});
assert.equal(lateRoute.llm.used, true);

let repairCalls = 0;
const repairLlm = {
  async *stream() {
    repairCalls += 1;
    const output = repairCalls === 1
      ? "架构分析：{not valid json}"
      : JSON.stringify({
          layers: [{ id: "interface", name: "接口层", responsibility: "接收请求" }, { id: "domain", name: "领域层", responsibility: "处理业务" }],
          components: [
            { id: "ui", name: "工作区界面", layerId: "interface", responsibility: "展示项目", evidencePaths: ["src/ui/App.tsx"] },
            { id: "engine", name: "分析引擎", layerId: "domain", responsibility: "分析项目", evidencePaths: ["src/core/service.ts"] },
          ],
        });
    yield { type: "text-delta", index: 0, text: output };
    yield { type: "finish", reason: { kind: "stop" } };
  },
};
const repairedArchitecture = await buildArchitecture({
  fs: fsAdapter,
  projectPath: root,
  scan,
  config: { architectureLlmEnabled: true },
  llm: repairLlm,
  route,
  sessionId: "session-json-repair",
});
assert.equal(repairedArchitecture.llm.used, true);
assert.equal(repairedArchitecture.llm.repaired, true);
assert.equal(repairedArchitecture.llm.attempts, 2);
assert.equal(repairCalls, 2);

const result = await scanAndWrite(fsAdapter, null, { path: root }, "project_init", {
  getMemoryConfig: () => ({ architectureLlmEnabled: false }),
});
assert.equal(result.ok, true);
assert.equal(result.data.architecture.generated, true);
const written = JSON.parse(readFileSync(join(root, ".project-brain", "architecture.json"), "utf8"));
assert.equal(written.schemaVersion, 2);
assert.equal(written.components.length >= 3, true);

console.log("architecture analyzer: semantic architecture assertions PASS");
