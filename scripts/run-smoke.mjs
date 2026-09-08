import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tests = [
  "smoke-runtime-workspace.mjs",
  "smoke-project-memory.mjs",
  "smoke-session-semantic.mjs",
  "smoke-memory-retrieval.mjs",
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
];

for (const test of tests) {
  console.log("\n=== " + test + " ===");
  const result = spawnSync(process.execPath, [join(__dirname, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nAll smoke suites passed (" + tests.length + ").");
