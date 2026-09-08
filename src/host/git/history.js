// git/history.js - 项目 git 历史读取（纯 node，不依赖 shell）
//
// 复用 detector.js 的底层 git object 读取能力（loose + pack），提供高层 API：
//   - isGitRepo(projectPath): bool
//   - getGitHistory({ projectPath, limit, branch, maxCommits }): { available, currentBranch, head, total, commits, error }
//   - getGitBranches(projectPath): { branches, currentBranch }
//   - getWorkTreeChanges({ projectPath, maxFiles }): HEAD tree vs 工作树对比
//     → untracked / deleted 文件列表（不依赖 git binary）
//
// 限制：
//   - 多 parent commit 默认走 first-parent（与 git log --first-parent 一致）
//   - merge commit 的额外 parent 标记在 extraParents 字段
//   - 提交时间用 authorTimestamp（unix seconds → ISO）
//   - 工作树 vs HEAD 只产出 untracked + deleted；modified 检测需要 hash 工作树文件（IO 大）暂不做

import { join, relative, sep } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readGitObject, readHead, readCommitFull, parseTree, collectTreeFiles } from "../diff/detector.js";

// 计算两个 commit 之间的 file-level 变化（基于 tree object diff）
// 返回 { files: [path], totalFiles, added, modified, removed, truncated }
// 限制：files 最多返回前 MAX_FILES 个文件路径（避免响应体过大）
const MAX_FILES = 8;
function diffCommitTrees(gitDir, currentTreeHash, parentTreeHash) {
  const currentFiles = collectTreeFiles(gitDir, currentTreeHash);
  const parentFiles = parentTreeHash ? collectTreeFiles(gitDir, parentTreeHash) : {};
  const allPaths = new Set([...Object.keys(currentFiles), ...Object.keys(parentFiles)]);
  const added = [];
  const modified = [];
  const removed = [];
  const files = [];
  for (const path of allPaths) {
    const cur = currentFiles[path];
    const par = parentFiles[path];
    if (par === undefined) {
      added.push(path);
      files.push(path);
    } else if (cur === undefined) {
      removed.push(path);
      files.push(path);
    } else if (cur !== par) {
      modified.push(path);
      files.push(path);
    }
  }
  return {
    files: files.slice(0, MAX_FILES),
    totalFiles: files.length,
    added: added.length,
    modified: modified.length,
    removed: removed.length,
    truncated: files.length > MAX_FILES,
  };
}

const GIT_DIR_NAMES = [".git"];

function findGitDir(projectPath) {
  if (!projectPath) return null;
  for (const name of GIT_DIR_NAMES) {
    const candidate = join(projectPath, name);
    if (existsSync(candidate)) {
      try {
        if (existsSync(join(candidate, "HEAD"))) return candidate;
      } catch (e) {}
    }
  }
  return null;
}

export function isGitRepo(projectPath) {
  return Boolean(findGitDir(projectPath));
}

// 读 refs/heads/* 分支列表
function readHeadsBranches(gitDir) {
  const out = [];
  const headsDir = join(gitDir, "refs", "heads");
  if (!existsSync(headsDir)) return out;
  const walk = (dir, prefix) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, prefix + entry.name + "/");
      } else if (entry.isFile()) {
        try {
          const hash = readFileSync(full, "utf8").trim();
          if (/^[0-9a-f]{40}$/i.test(hash)) {
            out.push({ name: prefix + entry.name, commit: hash.toLowerCase() });
          }
        } catch (e) {}
      }
    }
  };
  walk(headsDir, "");
  return out;
}

// 从 packed-refs 读分支
function readPackedBranches(gitDir) {
  const out = [];
  const path = join(gitDir, "packed-refs");
  if (!existsSync(path)) return out;
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith("#") || !line.trim()) continue;
      const m = line.match(/^([0-9a-f]{40})\s+refs\/heads\/(.+)$/);
      if (m) out.push({ name: m[2], commit: m[1].toLowerCase() });
    }
  } catch (e) {}
  return out;
}

export function getGitBranches(projectPath) {
  const gitDir = findGitDir(projectPath);
  if (!gitDir) return { available: false, branches: [], currentBranch: null };
  const head = readHead(gitDir);
  const fromLoose = readHeadsBranches(gitDir);
  const fromPacked = readPackedBranches(gitDir);
  // 合并（loose 优先于 packed-refs）
  const map = new Map();
  for (const b of fromPacked) map.set(b.name, b);
  for (const b of fromLoose) map.set(b.name, b);
  const branches = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  return {
    available: true,
    currentBranch: (head && head.branch) || null,
    branches,
  };
}

// 走 commit chain（first-parent）取最近 N 个 commit
// 如果 commit 缺失（pack 不支持），跳过并继续
export function getGitHistory({ projectPath, limit = 50, branch = null } = {}) {
  const gitDir = findGitDir(projectPath);
  if (!gitDir) return { available: false, error: "not a git repository", commits: [] };
  const head = readHead(gitDir);
  if (!head || !head.commit) return { available: false, error: "no HEAD commit", commits: [] };

  const commits = [];
  const visited = new Set();
  const max = Math.max(1, Math.min(500, Number(limit) || 50));
  let current = head.commit.toLowerCase();
  let truncated = false;

  while (current && !visited.has(current) && commits.length < max) {
    visited.add(current);
    const c = readCommitFull(gitDir, current);
    if (!c) {
      // commit object 读不到（pack 解析限制） → 停止遍历，记录已读到的
      break;
    }
    // 取 first-parent 作线性历史；其他 parent 标 extraParents（merge 信息）
    const firstParent = (c.parents && c.parents[0]) || null;
    const extraParents = (c.parents || []).slice(1);
    // 计算本次 commit 相对 firstParent 的变更文件（tree object diff）
    // 失败时不阻塞（pack 限制 / 读不到 tree 时返回空）
    let diff = { files: [], totalFiles: 0, added: 0, modified: 0, removed: 0, truncated: false };
    try {
      // parentTreeHash: 读 firstParent commit 的 tree（避免再次依赖 readCommitFull）
      let parentTreeHash = null;
      if (firstParent) {
        const parentObj = readGitObject(gitDir, firstParent);
        if (parentObj && parentObj.type === "commit") {
          const parentText = parentObj.content.toString("utf8");
          const treeMatch = parentText.match(/^tree\s+([0-9a-f]{40})\s*$/m);
          if (treeMatch) parentTreeHash = treeMatch[1];
        }
      }
      diff = diffCommitTrees(gitDir, c.tree, parentTreeHash);
    } catch (e) {
      // tree 读不到（pack 限制等）— diff 保持空，不阻塞 commit 列表
    }
    commits.push({
      hash: c.hash,
      shortHash: c.shortHash,
      subject: c.subject || "",
      body: c.message && c.message.length > (c.subject || "").length ? c.message.slice((c.subject || "").length).replace(/^\s+/, "").slice(0, 400) : "",
      author: c.author || "",
      authorEmail: c.authorEmail || "",
      timestamp: Number(c.authorTimestamp) || 0,
      isoTime: c.authorTimestamp ? new Date(Number(c.authorTimestamp) * 1000).toISOString() : "",
      firstParent,
      extraParents,
      isMerge: extraParents.length > 0,
      // 文件变更（基于 tree diff）
      filesChanged: diff.files,
      filesChangedTotal: diff.totalFiles,
      filesAdded: diff.added,
      filesModified: diff.modified,
      filesRemoved: diff.removed,
      filesTruncated: diff.truncated,
    });
    current = firstParent;
  }
  if (current && !visited.has(current) === false) {
    truncated = true;
  }

  return {
    available: true,
    currentBranch: (head && head.branch) || null,
    head: head.commit,
    total: commits.length,
    truncated,
    commits,
  };
}

// ── 工作树对比（不依赖 git binary，纯文件 IO + git object 读取） ──

// 常见忽略（git status 默认也会忽略 .git 等）
const WORKTREE_IGNORE_DIRS = new Set([
  ".git",
  ".project-brain",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  "target",
  "__pycache__",
  ".DS_Store",
  ".venv",
  "venv",
  "vendor",
  ".idea",
  ".vscode",
  ".turbo",
  ".cache",
  ".pnpm-store",
]);
const WORKTREE_IGNORE_SUFFIXES = [".log", ".bak", ".tmp", ".swp", ".swo"];
const WORKTREE_IGNORE_NAMES = new Set([".DS_Store", "Thumbs.db"]);

// 递归扫描工作树，返回 { filePath: true } map
function collectWorkTreeFiles(projectPath) {
  const out = Object.create(null);
  if (!projectPath) return out;
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      const name = entry.name;
      if (WORKTREE_IGNORE_NAMES.has(name)) continue;
      if (WORKTREE_IGNORE_DIRS.has(name)) continue;
      const full = join(dir, name);
      // 后缀过滤（仅对文件生效）
      let isDir = entry.isDirectory();
      if (!isDir && entry.isSymbolicLink()) {
        // 跳过 symlink（避免循环）
        continue;
      }
      if (!isDir && WORKTREE_IGNORE_SUFFIXES.some((suf) => name.endsWith(suf))) continue;
      if (isDir) {
        walk(full);
      } else if (entry.isFile()) {
        let rel;
        try { rel = relative(projectPath, full).split(sep).join("/"); } catch (e) { continue; }
        if (!rel || rel.startsWith("..")) continue;
        out[rel] = true;
      }
    }
  }
  walk(projectPath);
  return out;
}

// 沿 first-parent 链找一个可读的 commit tree（HEAD tree 读不到时的 fallback）
// 返回 { files, commitHash, commitShort } 或 null
function findReadableReferenceTree(gitDir, startCommitHash) {
  let current = startCommitHash;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    const c = readCommitFull(gitDir, current);
    if (!c) break;
    const files = collectTreeFiles(gitDir, c.tree);
    if (Object.keys(files).length > 0) {
      return { files, commitHash: current, commitShort: current.substring(0, 7) };
    }
    if (!c.parents || !c.parents[0]) break;
    current = c.parents[0];
  }
  return null;
}

// 工作树 vs HEAD tree 对比
// 返回 { available, untracked, deleted, untrackedTotal, deletedTotal, workFilesTotal, reference }
// 注意：modified 检测需要 hash 工作树文件内容（IO 大），暂不产出
// 限制：
//   - HEAD tree 优先作为参考 tree
//   - 若 HEAD tree 不可读（pack 解析失败），沿 first-parent 链找一个可读 tree 作为 fallback
//   - 若完全找不到可读 tree，整个 workTree 检测不可用（available=false）
export function getWorkTreeChanges({ projectPath, maxFiles = 50 } = {}) {
  const gitDir = findGitDir(projectPath);
  if (!gitDir) return { available: false, error: "not a git repository" };
  const head = readHead(gitDir);
  if (!head || !head.commit) return { available: false, error: "no HEAD commit" };

  // HEAD tree files
  const headCommit = readCommitFull(gitDir, head.commit);
  if (!headCommit) return { available: false, error: "cannot read HEAD commit" };
  let headTreeFiles = collectTreeFiles(gitDir, headCommit.tree);
  let reference = "head";  // "head" | "fallback"
  let referenceCommit = head.commit;

  // 鲁棒性：HEAD tree 不可读时（detector.js v0.4.6 pack fallback 已知 bug），
  // 沿 first-parent 链找一个可读 tree 作为参考，避免完全显示不出 Working Tree 区块
  if (Object.keys(headTreeFiles).length === 0) {
    const fallback = findReadableReferenceTree(gitDir, head.commit);
    if (!fallback) {
      return {
        available: false,
        error: "HEAD tree 不可读（pack 解析限制），无法可靠检测工作树变更",
      };
    }
    headTreeFiles = fallback.files;
    reference = "fallback";
    referenceCommit = fallback.commitHash;
  }
  const headPaths = Object.keys(headTreeFiles);

  // 工作树 files
  const workFiles = collectWorkTreeFiles(projectPath);
  const workPaths = Object.keys(workFiles);

  const untracked = [];
  const deleted = [];
  for (const p of workPaths) {
    if (!Object.prototype.hasOwnProperty.call(headTreeFiles, p)) untracked.push(p);
  }
  for (const p of headPaths) {
    if (!Object.prototype.hasOwnProperty.call(workFiles, p)) deleted.push(p);
  }
  // 排序
  untracked.sort();
  deleted.sort();
  const cap = Math.max(1, Math.min(200, Number(maxFiles) || 50));
  return {
    available: true,
    head: head.commit,
    reference,
    referenceCommit,
    referenceCommitShort: referenceCommit.substring(0, 7),
    untracked,
    deleted,
    untrackedTotal: untracked.length,
    deletedTotal: deleted.length,
    workFilesTotal: workPaths.length,
    truncatedUntracked: untracked.length > cap,
    truncatedDeleted: deleted.length > cap,
    untrackedSample: untracked.slice(0, cap),
    deletedSample: deleted.slice(0, cap),
  };
}