// codegraph-scan.mjs — tree-sitter AST → codegraph.json
// P0.3a + v0.4.8：调用图 + API endpoint 提取 + DB schema 识别
// v0.4.8 扩展：支持 6 种语言（JS/TS/Python/Go/Java/Rust/C/C++）的 AST 分析
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

// ─── tree-sitter 懒加载（6 语言）───
let _grammars = null;
async function loadGrammars() {
  if (_grammars) return _grammars;
  const TS = (await import("tree-sitter")).default;
  const TS_JS = (await import("tree-sitter-javascript")).default;
  const TS_PY = (await import("tree-sitter-python")).default;
  const TS_GO = (await import("tree-sitter-go")).default;
  const TS_JAVA = (await import("tree-sitter-java")).default;
  const TS_RUST = (await import("tree-sitter-rust")).default;
  const TS_C = (await import("tree-sitter-c")).default;
  _grammars = {
    TS,
    javascript: TS_JS,
    typescript: TS_JS, // TS grammar covers JS too; JS grammar parses TS as well enough for import/export/function
    python: TS_PY,
    go: TS_GO,
    java: TS_JAVA,
    rust: TS_RUST,
    c: TS_C,
    cpp: TS_C, // C grammar covers C++ header patterns; full C++ needs tree-sitter-cpp
  };
  return _grammars;
}

// ─── 扫描配置 ───
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", "target", ".DS_Store",
  ".idea", ".vscode", "coverage", ".turbo", ".cache", "out", "release",
]);
const SCAN_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py",
  ".go", ".java", ".rs",
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp",
]);
const MAX_FILE_BYTES = 512 * 1024;
const CALL_GRAPH_DEPTH = 6;
const CALL_GRAPH_TOP_CHAINS = 5;

// ─── 语言检测 ───
function detectLang(p) {
  const e = extname(p);
  if ([".ts", ".tsx"].includes(e)) return "typescript";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(e)) return "javascript";
  if (e === ".py") return "python";
  if (e === ".go") return "go";
  if (e === ".java") return "java";
  if (e === ".rs") return "rust";
  if ([".c", ".h"].includes(e)) return "c";
  if ([".cc", ".cpp", ".cxx", ".hpp"].includes(e)) return "cpp";
  return "unknown";
}

function pickParserForLang(lang, grammars) {
  return grammars[lang] || null;
}

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

// ─── 通用 import 规范化：去掉 .js/.ts 后缀（AST 节点原样）───
function resolveImport(fromFile, spec) {
  if (spec.startsWith(".") || spec.startsWith("/")) {
    const fromDir = dirname(fromFile);
    return relative(".", join(fromDir, spec)).replaceAll("\\", "/");
  }
  return spec;
}

// ════════════════════════════════════════════════════════════
// 语言分发器：每种语言一个抽取器，返回 {imports, exports, functions}
// ════════════════════════════════════════════════════════════

// ─── JavaScript / TypeScript（共用 grammar）───
function extractJsLike(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "import_statement" || node.type === "import_declaration") {
      const src = node.childForFieldName("source");
      if (src) imports.add(src.text.replace(/^['"]|['"]$/g, ""));
    }
    if (node.type === "call_expression" || node.type === "call") {
      const fn = node.child(0);
      if (fn && fn.type === "identifier" && fn.text === "require") {
        const arg = node.childForFieldName("arguments") || node.child(2);
        if (arg) {
          // 兼容形如 ("user") / ('user') / ("user") 等括号+引号
          const cleaned = arg.text.replace(/^[\s('"`]+|[\s)'"`]+$/g, "").replace(/^['"]|['"]$/g, "");
          imports.add(cleaned);
        }
      }
    }
    if (node.type === "export_statement" || node.type === "export_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c && (c.type === "function_declaration" || c.type === "class_declaration" || c.type === "lexical_declaration")) {
          const nameNode = c.childForFieldName("name");
          if (nameNode) exports.add(nameNode.text);
        }
      }
    }
    // CommonJS: module.exports = { foo, bar } → 视为 export
    if (node.type === "expression_statement") {
      const text = node.text || "";
      if (/module\.exports\s*=/.test(text)) {
        const m = text.match(/module\.exports\s*=\s*\{([^}]+)\}/);
        if (m) {
          const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+|\s*:\s*/).pop()).filter(Boolean);
          for (const n of names) exports.add(n);
        } else {
          // module.exports = app 等单值
          const single = text.match(/module\.exports\s*=\s*(\w+)/);
          if (single) exports.add(single[1]);
        }
      }
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

// ─── Python ───
function extractPython(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      const mod = node.childForFieldName("module_name") || node.childForFieldName("module");
      if (mod) imports.add(mod.text);
      // from X import a, b → 收集所有 name
      if (node.type === "import_from_statement") {
        for (let i = 0; i < node.childCount; i++) {
          const c = node.child(i);
          if (c && c.type === "dotted_name" && c !== mod) {
            // only at top-level doted_name after 'import'
          }
        }
      }
    }
    if (node.type === "function_definition") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    }
    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) exports.add(nameNode.text);
    }
    // __all__ → exports
    if (node.type === "assignment" && /__all__/.test(node.text || "")) {
      const right = node.childForFieldName("right");
      if (right && right.type === "list") {
        for (let i = 0; i < right.childCount; i++) {
          const c = right.child(i);
          if (c && c.type === "string") {
            const s = c.text.replace(/^['"]|['"]$/g, "");
            if (s) exports.add(s);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

// ─── Go ───
function extractGo(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    // import "x" / import ( "x"; "y" )
    if (node.type === "import_spec" || node.type === "import_declaration") {
      // 单行 import_spec
      if (node.type === "import_spec") {
        const path = node.childForFieldName("path") || node.childForFieldName("name");
        if (path) imports.add((path.text || "").replace(/^['"]|['"]$/g, ""));
      } else {
        // import_declaration：扫所有 child 中的 string
        for (let i = 0; i < node.childCount; i++) {
          const c = node.child(i);
          if (!c) continue;
          if (c.type === "import_spec" || c.type === "interpreted_string_literal") {
            const txt = c.type === "import_spec"
              ? (c.childForFieldName("path")?.text || "")
              : c.text;
            const s = (txt || "").replace(/^['"]|['"]$/g, "");
            if (s) imports.add(s);
          }
        }
      }
    }
    // function / method → Go 大写开头的 identifier 即导出
    if (node.type === "function_declaration" || node.type === "method_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
        if (/^[A-Z]/.test(nameNode.text)) exports.add(nameNode.text);
      }
    }
    // type X struct / type X interface → 视作"导出"
    if (node.type === "type_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c && c.type === "type_spec") {
          const nameNode = c.childForFieldName("name");
          if (nameNode) exports.add(nameNode.text);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

// ─── Java ───
function extractJava(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "import_declaration") {
      // 形如：import java.util.List;  import static java.lang.Math.*;
      const text = node.text || "";
      const m = text.match(/import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;?/);
      if (m) imports.add(m[1]);
    }
    // package declaration → 也算 import 的语义邻居，但非 import；忽略
    if (node.type === "class_declaration" || node.type === "interface_declaration" || node.type === "enum_declaration" || node.type === "record_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) exports.add(nameNode.text);
    }
    if (node.type === "method_declaration" || node.type === "constructor_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

// ─── Rust ───
function extractRust(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "use_declaration") {
      const arg = node.childForFieldName("argument") || node.childForFieldName("path");
      if (arg) {
        // 收集整段文本（含 {a, b, c}）
        const t = arg.text || "";
        if (t) imports.add(t.replace(/\s+/g, " ").trim());
      }
    }
    // fn / pub fn
    if (node.type === "function_item") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
        // 是否有 pub 修饰符
        const text = node.text || "";
        if (/^\s*pub\s+/m.test(text) || /^pub\s+fn/.test(text)) exports.add(nameNode.text);
      }
    }
    // struct / enum / trait / impl
    if (["struct_item", "enum_item", "trait_item", "type_item", "impl_item"].includes(node.type)) {
      const nameNode = node.childForFieldName("name") || node.childForFieldName("type");
      if (nameNode) exports.add(nameNode.text);
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

// ─── C / C++ ───
function extractC(rootNode) {
  const imports = new Set();
  const exports = new Set();
  const functions = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "preproc_include") {
      // #include <stdio.h> / #include "my.h"
      const text = node.text || "";
      const m = text.match(/#\s*include\s+([<"][^>"]*[>"])/);
      if (m) {
        const s = m[1].replace(/^[<"]|[>"]$/g, "");
        if (s) imports.add(s);
      }
    }
    // function_definition → 形如 type name(...) { ... }
    if (node.type === "function_definition") {
      const declarator = node.childForFieldName("declarator");
      if (declarator) {
        // declarator 可能是 function_declarator 或 pointer_declarator 套 function_declarator
        const fn = declarator.type === "function_declarator"
          ? declarator
          : declarator.descendantsOfType?.("function_declarator")?.[0];
        if (fn) {
          const nameNode = fn.childForFieldName("declarator");
          if (nameNode && nameNode.type === "identifier") {
            functions.push({ name: nameNode.text, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return { imports: [...imports], exports: [...exports], functions };
}

const EXTRACTORS = {
  javascript: extractJsLike,
  typescript: extractJsLike,
  python: extractPython,
  go: extractGo,
  java: extractJava,
  rust: extractRust,
  c: extractC,
  cpp: extractC,
};

// ════════════════════════════════════════════════════════════
// API endpoint 抽取（按语言分发）
// ════════════════════════════════════════════════════════════

const HTTP_SERVER_NAMES_JS = new Set([
  "app", "router", "server", "this.app", "this.router",
  "fastapi", "api", "routerV1",
]);

function extractJsApiEndpoints(filePath, rootNode) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "call_expression" || node.type === "call") {
      const callee = node.child(0);
      if (callee && (callee.type === "member_expression" || callee.type === "attribute")) {
        const text = callee.text || "";
        const m = text.match(/\.(get|post|put|patch|delete|head|options|all)\b/i);
        if (m) {
          const objectText = (callee.child(0)?.text || "").toLowerCase();
          if (!HTTP_SERVER_NAMES_JS.has(objectText) && !objectText.includes("app") && !objectText.includes("router") && !objectText.includes("server")) {
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

function extractPythonApiEndpoints(filePath, rootNode) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "decorated_definition") {
      // Python tree-sitter: decorated_definition 的 decorator/definition 字段名不存在，按子节点类型找
      let dec = null, def = null;
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (!c) continue;
        if (c.type === "decorator") dec = c;
        else if (c.type === "function_definition" || c.type === "class_definition") def = c;
      }
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

// Go Gin: r.GET("/path", handler) / router.POST(...) / group.GET(...)
function extractGoApiEndpoints(filePath, rootNode) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "call_expression" || node.type === "call") {
      const callee = node.child(0);
      if (callee && callee.type === "selector_expression") {
        const text = callee.text || "";
        const m = text.match(/\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/);
        if (m) {
          const method = m[1];
          const args = node.childForFieldName("arguments");
          if (args) {
            for (let i = 0; i < args.childCount; i++) {
              const c = args.child(i);
              if (c && (c.type === "interpreted_string_literal" || c.type === "raw_string_literal")) {
                const path = c.text.replace(/^["`]|["`]$/g, "");
                if (path.startsWith("/")) {
                  endpoints.push({ method, path, file: filePath, line: node.startPosition.row + 1 });
                }
                break;
              }
            }
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return endpoints;
}

// Java Spring: @RequestMapping / @GetMapping / @PostMapping 注解方法
function extractJavaApiEndpoints(filePath, rootNode) {
  const endpoints = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "modifiers" || node.type === "annotations") {
      for (let i = 0; i < node.childCount; i++) {
        const ann = node.child(i);
        if (!ann || ann.type !== "annotation") continue;
        const annText = ann.text || "";
        const m = annText.match(/@(?:RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)(?:\s*\(\s*["']([^"']+)["']\s*\))?/);
        if (m) {
          const path = m[1] || "";
          const verb = annText.match(/@(Get|Post|Put|Delete|Patch)Mapping/);
          const method = verb ? verb[1].toUpperCase() : "REQUEST";
          if (path.startsWith("/") || path === "") {
            endpoints.push({ method, path: path || "/", file: filePath, line: ann.startPosition.row + 1 });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return endpoints;
}

const API_EXTRACTORS = {
  javascript: extractJsApiEndpoints,
  typescript: extractJsApiEndpoints,
  python: extractPythonApiEndpoints,
  go: extractGoApiEndpoints,
  java: extractJavaApiEndpoints,
};

// ════════════════════════════════════════════════════════════
// DB schema 识别（按语言分发）
// ════════════════════════════════════════════════════════════

function extractPrisma(rootNode, filePath) {
  const models = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "type_alias" || (node.type === "declaration" && (node.text || "").startsWith("model "))) {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        let fieldCount = 0;
        const body = node.childForFieldName("value") || node.childForFieldName("body");
        if (body) {
          for (let i = 0; i < body.childCount; i++) {
            const c = body.child(i);
            if (c && c.type !== "comment" && c.isNamed) fieldCount++;
          }
        }
        models.push({ name: nameNode.text, framework: "prisma", file: filePath, line: node.startPosition.row + 1, fieldCount });
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return models;
}

function extractSqlalchemy(rootNode, filePath) {
  const models = [];
  function visit(node) {
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
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return models;
}

// Go: 含 `gorm:"..."` 或 `db:"..."` struct tag 的 struct
function extractGoGorm(rootNode, filePath) {
  const models = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "type_declaration") {
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (!c || c.type !== "type_spec") continue;
        // Go tree-sitter: type_spec 没有名为 'name' 的字段，type_identifier 是兄弟
        const nameNode = c.childForFieldName("name") || (() => {
          for (let j = 0; j < c.childCount; j++) {
            const cc = c.child(j);
            if (cc && cc.type === "type_identifier") return cc;
          }
          return null;
        })();
        const typeNode = c.childForFieldName("type") || (() => {
          for (let j = 0; j < c.childCount; j++) {
            const cc = c.child(j);
            if (cc && (cc.type === "struct_type" || cc.type === "interface_type")) return cc;
          }
          return null;
        })();
        if (!nameNode || !typeNode || typeNode.type !== "struct_type") continue;
        const text = typeNode.text || "";
        if (/gorm:|db:/i.test(text)) {
          const fields = text.split("\n").filter((l) => /`[^`]*:/i.test(l)).length;
          models.push({ name: nameNode.text, framework: "gorm", file: filePath, line: c.startPosition.row + 1, fieldCount: fields });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return models;
}

// Java: JPA @Entity + @Table / @Column
function extractJavaJpa(rootNode, filePath) {
  const models = [];
  // Java 注解分散在 modifiers 节点内；用全文模式扫描更稳
  function visit(node) {
    if (!node) return;
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      if (!nameNode) { for (let i = 0; i < node.childCount; i++) visit(node.child(i)); return; }
      const text = node.text || "";
      const isEntity = /@(?:Entity|Table)\b/.test(text);
      const fieldMatches = text.match(/@(?:Column|Id|JoinColumn|OneToMany|ManyToOne|ManyToMany|OneToOne)\b/g);
      if (isEntity) {
        models.push({ name: nameNode.text, framework: "jpa", file: filePath, line: node.startPosition.row + 1, fieldCount: (fieldMatches || []).length });
        return;
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return models;
}

// Rust: Diesel #[derive(Queryable, Table)] 或 #[table_name = "..."]
function extractRustDiesel(rootNode, filePath) {
  const models = [];
  function visit(node) {
    if (!node) return;
    if (node.type === "struct_item") {
      const nameNode = node.childForFieldName("name");
      if (!nameNode) return;
      const text = node.text || "";
      if (/derive\([^)]*(?:Queryable|Insertable|Table)[^)]*\)|#\[table_name\s*=/i.test(text)) {
        // 简单计数：pub 行
        const fields = (text.match(/^\s*pub\s+\w+/gm) || []).length;
        models.push({ name: nameNode.text, framework: "diesel", file: filePath, line: node.startPosition.row + 1, fieldCount: fields });
      }
    }
    for (let i = 0; i < node.childCount; i++) visit(node.child(i));
  }
  visit(rootNode);
  return models;
}

function extractDbModels(filePath, rootNode, language) {
  if (filePath.endsWith(".prisma")) return extractPrisma(rootNode, filePath);
  if (language === "python") return extractSqlalchemy(rootNode, filePath);
  if (language === "go") return extractGoGorm(rootNode, filePath);
  if (language === "java") return extractJavaJpa(rootNode, filePath);
  if (language === "rust") return extractRustDiesel(rootNode, filePath);
  return [];
}

// ════════════════════════════════════════════════════════════
// 调用图构建（BFS + DFS 最长链）
// ════════════════════════════════════════════════════════════
function buildCallGraph(files) {
  const byPath = new Map();
  for (const f of files) byPath.set(f.path, f);
  function resolveEdge(from, spec) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
    const fromDir = dirname(from);
    const abs = join(fromDir, spec).replaceAll("\\", "/");
    if (byPath.has(abs)) return abs;
    const candidates = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".go", ".rs", ".py", ".java", "/mod.rs"];
    for (const ext of candidates) {
      if (byPath.has(abs + ext)) return abs + ext;
    }
    return null;
  }
  const entrypoints = [];
  for (const f of files) {
    if (f.exports.length > 0) entrypoints.push(f.path);
    else if (f.functions.some((fn) => /^(apply|main|run|start)$/i.test(fn.name))) entrypoints.push(f.path);
  }
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

// ════════════════════════════════════════════════════════════
// main
// ════════════════════════════════════════════════════════════
async function main(projectPathArg) {
  const projectPath = projectPathArg || process.argv[2] || ".";
  const startMs = Date.now();

  const grammars = await loadGrammars();
  const TS = grammars.TS;

  // 读取 config.json（可选）—— languages 白名单
  let enabledLangs = null;
  const cfgPath = join(projectPath, ".project-brain", "config.json");
  try {
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
      if (Array.isArray(cfg.languages) && cfg.languages.length > 0) enabledLangs = new Set(cfg.languages);
    }
  } catch { /* ignore */ }

  const files = [];
  const edges = [];
  const apiEndpoints = [];
  const dbModels = [];
  const langStats = {};

  for await (const rel of walkFiles(projectPath)) {
    const abs = join(projectPath, rel);
    const lang = detectLang(rel);
    if (lang === "unknown") continue;
    if (enabledLangs && !enabledLangs.has(lang)) continue;
    const parser = new TS();
    parser.setLanguage(pickParserForLang(lang, grammars));
    if (!parser.getLanguage()) continue;
    let source;
    try { source = readFileSync(abs, "utf8"); } catch { continue; }
    let tree;
    try { tree = parser.parse(source); } catch { continue; }
    if (!tree || !tree.rootNode) continue;

    const extractor = EXTRACTORS[lang];
    if (!extractor) continue;
    const { imports, exports, functions } = extractor(tree.rootNode);

    langStats[lang] = (langStats[lang] || 0) + 1;
    files.push({ path: rel, language: lang, imports, exports, functions });

    for (const spec of imports) {
      const target = resolveImport(rel, spec);
      edges.push({ from: rel, to: target, type: "import" });
    }

    const apiFn = API_EXTRACTORS[lang];
    if (apiFn) {
      const eps = apiFn(rel, tree.rootNode);
      for (const ep of eps) apiEndpoints.push(ep);
    }

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
  console.log(`[codegraph-scan] languages: ${Object.entries(langStats).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  return codegraph;
}

// 仅当作为 CLI 直接运行时执行；被 import 时不自动跑
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("codegraph-scan.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

export { main as scanProject, EXTRACTORS, API_EXTRACTORS, extractDbModels, buildCallGraph, walkFiles, detectLang, loadGrammars };
