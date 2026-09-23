// edit.js — 人工维护记忆的纯逻辑层（编辑 / 归档 / 恢复 / 永久删除）。
//
// 与 admit.js 的分工：admit 管「机器写入」，要过规则门和模型确认；
// 这里管「人工修正」，用户是权威，只拦明显坏掉的输入（空标题、正文过短、非法枚举）。
// 全部是纯函数：接收 rows，返回新 rows，IO 由调用方（RPC / tool）负责。

import { enforceCoreCap, maxPinnedCount, memoryFingerprint, pinnedMemories } from "./admit.js";
import { isRetrievableMemory, normalizeMemoryType } from "../store/brain-logic.js";

// 人工可直接切换的状态。archived 走归档动作，superseded 由 supersede 链维护，都不在表单里。
export const EDITABLE_STATUSES = ["active", "dormant"];
export const RESTORABLE_STATUSES = ["archived", "superseded", "deleted"];
export const MIN_EDITED_CONTENT_CHARS = 12;
export const MAX_EDITED_TITLE_CHARS = 200;
export const MAX_EDITED_CONTENT_CHARS = 4000;

function fail(code, message) {
  return { ok: false, code, message };
}

// id 可以给前缀（UI 传完整 id，tool 可能只给前几位）。includeArchived 决定归档条目算不算命中。
export function findMemoryById(rows, idPrefix, { includeArchived = false } = {}) {
  const needle = String(idPrefix || "").trim();
  if (!needle) return fail("E_NO_ID", "id 必填");
  const pool = (rows || []).filter((m) => m && m.id && (includeArchived || isRetrievableMemory(m)));
  const matches = pool.filter((m) => m.id === needle || m.id.indexOf(needle) === 0);
  if (matches.length === 0) return fail("E_NOT_FOUND", "未找到 id=" + needle + " 的记忆");
  if (matches.length > 1) return fail("E_AMBIGUOUS_ID", "id=" + needle + " 匹配到 " + matches.length + " 条，请提供更精确的 id");
  return { ok: true, entry: matches[0] };
}

function normalizeTags(value, previous) {
  if (value === undefined) return previous;
  if (!Array.isArray(value)) return previous;
  const out = [];
  for (const tag of value) {
    const clean = String(tag == null ? "" : tag).trim().slice(0, 50);
    if (clean && out.indexOf(clean) < 0) out.push(clean);
    if (out.length >= 10) break;
  }
  return out;
}

// 只接受表单里那几个字段；id / createdAt / source.kind 一律保留，改错字不该变成另一条记忆。
export function applyMemoryEdit(rows, { id, patch = {}, now = Date.now(), limits } = {}) {
  const found = findMemoryById(rows, id);
  if (!found.ok) return found;
  const target = found.entry;

  const next = Object.assign({}, target);

  if (patch.title !== undefined) {
    const title = String(patch.title).trim();
    if (!title) return fail("E_NO_TITLE", "标题不能为空");
    next.title = title.slice(0, MAX_EDITED_TITLE_CHARS);
  }
  if (patch.content !== undefined) {
    const content = String(patch.content).trim();
    if (content.length < MIN_EDITED_CONTENT_CHARS) {
      return fail("E_CONTENT_TOO_SHORT", "正文至少 " + MIN_EDITED_CONTENT_CHARS + " 个字符");
    }
    next.content = content.slice(0, MAX_EDITED_CONTENT_CHARS);
  }
  if (patch.type !== undefined) {
    const type = normalizeMemoryType(patch.type);
    if (!type) return fail("E_INVALID_TYPE", "记忆类型不合法");
    next.type = type;
  }
  if (patch.importance !== undefined) {
    const importance = Number(patch.importance);
    if (!Number.isFinite(importance) || importance < 0 || importance > 1) {
      return fail("E_INVALID_IMPORTANCE", "重要性必须是 0~1 之间的数字");
    }
    next.importance = Math.round(importance * 100) / 100;
  }
  if (patch.status !== undefined) {
    const status = String(patch.status).trim();
    if (EDITABLE_STATUSES.indexOf(status) < 0) {
      return fail("E_INVALID_STATUS", "状态只能是 " + EDITABLE_STATUSES.join(" / "));
    }
    next.status = status;
  }
  if (patch.pinned !== undefined) {
    const pinned = patch.pinned === true;
    if (pinned && target.pinned !== true) {
      // 置顶配额留一半给自动写入，否则淘汰时挑不出victim，置顶这条保证就形同虚设。
      const cap = maxPinnedCount(limits);
      const current = pinnedMemories(rows).filter((m) => m.id !== target.id).length;
      if (current >= cap) {
        return fail("E_PIN_LIMIT", "置顶最多 " + cap + " 条，请先取消其他置顶");
      }
    }
    if (pinned) next.pinned = true;
    else delete next.pinned;
  }
  const tags = normalizeTags(patch.tags, target.tags);
  if (tags && tags.length) next.tags = tags;
  else delete next.tags;

  const unchanged = ["title", "content", "type", "importance", "status"].every((key) => next[key] === target[key])
    && (next.pinned === true) === (target.pinned === true)
    && JSON.stringify(next.tags || []) === JSON.stringify(target.tags || []);
  if (unchanged) return { ok: true, changed: false, rows: (rows || []).slice(), entry: target };

  // fingerprint 是 type+title+content 的哈希，正文改了不重算的话去重会认错人。
  next.source = Object.assign({}, target.source || {}, {
    fingerprint: memoryFingerprint(next),
    editedBy: "user",
    editedAt: now,
  });
  next.updatedAt = now;

  const replaced = (rows || []).map((m) => (m && m.id === target.id ? next : m));
  // 手动激活一条记忆时，该被挤出 Core 的是别人，不是它自己。
  const capped = enforceCoreCap(replaced, { pinnedIds: [target.id], now, limits });
  return { ok: true, changed: true, rows: capped.rows, entry: next, previous: target };
}

export function applyMemoryStatus(rows, { id, status, reason = "", now = Date.now(), limits } = {}) {
  // 归档态的条目也要能被命中，否则「恢复」和「重复归档」都会撞上 E_NOT_FOUND。
  const found = findMemoryById(rows, id, { includeArchived: true });
  if (!found.ok) return found;
  const target = found.entry;
  const archiving = status === "archived";
  if (target.status === status) {
    return { ok: true, changed: false, rows: (rows || []).slice(), entry: target };
  }

  const next = Object.assign({}, target, { status, updatedAt: now, lastAccessedAt: now });
  if (archiving) {
    if (reason) next.archiveReason = reason;
  } else {
    // 恢复时把归档/替换的痕迹清掉，否则 housekeep 下一轮又按旧理由把它归回去。
    delete next.archiveReason;
    delete next.supersededBy;
    delete next.supersededReason;
  }

  const replaced = (rows || []).map((m) => (m && m.id === target.id ? next : m));
  if (status !== "active") return { ok: true, changed: true, rows: replaced, entry: next, previous: target };
  const capped = enforceCoreCap(replaced, { pinnedIds: [target.id], now, limits });
  return { ok: true, changed: true, rows: capped.rows, entry: next, previous: target };
}

// 物理删行。会打断 supersededBy 指向链，所以调用方必须做二次确认。
export function applyMemoryDelete(rows, { id } = {}) {
  const found = findMemoryById(rows, id, { includeArchived: true });
  if (!found.ok) return found;
  const target = found.entry;
  const remaining = (rows || []).filter((m) => !(m && m.id === target.id));
  // 被删掉的那条如果是别人的替代者，留着悬空指针会让 UI 显示「已被替换」却找不到替代者。
  const cleaned = remaining.map((m) => {
    if (!m || m.supersededBy !== target.id) return m;
    const copy = Object.assign({}, m);
    delete copy.supersededBy;
    return copy;
  });
  return { ok: true, changed: true, rows: cleaned, entry: target };
}
