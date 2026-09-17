// backup.js — 本地备份管理：创建 / 列举 / 清理 / 回滚
//
// 数据布局（在项目根目录下，与 .project-brain/ 平级）：
//   <projectRoot>/
//   ├── .project-brain/
//   └── .project-brain.backup-<yyyymmdd-hhmm>-<sss>/
//       └── （原 .project-brain/ 全部内容）
//
// 设计要点：
//   - 用 node:fs/promises（host 进程可访问）做 rename（fs service 没有 rename/remove）
//   - 备份目录命名带毫秒避免冲突
//   - 列举时统计每条 backup 的体积 / 记录数（用于 UI 展示）
//   - 清理支持两种策略：keepLast（保留最近 N 个）+ olderThanMs（按时间）
//   - 回滚前先备份当前脑（确保可逆）

import { promises as fsp } from "node:fs";
import path from "node:path";
import { assertSafeProjectPath } from "../store/brain-files.js";
import { getTokenStore } from "./confirm-tokens.js";

// 直接用 node:fs（理由同 bundle.js）
async function readJsonlFile(filePath) {
  try {
    const text = await fsp.readFile(filePath, "utf8");
    const out = [];
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try { out.push(JSON.parse(s)); } catch (e) { /* skip */ }
    }
    return out;
  } catch (e) { return []; }
}

async function readJsonFile(filePath) {
  try {
    const text = await fsp.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (e) { return { __error: String((e && e.message) || e) }; }
}

// 备份目录名：
//   新：.project-brain.backup-yyyymmdd-hhmmss-mmm   （spec：20260915-143022-345）
//   旧：.project-brain.backup-yyyymmdd-hhmm-mmm     （v1.3.1 开发期漏了秒，列举时仍识别）
const BACKUP_DIR_RE = /^\.project-brain\.backup-(\d{8})-(\d{6})-(\d{3})$/;
const BACKUP_DIR_RE_LEGACY = /^\.project-brain\.backup-(\d{8})-(\d{4})-(\d{3})$/;

/**
 * 生成备份目录名（年月日 + 时分秒 + 毫秒，避免冲突）
 */
function generateBackupName(now = new Date()) {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `.project-brain.backup-${y}${mo}${d}-${h}${mi}${s}-${ms}`;
}

/**
 * 从目录名提取 ts。新格式优先，旧 HHMM 格式兼容。
 * 带 `-<n>` 冲突后缀的名字返回 null（那种目录回滚不了，必须避免生成）。
 */
function matchBackupDir(name) {
  if (typeof name !== "string") return null;
  const neu = name.match(BACKUP_DIR_RE);
  if (neu) return { ts: `${neu[1]}-${neu[2]}-${neu[3]}`, legacy: false };
  const old = name.match(BACKUP_DIR_RE_LEGACY);
  if (old) return { ts: `${old[1]}-${old[2]}-${old[3]}`, legacy: true };
  return null;
}

function extractTsFromDirName(name) {
  const m = matchBackupDir(name);
  return m ? m.ts : null;
}

/**
 * 创建备份：rename .project-brain/ → .project-brain.backup-<ts>/
 *
 * @param {{ projectPath: string, customTs?: string }} args
 *   customTs 用于回滚场景（指定时间戳避免冲突）；默认用当前时间
 * @returns {Promise<{ backupPath: string, backupName: string, ts: string, sizeBytes: number }>}
 */
export async function createBackup({ projectPath, customTs = null }) {
  const safe = assertSafeProjectPath(projectPath);
  const brainDir = path.join(safe, ".project-brain");

  let brainStat;
  try {
    brainStat = await fsp.stat(brainDir);
  } catch (e) {
    const err = new Error("当前项目无脑可备份（.project-brain 不存在）");
    err.code = "E_BRAIN_NOT_FOUND";
    throw err;
  }
  if (!brainStat.isDirectory()) {
    const err = new Error(".project-brain 不是目录");
    err.code = "E_BRAIN_NOT_FOUND";
    throw err;
  }

  // 生成不冲突的目录名
  let backupName = customTs ? `.project-brain.backup-${customTs}` : generateBackupName();
  let backupPath = path.join(safe, backupName);
  let attempt = 0;
  while (true) {
    try {
      await fsp.access(backupPath);
      attempt += 1;
      if (attempt > 50) {
        const err = new Error("备份目录冲突次数过多，请稍后再试");
        err.code = "E_BACKUP_CONFLICT";
        throw err;
      }
      // 重名 → 加 1ms 再生成，绝不追加 -<n>（会破坏目录名正则，回滚找不到）
      backupName = generateBackupName(new Date(Date.now() + attempt));
      backupPath = path.join(safe, backupName);
    } catch (e) {
      if (e && e.code === "E_BACKUP_CONFLICT") throw e;
      break; // access 抛 NOT_FOUND → 名字可用
    }
  }

  await fsp.mkdir(path.dirname(backupPath), { recursive: true });
  await fsp.rename(brainDir, backupPath);

  // 统计体积
  const sizeBytes = await dirSize(backupPath);

  return {
    backupName,
    backupPath,
    ts: extractTsFromDirName(backupName) || null,
    sizeBytes,
    createdAt: brainStat.mtimeMs || Date.now(),
  };
}

/**
 * 递归统计目录体积（字节）
 */
async function dirSize(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (e) { return 0; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      total += await dirSize(abs);
    } else if (e.isFile()) {
      try { total += (await fsp.stat(abs)).size; } catch (_) {}
    }
  }
  return total;
}

/**
 * 列举所有备份目录，按 ts 倒序
 */
export async function listBackups({ projectPath }) {
  const safe = assertSafeProjectPath(projectPath);
  let entries;
  try {
    entries = await fsp.readdir(safe, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const matched = matchBackupDir(e.name);
    if (!matched) continue;
    const backupPath = path.join(safe, e.name);
    const ts = matched.ts;
    let sizeBytes = 0;
    let memCount = 0;
    let todoCount = 0;
    let timelineCount = 0;
    let projectExists = false;
    let createdAt = 0;
    try {
      const stat = await fsp.stat(backupPath);
      createdAt = stat.mtimeMs || 0;
      sizeBytes = await dirSize(backupPath);
      const mems = await readJsonlFile(path.join(backupPath, "memory.jsonl"));
      const todos = await readJsonlFile(path.join(backupPath, "todo.jsonl"));
      const tline = await readJsonlFile(path.join(backupPath, "timeline.jsonl"));
      memCount = mems.length;
      todoCount = todos.length;
      timelineCount = tline.length;
      projectExists = true;
    } catch (_) { /* 不完整的备份也算，标记 projectExists=false */ }
    out.push({
      ts,
      backupName: e.name,
      backupPath,
      sizeBytes,
      memCount,
      todoCount,
      timelineCount,
      projectExists,
      createdAt,
    });
  }
  out.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
  return out;
}

/**
 * 清理备份
 *
 * @param {{ projectPath: string, keepLast?: number, olderThanMs?: number }} args
 *   - keepLast: 保留最近 N 个（按 ts 倒序）；默认 3
 *   - olderThanMs: 删除 createdAt 超过此毫秒数的；默认 30 天
 *   两者取交集：既不在"最近 N"也满足"超过 X 毫秒"才删
 */
export async function cleanupBackups({
  projectPath,
  keepLast = 3,
  olderThanMs = 30 * 24 * 60 * 60 * 1000,
}) {
  const safe = assertSafeProjectPath(projectPath);
  const all = await listBackups({ projectPath: safe });
  const now = Date.now();
  const candidates = [];
  const kept = [];
  for (let i = 0; i < all.length; i++) {
    const b = all[i];
    const isRecent = i < keepLast;
    const isOld = (now - (b.createdAt || 0)) > olderThanMs;
    if (isRecent && !isOld) {
      kept.push(b);
    } else {
      candidates.push(b);
    }
  }
  // 默认仍保留 keepLast 个（即使老的也保留）
  if (kept.length < keepLast) {
    const need = keepLast - kept.length;
    const promoted = candidates.splice(0, need);
    kept.push(...promoted);
  }
  const deleted = [];
  for (const b of candidates) {
    try {
      await fsp.rm(b.backupPath, { recursive: true, force: true });
      deleted.push(b);
    } catch (e) {
      // 删除失败跳过
    }
  }
  return {
    candidates: candidates.map((b) => b.backupPath),
    deleted: deleted.map((b) => b.backupPath),
    kept: kept.map((b) => b.backupPath),
  };
}

/**
 * 预览回滚：检查 backup 是否存在、读取元信息、计算 pre-rollback backup 路径
 */
export async function previewRollback({ projectPath, backupTimestamp }) {
  const safe = assertSafeProjectPath(projectPath);
  if (!backupTimestamp || !matchBackupDir(`.project-brain.backup-${backupTimestamp}`)) {
    const err = new Error(`备份时间戳格式无效：${backupTimestamp}（期望 yyyymmdd-hhmmss-mmm，兼容旧版 hhmm-mmm）`);
    err.code = "E_BACKUP_INVALID";
    throw err;
  }
  const backupName = `.project-brain.backup-${backupTimestamp}`;
  const backupPath = path.join(safe, backupName);

  let backupStat;
  try {
    backupStat = await fsp.stat(backupPath);
  } catch (e) {
    const err = new Error(`备份不存在：${backupName}`);
    err.code = "E_BACKUP_NOT_FOUND";
    throw err;
  }
  if (!backupStat.isDirectory()) {
    const err = new Error(`备份不是目录：${backupName}`);
    err.code = "E_BACKUP_INVALID";
    throw err;
  }

  // 校验 backup 完整性
  const mems = await readJsonlFile(path.join(backupPath, "memory.jsonl"));
  const todos = await readJsonlFile(path.join(backupPath, "todo.jsonl"));
  const tline = await readJsonlFile(path.join(backupPath, "timeline.jsonl"));
  const projectMeta = await readJsonFile(path.join(backupPath, "project.json"));
  if (!projectMeta || projectMeta.__error) {
    const err = new Error(`备份缺少或损坏 project.json：${backupName}`);
    err.code = "E_BACKUP_INVALID";
    throw err;
  }

  // 当前脑信息
  const currentBrainPath = path.join(safe, ".project-brain");
  let currentBrain = null;
  try {
    const stat = await fsp.stat(currentBrainPath);
    if (stat.isDirectory()) {
      const curMems = await readJsonlFile(path.join(safe, ".project-brain", "memory.jsonl"));
      const curTodos = await readJsonlFile(path.join(safe, ".project-brain", "todo.jsonl"));
      const curTline = await readJsonlFile(path.join(safe, ".project-brain", "timeline.jsonl"));
      const curProj = await readJsonFile(path.join(safe, ".project-brain", "project.json"));
      currentBrain = {
        exists: true,
        projectId: curProj && !curProj.__error ? curProj.id : null,
        memCount: curMems.length,
        todoCount: curTodos.length,
        timelineCount: curTline.length,
        lastUpdateAt: stat.mtimeMs || null,
      };
    }
  } catch (e) {
    currentBrain = { exists: false };
  }

  // 计算"先备份当前脑"的目录名
  const willBackupCurrentTo = currentBrain && currentBrain.exists
    ? path.join(safe, generateBackupName())
    : null;

  return {
    sourceBackup: {
      ts: backupTimestamp,
      backupName,
      backupPath,
      createdAt: backupStat.mtimeMs || null,
      sizeBytes: await dirSize(backupPath),
      memCount: mems.length,
      todoCount: todos.length,
      timelineCount: tline.length,
    },
    currentBrain,
    willBackupCurrentTo,
  };
}

/**
 * 应用回滚：
 *   1) 若当前脑存在 → 先备份一次（pre-rollback backup）
 *   2) 删除当前脑
 *   3) rename backup → 当前脑
 *   4) 触发 rescan（标记，由调用方调度）
 */
export async function applyRollback({ projectPath, backupTimestamp, triggerRescan = true }) {
  const safe = assertSafeProjectPath(projectPath);
  const preview = await previewRollback({ projectPath: safe, backupTimestamp });

  let preRollbackBackupPath = null;
  const brainDir = path.join(safe, ".project-brain");

  // 1) pre-rollback backup
  if (preview.currentBrain && preview.currentBrain.exists) {
    const r = await createBackup({ projectPath: safe });
    preRollbackBackupPath = r.backupPath;
  }

  // 2) 确保当前脑不存在（可能被 backup 后 rename 走了）
  try {
    await fsp.access(brainDir);
    // 还在 → 删除
    await fsp.rm(brainDir, { recursive: true, force: true });
  } catch (e) {
    // 不存在，跳过
  }

  // 3) rename backup → 当前脑
  await fsp.rename(preview.sourceBackup.backupPath, brainDir);

  return {
    restoredFrom: preview.sourceBackup.backupPath,
    preRollbackBackupPath,
    rescanTriggered: !!triggerRescan,
  };
}

// 暴露 confirmToken 入口（在 transfer/bundle.js 复用此模式）
export async function issueRollbackConfirmToken({ projectPath, backupTimestamp }) {
  const preview = await previewRollback({ projectPath, backupTimestamp });
  return getTokenStore().issue({ kind: "rollback", payload: { backupTimestamp, preview } });
}

export async function issueImportConfirmToken({ bundlePath, destProjectPath }) {
  const { previewBundle } = await import("./bundle.js");
  const preview = await previewBundle({ bundlePath, destProjectPath });
  return getTokenStore().issue({
    kind: "import",
    payload: { bundlePath, destProjectPath, preview },
  });
}

export { generateBackupName, extractTsFromDirName, matchBackupDir, BACKUP_DIR_RE, BACKUP_DIR_RE_LEGACY };
