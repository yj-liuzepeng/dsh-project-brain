import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  "smoke-durable-core.mjs",
  "smoke-runtime-workspace.mjs",
  "smoke-project-memory.mjs",
  "smoke-session-semantic.mjs",
  "smoke-memory-retrieval.mjs",
  "smoke-settings-probe.mjs",
  "smoke-architecture.mjs",
  "smoke-test.mjs",
  "smoke-todostrip.mjs",
  "smoke-multi-workspace.mjs",
  "smoke-theme-tokens.mjs",
  "smoke-append-line.mjs",
  "smoke-dream-commit.mjs",
  "smoke-session-lifecycle.mjs",
  "smoke-project-diff.mjs",
  "smoke-multi-lang.mjs",
  "smoke-scanner-techstack.mjs",
  "smoke-suggest.mjs",
  "smoke-retrieval-rrf.mjs",
];

// v0.7.0-beta.3 release-fix：单 suite 失败不应阻断其他 suite 验证。
// 收集所有失败在末尾统一报告，CI 能一眼看出哪些 suite 需要修。
const failures = [];
for (const test of tests) {
  console.log("\n=== " + test + " ===");
  const result = spawnSync(process.execPath, [join(__dirname, test)], { stdio: "inherit" });
  if (result.status !== 0) {
    failures.push({ test, code: result.status || 1 });
    console.error(`  >>> ${test} failed with exit code ${result.status || 1}`);
  }
}

console.log(`\n=== Smoke summary: ${tests.length - failures.length}/${tests.length} passed ===`);
if (failures.length) {
  for (const f of failures) console.error(`  FAIL: ${f.test} (exit ${f.code})`);
  process.exit(1);
}
console.log("All smoke suites passed (" + tests.length + ").");
