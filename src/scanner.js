// Scanner：扫项目根、识别技术栈、统计语言、找入口
// 全部基于 fs 服务（DSH 抽象），无直接 Node fs 依赖
//
// 关键修复（P0.4.8 / 续开发）：
//   DSH fs.listDir 返回 FsDirEntry = { name, type: 'file'|'directory'|'other', target: FsTarget }
//   之前的代码用 e.isFile / e.isDirectory（boolean）— DSH 实际没这俩字段，导致
//   recursion 一个文件都没计数（实测 files:0 / languages:{}）。
//   改为 e.type 优先，e.isFile/isDirectory（boolean/method）作为 fallback，
//   recursion 直接用 e.target（resolved FsTarget），仅当缺失时回退 fs.resolve。

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", "target", ".DS_Store",
  ".idea", ".vscode", "coverage", ".turbo", ".cache", "out",
  ".project-brain", // 自身的项目脑数据目录，不应被扫
]);

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name)
    || /^node_modules(?:[._-].*)?$/i.test(name)
    || /(?:^|[._-])backup(?:[._-]|$)/i.test(name)
    || /\.bak(?:[._-]|$)/i.test(name);
}

const EXT_LANG = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java",
  ".rs": "rust",
  ".c": "c", ".h": "c",
  ".cc": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".cs": "csharp", ".php": "php", ".rb": "ruby",
  ".kt": "kotlin", ".kts": "kotlin", ".swift": "swift",
  ".dart": "dart", ".scala": "scala", ".sh": "shell",
  ".sql": "sql", ".vue": "vue", ".svelte": "svelte",
};

function decodeReadmeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return named[entity.toLowerCase()] || all;
  });
}

export function sanitizeProjectDescription(value) {
  if (!value) return null;
  const cleaned = decodeReadmeEntities(String(value)
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|svg|picture)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]\s+)\s*/gm, "")
    .replace(/[*_~`|]+/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

function isMeaningfulDescription(value) {
  const text = String(value || "").trim();
  if (text.length < 12) return false;
  if (/^(?:english|中文|简体中文|繁體中文|docs?|documentation|homepage)(?:\s*[|·/]\s*(?:english|中文|简体中文|繁體中文|docs?|documentation|homepage))*$/i.test(text)) return false;
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) || []).length;
  return chinese >= 6 || words >= 3;
}

export function firstReadmeParagraph(text) {
  if (!text) return null;
  const source = String(text).replace(/^\uFEFF/, "").replace(/<!--([\s\S]*?)-->/g, "");
  const lines = source.split(/\r?\n/);
  const parts = [];
  let started = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^```/.test(line)) {
      if (started && parts.length) break;
      continue;
    }
    if (/^#{1,6}\s+/.test(line) || /^<h[1-6]\b/i.test(line)) {
      if (started && parts.length) break;
      continue;
    }
    const visible = sanitizeProjectDescription(line);
    if (!visible || !isMeaningfulDescription(visible)) {
      if (started && parts.length && /^(?:[-*]\s|\d+\.\s|#{1,6}\s+)/.test(line)) break;
      continue;
    }
    started = true;
    parts.push(visible);
    if (parts.join(" ").length >= 360) break;
  }
  return sanitizeProjectDescription(parts.join(" "));
}

function processPathOf(fs, target) {
  return typeof fs.processPath === "function" ? fs.processPath(target) : String(target);
}

async function readText(fs, rootPath, name) {
  try {
    const t = await fs.resolve(name, { cwd: rootPath });
    return await fs.readText(t);
  } catch (e) {
    return null;
  }
}

// 检测 entry 是 file / directory / other（兼容 DSH FsDirEntry + 旧 adapter）
function entryKind(e) {
  if (!e) return "other";
  // DSH FsDirEntry.type 优先
  if (typeof e.type === "string") {
    if (e.type === "file" || e.type === "directory" || e.type === "other") return e.type;
  }
  // 旧 adapter：boolean
  if (e.isFile === true) return "file";
  if (e.isDirectory === true) return "directory";
  // 旧 adapter：method（node Dirent）
  if (typeof e.isFile === "function" && e.isFile()) return "file";
  if (typeof e.isDirectory === "function" && e.isDirectory()) return "directory";
  return "other";
}

// 拿到 child 的 FsTarget（用于递归）。优先用 entry 自带的 target，否则 re-resolve。
async function childTarget(fs, parentTarget, entry) {
  if (entry && entry.target) return entry.target;
  try {
    return await fs.resolve(entry.name, { cwd: parentTarget });
  } catch (e) {
    return null;
  }
}

export async function scanProject(fs, projectPath) {
  const rootTarget = await fs.resolve(projectPath);
  const rootPath = processPathOf(fs, rootTarget);

  const result = {
    projectName: null,
    description: null,
    techStack: {},
    languages: {},
    tooling: [],
    fileCount: 0,
    topLevel: [],
    entrypoints: [],
    files: [],
  };

  let entries;
  try {
    entries = await fs.listDir(rootTarget);
  } catch (e) {
    return result;
  }

  // topLevel：保留所有非忽略项（包括目录），方便后续 Phase 区块展示
  result.topLevel = entries
    .map((e) => e && e.name)
    .filter((n) => n && !shouldIgnoreDir(n))
    .slice()
    .sort();

  const names = result.topLevel;

  // —— Package.json → JS/TS framework ——
  if (names.includes("package.json")) {
    const txt = await readText(fs, rootPath, "package.json");
    if (txt) {
      try {
        const pkg = JSON.parse(txt);
        result.projectName = typeof pkg.name === "string" ? pkg.name : null;
        result.description = typeof pkg.description === "string" ? sanitizeProjectDescription(pkg.description) : null;
        const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
        if (deps.next) result.techStack.fullstack = "Next.js";
        else if (deps.nuxt) result.techStack.fullstack = "Nuxt";
        else if (deps.express) result.techStack.backend = "Express";
        else if (deps.fastify) result.techStack.backend = "Fastify";
        else if (deps["@nestjs/core"]) result.techStack.backend = "NestJS";
        if (deps.react) result.techStack.frontend = "React";
        else if (deps.vue) result.techStack.frontend = "Vue";
        else if (deps.svelte) result.techStack.frontend = "Svelte";
        if (deps.electron) result.techStack.desktop = "Electron";
        if (deps.prisma || deps["@prisma/client"]) result.techStack.database = "Prisma";
        if (deps.vite) result.tooling.push("Vite");
        if (deps.typescript) result.tooling.push("TypeScript");
        if (pkg.workspaces) result.techStack.structure = "Monorepo";
        // 入口：npm run dev / build（仅当 scripts 存在时）
        if (pkg.scripts && pkg.scripts.dev) {
          result.entrypoints.push({ path: "npm run dev", type: "script" });
        }
        if (pkg.scripts && pkg.scripts.build) {
          result.entrypoints.push({ path: "npm run build", type: "script" });
        }
      } catch (e) { /* ignore parse error */ }
    }
  }

  // —— Python ——
  const pyToml = names.includes("pyproject.toml") ? await readText(fs, rootPath, "pyproject.toml") : null;
  const requirements = names.includes("requirements.txt") ? await readText(fs, rootPath, "requirements.txt") : null;
  if (pyToml && pyToml.indexOf("fastapi") !== -1) result.techStack.backend = "FastAPI";
  else if (pyToml && pyToml.indexOf("django") !== -1) result.techStack.backend = "Django";
  else if (pyToml && pyToml.indexOf("flask") !== -1) result.techStack.backend = "Flask";
  else if (requirements && requirements.indexOf("fastapi") !== -1) result.techStack.backend = "FastAPI";
  else if (requirements && requirements.indexOf("django") !== -1) result.techStack.backend = "Django";
  else if (requirements && requirements.indexOf("flask") !== -1) result.techStack.backend = "Flask";

  // —— Go / Java / Rust ——
  if (names.includes("go.mod")) result.techStack.backend = "Go";
  if (names.includes("pom.xml")) result.techStack.backend = "Spring (Maven)";
  else if (names.some((n) => n === "build.gradle" || n === "build.gradle.kts")) result.techStack.backend = "Spring (Gradle)";
  if (names.includes("Cargo.toml")) result.techStack.backend = "Rust";
  if (names.includes("Dockerfile") || names.includes("docker-compose.yml") || names.includes("compose.yml")) result.tooling.push("Docker");
  if (names.includes("pnpm-workspace.yaml") || names.includes("turbo.json") || names.includes("nx.json")) result.techStack.structure = "Monorepo";
  if (names.some((n) => n.endsWith(".tf"))) result.tooling.push("Terraform");
  if (names.includes("Makefile")) result.tooling.push("Make");

  // README 首段通常比目录名更能帮助用户快速理解陌生项目。
  if (!result.description) {
    const readmeName = names.find((n) => /^readme(?:\.[a-z0-9]+)?$/i.test(n));
    if (readmeName) result.description = firstReadmeParagraph(await readText(fs, rootPath, readmeName));
  }

  // —— 入口候选（递归完成后按相对路径判断）——
  const entryCandidates = [
    ["main.ts", "service"], ["main.js", "service"],
    ["index.ts", "service"], ["index.js", "service"],
    ["app.py", "service"], ["server.py", "service"],
    ["manage.py", "cli"],
    ["cmd/main.go", "service"], ["main.go", "service"],
    ["src/main.ts", "service"], ["src/main.js", "service"],
    ["src/index.ts", "service"], ["src/index.js", "service"],
  ];
  // —— 递归扫文件 / 目录（限深 5，足够覆盖典型项目 src/host/store/...）——
  const relativeFiles = new Set();
  async function scanDepth(target, depth, prefix) {
    if (depth > 5) return;
    let sub;
    try { sub = await fs.listDir(target); } catch (e) { return; }
    for (const e of sub) {
      if (!e || !e.name) continue;
      if (shouldIgnoreDir(e.name)) continue;
      const kind = entryKind(e);
      if (kind === "file") {
        result.fileCount += 1;
        const rel = prefix ? prefix + "/" + e.name : e.name;
        relativeFiles.add(rel);
        const lower = e.name.toLowerCase();
        for (const [ext, lang] of Object.entries(EXT_LANG)) {
          if (lower.endsWith(ext)) {
            result.languages[lang] = (result.languages[lang] || 0) + 1;
            break;
          }
        }
      } else if (kind === "directory") {
        const subT = await childTarget(fs, target, e);
        if (!subT) continue;
        const nextPrefix = prefix ? prefix + "/" + e.name : e.name;
        await scanDepth(subT, depth + 1, nextPrefix);
      }
      // kind === 'other' 跳过（symlink / 不识别）
    }
  }
  await scanDepth(rootTarget, 0, "");

  for (const [cand, type] of entryCandidates) {
    if (relativeFiles.has(cand) && !result.entrypoints.some((e) => e.path === cand)) {
      result.entrypoints.push({ path: cand, type });
    }
  }
  result.tooling = Array.from(new Set(result.tooling)).sort();
  // 架构分析只消费相对路径，不在 project.json 中暴露机器绝对路径。
  result.files = Array.from(relativeFiles).sort();

  return result;
}
