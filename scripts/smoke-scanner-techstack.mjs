// smoke-scanner-techstack.mjs — v0.4.14 验证 scanner 扩展技术栈推断
// 覆盖：JS/TS（Next + Prisma + Redis + Bull + Tailwind + Vite + Vitest + TS）
//       Python（FastAPI + SQLAlchemy + asyncpg + redis）
//       Go（Gin + GORM + go-redis）
//       Rust（Axum + Tokio + Serde + SQLx）

import { existsSync, readFileSync, rmSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { tmpdir } from "node:os";
import { scanProject } from "../src/scanner.js";
import { isLanguageTech, previewStackLayers, mergeStackWithArchitecture } from "../src/stack-taxonomy.js";
import { buildWorkspacePreview } from "../src/host/sidebar/aggregator.js";

const PLUGIN_DIR = process.cwd();
const FIXTURE_DIR = join(PLUGIN_DIR, "fixtures-multi-lang");
const RESULTS = [];
let _pass = 0, _fail = 0;

function pass(name) { _pass++; RESULTS.push({ ok: true, name }); }
function fail(name, msg) { _fail++; RESULTS.push({ ok: false, name, msg }); console.error("FAIL:", name, "-", msg); }
function assert(cond, name, msg) { cond ? pass(name) : fail(name, msg || "assertion failed"); }

// 用纯 Node fs adapter（不走 DSH sandbox）
function makeFs() {
  const cache = new Map();
  function pathToRel(p) { return p.replaceAll("\\", "/"); }
  async function listDirImpl(rel) {
    const full = join(FIXTURE_DIR, rel);
    if (!existsSync(full)) return [];
    return readdirSync(full, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".") || e.name === ".project-brain")
      .map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        target: { path: join(full, e.name).replaceAll("\\", "/") },
      }));
  }
  return {
    resolve: async (p) => ({ path: p === FIXTURE_DIR ? FIXTURE_DIR : join(FIXTURE_DIR, p).replaceAll("\\", "/") }),
    listDir: async (target) => {
      const abs = typeof target === "string" ? target : target.path;
      // 把绝对路径转回相对 FIXTURE_DIR 的相对路径
      const rel = abs === FIXTURE_DIR ? "" : abs.startsWith(FIXTURE_DIR) ? abs.slice(FIXTURE_DIR.length).replace(/^[/\\]/, "") : abs;
      return listDirImpl(rel);
    },
    readText: async (target) => {
      const abs = typeof target === "string" ? target : target.path;
      try { return readFileSync(abs, "utf8"); } catch { return ""; }
    },
    processPath: (target) => typeof target === "string" ? target : target.path,
  };
}

const brainDir = join(FIXTURE_DIR, ".project-brain");
if (existsSync(brainDir)) rmSync(brainDir, { recursive: true, force: true });

console.log("[smoke-scanner-techstack] start");

const fs = makeFs();
const scan = await scanProject(fs, FIXTURE_DIR);

// 必须包含的 manifest 文件
const expectedFiles = ["package.json", "requirements.txt", "Cargo.toml", "go.mod"];
for (const f of expectedFiles) {
  assert(scan.topLevel.includes(f), `fixture manifest present: ${f}`);
}

// 工具函数：支持 string 和数组两种形态
function includes(stack, field, value) {
  const v = stack[field];
  if (v === value) return true;
  if (Array.isArray(v) && v.includes(value)) return true;
  return false;
}

// JS/TS (package.json)
assert(includes(scan.techStack, "fullstack", "Next.js"), `JS fullstack contains Next.js (got ${JSON.stringify(scan.techStack.fullstack)})`);
assert(includes(scan.techStack, "orm", "Prisma"), `JS orm contains Prisma (got ${JSON.stringify(scan.techStack.orm)})`);
assert(includes(scan.techStack, "cache", "Redis"), `JS cache contains Redis (got ${JSON.stringify(scan.techStack.cache)})`);
assert(includes(scan.techStack, "queue", "Bull"), `JS queue contains Bull (got ${JSON.stringify(scan.techStack.queue)})`);
assert(scan.tooling.includes("Tailwind CSS"), `JS tooling includes Tailwind CSS (got ${scan.tooling.join(",")})`);
assert(scan.tooling.includes("Vite"), `JS tooling includes Vite`);
assert(scan.tooling.includes("Vitest"), `JS tooling includes Vitest`);
assert(scan.tooling.includes("TypeScript"), `JS tooling includes TypeScript`);

// Python
assert(includes(scan.techStack, "backend", "FastAPI"), `Py backend contains FastAPI (got ${JSON.stringify(scan.techStack.backend)})`);
assert(includes(scan.techStack, "orm", "SQLAlchemy"), `Py orm contains SQLAlchemy (got ${JSON.stringify(scan.techStack.orm)})`);
assert(includes(scan.techStack, "database", "PostgreSQL"), `Py db contains PostgreSQL via asyncpg (got ${JSON.stringify(scan.techStack.database)})`);

// Go
assert(includes(scan.techStack, "backend", "Gin"), `Go backend contains Gin (got ${JSON.stringify(scan.techStack.backend)})`);
assert(includes(scan.techStack, "orm", "GORM"), `Go orm contains GORM (got ${JSON.stringify(scan.techStack.orm)})`);

// Rust
assert(includes(scan.techStack, "backend", "Axum"), `Rust backend contains Axum (got ${JSON.stringify(scan.techStack.backend)})`);
assert(includes(scan.techStack, "orm", "SQLx"), `Rust orm contains SQLx (got ${JSON.stringify(scan.techStack.orm)})`);
assert(scan.tooling.includes("Tokio"), `Rust tooling includes Tokio`);
assert(scan.tooling.includes("Serde"), `Rust tooling includes Serde`);

// 核心收益：orm 数组同时包含 Prisma + SQLAlchemy + GORM + SQLx（之前会被覆盖）
const ormArr = Array.isArray(scan.techStack.orm) ? scan.techStack.orm : [scan.techStack.orm];
assert(ormArr.includes("Prisma") && ormArr.includes("SQLAlchemy") && ormArr.includes("GORM") && ormArr.includes("SQLx"), `orm array preserves all languages (got ${ormArr.join(",")})`);

function makeFsFor(root) {
  return {
    resolve: async (p) => ({ path: p === root ? root : join(root, p).replaceAll("\\", "/") }),
    listDir: async (target) => {
      const abs = typeof target === "string" ? target : target.path;
      const rel = abs === root ? "" : abs.startsWith(root) ? abs.slice(root.length).replace(/^[/\\]/, "") : abs;
      const full = join(root, rel);
      if (!existsSync(full)) return [];
      return readdirSync(full, { withFileTypes: true }).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        target: { path: join(full, e.name).replaceAll("\\", "/") },
      }));
    },
    readText: async (target) => {
      const abs = typeof target === "string" ? target : target.path;
      try { return readFileSync(abs, "utf8"); } catch { return ""; }
    },
    processPath: (target) => typeof target === "string" ? target : target.path,
  };
}

async function scanTempProject(files) {
  const dir = mkdtempSync(join(tmpdir(), "dsh-stack-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
    return await scanProject(makeFsFor(dir), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const dockerOnly = await scanTempProject({ Dockerfile: "FROM python:3.12-slim\n" });
assert(includes(dockerOnly.stack, "container", "Docker"), `Dockerfile FROM python → Docker (got ${JSON.stringify(dockerOnly.stack.container)})`);
assert(!includes(dockerOnly.stack, "webserver", "Nginx"), `plain Python Dockerfile should not mark Nginx (got ${JSON.stringify(dockerOnly.stack.webserver)})`);

const dockerNginx = await scanTempProject({ Dockerfile: "FROM nginx:1.27-alpine\n" });
assert(includes(dockerNginx.stack, "container", "Docker"), `Dockerfile FROM nginx → Docker`);
assert(includes(dockerNginx.stack, "webserver", "Nginx"), `Dockerfile FROM nginx → Nginx (got ${JSON.stringify(dockerNginx.stack.webserver)})`);

assert(isLanguageTech("Python") === true, "Python is a language, not a framework chip");
assert(isLanguageTech("JavaScript") === true, "JavaScript is a language, not a framework chip");
assert(isLanguageTech("FastAPI") === false, "FastAPI stays a framework");
assert(isLanguageTech("Vue") === false, "Vue stays a framework");

const layered = previewStackLayers({
  stack: {
    "framework-backend": ["FastAPI"],
    ci: ["GitLab CI"],
    _extra: ["Python", "custom-lib"],
  },
  techStack: {},
  structure: ["Monorepo"],
});
assert(layered.runtime["framework-backend"] && layered.runtime["framework-backend"].includes("FastAPI"), `runtime keeps FastAPI (got ${JSON.stringify(layered.runtime)})`);
assert(!layered.runtime.ci, `CI must not sit in runtime stack (got ${JSON.stringify(layered.runtime)})`);
assert(layered.devops.ci && layered.devops.ci.includes("GitLab CI"), `CI goes to devops (got ${JSON.stringify(layered.devops)})`);
assert(layered.extra.includes("custom-lib") && !layered.extra.includes("Python"), `language names stripped from extra (got ${JSON.stringify(layered.extra)})`);
assert(layered.structure.includes("Monorepo"), "structure stays out of runtime chips");
assert(layered.usedFallback === false, "non-empty stack should not use techStack fallback");

const emptyRuntime = previewStackLayers({
  stack: { ci: ["GitHub Actions"] },
  techStack: { ci: "GitHub Actions", structure: "Monorepo" },
  structure: [],
});
assert(Object.keys(emptyRuntime.runtime).length === 0, `CI-only project has empty runtime (got ${JSON.stringify(emptyRuntime.runtime)})`);
assert(emptyRuntime.devops.ci && emptyRuntime.devops.ci.includes("GitHub Actions"), "CI-only project still shows CI in devops");
assert(emptyRuntime.structure.includes("Monorepo"), "CI-only stack still keeps structure from techStack");
assert(emptyRuntime.usedFallback === false, "stack.ci counts as real stack data, not old-field fallback");

const legacy = previewStackLayers({
  stack: {},
  techStack: { ci: "GitHub Actions", structure: "Monorepo", backend: "FastAPI" },
  structure: [],
});
assert(legacy.usedFallback === true, "empty stack uses techStack fallback");
assert(legacy.runtime["framework-backend"] && legacy.runtime["framework-backend"].includes("FastAPI"), `fallback maps backend → FastAPI (got ${JSON.stringify(legacy.runtime)})`);
assert(legacy.devops.ci && legacy.devops.ci.includes("GitHub Actions"), `fallback maps ci to devops not runtime (got ${JSON.stringify(legacy.devops)})`);
assert(!legacy.runtime.ci && !String(JSON.stringify(legacy.runtime)).includes("GitHub Actions"), "fallback must not promote CI into runtime");
assert(legacy.structure.includes("Monorepo"), `fallback maps structure separately (got ${JSON.stringify(legacy.structure)})`);

const misspelledReqs = await scanTempProject({
  "requirment.txt": "openai\nlangchain\nlanggraph\nhttpx\n",
});
assert(includes(misspelledReqs.stack, "ai", "OpenAI SDK"), `requirment.txt → OpenAI SDK (got ${JSON.stringify(misspelledReqs.stack.ai)})`);
assert(includes(misspelledReqs.stack, "ai", "LangChain"), `requirment.txt → LangChain`);
assert(includes(misspelledReqs.stack, "ai", "LangGraph"), `requirment.txt → LangGraph (got ${JSON.stringify(misspelledReqs.stack.ai)})`);
assert(includes(misspelledReqs.techStack, "ai", "LangGraph"), `manifest hits also fill techStack.ai (got ${JSON.stringify(misspelledReqs.techStack.ai)})`);

const importOnly = await scanTempProject({
  "agent.py": "from langgraph.graph import StateGraph\nfrom langchain_core.tools import tool\nfrom openai import OpenAI\n",
});
assert(includes(importOnly.stack, "ai", "LangGraph"), `source import → LangGraph (got ${JSON.stringify(importOnly.stack.ai)})`);
assert(includes(importOnly.stack, "ai", "LangChain"), `source import → LangChain`);
assert(includes(importOnly.stack, "ai", "OpenAI SDK"), `source import → OpenAI SDK`);
assert(includes(importOnly.techStack, "ai", "LangGraph"), `import fallback also writes techStack (got ${JSON.stringify(importOnly.techStack.ai)})`);

const mergedArch = mergeStackWithArchitecture(
  { ai: ["LangChain"] },
  { components: [{ technologies: ["LangGraph", "MCP", "Python"] }] },
);
assert(includes(mergedArch, "ai", "LangChain"), "architecture merge keeps scanned LangChain");
assert(includes(mergedArch, "ai", "LangGraph"), `architecture merge maps LangGraph to ai (got ${JSON.stringify(mergedArch.ai)})`);
assert(includes(mergedArch, "api", "MCP"), `architecture merge maps MCP to api (got ${JSON.stringify(mergedArch.api)})`);
assert(!includes(mergedArch, "framework-backend", "Python"), "architecture merge still skips language names");

const previewDir = mkdtempSync(join(tmpdir(), "dsh-preview-"));
try {
  mkdirSync(join(previewDir, ".project-brain"));
  writeFileSync(join(previewDir, ".project-brain", "project.json"), JSON.stringify({
    id: "brain-test",
    name: "energy_smart_analysis",
    techStack: {},
    stack: { ai: ["OpenAI SDK", "LangChain"] },
    structure: [],
    tooling: [],
    languages: { python: 6 },
    entrypoints: [],
    updatedAt: Date.now(),
  }));
  writeFileSync(join(previewDir, ".project-brain", "architecture.json"), JSON.stringify({
    components: [{ technologies: ["LangGraph", "MCP"] }],
  }));
  const previewFs = {
    resolve: async (p) => ({ path: /^([A-Za-z]:[\\/]|\/)/.test(String(p)) ? resolvePath(p) : resolvePath(previewDir, p) }),
    readText: async (target) => {
      try { return readFileSync(typeof target === "string" ? target : target.path, "utf8"); } catch { return ""; }
    },
  };
  const preview = await buildWorkspacePreview(previewFs, previewDir);
  assert(preview && preview.project && includes(preview.project.stack, "ai", "LangChain"), `runtime preview forwards stack.ai (got ${JSON.stringify(preview && preview.project && preview.project.stack)})`);
  assert(includes(preview.project.stack, "ai", "LangGraph"), "runtime preview merges architecture LangGraph");
  assert(includes(preview.project.stack, "api", "MCP"), "runtime preview merges architecture MCP");
} finally {
  rmSync(previewDir, { recursive: true, force: true });
}

// 清理
if (existsSync(brainDir)) rmSync(brainDir, { recursive: true, force: true });

console.log(`\n[smoke-scanner-techstack] ${_pass}/${_pass + _fail} PASS`);
for (const r of RESULTS) {
  if (!r.ok) console.error(`  FAIL: ${r.name} - ${r.msg}`);
}
if (_fail > 0) process.exit(1);
