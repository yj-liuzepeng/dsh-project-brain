// scanner-fix-test.mjs - 验证 scanner 递归修复是否正确
// 用 node:fs adapter（与 scripts/verify-preview.mjs 一致），扫描插件自身目录
// 预期 fileCount > 0，languages.javascript >= 10，scanDepth 递归正常

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { scanProject } from "../src/scanner.js";

const fsAdapter = {
  resolve: async (p, opts) => (opts && opts.cwd ? join(opts.cwd, p) : p),
  readText: async (t) => readFileSync(t, "utf8"),
  listDir: async (t) => readdirSync(t, { withFileTypes: true }).map((e) => ({ name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory() })),
  processPath: (t) => t,
};

const pluginRoot = "C:\\Users\\liuzp16\\Desktop\\liuzp\\plugins\\dsh-project-brain";

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log("  PASS  " + name);
  else { failed++; console.log("  FAIL  " + name + (extra ? " -> " + extra : "")); }
}

console.log("== scanner fix verify ==");
const scan = await scanProject(fsAdapter, pluginRoot);

check("fileCount > 0", scan.fileCount > 0, "got " + scan.fileCount);
check("languages.javascript defined", typeof scan.languages.javascript === "number", JSON.stringify(scan.languages));
check("languages.javascript > 0", (scan.languages.javascript || 0) > 0, "got " + scan.languages.javascript);
check("topLevel not empty", scan.topLevel.length > 0, JSON.stringify(scan.topLevel));
check("topLevel contains package.json", scan.topLevel.includes("package.json"));
check("topLevel contains README.md", scan.topLevel.includes("README.md"));
check("topLevel excludes node_modules", !scan.topLevel.includes("node_modules"));
check("topLevel excludes .git", !scan.topLevel.includes(".git"));
check("topLevel excludes .project-brain", !scan.topLevel.includes(".project-brain"));
// 验证 recursive: src/host/store/*.js 至少被识别为 javascript
check("languages.javascript >= 10 (recursive scan works)", (scan.languages.javascript || 0) >= 10, "got " + scan.languages.javascript);

console.log("\n== result ==");
console.log("files:", scan.fileCount);
console.log("languages:", JSON.stringify(scan.languages));
console.log("techStack:", JSON.stringify(scan.techStack));
console.log("topLevel:", scan.topLevel);
console.log("\n== RESULT:", failed === 0 ? "ALL PASS" : failed + " FAILED", "==");
process.exit(failed > 0 ? 1 : 0);