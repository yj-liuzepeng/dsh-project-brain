// smoke-multi-lang.mjs — v0.4.8 验证 6 种语言的 codegraph 扫描
// 覆盖 JS/TS/Python/Go/Java/Rust/C：
//   1. 各语言 grammar 可加载
//   2. 各语言 import / function / export 抽取正确
//   3. JS/Python API endpoint 抽取正确
//   4. Go Gin / Java Spring API endpoint 抽取正确
//   5. Java JPA / Go Gorm DB schema 抽取正确
//   6. config.json languages 白名单生效
//   7. 调用图覆盖跨文件 import

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { scanProject } from "./codegraph-scan.mjs";

const PLUGIN_DIR = process.cwd();
const FIXTURE_DIR = join(PLUGIN_DIR, "fixtures-multi-lang");
const RESULTS = [];
let _pass = 0, _fail = 0;

function pass(name) { _pass++; RESULTS.push({ ok: true, name }); }
function fail(name, msg) { _fail++; RESULTS.push({ ok: false, name, msg }); console.error("FAIL:", name, "-", msg); }
function assert(cond, name, msg) { cond ? pass(name) : fail(name, msg || "assertion failed"); }

function cleanup() {
  if (existsSync(join(FIXTURE_DIR, ".project-brain"))) {
    rmSync(join(FIXTURE_DIR, ".project-brain"), { recursive: true, force: true });
  }
}

function scanSync() {
  // CLI 已经把 codegraph.json 写出来了，直接读
  return JSON.parse(readFileSync(join(FIXTURE_DIR, ".project-brain", "codegraph.json"), "utf8"));
}

console.log("[smoke-multi-lang] start");

// ─── 测试 1: 各语言 grammar 可加载 ───
async function testGrammarLoad() {
  const langs = ["tree-sitter-javascript", "tree-sitter-python", "tree-sitter-go", "tree-sitter-java", "tree-sitter-rust", "tree-sitter-c"];
  for (const pkg of langs) {
    try {
      const m = await import(pkg);
      assert(typeof m.default === "object", `grammar load: ${pkg}`, `default should be object, got ${typeof m.default}`);
    } catch (e) {
      fail(`grammar load: ${pkg}`, e.message);
    }
  }
}
await testGrammarLoad();

// ─── 测试 2-6: 完整扫描 + 各维度断言 ───
cleanup();
import { spawnSync } from "node:child_process";
let g;
const cliResult = spawnSync(process.execPath, [join(PLUGIN_DIR, "scripts", "codegraph-scan.mjs"), FIXTURE_DIR], { cwd: PLUGIN_DIR });
if (cliResult.status === 0) {
  g = scanSync();
} else {
  // fallback: 直接 import 调 scanProject（DSH sandbox 拒绝 spawn 时）
  g = await scanProject(FIXTURE_DIR);
}

assert(g.stats.files === 8, "scan total files", `expected 8 files, got ${g.stats.files}`);
assert(Object.keys(g.stats.languages).length === 6, "scan 6 languages", `expected 6 langs, got ${Object.keys(g.stats.languages).join(",")}`);

const langs = ["javascript", "python", "go", "java", "rust", "c"];
for (const l of langs) {
  assert((g.stats.languages[l] || 0) >= 1, `language present: ${l}`, `expected >=1 file, got ${g.stats.languages[l]}`);
}

const jsIndex = g.files.find((f) => f.path === "src/js/index.js");
assert(jsIndex, "js/index.js found");
assert(jsIndex && jsIndex.imports.some((i) => i.includes("express")), "js imports express");
assert(jsIndex && jsIndex.imports.some((i) => i.includes("user")), "js imports local user.js");

const jsApis = g.apiEndpoints.filter((e) => e.file.endsWith("index.js"));
assert(jsApis.length === 2, `js API count (${jsApis.length})`, "expected 2 endpoints");
assert(jsApis.some((e) => e.method === "GET" && e.path === "/api/users"), "js GET /api/users");
assert(jsApis.some((e) => e.method === "POST" && e.path === "/api/users"), "js POST /api/users");

const py = g.files.find((f) => f.path === "src/py/app.py");
assert(py, "py/app.py found");
assert(py && py.imports.includes("fastapi"), "py imports fastapi");
assert(py && py.exports.includes("User"), "py exports User");
assert(py && py.exports.includes("helper"), "py exports helper (via __all__)");
const pyApi = g.apiEndpoints.find((e) => e.file.endsWith("app.py"));
assert(pyApi && pyApi.method === "GET", "py FastAPI GET");

const go = g.files.find((f) => f.path === "src/go/main.go");
assert(go, "go/main.go found");
assert(go && go.imports.some((i) => i.includes("gin-gonic")), "go imports gin");
assert(go && go.exports.includes("Helper"), "go exports Helper (capitalized)");
assert(go && go.exports.includes("User"), "go exports User struct");
const goApi = g.apiEndpoints.find((e) => e.file.endsWith("main.go"));
assert(goApi && goApi.method === "GET", "go Gin GET");

const javaMain = g.files.find((f) => f.path === "src/java/Main.java");
assert(javaMain, "java Main.java found");
assert(javaMain && javaMain.imports.some((i) => i.includes("java.util")), "java imports java.util");
assert(javaMain && javaMain.exports.includes("Main"), "java exports Main class");
const javaApi = g.apiEndpoints.find((e) => e.file.endsWith("Main.java"));
assert(javaApi && javaApi.method === "GET" && javaApi.path === "/api/users", `java Spring GET /api/users (got ${javaApi ? javaApi.method + " " + javaApi.path : "none"})`);

const rust = g.files.find((f) => f.path === "src/rust/lib.rs");
assert(rust, "rust/lib.rs found");
assert(rust && rust.imports.some((i) => i.includes("HashMap")), "rust use HashMap");
assert(rust && rust.exports.includes("greet"), "rust exports pub fn greet");
assert(rust && rust.exports.includes("Config"), "rust exports pub struct");
assert(rust && rust.exports.includes("Handler"), "rust exports pub trait");

const c = g.files.find((f) => f.path === "src/c/main.c");
assert(c, "c/main.c found");
assert(c && c.imports.some((i) => i.includes("stdio")), "c includes stdio");
assert(c && c.imports.some((i) => i === "my.h"), "c includes local my.h");
assert(c && c.functions.some((f) => f.name === "main"), "c detects main fn");
assert(c && c.functions.some((f) => f.name === "helper"), "c detects helper fn");

const jpaModel = g.dbModels.find((m) => m.framework === "jpa");
assert(jpaModel && jpaModel.name === "UserEntity", `JPA UserEntity (got ${jpaModel ? jpaModel.name : "none"})`);
assert(jpaModel && jpaModel.fieldCount >= 2, `JPA fieldCount>=2 (got ${jpaModel ? jpaModel.fieldCount : 0})`);
const gormModel = g.dbModels.find((m) => m.framework === "gorm");
assert(gormModel && gormModel.name === "User", `Gorm User (got ${gormModel ? gormModel.name : "none"})`);
assert(gormModel && gormModel.fieldCount >= 2, `Gorm fieldCount>=2 (got ${gormModel ? gormModel.fieldCount : 0})`);

assert(g.callGraph.entrypoints.length > 0, "call graph entrypoints exist");
const jsEp = g.callGraph.entrypoints.find((e) => e.file === "src/js/index.js");
assert(jsEp && jsEp.reachable >= 2, `js/index.js reaches user.js (reachable=${jsEp ? jsEp.reachable : 0})`);

// ─── 测试 7: config.json languages 白名单 ───
const brainDir = join(FIXTURE_DIR, ".project-brain");
mkdirSync(brainDir, { recursive: true });
writeFileSync(join(brainDir, "config.json"), JSON.stringify({ languages: ["python", "go"] }));
let g2;
const cliResult2 = spawnSync(process.execPath, [join(PLUGIN_DIR, "scripts", "codegraph-scan.mjs"), FIXTURE_DIR], { cwd: PLUGIN_DIR });
if (cliResult2.status === 0) {
  g2 = scanSync();
} else {
  g2 = await scanProject(FIXTURE_DIR);
}
assert(g2.stats.languages.python === 1, "whitelist keeps python");
assert(g2.stats.languages.go === 1, "whitelist keeps go");
assert(!g2.stats.languages.javascript, "whitelist drops javascript");
assert(!g2.stats.languages.java, "whitelist drops java");
assert(!g2.stats.languages.rust, "whitelist drops rust");
assert(!g2.stats.languages.c, "whitelist drops c");

cleanup();
console.log(`\n[smoke-multi-lang] ${_pass}/${_pass + _fail} PASS`);
for (const r of RESULTS) {
  if (!r.ok) console.error(`  FAIL: ${r.name} - ${r.msg}`);
}
if (_fail > 0) process.exit(1);
