// access.js — 记录记忆被检索命中的时间。
//
// 没有这个回写，lastAccessedAt 永远只在归档/替换时被写一次，
// 于是一条反复被 project_ask 查到的 dormant 记忆会一直沉着：
// 排序看的是 updatedAt，淘汰看的是 importance，两边都感知不到「常用」。

import { brainPath, readJsonl, writeJsonl } from "../store/brain-files.js";
import { brainTxKey, withWriteLock } from "../store/write-lock.js";

// 同一条记忆在这个窗口内重复命中只记一次，避免一轮对话里连续几次 ask
// 就把整个 memory.jsonl 重写好几遍。
export const ACCESS_THROTTLE_MS = 5 * 60 * 1000;
const MAX_ACCESS_COUNT = 9999;

export function applyAccessTouch(rows, ids, now = Date.now(), throttleMs = ACCESS_THROTTLE_MS) {
  const wanted = new Set((ids || []).map(String).filter(Boolean));
  if (wanted.size === 0) return { changed: false, rows: rows || [], touched: [] };

  const touched = [];
  const next = (rows || []).map((m) => {
    if (!m || !wanted.has(String(m.id))) return m;
    const last = Number(m.lastAccessedAt) || 0;
    if (last && now - last < throttleMs) return m;
    touched.push(m.id);
    return Object.assign({}, m, {
      lastAccessedAt: now,
      accessCount: Math.min(MAX_ACCESS_COUNT, (Number(m.accessCount) || 0) + 1),
    });
  });
  return { changed: touched.length > 0, rows: next, touched };
}

// 检索是只读操作，这里的写入不该让 ask 失败。调用方直接忽略返回的 error 即可。
export async function recordMemoryAccess({ fs, projectPath, ids, now = Date.now() } = {}) {
  if (!fs || !projectPath || !ids || ids.length === 0) return { changed: false, touched: [] };
  try {
    return await withWriteLock(brainTxKey(projectPath, "memory.jsonl"), async () => {
      const file = brainPath(projectPath, "memory.jsonl");
      const rows = await readJsonl(fs, file);
      const result = applyAccessTouch(rows, ids, now);
      if (!result.changed) return { changed: false, touched: [] };
      const wrote = await writeJsonl(fs, file, result.rows);
      return { changed: wrote, touched: result.touched };
    });
  } catch (e) {
    return { changed: false, touched: [], error: String((e && e.message) || e) };
  }
}
