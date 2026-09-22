// session-window.js — 「本次会话改了什么」的变更窗口
//
// 旧实现用 detectChanges({ since: "1" })（HEAD vs HEAD~1），等于把上一个 commit
// 当成本次会话的成果：没提交就什么都收不到，别人刚提交过就会被算到自己头上。
//
// 这里改成时间窗口：
//   1) 工作树里 mtime 落在 (sinceMs, now] 的文件（未提交的改动也算，非 git 项目同样可用）
//   2) git 仓库里 committer 时间落在窗口内的 commit，逐个与 first parent 做 tree diff
// 两路合并去重。读不到 git 不算错误，降级为纯工作树。

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readHead, readCommitFull, collectTreeFiles } from "./detector.js";
import { WORKTREE_IGNORE_DIRS, WORKTREE_IGNORE_NAMES, WORKTREE_IGNORE_SUFFIXES } from "../git/history.js";

const MAX_WINDOW_MS = 14 * 86_400_000;
const MAX_COMMITS = 30;
const DEFAULT_MAX_FILES = 40;

// 会话窗口起点：上次 session_summary > 上次扫描 > 建脑时间 > 24 小时前，且最长只回看 14 天。
export function sessionWindowStart(brain, now = Date.now()) {
  const timeline = Array.isArray(brain && brain.timeline) ? brain.timeline : [];
  let last = 0;
  for (const e of timeline) {
    if (!e || e.eventType !== "session_summary") continue;
    const at = Number(e.occurredAt) || 0;
    if (at > last) last = at;
  }
  const project = (brain && brain.project) || {};
  const fallback = Number(project.lastScannedAt) || Number(project.createdAt) || 0;
  const picked = last || fallback || now - 86_400_000;
  return Math.max(picked, now - MAX_WINDOW_MS);
}

function walkWorkTree(projectPath, onFile) {
  const stack = [projectPath];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      const name = entry.name;
      if (WORKTREE_IGNORE_NAMES.has(name) || WORKTREE_IGNORE_DIRS.has(name)) continue;
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (WORKTREE_IGNORE_SUFFIXES.some((suf) => name.endsWith(suf))) continue;
      let rel;
      try { rel = relative(projectPath, full).split(sep).join("/"); } catch (e) { continue; }
      if (!rel || rel.startsWith("..")) continue;
      onFile(rel, full);
    }
  }
}

function worktreeChangedSince(projectPath, sinceMs, now) {
  const out = [];
  walkWorkTree(projectPath, (rel, full) => {
    let stat = null;
    try { stat = statSync(full); } catch (e) { return; }
    const mtime = stat.mtimeMs;
    if (!(mtime > sinceMs && mtime <= now + 1000)) return;
    // 没有 git 时，「窗口内才出生」是判断新增文件的唯一线索；有 git 时以 HEAD tree 为准。
    const birth = Number(stat.birthtimeMs) || 0;
    out.push({ path: rel, born: Boolean(birth) && birth > sinceMs && birth <= now + 1000 });
  });
  return out;
}

function diffTrees(gitDir, treeHash, parentTreeHash) {
  const cur = collectTreeFiles(gitDir, treeHash);
  const par = parentTreeHash ? collectTreeFiles(gitDir, parentTreeHash) : {};
  const out = [];
  const seen = new Set([...Object.keys(cur), ...Object.keys(par)]);
  for (const path of seen) {
    const a = cur[path];
    const b = par[path];
    if (a === b) continue;
    if (b === undefined) out.push({ path, type: "added" });
    else if (a === undefined) out.push({ path, type: "removed" });
    else out.push({ path, type: "modified" });
  }
  return out;
}

// 返回 { files, changes, commits, windowStart, source, truncated, error }
export function detectSessionChanges({ projectPath, sinceMs, now = Date.now(), maxFiles = DEFAULT_MAX_FILES }) {
  const result = {
    files: [],
    changes: [],
    commits: [],
    windowStart: sinceMs,
    source: "worktree",
    truncated: false,
    error: "",
  };
  if (!projectPath) {
    result.error = "no project path";
    return result;
  }

  const byPath = new Map();
  const note = (path, type) => {
    const p = String(path || "").replace(/\\/g, "/");
    if (!p) return;
    const prev = byPath.get(p);
    // added 比 modified 更有信息量（结构变化），removed 优先级最高
    if (!prev || type === "removed" || (type === "added" && prev !== "removed")) byPath.set(p, type);
  };

  const gitDir = join(projectPath, ".git");
  let headTreeFiles = null;
  if (existsSync(gitDir)) {
    try {
      const head = readHead(gitDir);
      const headCommit = head && head.commit ? readCommitFull(gitDir, head.commit) : null;
      if (headCommit) {
        headTreeFiles = collectTreeFiles(gitDir, headCommit.tree);
        result.source = "git+worktree";
        let cursor = headCommit;
        let depth = 0;
        while (cursor && depth < MAX_COMMITS) {
          const ts = (Number(cursor.committerTimestamp) || Number(cursor.authorTimestamp) || 0) * 1000;
          if (!ts || ts <= sinceMs) break;
          result.commits.push({ hash: cursor.hash, at: ts, subject: cursor.subject });
          const parentHash = cursor.parents && cursor.parents[0];
          const parent = parentHash ? readCommitFull(gitDir, parentHash) : null;
          for (const change of diffTrees(gitDir, cursor.tree, parent ? parent.tree : null)) {
            note(change.path, change.type);
          }
          cursor = parent;
          depth += 1;
        }
      } else {
        result.error = "cannot read HEAD commit";
      }
    } catch (e) {
      result.error = String((e && e.message) || e);
    }
  }

  for (const item of worktreeChangedSince(projectPath, sinceMs, now)) {
    const tracked = headTreeFiles
      ? Object.prototype.hasOwnProperty.call(headTreeFiles, item.path)
      : !item.born;
    note(item.path, tracked ? "modified" : "added");
  }

  const all = Array.from(byPath.entries())
    .map(([path, type]) => ({ path, type }))
    .sort((a, b) => a.path.localeCompare(b.path));
  result.truncated = all.length > maxFiles;
  result.changes = all.slice(0, maxFiles);
  result.files = result.changes.map((c) => c.path);
  return result;
}
