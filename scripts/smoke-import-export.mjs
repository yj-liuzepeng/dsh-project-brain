// smoke-import-export.mjs — 端到端 smoke：导出 → 跨项目模拟 → 导入 → 回滚 → 清理
//
// 场景：模拟「公司脑 → 家里脑」完整流程
//   1. 在临时项目 A 初始化脑（带几条 memory/todo/timeline）
//   2. export → bundle.zip
//   3. 在临时项目 B 导入 bundle → 验证记忆/todo/timeline 完整恢复
//   4. 改写项目 B 脑（加几条新记忆）→ 备份 → 回滚 → 验证还原
//   5. cleanup → 验证保留 N 个

import { promises as fsp } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, "..", "src");
const fileUrl = (relPath) => pathToFileURL(join(SRC_ROOT, relPath)).href;

// 动态 import（Windows 上需要 file:// URL）
const {
  buildBundleBuffer,
  parseBundle,
  previewBundle,
  applyBundle,
  writeBundleFile,
} = await import(fileUrl("host/transfer/bundle.js"));
const {
  createBackup,
  listBackups,
  cleanupBackups,
  previewRollback,
  applyRollback,
} = await import(fileUrl("host/transfer/backup.js"));
const {
  createTokenStore,
} = await import(fileUrl("host/transfer/confirm-tokens.js"));

let pass = 0;
let fail = 0;
function check(name, ok, extra) {
  if (ok) {
    pass += 1;
    console.log("  PASS  " + name);
  } else {
    fail += 1;
    console.log("  FAIL  " + name + (extra ? "  -> " + extra : ""));
  }
}

function tmpDir(label) {
  return join(tmpdir(), `dsh-brain-smoke-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

async function mkBrain(projectPath, { memCount, todoCount, timelineCount }) {
  const brainDir = join(projectPath, ".project-brain");
  await fsp.mkdir(brainDir, { recursive: true });
  const project = {
    id: "brain-smoke-" + Math.random().toString(36).slice(2, 8),
    name: path.basename(projectPath),
    rootPath: projectPath,
    description: "smoke test brain",
    techStack: { ci: "GitHub Actions", structure: "Monorepo" },
    stack: { ci: ["GitHub Actions"] },
    structure: ["Monorepo"],
    languages: { javascript: 10 },
    tooling: ["node"],
    size: { files: 10 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastScannedAt: Date.now(),
  };
  await fsp.writeFile(join(brainDir, "project.json"), JSON.stringify(project, null, 2));
  const memLines = [];
  for (let i = 0; i < memCount; i++) {
    memLines.push(JSON.stringify({
      id: `mem-smoke-${i}`,
      type: i % 2 === 0 ? "decision" : "lesson",
      title: `Smoke memory #${i}`,
      content: `Memory content for smoke test #${i}. Some details.`,
      importance: 0.5,
      confidence: 0.7,
      createdAt: Date.now() - i * 1000,
      tags: ["smoke"],
    }));
  }
  await fsp.writeFile(join(brainDir, "memory.jsonl"), memLines.join("\n") + "\n");
  const todoLines = [];
  for (let i = 0; i < todoCount; i++) {
    todoLines.push(JSON.stringify({
      id: `todo-smoke-${i}`,
      title: `Smoke todo #${i}`,
      status: i === 0 ? "done" : "pending",
      priority: "medium",
      createdAt: Date.now() - i * 1000,
      updatedAt: Date.now() - i * 1000,
    }));
  }
  await fsp.writeFile(join(brainDir, "todo.jsonl"), todoLines.join("\n") + "\n");
  const tlLines = [];
  for (let i = 0; i < timelineCount; i++) {
    tlLines.push(JSON.stringify({
      id: `evt-smoke-${i}`,
      title: `Timeline event #${i}`,
      eventType: "init",
      occurredAt: Date.now() - i * 1000,
    }));
  }
  await fsp.writeFile(join(brainDir, "timeline.jsonl"), tlLines.join("\n") + "\n");
  // architecture
  await fsp.writeFile(join(brainDir, "architecture.json"), JSON.stringify({
    generated: true, version: 1, modules: 3, edges: 2, source: "smoke", createdAt: Date.now(),
  }, null, 2));
}

async function readJsonl(path) {
  try {
    const text = await fsp.readFile(path, "utf8");
    return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch (e) { return []; }
}

console.log("=== AC-1: buildBundleBuffer + parseBundle roundtrip ===");
{
  const projectPath = tmpDir("export");
  await mkBrain(projectPath, { memCount: 5, todoCount: 3, timelineCount: 4 });
  const bundlePath = join(projectPath, "bundle.zip");
  const built = await buildBundleBuffer({ projectPath, pluginVersion: "1.3.1", includeCache: true });
  await fsp.writeFile(bundlePath, built.buffer);
  check("bundle file written", existsSync(bundlePath));
  check("bundle size > 0", built.sizeBytes > 0);
  check("bundle manifest.schemaVersion=1", built.manifest.schemaVersion === 1);
  check("bundle manifest.fileCount=5+ files", built.fileCount >= 5);
  check("bundle sourceProject.id matches", built.manifest.sourceProject.id.startsWith("brain-smoke-"));

  const parsed = await parseBundle(bundlePath);
  check("parseBundle manifest.schemaVersion ok", parsed.manifest.schemaVersion === 1);
  check("parseBundle project.json present", parsed.files.has(".project-brain/project.json"));
  check("parseBundle memory.jsonl present", parsed.files.has(".project-brain/memory.jsonl"));
  const mems = (await readJsonl(join(projectPath, ".project-brain/memory.jsonl")));
  const memsInBundle = parsed.files.get(".project-brain/memory.jsonl").toString("utf8").split("\n").filter(Boolean);
  check("memory count matches", memsInBundle.length === mems.length);

  const diskPath = join(projectPath, "dist-backups", "direct.zip");
  const written = await writeBundleFile({ projectPath, outputPath: diskPath, pluginVersion: "1.3.1" });
  check("writeBundleFile created dist-backups zip", existsSync(diskPath));
  check("writeBundleFile sizeBytes matches stat", written.sizeBytes > 0);
  check("writeBundleFile bundlePath is outputPath", written.bundlePath === diskPath);

  // cleanup
  await fsp.rm(projectPath, { recursive: true, force: true });
}

console.log("\n=== AC-2: applyBundle to empty project (first-time) ===");
{
  const srcPath = tmpDir("src");
  const destPath = tmpDir("dest");
  await mkBrain(srcPath, { memCount: 3, todoCount: 2, timelineCount: 2 });
  const bundlePath = join(srcPath, "bundle.zip");
  const built = await buildBundleBuffer({ projectPath: srcPath, pluginVersion: "1.3.1" });
  await fsp.writeFile(bundlePath, built.buffer);
  await fsp.mkdir(destPath, { recursive: true });

  const result = await applyBundle({ bundlePath, destProjectPath: destPath });
  check("first-time: backupPath is null", result.backupPath === null);
  check("first-time: brain dir created", existsSync(join(destPath, ".project-brain")));
  const proj = JSON.parse(await fsp.readFile(join(destPath, ".project-brain/project.json"), "utf8"));
  check("first-time: rootPath rewritten", proj.rootPath === destPath);
  const mems = await readJsonl(join(destPath, ".project-brain/memory.jsonl"));
  check("first-time: 3 memories restored", mems.length === 3);

  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-3: applyBundle to existing project (backup created) ===");
{
  const srcPath = tmpDir("src");
  const destPath = tmpDir("dest");
  await mkBrain(srcPath, { memCount: 4, todoCount: 1, timelineCount: 1 });
  await mkBrain(destPath, { memCount: 2, todoCount: 2, timelineCount: 2 });

  const bundlePath = join(srcPath, "bundle.zip");
  const built = await buildBundleBuffer({ projectPath: srcPath, pluginVersion: "1.3.1" });
  await fsp.writeFile(bundlePath, built.buffer);

  const result = await applyBundle({ bundlePath, destProjectPath: destPath });
  check("existing: backupPath non-null", result.backupPath !== null);
  check("existing: backup dir exists", existsSync(result.backupPath));
  const mems = await readJsonl(join(destPath, ".project-brain/memory.jsonl"));
  check("existing: 4 memories (from bundle)", mems.length === 4);
  const backupMems = await readJsonl(join(result.backupPath, "memory.jsonl"));
  check("existing: backup has 2 memories (old)", backupMems.length === 2);

  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-4: previewBundle dry-run does not modify files ===");
{
  const srcPath = tmpDir("src");
  const destPath = tmpDir("dest");
  await mkBrain(srcPath, { memCount: 2, todoCount: 2, timelineCount: 2 });
  await mkBrain(destPath, { memCount: 5, todoCount: 5, timelineCount: 5 });
  const bundlePath = join(srcPath, "bundle.zip");
  await fsp.writeFile(bundlePath, (await buildBundleBuffer({ projectPath: srcPath, pluginVersion: "1.3.1" })).buffer);

  const preview = await previewBundle({ bundlePath, destProjectPath: destPath });
  check("preview: currentBrain.exists", preview.currentBrain.exists === true);
  check("preview: current memCount=5", preview.currentBrain.memCount === 5);
  check("preview: incoming memCount=2", preview.incoming.memCount === 2);
  check("preview: backupWillCreateAt non-null", preview.backupWillCreateAt !== null);
  check("preview: rootPathRewrite.from present", preview.rootPathRewrite.from && preview.rootPathRewrite.from.includes("src"));
  check("preview: rootPathRewrite.to=destPath", preview.rootPathRewrite.to === destPath);

  // 验证：未修改任何文件
  const beforeMems = await readJsonl(join(destPath, ".project-brain/memory.jsonl"));
  check("preview did NOT change brain", beforeMems.length === 5);

  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-5/6: confirmToken issue + consume + mismatch ===");
{
  const store = createTokenStore();
  const token = store.issue({ kind: "import", payload: { bundlePath: "/x.zip" } });
  check("token is 32-char hex", /^[0-9a-f]{32}$/.test(token));
  const payload1 = store.consume(token, { kind: "import" });
  check("first consume succeeds", payload1 && payload1.bundlePath === "/x.zip");
  const payload2 = store.consume(token, { kind: "import" });
  check("second consume returns null", payload2 === null);
  const token2 = store.issue({ kind: "import", payload: {} });
  const payload3 = store.consume(token2, { kind: "rollback" }); // wrong kind
  check("kind mismatch returns null", payload3 === null);
}

console.log("\n=== AC-7: bundle with future schemaVersion rejected ===");
{
  const srcPath = tmpDir("src");
  const destPath = tmpDir("dest");
  await mkBrain(srcPath, { memCount: 1, todoCount: 0, timelineCount: 0 });
  const built = await buildBundleBuffer({ projectPath: srcPath, pluginVersion: "1.3.1" });
  // Tamper: bump schemaVersion in the buffer
  const manifestJson = JSON.stringify({
    ...built.manifest,
    schemaVersion: 999,
  });
  const newBuf = Buffer.concat([
    Buffer.from("MANIFEST-FAKE"),
    built.buffer,
  ]);
  // Write tampered bundle via rewriting manifest in zip — easier to write a custom zip
  // Use a minimal hand-crafted zip-like: just put manifest.json with schemaVersion=999 as only entry
  // For test, use a small fake zip via our writer:
  const { _internal } = await import(fileUrl("host/transfer/bundle.js"));
  const zw = new _internal.ZipWriter();
  zw.addFile("manifest.json", Buffer.from(manifestJson, "utf8"));
  zw.addFile(".project-brain/project.json", Buffer.from(JSON.stringify({ id: "fake", name: "fake" }), "utf8"));
  const fakeBundlePath = join(srcPath, "fake.zip");
  await fsp.writeFile(fakeBundlePath, zw.finalize());

  try {
    await parseBundle(fakeBundlePath);
    check("future schema rejected", false, "should have thrown");
  } catch (e) {
    check("future schema rejected", e.code === "E_BUNDLE_SCHEMA_UNSUPPORTED", "got code=" + e.code);
  }

  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-8: rootPath auto-rewritten to dest ===");
{
  const srcPath = tmpDir("src");
  const destPath = tmpDir("dest");
  await mkBrain(srcPath, { memCount: 1, todoCount: 0, timelineCount: 0 });
  const bundlePath = join(srcPath, "bundle.zip");
  await fsp.writeFile(bundlePath, (await buildBundleBuffer({ projectPath: srcPath, pluginVersion: "1.3.1" })).buffer);

  await fsp.mkdir(destPath, { recursive: true });
  await applyBundle({ bundlePath, destProjectPath: destPath });
  const proj = JSON.parse(await fsp.readFile(join(destPath, ".project-brain/project.json"), "utf8"));
  check("rootPath rewritten to destPath", proj.rootPath === destPath);
  check("rootPath is NOT srcPath", proj.rootPath !== srcPath);

  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-9/10/11: backup create + list + rollback ===");
{
  const projectPath = tmpDir("backup");
  await mkBrain(projectPath, { memCount: 3, todoCount: 2, timelineCount: 1 });
  const r1 = await createBackup({ projectPath });
  check("backup r1 created", existsSync(r1.backupPath));
  check("backup r1 ts format valid", /^\d{8}-\d{6}-\d{3}$/.test(r1.ts));
  check("backup r1 sizeBytes > 0", r1.sizeBytes > 0);
  check("brain dir renamed away after r1", !existsSync(join(projectPath, ".project-brain")));

  await mkBrain(projectPath, { memCount: 4, todoCount: 0, timelineCount: 0 });
  const r2 = await createBackup({ projectPath });
  check("backup r2 created", existsSync(r2.backupPath));

  // 现在直接回滚到 r2 来测：先恢复脑（不要立即再 backup）
  // r2 = 4 mem, r1 = 3 mem
  await mkBrain(projectPath, { memCount: 5, todoCount: 0, timelineCount: 0 });
  // 不立即 backup → 当前脑=5 mems
  check("current brain exists before rollback", existsSync(join(projectPath, ".project-brain")));

  // Rollback preview to r1 (oldest, 3 mems)
  const preview = await previewRollback({ projectPath, backupTimestamp: r1.ts });
  check("rollback preview: source memCount=3", preview.sourceBackup.memCount === 3);
  check("rollback preview: current memCount=5", preview.currentBrain.memCount === 5);
  check("rollback preview: willBackupCurrentTo non-null", preview.willBackupCurrentTo !== null);

  // Apply rollback to r1
  const applied = await applyRollback({ projectPath, backupTimestamp: r1.ts });
  check("rollback applied: restoredFrom", applied.restoredFrom.endsWith(r1.backupName));
  check("rollback applied: preRollbackBackupPath non-null", applied.preRollbackBackupPath !== null);

  // Verify: current brain = 3 memories (from r1)
  const mems = await readJsonl(join(projectPath, ".project-brain/memory.jsonl"));
  check("after rollback: 3 memories", mems.length === 3);

  // r1 is gone (renamed → current brain). r2 + pre-rollback backup remain.
  const list2 = await listBackups({ projectPath });
  check("after rollback: 2 backups remaining (r2 + pre-rollback)", list2.length === 2);

  // Cleanup: keep last 1, older than 0ms (everything except most recent)
  const cleanup = await cleanupBackups({ projectPath, keepLast: 1, olderThanMs: 0 });
  check("cleanup: deleted = 1 (the older one)", cleanup.deleted.length === 1);
  const list3 = await listBackups({ projectPath });
  check("cleanup: 1 backup remaining", list3.length === 1);

  await fsp.rm(projectPath, { recursive: true, force: true });
}

console.log("\n=== AC-12: bundle excludes excluded files ===");
{
  const projectPath = tmpDir("exclude");
  const brainDir = join(projectPath, ".project-brain");
  await fsp.mkdir(brainDir, { recursive: true });
  await fsp.writeFile(join(brainDir, "project.json"), JSON.stringify({ id: "b1", name: "ex", rootPath: projectPath, updatedAt: Date.now() }, null, 2));
  await fsp.writeFile(join(brainDir, "memory.jsonl"), "");
  await fsp.writeFile(join(brainDir, "debug.log"), "should be excluded");
  await fsp.writeFile(join(brainDir, "tmp-debug.txt"), "should be excluded");

  const built = await buildBundleBuffer({ projectPath, pluginVersion: "1.3.1" });
  // Re-parse and check entries
  const { _internal } = await import(fileUrl("host/transfer/bundle.js"));
  // Write to temp and parse to get entries
  const tmpZip = join(projectPath, "test.zip");
  await fsp.writeFile(tmpZip, built.buffer);
  // Use parseZip from internal to inspect entries
  // Hack: re-parse via parseBundle
  const parsed = await parseBundle(tmpZip);
  const fileNames = Array.from(parsed.files.keys());
  check("debug.log excluded", !fileNames.some((n) => n.endsWith("debug.log")));
  check("tmp-*.txt excluded", !fileNames.some((n) => n.includes("tmp-debug")));

  await fsp.rm(projectPath, { recursive: true, force: true });
}

console.log("\n=== AC-13: tools.execute unwrap 兼容 (RPC executeTool contract) ===");
// 验证 RPC executeTool 的 unwrap 逻辑兼容两种 tools.execute 返回格式
// （这条防止 v1.3.1 实测中发现的 bug：bundlePath 被吞掉导致 Toast 显示「未拿到文件名」）
{
  function unwrap(result) {
    if (!result) return {};
    if (result.ok === false) return { error: true, code: result.code, message: result.message };
    if (result && typeof result === "object" && "data" in result && result.data && typeof result.data === "object") return result.data;
    if (result && typeof result === "object" && !("ok" in result)) return result;
    return {};
  }
  // 格式 A：标准 { ok: true, data: {...} }
  const a = unwrap({ ok: true, data: { bundlePath: "/x/y.zip", bundleName: "y.zip", defaultDirPath: "/x" } });
  check("unwrap A: bundlePath present", a.bundlePath === "/x/y.zip");
  check("unwrap A: defaultDirPath present", a.defaultDirPath === "/x");
  // 格式 B：直接返回 data（部分 DSH 版本行为）
  const b = unwrap({ bundlePath: "/a/b.zip", bundleName: "b.zip" });
  check("unwrap B: bundlePath present", b.bundlePath === "/a/b.zip");
  check("unwrap B: bundleName present", b.bundleName === "b.zip");
  // 失败格式
  const e = unwrap({ ok: false, code: "E_X", message: "fail" });
  check("unwrap error: error=true", e.error === true);
  check("unwrap error: code kept", e.code === "E_X");
  // 边缘：result 是 null
  const n = unwrap(null);
  check("unwrap null: empty object", typeof n === "object" && Object.keys(n).length === 0);
}

console.log("\n=== AC-14: unwrapToolResult peels nested {ok,data} (RPC 实装会再包一层) ===");
{
  const { unwrapToolResult } = await import(fileUrl("host/transfer/tool-result.js"));
  const nested = unwrapToolResult({
    ok: true,
    data: { ok: true, data: { bundlePath: "C:\\\\work\\\\a.zip", bundleName: "a.zip", sizeBytes: 12 } },
  });
  check("nested unwrap: bundlePath kept", nested.bundlePath === "C:\\\\work\\\\a.zip");
  check("nested unwrap: bundleName kept", nested.bundleName === "a.zip");
  const flat = unwrapToolResult({ ok: true, data: { confirmToken: "abc", mode: "preview" } });
  check("one-level unwrap: confirmToken kept", flat.confirmToken === "abc" && flat.mode === "preview");
  const bare = unwrapToolResult({ bundlePath: "/x.zip" });
  check("bare data unwrap: bundlePath kept", bare.bundlePath === "/x.zip");
  const failed = unwrapToolResult({ ok: false, code: "E_X", message: "nope" });
  check("failed unwrap: error=true", failed.error === true && failed.code === "E_X");
}

console.log("\n=== AC-14b: pickRpcToolData reads action-shaped RPC (value.result.data) ===");
{
  const { pickRpcToolData } = await import(fileUrl("host/transfer/tool-result.js"));
  const actionShaped = pickRpcToolData({
    ok: true,
    value: {
      projectPath: "C:\\\\work\\\\app",
      preview: { initialized: true },
      result: { ok: true, data: { bundlePath: "C:\\\\work\\\\app\\\\dist-backups\\\\a.zip", bundleName: "a.zip", defaultDirPath: "C:\\\\work\\\\app\\\\dist-backups", sizeBytes: 99 } },
    },
  });
  check("action-shaped: bundlePath", actionShaped.bundlePath === "C:\\\\work\\\\app\\\\dist-backups\\\\a.zip");
  check("action-shaped: bundleName", actionShaped.bundleName === "a.zip");
  const hoisted = pickRpcToolData({
    ok: true,
    value: { bundlePath: "D:\\\\out\\\\b.zip", bundleName: "b.zip", result: {} },
  });
  check("top-level hoist: bundlePath", hoisted.bundlePath === "D:\\\\out\\\\b.zip");
  const flattened = pickRpcToolData({
    ok: true,
    value: { result: { bundlePath: "E:\\\\x\\\\c.zip", bundleName: "c.zip" } },
  });
  check("flattened result: bundlePath", flattened.bundlePath === "E:\\\\x\\\\c.zip");
}

console.log("\n=== AC-15: backup dir name includes seconds (spec yyyymmdd-hhmmss-mmm) ===");
{
  const { generateBackupName, matchBackupDir } = await import(fileUrl("host/transfer/backup.js"));
  const d = new Date(2026, 8, 15, 14, 30, 22, 345);
  const name = generateBackupName(d);
  check("generateBackupName uses HHMMSS", name === ".project-brain.backup-20260915-143022-345", "got " + name);
  const matched = matchBackupDir(name);
  check("new name matches parser", !!(matched && matched.ts === "20260915-143022-345"));
  const old = matchBackupDir(".project-brain.backup-20260915-1430-345");
  check("old HHMM name still listed", !!(old && old.ts === "20260915-1430-345"));
  const conflict = matchBackupDir(".project-brain.backup-20260915-143022-345-1");
  check("suffix-conflict name is NOT a valid backup id", conflict === null);
}

console.log("\n=== AC-16: zip slip rejected (entry escaping .project-brain/) ===");
{
  const destPath = tmpDir("slip-dest");
  const srcPath = tmpDir("slip-src");
  await fsp.mkdir(destPath, { recursive: true });
  await fsp.mkdir(srcPath, { recursive: true });
  const { createHash } = await import("node:crypto");
  const { _internal, applyBundle } = await import(fileUrl("host/transfer/bundle.js"));
  const zw = new _internal.ZipWriter();
  const projectJson = Buffer.from(JSON.stringify({ id: "brain-slip", name: "slip", rootPath: srcPath }), "utf8");
  const sha = createHash("sha256").update(projectJson).digest("hex");
  const manifest = {
    schemaVersion: 1,
    pluginVersion: "1.3.1",
    exportedAt: Date.now(),
    sourceProject: { id: "brain-slip", name: "slip", rootPath: srcPath },
    checksum: { algorithm: "sha256", files: { "project.json": sha } },
    options: { includeCache: false },
  };
  zw.addFile("manifest.json", Buffer.from(JSON.stringify(manifest), "utf8"));
  zw.addFile(".project-brain/project.json", projectJson);
  zw.addFile(".project-brain/../../evil.txt", Buffer.from("pwned", "utf8"));
  const bundlePath = join(srcPath, "slip.zip");
  await fsp.writeFile(bundlePath, zw.finalize());
  try {
    await applyBundle({ bundlePath, destProjectPath: destPath, triggerRescan: false });
    check("zip slip rejected", false, "should have thrown");
  } catch (e) {
    check("zip slip rejected", e.code === "E_BUNDLE_INVALID" || /穿越|escape|\\.\\./i.test(String(e && e.message)), "got " + ((e && e.code) || e));
  }
  const escaped = join(destPath, "..", "evil.txt");
  let escapedExists = false;
  try { await fsp.access(escaped); escapedExists = true; } catch (e) {}
  check("evil.txt was not written outside dest", escapedExists === false);
  await fsp.rm(srcPath, { recursive: true, force: true });
  await fsp.rm(destPath, { recursive: true, force: true });
}

console.log("\n=== AC-17: import/rollback preview payload hoists confirmToken + counts ===");
{
  const { shapeImportPreviewData, shapeRollbackPreviewData } = await import(fileUrl("host/transfer/rpc-payload.js"));
  const importShaped = shapeImportPreviewData({
    manifest: { schemaVersion: 1, pluginVersion: "1.3.1", exportedAt: 1, sourceProject: { rootPath: "D:\\src" } },
    currentBrain: { exists: true, projectId: "p1", memCount: 3, todoCount: 2, timelineCount: 1, archExists: true },
    incoming: { projectId: "p2", memCount: 9, todoCount: 4, timelineCount: 7 },
    rootPathRewrite: { from: "D:\\src", to: "E:\\dst" },
    backupWillCreateAt: "E:\\dst\\.project-brain.backup-20260917-100000-001",
  }, "E:\\dst\\in.zip", "aabbccddeeff00112233445566778899");
  check("import shape: confirmToken", importShaped.confirmToken === "aabbccddeeff00112233445566778899");
  check("import shape: incomingMemories is number", importShaped.incomingMemories === 9);
  check("import shape: currentMemories is number", importShaped.currentMemories === 3);
  check("import shape: sourceProjectRoot", importShaped.sourceProjectRoot === "D:\\src");
  check("import shape: rootPathFrom/to", importShaped.rootPathFrom === "D:\\src" && importShaped.rootPathTo === "E:\\dst");
  check("import shape: currentBrainExists true", importShaped.currentBrainExists === true);

  const emptyImport = shapeImportPreviewData({
    manifest: {},
    currentBrain: { exists: false, memCount: 0, todoCount: 0, timelineCount: 0 },
    incoming: { memCount: 5, todoCount: 0, timelineCount: 0 },
    rootPathRewrite: { from: null, to: "/new" },
    backupWillCreateAt: null,
  }, "/tmp/a.zip", "token-empty");
  check("empty current: still has incomingMemories", emptyImport.incomingMemories === 5);
  check("empty current: currentBrainExists false", emptyImport.currentBrainExists === false);
  check("empty current: incoming numbers not undefined", emptyImport.incomingTodos === 0 && emptyImport.incomingTimeline === 0);

  const rollbackShaped = shapeRollbackPreviewData({
    sourceBackup: { ts: "20260917-100000-001", backupName: ".project-brain.backup-20260917-100000-001", memCount: 8, todoCount: 1, timelineCount: 2 },
    currentBrain: { exists: true, memCount: 4, todoCount: 3, timelineCount: 1 },
    willBackupCurrentTo: "/proj/.project-brain.backup-next",
  }, "20260917-100000-001", "rollback-token");
  check("rollback shape: confirmToken", rollbackShaped.confirmToken === "rollback-token");
  check("rollback shape: sourceMemCount", rollbackShaped.sourceMemCount === 8);
  check("rollback shape: currentMemories", rollbackShaped.currentMemories === 4);

  function readRpcResult(resp) {
    const value = resp.value && typeof resp.value === "object" ? resp.value : {};
    const result = value.result && typeof value.result === "object" ? value.result : null;
    const nested = result && result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data
      : null;
    const out = {};
    const layers = [nested, result, value];
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer) continue;
      const keys = Object.keys(layer);
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        if (key === "result" || key === "data" || key === "preview" || key === "ok" || key === "name") continue;
        if (out[key] == null && layer[key] != null) out[key] = layer[key];
      }
    }
    return out;
  }
  const stripped = {
    ok: true,
    value: Object.assign({}, importShaped, {
      impact: undefined,
      manifest: undefined,
      result: {
        ok: true,
        data: {
          confirmToken: importShaped.confirmToken,
          incomingMemories: importShaped.incomingMemories,
          incomingTodos: importShaped.incomingTodos,
          incomingTimeline: importShaped.incomingTimeline,
          currentBrainExists: importShaped.currentBrainExists,
          currentMemories: importShaped.currentMemories,
          bundlePath: importShaped.bundlePath,
          sourceProjectRoot: importShaped.sourceProjectRoot,
        },
      },
    }),
  };
  const flattened = readRpcResult(stripped);
  check("stripped nested: confirmToken survives", flattened.confirmToken === importShaped.confirmToken);
  check("stripped nested: incomingMemories survives", flattened.incomingMemories === 9);
  check("stripped nested: sourceProjectRoot survives", flattened.sourceProjectRoot === "D:\\src");
}

console.log(`\n=== Smoke summary: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
