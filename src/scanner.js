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

  // techStack 字段：单值字段（fullstack/structure）+ 多值字段（backend/fullstack/frontend/desktop/mobile/orm/database/cache/queue 都允许数组）
  // 兼容老代码：保留对象初始化，单值字段保留 string，重复命中改为数组
  function setStack(field, value) {
    if (!value) return;
    const cur = result.techStack[field];
    if (!cur) result.techStack[field] = value;
    else if (Array.isArray(cur)) { if (!cur.includes(value)) cur.push(value); }
    else if (cur !== value) result.techStack[field] = [cur, value];
  }

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
        // Backend / Fullstack
        if (deps.next) setStack("fullstack", "Next.js");
        else if (deps.nuxt) setStack("fullstack", "Nuxt");
        else if (deps["@sveltejs/kit"]) setStack("fullstack", "SvelteKit");
        else if (deps["remix"] || deps["@remix-run/react"]) setStack("fullstack", "Remix");
        else if (deps.astro) setStack("fullstack", "Astro");
        else if (deps.express) setStack("backend", "Express");
        else if (deps.fastify) setStack("backend", "Fastify");
        else if (deps["@nestjs/core"]) setStack("backend", "NestJS");
        else if (deps.koa) setStack("backend", "Koa");
        else if (deps.hapi) setStack("backend", "Hapi");
        else if (deps["@hapi/hapi"]) setStack("backend", "Hapi");
        // Frontend
        if (deps.react) setStack("frontend", "React");
        else if (deps.vue) setStack("frontend", "Vue");
        else if (deps.svelte) setStack("frontend", "Svelte");
        else if (deps.solid || deps["solid-js"]) setStack("frontend", "Solid");
        else if (deps.preact) setStack("frontend", "Preact");
        else if (deps.angular || deps["@angular/core"]) setStack("frontend", "Angular");
        // Desktop / Mobile
        if (deps.electron) setStack("desktop", "Electron");
        if (deps["react-native"]) setStack("mobile", "React Native");
        if (deps.expo) setStack("mobile", "Expo");
        if (deps["@tauri-apps/api"] || deps.tauri) setStack("desktop", "Tauri");
        // Database / ORM
        if (deps.prisma || deps["@prisma/client"]) setStack("orm", "Prisma");
        if (deps["typeorm"]) setStack("orm", "TypeORM");
        if (deps["sequelize"] || deps.sequelize) setStack("orm", "Sequelize");
        if (deps.mongoose) setStack("orm", "Mongoose");
        if (deps["drizzle-orm"] || deps.drizzle) setStack("orm", "Drizzle");
        if (deps["knex"]) setStack("orm", "Knex");
        if (deps.mikro) setStack("orm", "MikroORM");
        // Cache / Queue
        if (deps.ioredis || deps.redis) setStack("cache", "Redis");
        if (deps.memcached || deps["memjs"]) setStack("cache", "Memcached");
        if (deps.bull || deps["bullmq"]) setStack("queue", "Bull");
        if (deps["amqplib"]) setStack("queue", "RabbitMQ");
        // Tooling
        if (deps.vite) result.tooling.push("Vite");
        if (deps.typescript) result.tooling.push("TypeScript");
        if (deps.eslint) result.tooling.push("ESLint");
        if (deps.prettier) result.tooling.push("Prettier");
        if (deps.jest) result.tooling.push("Jest");
        if (deps.vitest) result.tooling.push("Vitest");
        if (deps.playwright || deps["@playwright/test"]) result.tooling.push("Playwright");
        if (deps.cypress) result.tooling.push("Cypress");
        if (deps.tailwindcss) result.tooling.push("Tailwind CSS");
        if (deps["styled-components"]) result.tooling.push("styled-components");
        if (deps.webpack) result.tooling.push("webpack");
        if (deps.turbo) result.tooling.push("Turbopack");
        if (pkg.workspaces) setStack("structure", "Monorepo");
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
  const requirements = names.includes("requirements.txt") ? await readText(fs, rootPath, "requirements.txt") : null;
  const pyProject = names.includes("pyproject.toml") ? await readText(fs, rootPath, "pyproject.toml") : null;
  // helper：检查 pyproject.toml/requirements.txt 是否含某包名（大小写不敏感）
  const pyHas = (pkg) => {
    const re = new RegExp("(^|\\s|\\[|\\b)" + pkg + "(\\b|\\s|\\[|>=|<|=|!|~)", "i");
    return (pyProject && re.test(pyProject)) || (requirements && re.test(requirements));
  };
  // Backend frameworks
  if (pyHas("fastapi")) setStack("backend", "FastAPI");
  else if (pyHas("django")) setStack("backend", "Django");
  else if (pyHas("flask")) setStack("backend", "Flask");
  else if (pyHas("sanic")) setStack("backend", "Sanic");
  else if (pyHas("starlette")) setStack("backend", "Starlette");
  else if (pyHas("aiohttp")) setStack("backend", "aiohttp");
  else if (pyHas("tornado")) setStack("backend", "Tornado");
  else if (pyHas("pyramid")) setStack("backend", "Pyramid");
  else if (pyHas("bottle")) setStack("backend", "Bottle");
  else if (pyHas("streamlit")) setStack("frontend", "Streamlit");
  else if (pyHas("gradio")) setStack("frontend", "Gradio");
  // ORM / DB
  if (pyHas("sqlalchemy")) setStack("orm", "SQLAlchemy");
  if (pyHas("peewee")) setStack("orm", "Peewee");
  if (pyHas("tortoise-orm")) setStack("orm", "Tortoise ORM");
  if (pyHas("django")) setStack("orm", "Django ORM");
  if (pyHas("sqlmodel")) setStack("orm", "SQLModel");
  if (pyHas("asyncpg")) setStack("database", "PostgreSQL");
  if (pyHas("aiomysql") || pyHas("pymysql")) setStack("database", "MySQL");
  if (pyHas("pymongo") || pyHas("motor")) setStack("database", "MongoDB");
  if (pyHas("redis")) setStack("cache", "Redis");
  // 包管理 / 工具
  if (pyProject && /\[tool\.poetry\]/.test(pyProject)) result.tooling.push("Poetry");
  if (pyProject && /\[tool\.uv\]/.test(pyProject)) result.tooling.push("uv");
  if (pyProject && /\[tool\.hatch/.test(pyProject)) result.tooling.push("Hatch");
  if (pyProject && /\[tool\.pdm\.projects\]/.test(pyProject)) result.tooling.push("PDM");
  if (pyProject && /setup\.py|setuptools/.test(pyProject) && !/Poetry|uv|Hatch|PDM/.test(result.tooling.join(","))) result.tooling.push("setuptools");

  // —— Go ——
  const goMod = names.includes("go.mod") ? await readText(fs, rootPath, "go.mod") : null;
  if (goMod) {
    setStack("backend", "Go");
    // ORM / DB
    if (/gorm\.io\/gorm/.test(goMod)) setStack("orm", "GORM");
    if (/ent\.go/.test(goMod)) setStack("orm", "Ent");
    if (/sqlx/.test(goMod)) setStack("orm", "sqlx");
    if (/bun\.build/.test(goMod)) setStack("orm", "Bun");
    if (/pgx|lib\/pq/.test(goMod)) setStack("database", "PostgreSQL");
    if (/go-sql-driver\/mysql/.test(goMod)) setStack("database", "MySQL");
    if (/mongo-driver/.test(goMod)) setStack("database", "MongoDB");
    if (/go-redis\/redis/.test(goMod)) setStack("cache", "Redis");
    // Web 框架
    if (/gin-gonic\/gin/.test(goMod)) setStack("backend", "Gin");
    else if (/labstack\/echo/.test(goMod)) setStack("backend", "Echo");
    else if (/gofiber\/fiber/.test(goMod)) setStack("backend", "Fiber");
    else if (/go-chi\/chi/.test(goMod)) setStack("backend", "Chi");
    else if (/valyala\/fasthttp/.test(goMod)) setStack("backend", "FastHTTP");
  }
  // —— Java ——
  if (names.includes("pom.xml")) setStack("backend", "Spring (Maven)");
  else if (names.some((n) => n === "build.gradle" || n === "build.gradle.kts")) setStack("backend", "Spring (Gradle)");
  // —— Rust ——
  const cargoToml = names.includes("Cargo.toml") ? await readText(fs, rootPath, "Cargo.toml") : null;
  if (cargoToml) {
    setStack("backend", "Rust");
    // 识别子 crate workspace
    if (/\[workspace\]/.test(cargoToml)) setStack("structure", "Cargo Workspace");
    // Web 框架
    if (/^actix-web\s*=/m.test(cargoToml)) setStack("backend", "Actix Web");
    else if (/^axum\s*=/m.test(cargoToml)) setStack("backend", "Axum");
    else if (/^rocket\s*=/m.test(cargoToml)) setStack("backend", "Rocket");
    else if (/^warp\s*=/m.test(cargoToml)) setStack("backend", "Warp");
    else if (/^tide\s*=/m.test(cargoToml)) setStack("backend", "Tide");
    // ORM
    if (/^diesel\s*=/m.test(cargoToml)) setStack("orm", "Diesel");
    if (/^sea-orm\s*=/m.test(cargoToml)) setStack("orm", "SeaORM");
    if (/^sqlx\s*=/m.test(cargoToml)) setStack("orm", "SQLx");
    // DB
    if (/^postgres\s*=/m.test(cargoToml)) setStack("database", "PostgreSQL");
    if (/^mysql\s*=/m.test(cargoToml)) setStack("database", "MySQL");
    if (/^redis\s*=/m.test(cargoToml)) setStack("cache", "Redis");
    // 工具
    if (/^tokio\s*=/m.test(cargoToml)) result.tooling.push("Tokio");
    if (/^serde\s*=/m.test(cargoToml)) result.tooling.push("Serde");
  }
  // 顶层基础设施
  if (names.includes("Dockerfile") || names.includes("docker-compose.yml") || names.includes("compose.yml")) result.tooling.push("Docker");
  if (names.includes("pnpm-workspace.yaml") || names.includes("turbo.json") || names.includes("nx.json")) setStack("structure", "Monorepo");
  if (names.some((n) => n.endsWith(".tf"))) result.tooling.push("Terraform");
  if (names.includes("Makefile")) result.tooling.push("Make");
  // CI
  if (names.includes(".github") && names.some((n) => n.startsWith(".github"))) result.tooling.push("GitHub Actions");
  // 检测 SQL 文件存在（之前 EXT_LANG 有 .sql 但 techStack 没数据库字段）
  if (result.languages.sql && !result.techStack.database) setStack("database", "SQL");

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
