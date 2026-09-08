// smoke-scanner-techstack.mjs — v0.4.14 验证 scanner 扩展技术栈推断
// 覆盖：JS/TS（Next + Prisma + Redis + Bull + Tailwind + Vite + Vitest + TS）
//       Python（FastAPI + SQLAlchemy + asyncpg + redis）
//       Go（Gin + GORM + go-redis）
//       Rust（Axum + Tokio + Serde + SQLx）

import { existsSync, readFileSync, mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { scanProject } from "../src/scanner.js";

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

// 清理
if (existsSync(brainDir)) rmSync(brainDir, { recursive: true, force: true });

console.log(`\n[smoke-scanner-techstack] ${_pass}/${_pass + _fail} PASS`);
for (const r of RESULTS) {
  if (!r.ok) console.error(`  FAIL: ${r.name} - ${r.msg}`);
}
if (_fail > 0) process.exit(1);
