// smoke-session-window.mjs — 会话变更窗口（工作树 mtime + 窗口内 commit）
//
// 覆盖：
//   1) sessionWindowStart：上次 session_summary 优先，其次 lastScannedAt/createdAt，最长回看 14 天
//   2) 非 git 目录：按 mtime 落窗，忽略 node_modules/.project-brain/dist
//   3) git 仓库：窗口内 commit 的 tree diff 进结果，窗口外 commit 不进
//   4) 工作树：已跟踪文件改动 = modified，未跟踪新文件 = added
//   5) maxFiles 截断

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

import { detectSessionChanges, sessionWindowStart } from "../src/host/diff/session-window.js";

const DAY = 86_400_000;
const NOW = Date.now();

// ── 1) sessionWindowStart ──
assert.equal(
  sessionWindowStart({
    timeline: [
      { eventType: "session_summary", occurredAt: NOW - 3 * DAY },
      { eventType: "session_summary", occurredAt: NOW - 2 * DAY },
      { eventType: "rescan", occurredAt: NOW - 1000 },
    ],
    project: { createdAt: NOW - 30 * DAY },
  }, NOW),
  NOW - 2 * DAY,
  "优先取最近一条 session_summary",
);

assert.equal(
  sessionWindowStart({ timeline: [], project: { lastScannedAt: NOW - 2 * DAY, createdAt: NOW - 9 * DAY } }, NOW),
  NOW - 2 * DAY,
  "无摘要时退回 lastScannedAt",
);

const clamped = sessionWindowStart({ timeline: [{ eventType: "session_summary", occurredAt: NOW - 400 * DAY }] }, NOW);
assert.ok(clamped >= NOW - 15 * DAY && clamped <= NOW - 13 * DAY, "最长只回看 14 天");

// ── 2) 非 git 目录：mtime 落窗 ──
const plain = mkdtempSync(join(tmpdir(), "dsh-pb-window-plain-"));
mkdirSync(join(plain, "src"), { recursive: true });
mkdirSync(join(plain, "node_modules", "pkg"), { recursive: true });
mkdirSync(join(plain, ".project-brain"), { recursive: true });

const touch = (root, rel, atMs) => {
  const full = join(root, rel);
  writeFileSync(full, "x");
  const sec = atMs / 1000;
  utimesSync(full, sec, sec);
};

touch(plain, join("src", "fresh.js"), NOW - 60_000);
touch(plain, join("src", "old.js"), NOW - 10 * DAY);
touch(plain, join("node_modules", "pkg", "index.js"), NOW - 60_000);
touch(plain, join(".project-brain", "memory.jsonl"), NOW - 60_000);

const plainRes = detectSessionChanges({ projectPath: plain, sinceMs: NOW - DAY, now: NOW });
assert.ok(plainRes.files.includes("src/fresh.js"), "窗口内文件进结果");
assert.ok(!plainRes.files.includes("src/old.js"), "窗口外文件不进结果");
assert.ok(!plainRes.files.some((f) => f.startsWith("node_modules/")), "node_modules 被忽略");
assert.ok(!plainRes.files.some((f) => f.startsWith(".project-brain/")), ".project-brain 被忽略");
assert.equal(plainRes.source, "worktree");
assert.ok(!plainRes.error, "非 git 目录不算错误");

// 非 git 项目没有 HEAD tree 可比，只能靠「窗口内才出生」识别新增文件；
// 否则新建文件会被当成 modified，架构的结构化触发永远不生效。
touch(plain, join("src", "brand-new.js"), NOW - 30_000);
const plainAdded = detectSessionChanges({ projectPath: plain, sinceMs: NOW - DAY, now: NOW });
assert.equal((plainAdded.changes.find((c) => c.path === "src/brand-new.js") || {}).type, "added");
assert.equal((plainAdded.changes.find((c) => c.path === "src/fresh.js") || {}).type, "added", "窗口内新建的都算 added");

// ── git fixture ──
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");
function writeLoose(gitDir, type, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const obj = Buffer.concat([Buffer.from(`${type} ${body.length}\0`, "binary"), body]);
  const hash = sha1(obj);
  mkdirSync(join(gitDir, "objects", hash.slice(0, 2)), { recursive: true });
  writeFileSync(join(gitDir, "objects", hash.slice(0, 2), hash.slice(2)), deflateSync(obj));
  return hash;
}
function makeTree(gitDir, entries) {
  const sorted = entries.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const parts = [];
  for (const e of sorted) {
    parts.push(Buffer.from(`100644 ${e.name}\0`, "binary"));
    parts.push(Buffer.from(e.hash, "hex"));
  }
  return writeLoose(gitDir, "tree", Buffer.concat(parts));
}
function makeCommit(gitDir, { tree, parents = [], atMs }) {
  const sec = Math.floor(atMs / 1000);
  const who = `test <test@test> ${sec} +0000`;
  const lines = [`tree ${tree}`];
  for (const p of parents) lines.push(`parent ${p}`);
  lines.push(`author ${who}`, `committer ${who}`, "", "msg");
  return writeLoose(gitDir, "commit", lines.join("\n") + "\n");
}

const repo = mkdtempSync(join(tmpdir(), "dsh-pb-window-git-"));
const gitDir = join(repo, ".git");
mkdirSync(join(gitDir, "refs", "heads"), { recursive: true });
mkdirSync(join(gitDir, "objects"), { recursive: true });

// c1（窗口外）：base.js + stale.js
const baseBlob = writeLoose(gitDir, "blob", "base v1");
const staleBlob = writeLoose(gitDir, "blob", "stale v1");
const tree1 = makeTree(gitDir, [{ name: "base.js", hash: baseBlob }, { name: "stale.js", hash: staleBlob }]);
const c1 = makeCommit(gitDir, { tree: tree1, atMs: NOW - 10 * DAY });

// c2（窗口内）：改 base.js，新增 added.js
const baseBlob2 = writeLoose(gitDir, "blob", "base v2");
const addedBlob = writeLoose(gitDir, "blob", "added v1");
const tree2 = makeTree(gitDir, [
  { name: "base.js", hash: baseBlob2 },
  { name: "stale.js", hash: staleBlob },
  { name: "added.js", hash: addedBlob },
]);
const c2 = makeCommit(gitDir, { tree: tree2, parents: [c1], atMs: NOW - 2 * 3600_000 });

writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
writeFileSync(join(gitDir, "refs", "heads", "main"), c2 + "\n");

// 工作树：tracked 文件新改（modified）+ untracked 新文件（added）+ 老文件不动
touch(repo, "base.js", NOW - 10 * DAY);
touch(repo, "stale.js", NOW - 10 * DAY);
touch(repo, "added.js", NOW - 10 * DAY);
touch(repo, "dirty.js", NOW - 30_000);
touch(repo, "tracked-edit.js", NOW - 10 * DAY);

const gitRes = detectSessionChanges({ projectPath: repo, sinceMs: NOW - DAY, now: NOW });
assert.ok(gitRes.files.includes("base.js"), "窗口内 commit 修改的文件进结果");
assert.ok(gitRes.files.includes("added.js"), "窗口内 commit 新增的文件进结果");
assert.ok(!gitRes.files.includes("stale.js"), "窗口外 commit 的文件不进结果");
assert.ok(gitRes.files.includes("dirty.js"), "工作树新改文件进结果");
assert.equal(gitRes.source, "git+worktree");
assert.ok(gitRes.commits.length >= 1 && gitRes.commits.length <= 2, "只收窗口内 commit");

const typeOf = (p) => (gitRes.changes.find((c) => c.path === p) || {}).type;
assert.equal(typeOf("base.js"), "modified");
assert.equal(typeOf("added.js"), "added");
assert.equal(typeOf("dirty.js"), "added", "HEAD tree 里没有的新文件算 added");

// ── 5) maxFiles 截断 ──
const capped = detectSessionChanges({ projectPath: repo, sinceMs: NOW - 30 * DAY, now: NOW, maxFiles: 2 });
assert.equal(capped.files.length, 2);
assert.ok(capped.truncated === true);

rmSync(plain, { recursive: true, force: true });
rmSync(repo, { recursive: true, force: true });

console.log("smoke-session-window: PASS");
