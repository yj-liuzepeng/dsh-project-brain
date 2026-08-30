// codegraph-scan.mjs — tree-sitter AST → codegraph.json
// P0.3a Stage 2-4：调用图 + API endpoint 提取 + DB schema 识别
// 输出 schema：
// {
//   "scannedAt": <ms>, "durationMs": <ms>,
//   "files": [{path, language, imports, exports, functions}],
//   "edges": [{from, to, type}],
//   "callGraph": {
//     "maxDepth": <int>,
//     "entrypoints": [{file, reachable: <int> files}],
//     "chains": [[file1, file2, ...]] (top 5 longest paths)
//   },
//   "apiEndpoints": [{method, path, file, line}],
//   "dbModels": [{name, framework, file, line, fieldCount}],
//   "stats": {files, edges, languages, apiCount, modelCount}
// }
// 用法：node scripts/codegraph-scan.mjs <projectPath>

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, dirname, extname, basename } from "node:path";

// ─── tree-sitter 懒加载 ───
let _TS = null;
let _TS_JS = null;
let _TS_PY = null;
async function loadGrammars() {
  if (_TS) return;
  _TS = (await import("tree-sitter")).default;
  _TS_JS = (await import("tree-sitter-javascript")).default;
  _TS_PY = (await import("tree-sitter-python")).default;
}

// ─── 扫描配置 ───
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", "target", ".DS_Store",
  ".idea", ".vscode", "coverage", ".turbo", ".cache", "out", "release",
]);
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"]);
const MAX_FILE_BYTES = 512 * 1024;
const CALL_GRAPH_DEPTH = 6;
const CALL_GRAPH_TOP_CHAINS = 5;

// ─── 文件遍历 ───
async function* walkFiles(root) {
  const stack = ["."];
  while (stack.length) {
    const rel = stack.pop();
    const abs = join(root, rel);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(basename(abs))) continue;
      let entries;
      try { entries = await readdir(abs, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        stack.push(join(rel, e.name));
      }
    } else if (st.isFile()) {
      if (SCAN_EXTS.has(extname(abs)) && st.size < MAX_FILE_BYTES) yield rel.replaceAll("\\", "/");
    }
  }
}

// ─── 语言检测 + 解析器选择 ───
function detectLang(p) {
  const e = extname(p);
  if ([".ts", ".tsx"].includes(e)) return "typescript";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(e)) return "javascript";
  if (e === ".py") return "python";
  return "unknown";
}
function pickParserForLang(lang, TS_JS, TS_PY) {
  if (lang === "javascript" || lang === "typescript") return TS_JS;
  if (lang === "python") return TS_PY;
  return null;
}

// ─── AST 抽取（imports / exports / functions）───
function extractImportsAndExports(rootNode, source, language) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];

  function visit(node) {
    if (!node) return;
    // JS/TS: import_statement
    if (node.type === "import_statement" || node.type === "import_declaration") {
      const src = node.childForFieldName("source");
      if (src) imports.add(src.text.replace(/^['"]|['"]$/g, ""));
    }
    // JS/TS: require('mod')
    if (node.type === "call_expression" || node.type === "call") {
      const fn = node.child(0);
      if (fn && fn.type === "identifier" && fn.text === "require") {
        const arg = node.childForFieldName("arguments") || node.child(2);
        if (arg) imports.add(arg.text.replace(/^['"]|['"]$/g, ""));
      }
    }
    // Python: import / from
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      const mod = node.childForFieldName("module_name") || node.childForFieldName("module");
      if (mod) imports.add(mod.text);
    }
    // JS/TS: export function / class
    if (node.type === "export_statement" || node.type === "export_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c && (c.type === "function_declaration" || c.type === "class_declaration" || c.type === "lexical_declaration")) {
          const nameNode = c.childForFieldName("name");
          if (nameNode) exports.add(nameNode.text);
        }
      }
    }
    // functions
    if (node.type === "function_definition") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    }
    if (node.type === "function_declaration" || node.type === "method_definition") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    }
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) exports.add(nameNode.text);
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }

  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

function resolveImport(fromFile, spec) {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    const fromDir = dirname(fromFile);
    return relative(".", join(fromDir, spec)).replaceAll("\\", "/");
  }
  return spec;
}

// ─── API endpoint 提取 ───
const HTTP_SERVER_NAMES = new Set([
  "app", "router", "server", "this.app", "this.router",
  "fastapi", "api", "routerV1",
]);
function extractApiEndpoints(filePath, rootNode, language) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "call_expression" || node.type === "call") {
      const callee = node.child(0);
      if (callee && (callee.type === "member_expression" || callee.type === "attribute")) {
        const text = callee.text || "";
        const m = text.match(/\.(get|post|put|patch|delete|head|options|all)\b/i);
        if (m) {
          // 严格要求：callee object 是已知 HTTP 框架名（避免误报）
          const objectText = (callee.child(0)?.text || "").toLowerCase();
          if (!HTTP_SERVER_NAMES.has(objectText) && !objectText.includes("app") && !objectText.includes("router") && !objectText.includes("server")) {
            return;
          }
          const method = m[1].toUpperCase();
          let path = null;
          const args = node.childForFieldName("arguments");
          if (args) {
            for (let i = 0; i < args.childCount; i++) {
              const c = args.child(i);
              if (c && (c.type === "string" || c.type === "string_fragment" || c.type === "template_string")) {
                path = c.text.replace(/^['"`]|['"`]$/g, "");
                break;
              }
            }
          }
          if (path && path.startsWith("/")) {
            endpoints.push({ method, path, file: filePath, line: node.startPosition.row + 1 });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return endpoints;
}

// Python 装饰器特殊处理：app.get('/path') 后面跟 def handler
function extractPythonApiEndpoints(filePath, rootNode) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "decorated_definition") {
      // 找 decorator 和 inner function
      const dec = node.childForFieldName("decorator");
      const def = node.childForFieldName("definition");
      if (dec && def) {
        const decText = dec.text || "";
        const m = decText.match(/@[\w.]+\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/i);
        if (m) {
          const method = m[1].toUpperCase();
          const path = m[2];
          const fnName = def.childForFieldName("name")?.text || "(anonymous)";
          endpoints.push({ method, path, file: filePath, line: node.startPosition.row + 1, handler: fnName });
          return;
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return endpoints;
}

// ─── DB schema 识别 ───
function extractDbModels(filePath, rootNode, language) {
  const models = [];
  // Prisma schema: model Name { field Type @id ... }
  if (filePath.endsWith(".prisma") || rootNode.type === "program") {
    function visitPrisma(node) {
      if (!node) return;
      if (node.type === "type_alias" || (node.type === "declaration" && node.text.startsWith("model "))) {
        const nameNode = node.childForFieldName("name");
        if (nameNode) {
          // 计数 field: 找 body 内 punctuation , 等
          let fieldCount = 0;
          const body = node.childForFieldName("value") || node.childForFieldName("body");
          if (body) {
            for (let i = 0; i < body.childCount; i++) {
              if (body.child(i).type !== "comment" && body.child(i).isNamed) fieldCount++;
            }
          }
          models.push({ name: nameNode.text, framework: "prisma", file: filePath, line: node.startPosition.row + 1, fieldCount });
        }
      }
      for (let i = 0; i < node.childCount; i++) visitPrisma(node.child(i));
    }
    if (filePath.endsWith(".prisma")) visitPrisma(rootNode);
  }

  if (language === "python") {
    // SQLAlchemy: class User(Base): __tablename__ = 'users'; id = Column(Integer, primary_key=True)
    // 简化：找 class + __tablename__ attribute
    function visitPy(node) {
      if (!node) return;
      if (node.type === "class_definition") {
        const nameNode = node.childForFieldName("name");
        const body = node.childForFieldName("body");
        if (nameNode && body) {
          let hasTablename = false;
          let fieldCount = 0;
          for (let i = 0; i < body.childCount; i++) {
            const c = body.child(i);
            if (!c) continue;
            if (c.type === "expression_statement") {
              const txt = c.text || "";
              if (txt.includes("__tablename__")) hasTablename = true;
              if (/(?:=|Column\()/m.test(txt)) fieldCount++;
            }
          }
          if (hasTablename) {
            models.push({ name: nameNode.text, framework: "sqlalchemy", file: filePath, line: node.startPosition.row + 1, fieldCount });
          }
        }
      }
      for (let i = 0; i < node.childCount; i++) visitPy(node.child(i));
    }
    visitPy(rootNode);
  }
  return models;
}

// ─── 调用图构建（BFS）───
function buildCallGraph(files) {
  // 1) 建索引
  const byPath = new Map();
  for (const f of files) byPath.set(f.path, f);
  // 2) 解析相对 import 到绝对 path
  function resolveEdge(from, spec) {
    if (!spec.startsWith(".")) return null; // 外部 module
    const fromDir = dirname(from);
    const abs = join(fromDir, spec).replaceAll("\\", "/");
    // 找带 .js 扩展
    if (byPath.has(abs)) return abs;
    if (byPath.has(abs + ".js")) return abs + ".js";
    if (byPath.has(abs + ".mjs")) return abs + ".mjs";
    if (byPath.has(abs + ".ts")) return abs + ".ts";
    // 目录：找 index
    const idx = abs + "/index.js";
    if (byPath.has(idx)) return idx;
    return null; // 解析不到
  }
  // 3) entrypoints: 有 export 的文件 OR 含 apply/main 关键字
  const entrypoints = [];
  for (const f of files) {
    if (f.exports.length > 0) {
      entrypoints.push(f.path);
    } else if (f.functions.some((fn) => /^(apply|main|run|start)$/i.test(fn.name))) {
      // 含 apply/main 等特殊函数名也视为入口（cordis plugin 模式）
      entrypoints.push(f.path);
    }
  }
  // 4) BFS 计算每个 entry 的可达文件数
  function bfs(root) {
    const visited = new Set([root]);
    const queue = [root];
    while (queue.length) {
      const cur = queue.shift();
      const f = byPath.get(cur);
      if (!f) continue;
      for (const spec of f.imports) {
        const target = resolveEdge(cur, spec);
        if (target && !visited.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
    return visited.size;
  }
  const epResults = entrypoints.map((ep) => ({ file: ep, reachable: bfs(ep) }));
  // 5) 最长调用链（DFS + 深度限制）
  function longestChain(root, depth = 0, visited = new Set()) {
    if (depth > CALL_GRAPH_DEPTH) return [root];
    visited.add(root);
    const f = byPath.get(root);
    let best = [root];
    if (f) {
      for (const spec of f.imports) {
        const target = resolveEdge(root, spec);
        if (target && !visited.has(target)) {
          const chain = longestChain(target, depth + 1, new Set(visited));
          if (chain.length + 1 > best.length) best = [root, ...chain];
        }
      }
    }
    return best;
  }
  const chains = epResults
    .filter((ep) => ep.reachable > 1)
    .map((ep) => ({ file: ep.file, depth: longestChain(ep.file).length }))
    .sort((a, b) => b.depth - a.depth)
    .slice(0, CALL_GRAPH_TOP_CHAINS);
  return {
    maxDepth: chains.length > 0 ? chains[0].depth : 0,
    entrypoints: epResults,
    topChains: chains,
  };
}

// ─── main ───
async function main() {
  const projectPath = process.argv[2] || ".";
  const startMs = Date.now();

  await loadGrammars();
  const TS = (await import("tree-sitter")).default;
  const TS_JS = (await import("tree-sitter-javascript")).default;
  const TS_PY = (await import("tree-sitter-python")).default;

  const files = [];
  const edges = [];
  const apiEndpoints = [];
  const dbModels = [];
  const langStats = {};

  for await (const rel of walkFiles(projectPath)) {
    const abs = join(projectPath, rel);
    const lang = detectLang(rel);
    if (lang === "unknown") continue;
    const parser = new TS();
    parser.setLanguage(pickParserForLang(lang, TS_JS, TS_PY));
    let source;
    try { source = readFileSync(abs, "utf8"); } catch { continue; }
    let tree;
    try { tree = parser.parse(source); } catch { continue; }
    if (!tree || !tree.rootNode) continue;

    const { imports, exports, functions } = extractImportsAndExports(tree.rootNode, source, lang);

    langStats[lang] = (langStats[lang] || 0) + 1;
    files.push({ path: rel, language: lang, imports, exports, functions });

    for (const spec of imports) {
      const target = resolveImport(rel, spec);
      edges.push({ from: rel, to: target, type: "import" });
    }

    // API endpoints
    if (lang === "python") {
      const eps = extractPythonApiEndpoints(rel, tree.rootNode);
      for (const ep of eps) apiEndpoints.push(ep);
    } else {
      const eps = extractApiEndpoints(rel, tree.rootNode, lang);
      for (const ep of eps) apiEndpoints.push(ep);
    }

    // DB models
    const models = extractDbModels(rel, tree.rootNode, lang);
    for (const m of models) dbModels.push(m);
  }

  const callGraph = buildCallGraph(files);

  const codegraph = {
    scannedAt: Date.now(),
    durationMs: Date.now() - startMs,
    files,
    edges,
    callGraph,
    apiEndpoints,
    dbModels,
    stats: {
      files: files.length,
      edges: edges.length,
      languages: langStats,
      apiCount: apiEndpoints.length,
      modelCount: dbModels.length,
    },
  };

  const outPath = join(projectPath, ".project-brain", "codegraph.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(codegraph, null, 2));
  console.log(`[codegraph-scan] wrote ${outPath}`);
  console.log(`[codegraph-scan] ${codegraph.stats.files} files, ${codegraph.stats.edges} edges, ${codegraph.stats.apiCount} APIs, ${codegraph.stats.modelCount} models, ${codegraph.durationMs}ms`);
}

main().catch((e) => { console.error(e); process.exit(1); });