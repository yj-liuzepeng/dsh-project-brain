// brain-files.js - .project-brain/ 文件访问层（基于 DSH fs 服务适配器）
// 供 Host tools 使用；与 scripts/*.mjs（node:fs 直连）保持相同数据格式。
//
// DSH fs 服务接口（tools 实际可用面）：
//   fs.resolve(path, { cwd? }) -> target
//   fs.readText(target) / fs.writeText(target, content)
//   fs.listDir(target)
// 本模块只依赖 resolve/readText/writeText（+ 可选 mkdir），全部容错。

export function brainPath(projectPath, file) {
  const base = String(projectPath || ".").replace(/[\\/]+$/, "");
  return base + "/.project-brain/" + file;
}

export async function readText(fs, path) {
  try {
    const target = await fs.resolve(path);
    return await fs.readText(target);
  } catch (e) {
    return null;
  }
}

// v0.3.7：默认取 danger-full-access policy
//   如果调用方没传 writePolicy 且 fs 上有 sandboxPolicy（host fiber），
//   自动解析 danger-full-access mode（绕过 workspace 路径限制）。
//   node fs adapter（测试/CLI 脚本）无 sandboxPolicy → 返回 null（不限）。
function resolveWritePolicy(fs, writePolicy) {
  if (writePolicy) return writePolicy;
  try {
    const sp = fs && (fs.sandboxPolicy || (fs.ctx && fs.ctx.sandboxPolicy));
    if (sp && typeof sp.resolve === "function") {
      try { return sp.resolve({ mode: "danger-full-access" }); } catch (e) {}
    }
  } catch (e) {}
  return null;
}

export async function writeText(fs, path, content, writePolicy) {
  const policy = resolveWritePolicy(fs, writePolicy);
  try {
    try {
      const idx = path.lastIndexOf("/");
      if (idx > 0 && typeof fs.mkdir === "function") {
        const dirTarget = await fs.resolve(path.slice(0, idx));
        if (policy && fs.mkdir.length >= 2) {
          try { await fs.mkdir(dirTarget, { recursive: true }, { sandboxPolicy: policy }); } catch (e) {}
        } else if (policy) {
          try { await fs.mkdir(dirTarget, { recursive: true }); } catch (e) {}
        } else {
          try { await fs.mkdir(dirTarget, { recursive: true }); } catch (e) {}
        }
      }
    } catch (e) { /* ignore */ }
    const target = await fs.resolve(path);
    // fs.writeText(target, content, expected?, signal?, sandboxPolicy?)
    // 显式传 policy 作为第 5 参数
    if (policy) {
      try { await fs.writeText(target, content, undefined, undefined, policy); return true; }
      catch (e) { /* fallthrough: try without policy */ }
    }
    await fs.writeText(target, content);
    return true;
  } catch (e) {
    return false;
  }
}

// v0.4.0：appendLine — 直接追加单行内容到文件末尾（避免 O(N) 反序列化）
//   DSH fs service 没暴露原生 appendFile，但 writeText 是覆盖写。
//   优化方案：先 readText 拿当前内容（跳过 parseJsonl 反序列化），补换行，
//   再调 writeText 写"原文 + 新内容"。大文件下仍 O(N) 但避开 JSON.parse/stringify CPU 开销。
//   注意：仍非真 O(1)；要 O(1) 必须用 shell service spawn 子进程调 node:fs.appendFileSync（DSH Desktop sandbox 可能拦截）。
//
// 行为保证：
//   - 文件不存在 → 直接 writeText(line)
//   - 文件末尾有 "\n" → 直接 writeText(oldContent + line)
//   - 文件末尾无 "\n" → writeText(oldContent + "\n" + line)（修补换行）
//   - line 必须自带 "\n" 结尾（appendJsonl 调用方保证）
export async function appendLine(fs, path, line, writePolicy) {
  if (line == null) return false;
  // 确保 line 以 \n 结尾（但不强制要求 — 兼容空行）
  const normalizedLine = String(line).endsWith("\n") ? String(line) : String(line) + "\n";
  try {
    const target = await fs.resolve(path);
    let existing = null;
    try { existing = await fs.readText(target); } catch (e) { /* 文件不存在或不可读 → 当作空 */ }
    let next;
    if (existing == null || existing === "") {
      // 文件不存在或空 → 直接写 line
      next = normalizedLine;
    } else if (existing.endsWith("\n")) {
      // 文件末尾有换行 → 直接拼接
      next = existing + normalizedLine;
    } else {
      // 文件末尾无换行 → 补换行（边界保护）
      next = existing + "\n" + normalizedLine;
    }
    return writeText(fs, path, next, writePolicy);
  } catch (e) {
    return false;
  }
}

export function parseJsonl(text) {
  if (!text) return [];
  // 去 BOM（UTF-8 BOM 0xFEFF 或 \\r），trim 也清不掉的字符
  let t = String(text);
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const out = [];
  for (const line of t.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (e) { /* skip bad line */ }
  }
  return out;
}

export function serializeJsonl(items) {
  if (!items || items.length === 0) return "";
  return items.map((i) => JSON.stringify(i)).join("\n") + "\n";
}

export async function readJsonl(fs, path) {
  return parseJsonl(await readText(fs, path));
}

// v0.4.0：appendJsonl — 写一条 JSONL entry（用 appendLine 优化版本）
//   旧实现：readJsonl（O(N) parse）+ push + serializeJsonl + writeText（O(N) serialize）= O(N) + 2× 反序列化开销
//   新实现：appendLine（只 readText 拿原内容 + 直接拼接新行）= O(N) 一次读 + 一次写，避开 JSON parse/stringify
//   行为兼容：调用方无需改动；文件格式不变；并发安全（DSH 单线程 host fiber serialize 调用）
export async function appendJsonl(fs, path, entry, writePolicy) {
  return appendLine(fs, path, JSON.stringify(entry) + "\n", writePolicy);
}

// 覆盖写整个 jsonl（dream commit / batch archive 用）
// items 已按调用方要求排好；不主动 normalize / sort。
export async function writeJsonl(fs, path, items, writePolicy) {
  return writeText(fs, path, serializeJsonl(items || []), writePolicy);
}

export async function readJson(fs, path) {
  const text = await readText(fs, path);
  if (text == null) return null;
  // 去 BOM（\uFEFF）
  let t = text;
  if (typeof t === "string" && t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  try {
    return JSON.parse(t);
  } catch (e) {
    return { __error: String((e && e.message) || e) };
  }
}

export async function writeJson(fs, path, obj, writePolicy) {
  return writeText(fs, path, JSON.stringify(obj, null, 2), writePolicy);
}

// 一次读齐 .project-brain 四类数据（project / timeline / memory / todo）
export async function readBrain(fs, projectPath) {
  const [project, timeline, memories, todos] = await Promise.all([
    readJson(fs, brainPath(projectPath, "project.json")),
    readJsonl(fs, brainPath(projectPath, "timeline.jsonl")),
    readJsonl(fs, brainPath(projectPath, "memory.jsonl")),
    readJsonl(fs, brainPath(projectPath, "todo.jsonl")),
  ]);
  return { projectPath: projectPath, project: project, timeline: timeline, memories: memories, todos: todos };
}
