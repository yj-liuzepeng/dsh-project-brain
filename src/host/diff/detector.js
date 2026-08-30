// detector.js - v0.4.2/v0.4.4/v0.4.5/v0.4.6 真实 git diff 扫描器（不依赖 DSH shell service）
//
// v0.4.1 教训：DSH Desktop 静态 plugin fiber 静默阻止 ctx.get('shell').run('git ...')。
// v0.4.2 改用 node 内置模块（fs + zlib + crypto）直接读 .git 仓库，
// 完全脱离 DSH shell service / spawn / execFileSync。
//
// Git object format：
//   - .git/HEAD 文件：ref: refs/heads/<branch> 或直接 commit hash
//   - .git/refs/heads/<branch> 文件：commit hash（40 字符 hex）
//   - .git/objects/<hash[:2]>/<hash[2:]> loose object 文件：
//     zlib deflate（带 zlib header，首字节 0x78）压缩，inflate 后格式 = <type> <size>\0<content>
//     type: commit | tree | blob | tag
//     ⚠️ v0.4.4 修复：真实 git 用 zlib deflate（带 header），必须用 inflateSync；
//        不能用 inflateRawSync（期望无 header 的 raw deflate，真实 git object 会解失败）
//   - tree object 格式：<mode> <name>\0<20-byte-binary-hash> 序列
//   - blob object 格式：原始文件内容
//
// v0.4.5 关键改进：detector 只读 commit + tree object（diff 只比 hash，从不读 blob 内容）。
//   所以只要 commit/tree 在 loose 就能完整工作，即使 blob 被 git 打包进 .pack 也没关系。
//   移除了"仓库存在 pack 文件就整体 fallback"的过保守设计——只有真正读不到 commit/tree
//   时才提示 pack 不支持。
//
// v0.4.6 pack 支持：loose 找不到时 fallback 解析 .idx v2 + .pack v2（含 OFS_DELTA + REF_DELTA）。
//   还不支持 multi-pack-index（MIDX，git 2.20+）；遇到 MIDX-only 仓库回退到"在 pack 里"提示。
//
// MVP 限制：
//   - pack idx v1 不支持（git 1.4 以前格式，几乎绝迹）
//   - multi-pack-index（MIDX）不支持（v0.4.7 计划）
//   - diff 只做 file-level（add/modify/delete），不做行级 diff
//   - 工作树状态只读 commit 之间差异（HEAD vs HEAD~1 之类），不读 index

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

// 解压 git object（loose object = zlib deflate 压缩 + "type size\0content"）
function inflateGitObject(compressed) {
  try {
    const inflated = inflateSync(compressed);
    // 找第一个 null byte
    const nullIdx = inflated.indexOf(0);
    if (nullIdx < 0) return null;
    const header = inflated.slice(0, nullIdx).toString("binary");
    const spaceIdx = header.indexOf(" ");
    if (spaceIdx < 0) return null;
    const type = header.slice(0, spaceIdx);
    // size parse（不严格校验）
    const content = inflated.slice(nullIdx + 1);
    return { type, content };
  } catch (e) {
    return null;
  }
}

// 读 loose object by hash（只读 .git/objects/<aa>/<bbcc...>）
// 返回 null if 不存在 / 解压失败 / 不在 .git/objects 路径下
// v0.4.6：原 readGitObject 重命名为 readLooseObject，下面有 readGitObject 包装做 pack fallback
function readLooseObject(gitDir, hash) {
  if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
  const objPath = join(gitDir, "objects", hash.slice(0, 2), hash.slice(2));
  if (!existsSync(objPath)) return null;
  let compressed;
  try { compressed = readFileSync(objPath); } catch (e) { return null; }
  return inflateGitObject(compressed);
}

// ─── Pack v2 解析（v0.4.6 新增）───
// .idx v2 格式（big-endian）：
//   8 byte magic (\377tOc) + version (4 byte, =2)
//   256 × 4 byte fanout table
//   N × 20 byte SHA-1（按 hash 排序）
//   N × 4 byte CRC32（每个 object）
//   N × 4 byte offset（每个 object 在 pack 内的 offset）
//   N × 4 byte CRC32（整个 pack 文件的 CRC32，分段存储）
//   20 byte pack checksum
//
// .pack v2 格式：object entry 序列，每 entry = <type byte + size varint> + zlib compressed data
// type: OBJ_COMMIT=1, OBJ_TREE=2, OBJ_BLOB=3, OBJ_TAG=4, OBJ_OFS_DELTA=6, OBJ_REF_DELTA=7
// OFS_DELTA: 头后是 negative offset to base（varint encoding）
// REF_DELTA: 头后是 20-byte base hash

const OBJ_COMMIT = 1;
const OBJ_TREE = 2;
const OBJ_BLOB = 3;
const OBJ_TAG = 4;
const OBJ_OFS_DELTA = 6;
const OBJ_REF_DELTA = 7;

// 读 big-endian 32-bit int
function readBE32(buf, off) {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

// 解析 .idx v2 → Map<hash, packOffset>（或 null if 不是 v2）
// 不硬校验 size（git 各版本 idx 可能略有多余字节），用 fanout[255] 拿 N，按结构读
// v2 idx 实际布局：header(8) + fanout(1024) + N×hash(20) + N×CRC(4) + N×offset(4) + N×pack_CRC(4) + pack_checksum(20)
// 注：N*4 在 offset 之后是 pack file 的 CRC32 列表（不是 large offset table，large offset 是 N*8 编码）
function parseIdxV2(idxBytes) {
  if (idxBytes.length < 8 + 1024) return null;
  if (idxBytes[0] !== 0xff || idxBytes[1] !== 0x74 || idxBytes[2] !== 0x4f || idxBytes[3] !== 0x63) return null;
  const version = readBE32(idxBytes, 4);
  if (version !== 2) return null;
  const n = readBE32(idxBytes, 8 + 255 * 4);
  const minSize = 1072 + n * 28;  // v2 idx 实际 size（无 large offset）：header(8)+fanout(1024)+N*20(hash)+N*4(obj_CRC)+N*4(offset)+20(checksum) = 1052+28N+20 = 1072+28N
  if (idxBytes.length < minSize) return null;
  const hashStart = 8 + 1024;
  // offset list 在 hashStart + N×20(hash) + N×4(CRC)
  const offsetStart = hashStart + n * 20 + n * 4;
  const map = new Map();
  let skipped = 0;
  for (let i = 0; i < n; i++) {
    const hStart = hashStart + i * 20;
    const hash = idxBytes.slice(hStart, hStart + 20).toString("hex");
    const oStart = offsetStart + i * 4;
    const packOffset = readBE32(idxBytes, oStart);
    if ((packOffset & 0x80000000) !== 0) {
      // large offset：跳到 large offset table（idxBytes 末尾前 20 字节之前）
      const largeOffsetStart = offsetStart + n * 4;
      // 大 offset table 索引 = i
      // 实际我们这里直接跳过（简化：large offset 处理留给后续）
      skipped++;
      continue;
    }
    map.set(hash, packOffset);
  }
  return map;
}

// cache：idxPath -> Map<（hash, offset)>（避免重复解析；key 包含 gitDir 避免跨仓库污染）
const idxCache = new Map();
function loadIdxMap(gitDir, idxPath) {
  const key = gitDir + "|" + idxPath;
  if (idxCache.has(key)) return idxCache.get(key);
  let bytes;
  try { bytes = readFileSync(idxPath); } catch (e) { idxCache.set(key, null); return null; }
  const map = parseIdxV2(bytes);
  idxCache.set(key, map);
  return map;
}

// 读 pack entry type + size（git pack v2 变长编码）
// 格式：第一个字节 = (type << 4) | (size & 0x0f)；如果 bit 7=1，size 还有后续 7-bit 字节
// 后续字节：每字节 = (size bits) | (continue << 7)；最高位为 continue flag
// 解码：size = (b1 & 0x0f) | ((b2 & 0x7f) << 4) | ((b3 & 0x7f) << 11) | ((b4 & 0x7f) << 18) | ...
function readPackEntryHead(buf, offset) {
  let b = buf[offset];
  const t = (b >> 4) & 0x07;
  let size = b & 0x0f;
  let p = offset + 1;
  let shift = 4;
  while (b & 0x80) {
    if (p >= buf.length) return null;
    b = buf[p++];
    size |= (b & 0x7f) << shift;
    shift += 7;
  }
  return { type: t, size, dataOffset: p };
}

// 读 OFS_DELTA 的 negative offset to base
// 标准 git encoding：每字节高 7 位为数据 bit，最后一个字节高位为 0
function readOFSOffset(buf, offset) {
  let p = offset;
  let b = buf[p++];
  let ofs = b & 0x7f;
  while (b & 0x80) {
    if (p >= buf.length) return null;
    b = buf[p++];
    ofs = ((ofs + 1) << 7) | (b & 0x7f);
  }
  return { offset: ofs, nextPos: p };
}

// 应用 delta 数据到 base，返回 result buffer
function applyDelta(base, deltaBytes) {
  let p = 0;
  function readVarint() {
    let result = 0;
    let shift = 0;
    while (p < deltaBytes.length) {
      const b = deltaBytes[p++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += 7;
      if (shift > 63) return -1;
    }
    return -1;
  }
  const baseLen = readVarint();
  const resultLen = readVarint();
  if (baseLen < 0 || resultLen < 0) return null;
  if (baseLen !== base.length) return null;
  const out = Buffer.alloc(resultLen);
  let outPos = 0;
  while (p < deltaBytes.length && outPos < resultLen) {
    const inst = deltaBytes[p++];
    if (inst === 0) return null;  // reserved
    if (inst < 0x80) {
      // insert: inst bytes of raw data
      if (p + inst > deltaBytes.length) return null;
      deltaBytes.copy(out, outPos, p, p + inst);
      p += inst;
      outPos += inst;
    } else {
      // copy: bit 7 = 1, bits 4-6 = size bytes (0-3), bits 0-3 = offset bytes (0-4)
      // size = 0 表示 0x10000；offset = 0 表示 +0x10000
      const szN = (inst >> 4) & 0x07;
      const offN = inst & 0x0f;
      let copyOff = 0;
      let copySz = 0;
      if (offN > 0 && offN <= 4) {
        for (let i = 0; i < offN; i++) {
          if (p >= deltaBytes.length) return null;
          copyOff = (copyOff << 8) | deltaBytes[p++];
        }
      } else if (offN === 0) {
        copyOff = 0x10000;
      } else {
        return null;  // offN > 4 不支持
      }
      if (szN > 0 && szN <= 3) {
        for (let i = 0; i < szN; i++) {
          if (p >= deltaBytes.length) return null;
          copySz = (copySz << 8) | deltaBytes[p++];
        }
      } else if (szN === 0) {
        copySz = 0x10000;
      } else {
        return null;  // szN > 3 不支持
      }
      if (copySz === 0) continue;
      if (copyOff >= base.length) return null;
      const avail = base.length - copyOff;
      const actualSz = Math.min(copySz, avail);
      base.copy(out, outPos, copyOff, copyOff + actualSz);
      outPos += actualSz;
    }
  }
  if (outPos !== resultLen) return null;
  return out;
}

// pack cache：packPath -> Map<offset, {type, content}>
const packCache = new Map();
// 当前 gitDir（REF_DELTA 递归 base 用）—— detector 单线程使用
let gitDirCurrent = "";

function readPackEntryByOffset(packPath, packBytes, offset) {
  let cache = packCache.get(packPath);
  if (!cache) { cache = new Map(); packCache.set(packPath, cache); }
  if (cache.has(offset)) return cache.get(offset);

  const head = readPackEntryHead(packBytes, offset);
  if (!head) return null;
  const { type, dataOffset } = head;

  // pack 内 object 用 raw deflate（无 zlib header），必须 inflateRawSync
  if (type === OBJ_OFS_DELTA) {
    const ofs = readOFSOffset(packBytes, dataOffset);
    if (!ofs) return null;
    const baseOffset = offset - ofs.offset;
    if (baseOffset <= 0) return null;
    const baseRes = readPackEntryByOffset(packPath, packBytes, baseOffset);
    if (!baseRes) return null;
    let delta;
    try { delta = inflateSync(packBytes.slice(ofs.nextPos)); } catch (e) { return null; }
    if (!delta) return null;
    const result = applyDelta(baseRes.content, delta);
    if (!result) return null;
    const nullIdx = result.indexOf(0);
    if (nullIdx < 0) return null;
    const objType = result.slice(0, nullIdx).toString("binary").split(" ")[0];
    const ret = { type: objType, content: result.slice(nullIdx + 1) };
    cache.set(offset, ret);
    return ret;
  } else if (type === OBJ_REF_DELTA) {
    const baseHash = packBytes.slice(dataOffset, dataOffset + 20).toString("hex");
    const dataStart = dataOffset + 20;
    // 递归 base：先 loose 再 pack
    let baseRes = readLooseObject(gitDirCurrent, baseHash);
    if (!baseRes) baseRes = readPackObjectInternal(gitDirCurrent, baseHash);
    if (!baseRes) return null;
    let delta;
    try { delta = inflateSync(packBytes.slice(dataStart)); } catch (e) { return null; }
    if (!delta) return null;
    const result = applyDelta(baseRes.content, delta);
    if (!result) return null;
    const nullIdx = result.indexOf(0);
    if (nullIdx < 0) return null;
    const objType = result.slice(0, nullIdx).toString("binary").split(" ")[0];
    const ret = { type: objType, content: result.slice(nullIdx + 1) };
    cache.set(offset, ret);
    return ret;
  } else if (type === OBJ_COMMIT || type === OBJ_TREE || type === OBJ_BLOB || type === OBJ_TAG) {
    // pack inflate 出的是纯 content（无 header 无 null byte），type 已在 entry header 里
    let content;
    try { content = inflateSync(packBytes.slice(dataOffset)); } catch (e) { return null; }
    if (!content) return null;
    const typeName = ["", "commit", "tree", "blob", "tag", "", "ofs_delta", "ref_delta"][type];
    const ret = { type: typeName, content };
    cache.set(offset, ret);
    return ret;
  }
  return null;
}

// 内部 readPackObject：所有 pack 索引里找 hash
function readPackObjectInternal(gitDir, hash) {
  const packDir = join(gitDir, "objects", "pack");
  if (!existsSync(packDir)) return null;
  let files;
  try { files = readdirSync(packDir); } catch (e) { return null; }
  for (const f of files) {
    if (!f.endsWith(".idx")) continue;
    const idxPath = join(packDir, f);
    const map = loadIdxMap(gitDir, idxPath);
    if (!map) continue;
    const off = map.get(hash);
    if (off === undefined) continue;
    const packFile = idxPath.replace(/\.idx$/, ".pack");
    if (!existsSync(packFile)) continue;
    let packBytes;
    try { packBytes = readFileSync(packFile); } catch (e) { continue; }
    return readPackEntryByOffset(packFile, packBytes, off);
  }
  return null;
}

// 读 pack 中的 object by hash（设 gitDirCurrent 以支持 REF_DELTA 递归）
function readPackObject(gitDir, hash) {
  gitDirCurrent = gitDir;
  return readPackObjectInternal(gitDir, hash);
}

// v0.4.6：readGitObject = 先 loose 后 pack fallback
function readGitObject(gitDir, hash) {
  const loose = readLooseObject(gitDir, hash);
  if (loose) return loose;
  return readPackObject(gitDir, hash);
}

// 读 HEAD 拿 current branch + commit
// v0.4.6：ref 可能在 loose (.git/refs/heads/<branch>) 或 packed (.git/packed-refs)
function readHead(gitDir) {
  const headPath = join(gitDir, "HEAD");
  if (!existsSync(headPath)) return null;
  let head;
  try { head = readFileSync(headPath, "utf8").trim(); } catch (e) { return null; }
  if (!head) return null;
  // 两种格式：ref: refs/heads/main（detached HEAD 时直接是 hash）
  if (head.startsWith("ref: ")) {
    const refPath = join(gitDir, head.slice("ref: ".length));
    let commit = null;
    // 先读 loose ref
    if (existsSync(refPath)) {
      try { commit = readFileSync(refPath, "utf8").trim(); } catch (e) {}
    }
    // loose 不存在 → fallback 到 packed-refs
    if (!commit) {
      const packedRefsPath = join(gitDir, "packed-refs");
      if (existsSync(packedRefsPath)) {
        try {
          const content = readFileSync(packedRefsPath, "utf8");
          // 格式：每行 "<hash> <refname>"（行首可能是 # 注释）
          for (const line of content.split(/\r?\n/)) {
            if (line.startsWith("#") || !line.trim()) continue;
            // 可能还有 peeled 行（hash 在 ref 旁）
            const m = line.match(/^([0-9a-f]{40})\s+(\S+)$/);
            if (m && m[2] === head.slice("ref: ".length)) {
              commit = m[1];
              break;
            }
          }
        } catch (e) {}
      }
    }
    if (!commit) return null;
    return { branch: head.slice("refs/heads/".length), commit };
  }
  return { branch: null, commit: head };  // detached HEAD
}

// 解析 tree object → { path: hash } map
function parseTree(treeContent) {
  // 格式：<mode> <name>\0<20-byte-hash> 序列
  const entries = {};
  let i = 0;
  while (i < treeContent.length) {
    // 找空格（mode 与 name 分隔）
    const spaceIdx = treeContent.indexOf(0x20, i);
    if (spaceIdx < 0) break;
    const mode = treeContent.slice(i, spaceIdx).toString("binary");
    i = spaceIdx + 1;
    // 找 null（name 与 hash 分隔）
    const nullIdx = treeContent.indexOf(0, i);
    if (nullIdx < 0) break;
    const name = treeContent.slice(i, nullIdx).toString("utf8");
    i = nullIdx + 1;
    // 20 字节 binary hash
    if (i + 20 > treeContent.length) break;
    const hashBuf = treeContent.slice(i, i + 20);
    const hash = hashBuf.toString("hex");
    i += 20;
    entries[name] = { mode, hash };
  }
  return entries;
}

// 递归 collect tree：返回 flat { filePath: hash } map
function collectTreeFiles(gitDir, treeHash, prefix = "") {
  const obj = readGitObject(gitDir, treeHash);
  if (!obj || obj.type !== "tree") return {};
  const tree = parseTree(obj.content);
  const files = {};
  for (const [name, entry] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.mode === "160000" || name === "node_modules" || name === ".git") {
      // skip submodules + node_modules + .git
      continue;
    }
    // git tree mode（八进制但省略前导零，均无空格）：目录 = "40000"（= 0o40000 = 16384），
    // 文件 = "100644" / "100755"，符号链接 = "120000"，子模块 = "160000"。
    // v0.4.3 修复：不能用 parseInt(entry.mode, 8) === 40000（那是十进制 40000），
    //   也不能匹配 "040000"（git 实际省略前导 0）；统一用 parseInt(mode,8) === 0o40000。
    if (parseInt(entry.mode, 8) === 0o40000) {
      // directory
      Object.assign(files, collectTreeFiles(gitDir, entry.hash, path));
    } else {
      // file (100644 / 100755 / 120000)
      files[path] = entry.hash;
    }
  }
  return files;
}

// 读 commit object 拿 tree hash + parents
function readCommit(gitDir, commitHash) {
  const obj = readGitObject(gitDir, commitHash);
  if (!obj || obj.type !== "commit") return null;
  const text = obj.content.toString("utf8");
  const lines = text.split("\n");
  let tree = null;
  const parents = [];
  for (const line of lines) {
    if (line.startsWith("tree ")) tree = line.slice(5).trim();
    else if (line.startsWith("parent ")) parents.push(line.slice(7).trim());
    else if (line === "") break;  // 后面是 commit message
  }
  return tree ? { tree, parents } : null;
}

// 主入口：扫描项目从 since（commit 数）开始的代码变化
// 简化为"对比 commit N 与 commit N+since"（不是真的时间窗口）
export async function detectChanges({ projectPath, since = "1 day ago" }) {
  const gitDir = join(projectPath, ".git");
  if (!existsSync(gitDir)) {
    return { files: [], stat: "", commits: [], error: "not a git repository (no .git directory)" };
  }

  // 解析 since：'1 day ago' / '7 days ago' / '2 hours ago' / 'N'
  // MVP：只支持 N（commit 数），其它转默认 1
  let sinceN = 1;
  const m = String(since).match(/^(\d+)/);
  if (m) sinceN = Math.max(1, Math.min(100, parseInt(m[1], 10)));

  // 读 HEAD
  const head = readHead(gitDir);
  if (!head || !head.commit) {
    return { files: [], stat: "", commits: [], error: "cannot read HEAD" };
  }
  // 验证 commit hash 格式
  if (!/^[0-9a-f]{40}$/i.test(head.commit)) {
    return { files: [], stat: "", commits: [], error: "HEAD is not a valid commit hash: " + head.commit };
  }

  // 读 current commit
  const curCommit = readCommit(gitDir, head.commit);
  if (!curCommit) {
    // v0.4.5：可能是 commit object 在 pack 里（git gc 打包），而不是不存在
    return {
      files: [], stat: "", commits: [],
      error: "cannot read current commit " + head.commit + "（commit object 可能在 .pack 中，需 pack 支持，或 git repack -d 解开 loose object）",
    };
  }

  // 拿 current tree 文件集
  const curFiles = collectTreeFiles(gitDir, curCommit.tree);

  // 走 parent 链 sinceN 步（since=1 即 HEAD~1；since=2 即 HEAD~2）
  let parentHash = head.commit;
  let parentCommit = null;
  for (let i = 0; i < sinceN; i++) {
    const cur = readCommit(gitDir, parentHash);
    if (!cur || !cur.parents || cur.parents.length === 0) {
      // 没有更早的 parent
      break;
    }
    parentHash = cur.parents[0];
  }
  // parentHash 现在是 HEAD~sinceN（如果链足够长）
  if (parentHash !== head.commit) {
    parentCommit = readCommit(gitDir, parentHash);
  }
  const parentFiles = parentCommit ? collectTreeFiles(gitDir, parentCommit.tree) : {};

  // diff：add / modify / delete
  // 注：curFiles / parentFiles 是 { path: hashString } map，hash 直接是 string
  const files = [];
  for (const [path, hash] of Object.entries(curFiles)) {
    if (!parentFiles[path]) {
      files.push({ path, type: "added", hash });
    } else if (parentFiles[path] !== hash) {
      files.push({ path, type: "modified", hash });
    }
  }
  for (const path of Object.keys(parentFiles)) {
    if (!curFiles[path]) {
      files.push({ path, type: "deleted" });
    }
  }

  // commits 列表（HEAD + HEAD~1 + ... + HEAD~sinceN+1）
  // since=1 → [HEAD]；since=2 → [HEAD, HEAD~1]；since=N → N 个
  const commits = [head.commit];
  let p = curCommit.parents[0];
  let depth = 1;
  while (p && depth < sinceN) {
    commits.push(p);
    const pc = readCommit(gitDir, p);
    p = pc ? pc.parents[0] : null;
    depth++;
  }

  return {
    files: files.map((f) => f.path),  // 简化为路径数组（兼容 v0.4.1 smoke）
    changes: files,  // 详细 change 列表（new field）
    stat: files.length === 0
      ? ""
      : ` ${files.filter((f) => f.type === "added").length} files added, ${files.filter((f) => f.type === "modified").length} modified, ${files.filter((f) => f.type === "deleted").length} deleted`,
    commits,
    since: "commit+" + sinceN,
    scannedAt: Date.now(),
  };
}

// 把 detector 输出组装成 LLM prompt
export function buildDiffPrompt({ changes, projectPath, maxChars = 4000 }) {
  const fileList = (changes.changes || changes.files || []).map((f) =>
    typeof f === "string" ? `  - ${f}` : `  - [${f.type}] ${f.path}`
  ).join("\n") || "  (无文件变更)";

  const commitList = (changes.commits || []).map((c) => `  - ${c}`).join("\n") || "  (无 commit 记录)";

  const prompt = `你是一个项目架构分析师。请基于以下 git diff 信息，输出 JSON 格式的架构变更分析。

项目路径: ${projectPath}
扫描时间窗口: since=${changes.since || "commit+1"}

变更文件:
${fileList}

最近 commit:
${commitList}

变更统计:
${changes.stat ? changes.stat : "(无统计)"}

请输出 JSON（不要 markdown code block，不要其他文字）：
{
  "changes": [{"file": "相对路径", "type": "added|modified|deleted", "summary": "一句话描述"}],
  "architectureMemory": {
    "title": "架构变更一句话标题（<=50 字）",
    "content": "what + why（200-400 字，说明架构层面的变化）"
  }
}

要求：
- 关注架构层面变化（新模块、新依赖、新模式），不要逐文件描述
- 如果只是文档修改或杂项变更，architectureMemory.title 写 "非架构变更（杂项）"
- content 用中文`;

  return prompt.slice(0, maxChars);
}