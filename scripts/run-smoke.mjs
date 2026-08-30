import { spawnSync } from "node:child_process";

const tests = [
  "smoke-runtime-workspace.mjs",
  "smoke-project-memory.mjs",
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
];

for (const test of tests) {
  console.log("\n=== " + test + " ===");
  const result = spawnSync(process.execPath, [new URL(test, import.meta.url).pathname], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nAll smoke suites passed (" + tests.length + ").");
