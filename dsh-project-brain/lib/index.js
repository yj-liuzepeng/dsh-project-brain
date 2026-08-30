var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/tools.js
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/scanner.js
var IGNORE_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".next",
  "target",
  ".DS_Store",
  ".idea",
  ".vscode",
  "coverage",
  ".turbo",
  ".cache",
  "out",
  ".project-brain"
  // 自身的项目脑数据目录，不应被扫
]);
function shouldIgnoreDir(name2) {
  return IGNORE_DIRS.has(name2) || /^node_modules(?:[._-].*)?$/i.test(name2) || /(?:^|[._-])backup(?:[._-]|$)/i.test(name2) || /\.bak(?:[._-]|$)/i.test(name2);
}
var EXT_LANG = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java",
  ".rs": "rust",
  ".c": "c",
  ".h": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".dart": "dart",
  ".scala": "scala",
  ".sh": "shell",
  ".sql": "sql",
  ".vue": "vue",
  ".svelte": "svelte"
};
function decodeReadmeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 1114111 ? String.fromCodePoint(code) : all;
    }
    return named[entity.toLowerCase()] || all;
  });
}
function sanitizeProjectDescription(value) {
  if (!value) return null;
  const cleaned = decodeReadmeEntities(String(value).replace(/<!--([\s\S]*?)-->/g, " ").replace(/<(script|style|svg|picture)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<img\b[^>]*>/gi, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<https?:\/\/[^>]+>/gi, " ").replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/gi, " ").replace(/^\s{0,3}(?:#{1,6}|>|[-*+]\s+)\s*/gm, "").replace(/[*_~`|]+/g, " ")).replace(/\s+/g, " ").trim();
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
function firstReadmeParagraph(text) {
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
async function readText(fs, rootPath, name2) {
  try {
    const t = await fs.resolve(name2, { cwd: rootPath });
    return await fs.readText(t);
  } catch (e) {
    return null;
  }
}
function entryKind(e) {
  if (!e) return "other";
  if (typeof e.type === "string") {
    if (e.type === "file" || e.type === "directory" || e.type === "other") return e.type;
  }
  if (e.isFile === true) return "file";
  if (e.isDirectory === true) return "directory";
  if (typeof e.isFile === "function" && e.isFile()) return "file";
  if (typeof e.isDirectory === "function" && e.isDirectory()) return "directory";
  return "other";
}
async function childTarget(fs, parentTarget, entry) {
  if (entry && entry.target) return entry.target;
  try {
    return await fs.resolve(entry.name, { cwd: parentTarget });
  } catch (e) {
    return null;
  }
}
async function scanProject(fs, projectPath) {
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
    files: []
  };
  let entries;
  try {
    entries = await fs.listDir(rootTarget);
  } catch (e) {
    return result;
  }
  result.topLevel = entries.map((e) => e && e.name).filter((n) => n && !shouldIgnoreDir(n)).slice().sort();
  const names = result.topLevel;
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
        if (pkg.scripts && pkg.scripts.dev) {
          result.entrypoints.push({ path: "npm run dev", type: "script" });
        }
        if (pkg.scripts && pkg.scripts.build) {
          result.entrypoints.push({ path: "npm run build", type: "script" });
        }
      } catch (e) {
      }
    }
  }
  const pyToml = names.includes("pyproject.toml") ? await readText(fs, rootPath, "pyproject.toml") : null;
  const requirements = names.includes("requirements.txt") ? await readText(fs, rootPath, "requirements.txt") : null;
  if (pyToml && pyToml.indexOf("fastapi") !== -1) result.techStack.backend = "FastAPI";
  else if (pyToml && pyToml.indexOf("django") !== -1) result.techStack.backend = "Django";
  else if (pyToml && pyToml.indexOf("flask") !== -1) result.techStack.backend = "Flask";
  else if (requirements && requirements.indexOf("fastapi") !== -1) result.techStack.backend = "FastAPI";
  else if (requirements && requirements.indexOf("django") !== -1) result.techStack.backend = "Django";
  else if (requirements && requirements.indexOf("flask") !== -1) result.techStack.backend = "Flask";
  if (names.includes("go.mod")) result.techStack.backend = "Go";
  if (names.includes("pom.xml")) result.techStack.backend = "Spring (Maven)";
  else if (names.some((n) => n === "build.gradle" || n === "build.gradle.kts")) result.techStack.backend = "Spring (Gradle)";
  if (names.includes("Cargo.toml")) result.techStack.backend = "Rust";
  if (names.includes("Dockerfile") || names.includes("docker-compose.yml") || names.includes("compose.yml")) result.tooling.push("Docker");
  if (names.includes("pnpm-workspace.yaml") || names.includes("turbo.json") || names.includes("nx.json")) result.techStack.structure = "Monorepo";
  if (names.some((n) => n.endsWith(".tf"))) result.tooling.push("Terraform");
  if (names.includes("Makefile")) result.tooling.push("Make");
  if (!result.description) {
    const readmeName = names.find((n) => /^readme(?:\.[a-z0-9]+)?$/i.test(n));
    if (readmeName) result.description = firstReadmeParagraph(await readText(fs, rootPath, readmeName));
  }
  const entryCandidates = [
    ["main.ts", "service"],
    ["main.js", "service"],
    ["index.ts", "service"],
    ["index.js", "service"],
    ["app.py", "service"],
    ["server.py", "service"],
    ["manage.py", "cli"],
    ["cmd/main.go", "service"],
    ["main.go", "service"],
    ["src/main.ts", "service"],
    ["src/main.js", "service"],
    ["src/index.ts", "service"],
    ["src/index.js", "service"]
  ];
  const relativeFiles = /* @__PURE__ */ new Set();
  async function scanDepth(target, depth, prefix) {
    if (depth > 5) return;
    let sub;
    try {
      sub = await fs.listDir(target);
    } catch (e) {
      return;
    }
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
    }
  }
  await scanDepth(rootTarget, 0, "");
  for (const [cand, type] of entryCandidates) {
    if (relativeFiles.has(cand) && !result.entrypoints.some((e) => e.path === cand)) {
      result.entrypoints.push({ path: cand, type });
    }
  }
  result.tooling = Array.from(new Set(result.tooling)).sort();
  result.files = Array.from(relativeFiles).sort();
  return result;
}

// src/host/store/brain-files.js
function brainPath(projectPath, file) {
  const base = String(projectPath || ".").replace(/[\\/]+$/, "");
  return base + "/.project-brain/" + file;
}
async function readText2(fs, path2) {
  try {
    const target = await fs.resolve(path2);
    return await fs.readText(target);
  } catch (e) {
    return null;
  }
}
function resolveWritePolicy(fs, writePolicy) {
  if (writePolicy) return writePolicy;
  try {
    const sp = fs && (fs.sandboxPolicy || fs.ctx && fs.ctx.sandboxPolicy);
    if (sp && typeof sp.resolve === "function") {
      try {
        return sp.resolve({ mode: "danger-full-access" });
      } catch (e) {
      }
    }
  } catch (e) {
  }
  return null;
}
async function writeText(fs, path2, content, writePolicy) {
  const policy = resolveWritePolicy(fs, writePolicy);
  try {
    try {
      const idx = path2.lastIndexOf("/");
      if (idx > 0 && typeof fs.mkdir === "function") {
        const dirTarget = await fs.resolve(path2.slice(0, idx));
        if (policy && fs.mkdir.length >= 2) {
          try {
            await fs.mkdir(dirTarget, { recursive: true }, { sandboxPolicy: policy });
          } catch (e) {
          }
        } else if (policy) {
          try {
            await fs.mkdir(dirTarget, { recursive: true });
          } catch (e) {
          }
        } else {
          try {
            await fs.mkdir(dirTarget, { recursive: true });
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    const target = await fs.resolve(path2);
    if (policy) {
      try {
        await fs.writeText(target, content, void 0, void 0, policy);
        return true;
      } catch (e) {
      }
    }
    await fs.writeText(target, content);
    return true;
  } catch (e) {
    return false;
  }
}
async function appendLine(fs, path2, line, writePolicy) {
  if (line == null) return false;
  const normalizedLine = String(line).endsWith("\n") ? String(line) : String(line) + "\n";
  try {
    const target = await fs.resolve(path2);
    let existing = null;
    try {
      existing = await fs.readText(target);
    } catch (e) {
    }
    let next;
    if (existing == null || existing === "") {
      next = normalizedLine;
    } else if (existing.endsWith("\n")) {
      next = existing + normalizedLine;
    } else {
      next = existing + "\n" + normalizedLine;
    }
    return writeText(fs, path2, next, writePolicy);
  } catch (e) {
    return false;
  }
}
function parseJsonl(text) {
  if (!text) return [];
  let t = String(text);
  if (t.charCodeAt(0) === 65279) t = t.slice(1);
  const out = [];
  for (const line of t.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch (e) {
    }
  }
  return out;
}
function serializeJsonl(items) {
  if (!items || items.length === 0) return "";
  return items.map((i) => JSON.stringify(i)).join("\n") + "\n";
}
async function readJsonl(fs, path2) {
  return parseJsonl(await readText2(fs, path2));
}
async function appendJsonl(fs, path2, entry, writePolicy) {
  return appendLine(fs, path2, JSON.stringify(entry) + "\n", writePolicy);
}
async function writeJsonl(fs, path2, items, writePolicy) {
  return writeText(fs, path2, serializeJsonl(items || []), writePolicy);
}
async function readJson(fs, path2) {
  const text = await readText2(fs, path2);
  if (text == null) return null;
  let t = text;
  if (typeof t === "string" && t.charCodeAt(0) === 65279) t = t.slice(1);
  try {
    return JSON.parse(t);
  } catch (e) {
    return { __error: String(e && e.message || e) };
  }
}
async function writeJson(fs, path2, obj, writePolicy) {
  return writeText(fs, path2, JSON.stringify(obj, null, 2), writePolicy);
}
async function readBrain(fs, projectPath) {
  const [project, timeline, memories, todos] = await Promise.all([
    readJson(fs, brainPath(projectPath, "project.json")),
    readJsonl(fs, brainPath(projectPath, "timeline.jsonl")),
    readJsonl(fs, brainPath(projectPath, "memory.jsonl")),
    readJsonl(fs, brainPath(projectPath, "todo.jsonl"))
  ]);
  return { projectPath, project, timeline, memories, todos };
}

// src/host/store/brain-logic.js
var MEMORY_TYPES = [
  "decision",
  "requirement",
  "architecture",
  "change",
  "bug",
  "lesson",
  "issue",
  "context"
];
var TODO_STATUSES = ["pending", "in_progress", "blocked", "done", "cancelled"];
var TODO_PRIORITIES = ["low", "medium", "high", "urgent"];
var PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
var HIGH_VALUE_MEMORY_TYPES = { decision: true, architecture: true, bug: true, lesson: true };
function makeId(prefix, now, rand) {
  const t = (now != null ? now : Date.now()).toString(36);
  const r = rand != null ? rand : Math.random().toString(36).slice(2, 8);
  return prefix + "-" + t + "-" + r;
}
function normalizeMemoryType(type) {
  const s = String(type || "").toLowerCase().trim();
  return MEMORY_TYPES.indexOf(s) >= 0 ? s : null;
}
function normalizePriority(priority) {
  const s = String(priority || "").toLowerCase().trim();
  return TODO_PRIORITIES.indexOf(s) >= 0 ? s : null;
}
function normalizeStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  return TODO_STATUSES.indexOf(s) >= 0 ? s : null;
}
function makeMemoryEntry(input, now) {
  const i = input || {};
  const importance = Number(i.importance);
  const confidence = Number(i.confidence);
  const relatedFiles = Array.isArray(i.relatedFiles) ? i.relatedFiles.map(String).slice(0, 20) : null;
  const tags = Array.isArray(i.tags) ? i.tags.map(String).slice(0, 10) : null;
  return {
    schemaVersion: 2,
    id: i.id || makeId("mem", now),
    type: normalizeMemoryType(i.type) || "context",
    title: String(i.title || "").slice(0, 200),
    content: String(i.content || ""),
    importance: isNaN(importance) ? 0.5 : Math.min(1, Math.max(0, importance)),
    confidence: isNaN(confidence) ? 0.7 : Math.min(1, Math.max(0, confidence)),
    status: "active",
    ...i.source && typeof i.source === "object" ? { source: i.source } : {},
    ...relatedFiles && relatedFiles.length ? { relatedFiles } : {},
    ...tags && tags.length ? { tags } : {},
    createdAt: now,
    updatedAt: now
  };
}
function isActiveMemory(memory) {
  return Boolean(memory) && memory.status !== "archived" && memory.status !== "superseded" && memory.status !== "deleted";
}
function makeTodoEntry(input, now) {
  const i = input || {};
  const relatedFiles = Array.isArray(i.relatedFiles) ? i.relatedFiles.map(String).slice(0, 20) : null;
  return {
    id: i.id || makeId("todo", now),
    title: String(i.title || "").slice(0, 200),
    description: String(i.description || ""),
    status: "pending",
    priority: normalizePriority(i.priority) || "medium",
    ...relatedFiles && relatedFiles.length ? { relatedFiles } : {},
    createdAt: now,
    updatedAt: now
  };
}
function activeTodos(todos) {
  const list = (todos || []).filter(function(t) {
    return t && t.status !== "done" && t.status !== "cancelled";
  });
  list.sort(function(a, b) {
    const pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 2;
    const pb = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : 2;
    if (pa !== pb) return pa - pb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}
function todoStats(todos) {
  const list = todos || [];
  const active = list.filter(function(t) {
    return t && t.status !== "done" && t.status !== "cancelled";
  });
  const done = list.filter(function(t) {
    return t && t.status === "done";
  });
  return { pendingTodos: active.length, completedTodos: done.length, total: list.length };
}
function memoryScore(m, now) {
  const nowMs = now != null ? now : Date.now();
  const importance = typeof m.importance === "number" ? m.importance : 0.5;
  const created = m.createdAt || 0;
  const ageDays = Math.max(0, (nowMs - created) / 864e5);
  let recency = 1 - ageDays / 90;
  if (recency < 0) recency = 0;
  if (ageDays <= 7) recency = 1;
  const typeBoost = HIGH_VALUE_MEMORY_TYPES[m.type] ? 1 : 0.5;
  return importance * 0.5 + recency * 0.3 + typeBoost * 0.2;
}
function topMemories(memories, n, now) {
  const list = (memories || []).filter(isActiveMemory);
  list.sort(function(a, b) {
    return memoryScore(b, now) - memoryScore(a, now);
  });
  return list.slice(0, n || 5);
}
function recentTimeline(timeline, n) {
  const list = (timeline || []).slice();
  list.sort(function(a, b) {
    return (b.occurredAt || 0) - (a.occurredAt || 0);
  });
  return list.slice(0, n || 5);
}
function techStackToType(techStack) {
  if (!techStack || typeof techStack !== "object") return "Untyped";
  const parts = [];
  for (const k of Object.keys(techStack)) {
    if (techStack[k]) parts.push(String(techStack[k]));
  }
  return parts.length > 0 ? parts.join(" \xB7 ") : "Untyped";
}
function buildContinueData(brain, now) {
  const nowMs = now != null ? now : Date.now();
  const p = brain && brain.project;
  const memories = brain && brain.memories || [];
  const todos = brain && brain.todos || [];
  const timeline = brain && brain.timeline || [];
  const activity = recentTimeline(timeline, 5).map(function(e) {
    return { id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType };
  });
  const top = topMemories(memories, 5, nowMs).map(function(m) {
    return {
      id: m.id,
      type: m.type,
      title: m.title,
      content: String(m.content || "").slice(0, 200),
      importance: m.importance,
      createdAt: m.createdAt
    };
  });
  const active = activeTodos(todos);
  const pending = active.slice(0, 10).map(function(t) {
    return { id: t.id, title: t.title, status: t.status, priority: t.priority };
  });
  const stats = todoStats(todos);
  const activeMemories2 = memories.filter(isActiveMemory);
  const decisions = activeMemories2.filter(function(m) {
    return m.type === "decision";
  });
  const inProgress = active.filter(function(t) {
    return t.status === "in_progress";
  })[0];
  let suggestedNextStep;
  if (inProgress) {
    suggestedNextStep = "\u7EE7\u7EED\u8FDB\u884C\u4E2D\u4EFB\u52A1\uFF1A" + inProgress.title;
  } else if (active.length > 0) {
    suggestedNextStep = "\u5EFA\u8BAE\u5F00\u59CB\uFF1A" + active[0].title;
  } else if (activity.length > 0) {
    suggestedNextStep = "\u65E0\u5F85\u529E\uFF1B\u53EF\u53C2\u8003\u6700\u8FD1\u6D3B\u52A8\uFF1A" + activity[0].title;
  } else {
    suggestedNextStep = "\u6682\u65E0\u5F85\u529E\uFF1B\u5EFA\u8BAE\u7528 project_todo_add \u89C4\u5212\u4E0B\u4E00\u6B65";
  }
  return {
    initialized: Boolean(p && !p.__error),
    projectPath: brain ? brain.projectPath : null,
    project: p && !p.__error ? {
      id: p.id,
      name: p.name,
      type: techStackToType(p.techStack),
      lastUpdateAt: p.updatedAt || p.lastScannedAt || nowMs
    } : null,
    recentActivity: activity,
    topMemories: top,
    pendingTodos: pending,
    stats: {
      pendingTodos: stats.pendingTodos,
      completedTodos: stats.completedTodos,
      decisions: decisions.length,
      memories: activeMemories2.length
    },
    suggestedNextStep
  };
}
function findTodo(todos, ref) {
  const key = String(ref || "").trim();
  if (!key) return null;
  const active = activeTodos(todos);
  for (const t of active) {
    if (t.id === key || t.id.indexOf(key) === 0) return t;
  }
  const lower = key.toLowerCase();
  for (const t of active) {
    if (String(t.title || "").toLowerCase() === lower) return t;
  }
  return null;
}
function computeDreamActions(memories, opts) {
  const o = opts || {};
  const now = typeof o.now === "number" ? o.now : Date.now();
  const mergeThreshold = typeof o.mergeThreshold === "number" ? o.mergeThreshold : 0.92;
  const archiveImp = typeof o.archiveImportance === "number" ? o.archiveImportance : 0.15;
  const archiveAgeDays = typeof o.archiveAgeDays === "number" ? o.archiveAgeDays : 30;
  const list = memories || [];
  const plannedActions = [];
  const seen = /* @__PURE__ */ new Set();
  const items = list.filter(isActiveMemory).map((m, i) => ({ m, i, bg: titleBigrams(m.title) }));
  for (let i = 0; i < items.length; i++) {
    if (seen.has(items[i].i)) continue;
    const group = [items[i].i];
    for (let j = i + 1; j < items.length; j++) {
      if (seen.has(items[j].i)) continue;
      if (items[i].m.type !== items[j].m.type) continue;
      const sim = jaccard(items[i].bg, items[j].bg);
      if (sim >= mergeThreshold) {
        group.push(items[j].i);
        seen.add(items[j].i);
      }
    }
    if (group.length > 1) {
      const sorted = group.map((idx) => items[idx].m).sort((a, b) => {
        const ai = (a.importance || 0) * 100 + String(a.content || "").length;
        const bi = (b.importance || 0) * 100 + String(b.content || "").length;
        return bi - ai;
      });
      const keep = sorted[0];
      const drop = sorted.slice(1);
      plannedActions.push({
        action: "merge",
        keepId: keep.id,
        keepTitle: keep.title,
        dropIds: drop.map((m) => m.id),
        dropTitles: drop.map((m) => m.title),
        note: "Jaccard \u2265 " + mergeThreshold + "\uFF08title \u76F8\u4F3C\uFF09\uFF0C\u4FDD\u7559 importance \u9AD8 + content \u957F\u7684"
      });
    }
    seen.add(items[i].i);
  }
  for (const m of list) {
    if ((m.importance || 0) >= archiveImp) continue;
    const age = now - (m.createdAt || 0);
    if (age < archiveAgeDays * 864e5) continue;
    if (m.status === "archived") continue;
    plannedActions.push({
      action: "archive_candidate",
      id: m.id,
      type: m.type,
      title: m.title,
      importance: m.importance,
      ageDays: Math.round(age / 864e5),
      note: "importance < " + archiveImp + " \u4E14\u5E74\u9F84 > " + archiveAgeDays + " \u5929"
    });
  }
  return {
    plannedActions,
    mergeCount: plannedActions.filter((a) => a.action === "merge").length,
    archiveCount: plannedActions.filter((a) => a.action === "archive_candidate").length
  };
}
function applyDreamCommit(memories, plannedActions, now, mode) {
  const list = (memories || []).slice();
  const merges = (plannedActions || []).filter((a) => a.action === "merge");
  const archives = (plannedActions || []).filter((a) => a.action === "archive_candidate");
  const dropIds = /* @__PURE__ */ new Set();
  const keepMap = /* @__PURE__ */ new Map();
  for (const m of merges) {
    for (const id of m.dropIds) dropIds.add(id);
    keepMap.set(m.keepId, m);
  }
  let next = list.filter((mem) => !dropIds.has(mem.id)).map((mem) => {
    const k = keepMap.get(mem.id);
    if (!k) return mem;
    const mergedRelated = (mem.relatedMemoryIds || []).concat(k.dropIds).filter((v, i, arr) => arr.indexOf(v) === i);
    return Object.assign({}, mem, {
      relatedMemoryIds: mergedRelated,
      lastAccessedAt: now,
      status: "reinforced",
      importance: Math.min(1, (mem.importance || 0.5) + 0.05)
    });
  });
  const archiveIds = new Set(archives.map((a) => a.id));
  next = next.map((mem) => {
    if (!archiveIds.has(mem.id)) return mem;
    return Object.assign({}, mem, { status: "archived", lastAccessedAt: now });
  });
  if (mode === "full") {
    next = next.filter((mem) => mem.status !== "archived");
  }
  next.sort((a, b) => {
    const ai = (b.importance || 0) - (a.importance || 0);
    if (ai !== 0) return ai;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return next;
}
function titleBigrams(s) {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, " ").trim();
  if (t.length < 2) return /* @__PURE__ */ new Set([t]);
  const out = /* @__PURE__ */ new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// src/host/store/path-resolver.js
function readCwdFromSession(session) {
  if (!session) return null;
  try {
    const cwd = session.cwd;
    if (typeof cwd === "string" && cwd.trim()) return cwd;
    if (session.meta && typeof session.meta.cwd === "string" && session.meta.cwd.trim()) return session.meta.cwd;
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd.trim()) return session.header.cwd;
    if (session.header && session.header.meta && typeof session.header.meta.cwd === "string" && session.header.meta.cwd.trim()) return session.header.meta.cwd;
  } catch (e) {
  }
  return null;
}
function readCwdFromSessionsService(ctx, sessionId) {
  if (!ctx || !sessionId) return null;
  let sessions;
  try {
    sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
  } catch (e) {
    return null;
  }
  if (!sessions || typeof sessions.get !== "function") return null;
  try {
    const session = sessions.get(sessionId);
    return readCwdFromSession(session);
  } catch (e) {
    return null;
  }
}
function readCwdFromInitiator(ctx) {
  if (!ctx) return null;
  let agents;
  try {
    agents = ctx.get ? ctx.get("agents") : ctx.agents;
  } catch (e) {
    return null;
  }
  if (!agents || typeof agents.currentInitiator !== "function") return null;
  let agent;
  try {
    agent = agents.currentInitiator();
  } catch (e) {
    return null;
  }
  if (!agent) return null;
  try {
    if (agent.session) {
      const c = readCwdFromSession(agent.session);
      if (c) return c;
    }
    if (agent.sessionId && agents.requireInitiator) {
    }
    if (agent.header && agent.header.meta) {
      const c = agent.header.meta.cwd;
      if (typeof c === "string" && c.trim()) return c;
    }
    if (agent.meta && typeof agent.meta.cwd === "string" && agent.meta.cwd.trim()) {
      return agent.meta.cwd;
    }
  } catch (e) {
  }
  return null;
}
function isDshDesktopInstall(p) {
  if (!p || typeof p !== "string") return false;
  if (/[\\/]Programs[\\/]DSH Desktop$/i.test(p)) return true;
  if (/[\\/]DSH Desktop\.app/.test(p)) return true;
  return false;
}
function safeCwd(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) return null;
  if (isDshDesktopInstall(cwd)) return null;
  return cwd;
}
function resolveProjectPath(args, exec, sandboxPolicy) {
  try {
    const direct = safeCwd(readCwdFromSession(exec && exec.session));
    if (direct) return direct;
    const ctxSession = exec && exec.ctx && (exec.ctx.session || exec.ctx.agent && exec.ctx.agent.session);
    const ctxCwd = safeCwd(readCwdFromSession(ctxSession));
    if (ctxCwd) return ctxCwd;
    const sid = exec && (exec.sessionId || exec.session && exec.session.id);
    const ctx = exec && (exec.ctx || null);
    const svcCwd = safeCwd(readCwdFromSessionsService(ctx, sid));
    if (svcCwd) return svcCwd;
    const initiatorCwd = safeCwd(readCwdFromInitiator(ctx));
    if (initiatorCwd) return initiatorCwd;
  } catch (e) {
  }
  try {
    const explicit = args && typeof args.path === "string" && args.path.trim();
    if (explicit) {
      const safe = safeCwd(explicit.trim());
      return safe || ".";
    }
  } catch (e) {
  }
  try {
    if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === "string" && sandboxPolicy.workspaceRoot.trim()) {
      const root = sandboxPolicy.workspaceRoot;
      const safe = safeCwd(root);
      if (safe) return safe;
    }
  } catch (e) {
  }
  console.warn("[dsh-project-brain:path-resolver] All fallback cwd candidates were DSH Desktop installs (or missing). User should pass args.path explicitly.");
  return ".";
}

// src/host/architecture/analyzer.js
var SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|go|java|kt|kts|rs|cs|php|rb|swift|dart|scala|vue|svelte)$/i;
var MANIFEST_NAMES = /^(?:package\.json|pyproject\.toml|requirements\.txt|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|cargo\.toml|docker-compose\.ya?ml|compose\.ya?ml|dockerfile|makefile|pnpm-workspace\.yaml|turbo\.json|nx\.json)$/i;
var README_NAMES = /^readme(?:\.[a-z0-9]+)?$/i;
var ROLES = [
  { id: "presentation", name: "\u4EA4\u4E92\u4E0E\u5C55\u793A\u5C42", kind: "presentation", order: 0, match: /(?:^|\/)(?:client|frontend|web|ui|views?|pages?|components?|screens?)(?:\/|\.|$)/i },
  { id: "interface", name: "\u63A5\u53E3\u4E0E\u63A5\u5165\u5C42", kind: "interface", order: 1, match: /(?:^|\/)(?:api|routes?|controllers?|handlers?|rpc|commands?|cli|gateway)(?:\/|\.|$)/i },
  { id: "application", name: "\u5E94\u7528\u7F16\u6392\u5C42", kind: "application", order: 2, match: /(?:^|\/)(?:services?|use-?cases?|application|agents?|tools?|workflows?|orchestrators?)(?:\/|\.|$)/i },
  { id: "domain", name: "\u6838\u5FC3\u9886\u57DF\u5C42", kind: "domain", order: 3, match: /(?:^|\/)(?:core|domain|engine|business|analysis|scanner|parser|compiler)(?:\/|\.|$)/i },
  { id: "data", name: "\u6570\u636E\u4E0E\u8BB0\u5FC6\u5C42", kind: "data", order: 4, match: /(?:^|\/)(?:data|db|database|models?|schemas?|repositories?|stores?|storage|memory|cache|migrations?)(?:\/|\.|$)/i },
  { id: "integration", name: "\u5E73\u53F0\u4E0E\u5916\u90E8\u96C6\u6210\u5C42", kind: "integration", order: 5, match: /(?:^|\/)(?:host|integrations?|adapters?|providers?|connectors?|plugins?|infra|runtime)(?:\/|\.|$)/i },
  { id: "support", name: "\u5DE5\u7A0B\u652F\u6491", kind: "support", order: 6, match: /(?:^|\/)(?:tests?|specs?|fixtures?|scripts?|build|config|deploy)(?:\/|\.|$)/i }
];
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hashText(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function safeId(value) {
  return String(value || "item").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "item";
}
function cleanText(value, limit = 600) {
  return String(value || "").replace(/\0/g, "").replace(/\r/g, "").trim().slice(0, limit);
}
function isGeneratedOrVendor(file) {
  const path2 = String(file || "").replaceAll("\\", "/");
  return /(?:^|\/)(?:node_modules(?:[._-][^/]*)?|vendor|dist|build|coverage|\.next|target|out|__pycache__|\.venv|venv)(?:\/|$)/i.test(path2) || /(?:^|\/)[^/]*(?:backup|\.bak)(?:[-_.][^/]*)?(?:\/|$)/i.test(path2) || /(?:^|\/)dsh-project-brain\/lib(?:\/|$)/i.test(path2);
}
function languageOf(path2) {
  const lower = String(path2 || "").toLowerCase();
  if (/\.tsx?$/.test(lower)) return "typescript";
  if (/\.[cm]?jsx?$/.test(lower)) return "javascript";
  if (/\.py$/.test(lower)) return "python";
  if (/\.go$/.test(lower)) return "go";
  if (/\.java$/.test(lower)) return "java";
  if (/\.rs$/.test(lower)) return "rust";
  if (/\.vue$/.test(lower)) return "vue";
  if (/\.svelte$/.test(lower)) return "svelte";
  return "other";
}
async function readProjectFile(fs, projectPath, relativePath) {
  try {
    const root = await fs.resolve(projectPath);
    const target = await fs.resolve(relativePath, { cwd: root });
    return String(await fs.readText(target));
  } catch (e) {
    return "";
  }
}
function extractImports(text, language) {
  const out = [];
  const add = (value) => {
    const item = String(value || "").trim();
    if (item && !out.includes(item)) out.push(item);
  };
  let match;
  if (["javascript", "typescript", "vue", "svelte"].includes(language)) {
    const re = /(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    while (match = re.exec(text)) add(match[1]);
  } else if (language === "python") {
    const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
    while (match = re.exec(text)) add(match[1] || match[2]);
  } else if (language === "go") {
    const block = (text.match(/import\s*(?:\([\s\S]*?\)|["`][^"`]+["`])/) || [""])[0];
    const re = /["`]([^"`\s]+)["`]/g;
    while (match = re.exec(block)) add(match[1]);
  } else if (language === "java") {
    const re = /^\s*import\s+([\w.]+);/gm;
    while (match = re.exec(text)) add(match[1]);
  }
  return out.slice(0, 60);
}
function extractSymbols(text, language) {
  const out = [];
  const add = (kind, name2) => {
    if (name2 && !out.some((item) => item.name === name2)) out.push({ kind, name: String(name2).slice(0, 100) });
  };
  let match;
  if (["javascript", "typescript", "vue", "svelte"].includes(language)) {
    const re = /(?:export\s+(?:default\s+)?)?(?:async\s+)?(class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
    while (match = re.exec(text)) add(match[1], match[2]);
  } else if (language === "python") {
    const re = /^\s*(class|def|async\s+def)\s+([A-Za-z_]\w*)/gm;
    while (match = re.exec(text)) add(match[1], match[2]);
  } else if (language === "go") {
    const re = /^\s*(type|func)\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm;
    while (match = re.exec(text)) add(match[1], match[2]);
  } else if (language === "java") {
    const re = /\b(class|interface|enum|record)\s+([A-Za-z_]\w*)/g;
    while (match = re.exec(text)) add(match[1], match[2]);
  }
  return out.slice(0, 24);
}
function sourceExcerpt(text) {
  return cleanText(String(text || "").split("\n").filter((line) => !/^\s*(?:\/\/|#)\s*(?:eslint|prettier|type:|noqa)/i.test(line)).slice(0, 60).join("\n"), 1400);
}
function evidencePriority(file, scan) {
  let score = 0;
  if ((scan.entrypoints || []).some((entry) => entry.path === file)) score += 100;
  if (/(?:^|\/)(?:main|index|app|server|client|plugin|bootstrap)\.[^.]+$/i.test(file)) score += 45;
  if (/(?:scanner|analyzer|service|controller|router|store|memory|rpc|injector|engine|workflow)/i.test(file)) score += 28;
  if (String(file).split("/").length <= 3) score += 12;
  if (/(?:test|spec|fixture|mock|\.d\.ts$)/i.test(file)) score -= 35;
  return score;
}
function roleForFile(file) {
  return ROLES.find((role) => role.match.test(file)) || ROLES[3];
}
function friendlyComponentName(role, files) {
  const hints = files.join(" ").toLowerCase();
  if (role.id === "presentation") return /client|web|page|component/.test(hints) ? "\u7528\u6237\u754C\u9762\u4E0E\u53EF\u89C6\u5316" : "\u4EA4\u4E92\u5C55\u793A";
  if (role.id === "interface") return /rpc/.test(hints) ? "\u8FD0\u884C\u65F6 RPC \u63A5\u53E3" : /cli|command/.test(hints) ? "\u547D\u4EE4\u4E0E\u63A5\u5165\u63A5\u53E3" : "\u63A5\u53E3\u9002\u914D";
  if (role.id === "application") return /tool/.test(hints) ? "\u9879\u76EE\u80FD\u529B\u5DE5\u5177\u96C6" : /agent/.test(hints) ? "Agent \u7F16\u6392" : "\u5E94\u7528\u670D\u52A1\u7F16\u6392";
  if (role.id === "domain") return /scan|analy|parser/.test(hints) ? "\u9879\u76EE\u5206\u6790\u5F15\u64CE" : "\u6838\u5FC3\u4E1A\u52A1\u5F15\u64CE";
  if (role.id === "data") return /memory/.test(hints) ? "\u9879\u76EE\u8BB0\u5FC6\u4E0E\u68C0\u7D22" : "\u9879\u76EE\u6570\u636E\u5B58\u50A8";
  if (role.id === "integration") return /host|plugin/.test(hints) ? "DSH Host \u96C6\u6210" : "\u5E73\u53F0\u4E0E\u5916\u90E8\u670D\u52A1\u96C6\u6210";
  return "\u6784\u5EFA\u3001\u6D4B\u8BD5\u4E0E\u53D1\u5E03";
}
function localPurpose(scan) {
  if (scan.description) return cleanText(scan.description, 800);
  const stacks = Object.values(scan.techStack || {}).filter(Boolean);
  return (scan.projectName || "\u8BE5\u9879\u76EE") + (stacks.length ? " \u662F\u4E00\u4E2A\u57FA\u4E8E " + stacks.join("\u3001") + " \u7684\u8F6F\u4EF6\u9879\u76EE\u3002" : " \u662F\u4E00\u4E2A\u8F6F\u4EF6\u9879\u76EE\uFF0C\u53EF\u4ECE\u5165\u53E3\u4E0E\u6838\u5FC3\u7EC4\u4EF6\u7EE7\u7EED\u4E86\u89E3\u5176\u804C\u8D23\u3002");
}
function withAliases(architecture) {
  return {
    ...architecture,
    nodes: (architecture.components || []).map((item) => ({ id: item.id, label: item.name, kind: item.type, layerId: item.layerId, description: item.responsibility, details: item.details, files: item.importantFiles || [], evidencePaths: item.evidencePaths || [], technologies: item.technologies || [], confidence: item.confidence })),
    edges: (architecture.relationships || []).map((item) => ({ ...item })),
    flows: (architecture.runtimeFlows || []).map((flow) => ({ ...flow, label: flow.name, steps: (flow.steps || []).map((step) => step.componentId) }))
  };
}
function buildLocalArchitecture(scan, evidence, previous, config) {
  const grouped = /* @__PURE__ */ new Map();
  for (const fact of evidence.sourceFacts) {
    const role = roleForFile(fact.file);
    if (!grouped.has(role.id)) grouped.set(role.id, { role, facts: [] });
    grouped.get(role.id).facts.push(fact);
  }
  const components = [...grouped.values()].sort((a, b) => a.role.order - b.role.order).slice(0, clamp(Number(config.architectureMaxNodes) || 24, 6, 60)).map(({ role, facts }) => {
    const files = facts.map((fact) => fact.file);
    return {
      id: "component-" + role.id,
      name: friendlyComponentName(role, files),
      layerId: "layer-" + role.id,
      type: role.kind,
      responsibility: role.name + "\uFF1A" + (facts.flatMap((fact) => fact.symbols).slice(0, 5).map((item) => item.name).join("\u3001") || "\u627F\u8F7D\u76F8\u5173\u9879\u76EE\u80FD\u529B"),
      details: "\u7531 " + files.length + " \u4E2A\u5173\u952E\u6E90\u7801\u6587\u4EF6\u5F52\u7EB3\uFF1B\u76EE\u5F55\u53EA\u4F5C\u4E3A\u5206\u6790\u8BC1\u636E\u3002",
      technologies: [...new Set(facts.map((fact) => fact.language))].filter((item) => item !== "other"),
      importantFiles: files.slice(0, 6),
      evidencePaths: files.slice(0, 12),
      confidence: 0.62
    };
  });
  if (!components.length) components.push({ id: "component-project", name: "\u9879\u76EE\u4E3B\u4F53", layerId: "layer-domain", type: "domain", responsibility: "\u9879\u76EE\u6838\u5FC3\u80FD\u529B", details: "\u672A\u68C0\u6D4B\u5230\u53EF\u5206\u6790\u6E90\u7801\u3002", technologies: [], importantFiles: [], evidencePaths: [], confidence: 0.35 });
  const componentIds = new Set(components.map((item) => item.id));
  const layers = ROLES.filter((role) => componentIds.has("component-" + role.id)).map((role) => ({ id: "layer-" + role.id, name: role.name, responsibility: role.name, order: role.order }));
  if (!layers.length) layers.push({ id: "layer-domain", name: "\u6838\u5FC3\u9886\u57DF\u5C42", responsibility: "\u9879\u76EE\u6838\u5FC3\u80FD\u529B", order: 0 });
  const relationships = [];
  for (let i = 0; i < components.length - 1; i++) relationships.push({ id: "relation-local-" + (i + 1), from: components[i].id, to: components[i + 1].id, label: "\u8C03\u7528/\u534F\u4F5C", type: "uses", description: "\u4F9D\u636E\u5E38\u89C1\u5206\u5C42\u65B9\u5411\u63A8\u65AD\uFF0C\u9700\u7ED3\u5408\u4EE3\u7801\u9A8C\u8BC1", confidence: 0.42 });
  const keyFiles = evidence.sourceFacts.slice(0, 12).map((fact) => ({ path: fact.file, role: fact.symbols.length ? "\u5B9A\u4E49 " + fact.symbols.slice(0, 4).map((item) => item.name).join("\u3001") : "\u5173\u952E\u5B9E\u73B0\u6587\u4EF6", whyImportant: fact.imports.length ? "\u8FDE\u63A5 " + fact.imports.slice(0, 4).join("\u3001") : "\u4F4D\u4E8E\u9879\u76EE\u5165\u53E3\u6216\u6838\u5FC3\u5B9E\u73B0\u8DEF\u5F84", category: roleForFile(fact.file).kind }));
  const fingerprint = hashText(JSON.stringify({ files: evidence.sourceFacts.map((fact) => [fact.file, fact.hash, fact.imports]), manifests: evidence.manifests.map((item) => [item.path, item.hash]), readme: hashText(evidence.readme && evidence.readme.content), techStack: scan.techStack }));
  const changed = !previous || previous.schemaVersion !== 2 || previous.fingerprint !== fingerprint;
  const overview = { purpose: localPurpose(scan), audience: "\u9879\u76EE\u5F00\u53D1\u4E0E\u7EF4\u62A4\u4EBA\u5458", category: Object.values(scan.techStack || {})[0] || "\u8F6F\u4EF6\u9879\u76EE", architectureStyle: layers.length >= 3 ? "\u5206\u5C42\u67B6\u6784\uFF08\u672C\u5730\u63A8\u65AD\uFF09" : "\u6A21\u5757\u5316\u67B6\u6784\uFF08\u672C\u5730\u63A8\u65AD\uFF09", value: "\u5E2E\u52A9\u5F00\u53D1\u8005\u7406\u89E3\u9879\u76EE\u5165\u53E3\u3001\u6838\u5FC3\u80FD\u529B\u548C\u534F\u4F5C\u8FB9\u754C\u3002" };
  const runtimeFlows = components.length >= 2 ? [{ id: "flow-main", name: "\u4E3B\u8981\u6267\u884C\u94FE\u8DEF\uFF08\u672C\u5730\u63A8\u65AD\uFF09", trigger: "\u7528\u6237\u6216\u5BBF\u4E3B\u89E6\u53D1\u9879\u76EE\u80FD\u529B", outcome: "\u6838\u5FC3\u80FD\u529B\u5B8C\u6210\u5E76\u8BFB\u5199\u9879\u76EE\u6570\u636E", steps: components.map((component, index) => ({ componentId: component.id, action: index === 0 ? "\u63A5\u6536\u8BF7\u6C42" : index === components.length - 1 ? "\u5B8C\u6210\u5904\u7406" : "\u5904\u7406\u5E76\u4F20\u9012" })) }] : [];
  return withAliases({
    schemaVersion: 2,
    version: previous && previous.version && changed ? previous.version + 1 : previous && previous.version || 1,
    generatedAt: Date.now(),
    fingerprint,
    changed,
    source: "local",
    project: { name: scan.projectName || "Project", techStack: scan.techStack || {}, entrypoints: scan.entrypoints || [] },
    overview,
    summary: overview.purpose,
    layers,
    components,
    relationships,
    runtimeFlows,
    keyFiles,
    gettingStarted: ["\u5148\u9605\u8BFB README \u4E0E\u9879\u76EE\u6E05\u5355", "\u4ECE\u5165\u53E3\u6587\u4EF6\u8DDF\u8E2A\u4E3B\u8981\u8FD0\u884C\u94FE\u8DEF", "\u7ED3\u5408\u5173\u952E\u6587\u4EF6\u7406\u89E3\u6570\u636E\u4E0E\u5E73\u53F0\u8FB9\u754C"],
    designHighlights: [],
    risks: [],
    evidence: { readmeUsed: Boolean(evidence.readme && evidence.readme.content), manifestFiles: evidence.manifests.map((item) => item.path), sourceFilesAnalyzed: evidence.sourceFacts.length, sourceSnippetsShared: false },
    stats: { files: evidence.allFiles.length, analyzedFiles: evidence.sourceFacts.length, layers: layers.length, modules: components.length, components: components.length, edges: relationships.length, keyFiles: keyFiles.length },
    llm: { requested: false, used: false, provider: null, model: null, error: null }
  });
}
function stripCodeFence(value) {
  return String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
function withoutTrailingCommas(value) {
  const text = String(value || "");
  let out = "";
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      out += char;
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      if (text[next] === "}" || text[next] === "]") continue;
    }
    out += char;
  }
  return out;
}
function balancedJsonObjects(value) {
  const text = String(value || "");
  const out = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') {
        quoted = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          out.push(text.slice(start, index + 1));
          start = index;
          break;
        }
        if (depth < 0) break;
      }
    }
  }
  return out;
}
function parseArchitectureJson(value) {
  const text = String(value || "").trim();
  const candidates = [stripCodeFence(text)];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while (match = fenced.exec(text)) candidates.push(match[1].trim());
  candidates.push(...balancedJsonObjects(text));
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
    }
    try {
      return JSON.parse(withoutTrailingCommas(candidate));
    } catch (e) {
    }
  }
  throw Object.assign(new Error("LLM returned invalid architecture JSON"), {
    code: "ARCHITECTURE_LLM_INVALID_JSON",
    details: { receivedChars: text.length, balancedObjectFound: balancedJsonObjects(text).length > 0 }
  });
}
function strings(value, max, limit) {
  return (Array.isArray(value) ? value : []).map((item) => cleanText(item, limit)).filter(Boolean).slice(0, max);
}
function parseLlmArchitecture(text, base, knownFiles) {
  const parsed = parseArchitectureJson(text);
  const rawLayers = Array.isArray(parsed.layers) ? parsed.layers : [];
  const layers = rawLayers.slice(0, 10).map((item, index) => ({ id: "layer-" + safeId(item.id || item.name || index + 1), name: cleanText(item.name, 80) || "\u67B6\u6784\u5C42 " + (index + 1), responsibility: cleanText(item.responsibility, 500), order: index }));
  if (!layers.length) throw Object.assign(new Error("LLM architecture has no layers"), { code: "ARCHITECTURE_LLM_SCHEMA" });
  const layerByRaw = /* @__PURE__ */ new Map();
  rawLayers.slice(0, 10).forEach((item, index) => [item && item.id, item && item.name, layers[index].id].filter(Boolean).forEach((key) => layerByRaw.set(String(key), layers[index].id)));
  const known = new Set(knownFiles);
  const rawComponents = Array.isArray(parsed.components) ? parsed.components : [];
  const components = rawComponents.slice(0, 18).map((item, index) => {
    const evidencePaths = strings(item.evidencePaths, 12, 240).filter((path2) => known.has(path2));
    const importantFiles = strings(item.importantFiles, 8, 240).filter((path2) => known.has(path2));
    return { id: "component-" + safeId(item.id || item.name || index + 1), name: cleanText(item.name, 100) || "\u6838\u5FC3\u7EC4\u4EF6 " + (index + 1), layerId: layerByRaw.get(String(item.layerId || item.layer || "")) || layers[Math.min(index, layers.length - 1)].id, type: cleanText(item.type, 40) || "component", responsibility: cleanText(item.responsibility, 700), details: cleanText(item.details, 1200), technologies: strings(item.technologies, 10, 80), importantFiles: importantFiles.length ? importantFiles : evidencePaths.slice(0, 5), evidencePaths, confidence: clamp(Number(item.confidence) || 0.78, 0.2, 1) };
  }).filter((item) => item.name && item.responsibility);
  if (components.length < 2) throw Object.assign(new Error("LLM architecture has too few components"), { code: "ARCHITECTURE_LLM_SCHEMA" });
  const componentIds = new Set(components.map((item) => item.id));
  const rawToId = /* @__PURE__ */ new Map();
  rawComponents.slice(0, 18).forEach((item, index) => {
    if (components[index]) [item && item.id, item && item.name, components[index].id].filter(Boolean).forEach((key) => rawToId.set(String(key), components[index].id));
  });
  const relationships = (Array.isArray(parsed.relationships) ? parsed.relationships : []).slice(0, 36).map((item, index) => ({ id: "relation-" + (index + 1), from: rawToId.get(String(item.from || "")), to: rawToId.get(String(item.to || "")), label: cleanText(item.label, 80) || "\u8C03\u7528", type: cleanText(item.type, 40) || "uses", description: cleanText(item.description, 500), confidence: clamp(Number(item.confidence) || 0.75, 0.2, 1) })).filter((item) => componentIds.has(item.from) && componentIds.has(item.to) && item.from !== item.to);
  const runtimeFlows = (Array.isArray(parsed.runtimeFlows) ? parsed.runtimeFlows : []).slice(0, 8).map((flow, index) => ({ id: "flow-" + (index + 1), name: cleanText(flow.name, 100) || "\u8FD0\u884C\u6D41\u7A0B " + (index + 1), trigger: cleanText(flow.trigger, 400), outcome: cleanText(flow.outcome, 400), steps: (Array.isArray(flow.steps) ? flow.steps : []).slice(0, 12).map((step) => ({ componentId: rawToId.get(String(step.componentId || step.component || "")), action: cleanText(step.action, 400), file: known.has(step.file) ? step.file : null })).filter((step) => componentIds.has(step.componentId)) })).filter((flow) => flow.steps.length >= 2);
  const keyFiles = (Array.isArray(parsed.keyFiles) ? parsed.keyFiles : []).slice(0, 16).map((item) => ({ path: cleanText(item.path, 240), role: cleanText(item.role, 300), whyImportant: cleanText(item.whyImportant, 600), category: cleanText(item.category, 50) })).filter((item) => known.has(item.path));
  const overviewInput = parsed.overview || {};
  const result = { ...base, source: "hybrid", overview: { purpose: cleanText(overviewInput.purpose, 1200) || base.overview.purpose, audience: cleanText(overviewInput.audience, 500) || base.overview.audience, category: cleanText(overviewInput.category, 160) || base.overview.category, architectureStyle: cleanText(overviewInput.architectureStyle, 300) || base.overview.architectureStyle, value: cleanText(overviewInput.value, 800) || base.overview.value }, summary: cleanText(parsed.summary, 1600) || cleanText(overviewInput.purpose, 1200) || base.summary, layers, components, relationships, runtimeFlows, keyFiles: keyFiles.length ? keyFiles : base.keyFiles, gettingStarted: strings(parsed.gettingStarted, 8, 600), designHighlights: strings(parsed.designHighlights, 10, 600), risks: strings(parsed.risks, 10, 600) };
  result.stats = { ...base.stats, layers: layers.length, modules: components.length, components: components.length, edges: relationships.length, keyFiles: result.keyFiles.length };
  return withAliases(result);
}
function llmPrompt(base, evidence, includeSource) {
  const payload = { project: base.project, localOverview: base.overview, readme: evidence.readme ? { path: evidence.readme.path, content: evidence.readme.content } : null, manifests: evidence.manifests.slice(0, 8).map((item) => ({ path: item.path, content: item.content })), sourceFacts: evidence.sourceFacts.slice(0, 24).map((fact) => ({ path: fact.file, language: fact.language, imports: fact.imports, symbols: fact.symbols, ...includeSource ? { excerpt: fact.excerpt } : {} })), entrypoints: base.project.entrypoints, techStack: base.project.techStack };
  return [
    "\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u8F6F\u4EF6\u67B6\u6784\u5E08\u3002\u76EE\u6807\u662F\u8BA9\u7B2C\u4E00\u6B21\u63A5\u89E6\u4ED3\u5E93\u7684\u5F00\u53D1\u8005\u5728\u51E0\u5206\u949F\u5185\u7406\u89E3\u7CFB\u7EDF\u8BBE\u8BA1\uFF0C\u800C\u4E0D\u662F\u590D\u8FF0\u76EE\u5F55\u6811\u3002",
    "\u56DE\u7B54\u9879\u76EE\u505A\u4EC0\u4E48\u3001\u670D\u52A1\u8C01\u3001\u91C7\u7528\u4EC0\u4E48\u67B6\u6784\u98CE\u683C\u3001\u6709\u54EA\u4E9B\u6982\u5FF5\u5C42\u548C\u6838\u5FC3\u7EC4\u4EF6\u3001\u7EC4\u4EF6\u5982\u4F55\u534F\u4F5C\u3001\u4E3B\u8981\u8FD0\u884C\u6D41\u7A0B\u3001\u5173\u952E\u6587\u4EF6\u3001\u8BBE\u8BA1\u4EAE\u70B9\u4E0E\u98CE\u9669\u3002",
    "\u89C4\u5219\uFF1A\u7EC4\u4EF6\u5FC5\u987B\u662F\u6709\u804C\u8D23\u7684\u6982\u5FF5\u7EC4\u4EF6\uFF0C\u7981\u6B62\u628A src\u3001packages/foo\u3001scripts \u7B49\u76EE\u5F55\u540D\u76F4\u63A5\u5F53\u7EC4\u4EF6\u540D\uFF1B\u8DEF\u5F84\u53EA\u80FD\u4F5C\u4E3A evidencePaths/importantFiles/keyFiles \u8BC1\u636E\u3002\u5FFD\u7565 vendor\u3001\u5907\u4EFD\u3001\u751F\u6210\u7269\u548C\u6D4B\u8BD5\u5939\u5177\u5E72\u6270\u3002\u53EA\u9648\u8FF0\u8BC1\u636E\u652F\u6301\u7684\u5185\u5BB9\u3002\u8F93\u51FA\u4E2D\u6587\u4E25\u683C JSON\uFF0C\u4E0D\u8981 Markdown/HTML/Mermaid\u3002",
    "JSON \u683C\u5F0F\uFF1A" + JSON.stringify({ overview: { purpose: "\u9879\u76EE\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898", audience: "\u4F7F\u7528\u8005", category: "\u9879\u76EE\u7C7B\u578B", architectureStyle: "\u67B6\u6784\u98CE\u683C", value: "\u6838\u5FC3\u4EF7\u503C" }, summary: "\u6574\u4F53\u67B6\u6784\u8BF4\u660E", layers: [{ id: "interface", name: "\u63A5\u53E3\u5C42", responsibility: "\u5C42\u804C\u8D23" }], components: [{ id: "runtime-bridge", name: "\u8FD0\u884C\u65F6\u6865\u63A5", layerId: "interface", type: "service", responsibility: "\u804C\u8D23", details: "\u8FB9\u754C\u4E0E\u534F\u4F5C", technologies: ["\u6280\u672F"], importantFiles: ["\u771F\u5B9E\u76F8\u5BF9\u8DEF\u5F84"], evidencePaths: ["\u771F\u5B9E\u76F8\u5BF9\u8DEF\u5F84"], confidence: 0.85 }], relationships: [{ from: "runtime-bridge", to: "memory-store", label: "\u8BFB\u5199", type: "data-flow", description: "\u5173\u7CFB", confidence: 0.8 }], runtimeFlows: [{ name: "\u521D\u59CB\u5316\u6D41\u7A0B", trigger: "\u89E6\u53D1\u6761\u4EF6", outcome: "\u7ED3\u679C", steps: [{ componentId: "runtime-bridge", action: "\u52A8\u4F5C", file: "\u53EF\u9009\u771F\u5B9E\u8DEF\u5F84" }] }], keyFiles: [{ path: "\u771F\u5B9E\u76F8\u5BF9\u8DEF\u5F84", role: "\u6587\u4EF6\u89D2\u8272", whyImportant: "\u4E3A\u4EC0\u4E48\u5148\u8BFB", category: "entry|core|data|integration|config" }], gettingStarted: ["\u9605\u8BFB/\u8C03\u8BD5\u987A\u5E8F"], designHighlights: ["\u8BBE\u8BA1\u4EAE\u70B9"], risks: ["\u98CE\u9669\u6216\u4E0D\u786E\u5B9A\u9879"] }),
    "\u9879\u76EE\u8BC1\u636E\uFF1A" + JSON.stringify(payload)
  ].join("\n");
}
function repairArchitecturePrompt(value) {
  return [
    "\u4E0B\u9762\u662F\u4E00\u6B21\u8F6F\u4EF6\u67B6\u6784\u5206\u6790\u7684\u6A21\u578B\u8F93\u51FA\uFF0C\u4F46\u5B83\u4E0D\u662F\u53EF\u89E3\u6790\u7684\u4E25\u683C JSON\u3002",
    "\u8BF7\u53EA\u4FEE\u590D JSON \u8BED\u6CD5\u548C\u7F3A\u5931\u7684\u95ED\u5408\u7ED3\u6784\uFF0C\u4FDD\u7559\u5DF2\u6709\u4E8B\u5B9E\u4E0E\u76F8\u5BF9\u6587\u4EF6\u8DEF\u5F84\uFF1B\u4E0D\u8981\u6DFB\u52A0\u89E3\u91CA\u3001Markdown \u6216\u4EE3\u7801\u56F4\u680F\u3002",
    "\u6700\u7EC8\u53EA\u80FD\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u5E76\u786E\u4FDD\u81F3\u5C11\u5305\u542B\u975E\u7A7A layers \u548C\u81F3\u5C11\u4E24\u4E2A components\u3002",
    "\u5F85\u4FEE\u590D\u8F93\u51FA\uFF1A",
    cleanText(value, 24e3)
  ].join("\n");
}
async function streamText(llm, route, prompt, sessionId, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("architecture LLM timeout")), timeoutMs || 6e4);
  const chunks = /* @__PURE__ */ new Map();
  const completed = /* @__PURE__ */ new Map();
  try {
    const request = { provider: route.provider, model: route.model, system: options.system || "Produce an evidence-based conceptual software architecture as strict JSON only.", messages: [{ role: "user", content: [{ type: "text", text: prompt }], source: { kind: "plugin", plugin: "dsh-project-brain" } }], maxTokens: options.maxTokens || 6200, purpose: options.purpose || "project-architecture", ...sessionId ? { sessionId } : {}, signal: controller.signal };
    for await (const chunk of llm.stream(request)) {
      if (!chunk) continue;
      if (chunk.type === "text-delta") chunks.set(chunk.index, (chunks.get(chunk.index) || "") + String(chunk.text || ""));
      else if (chunk.type === "block-end" && chunk.block && chunk.block.type === "text") completed.set(chunk.index, String(chunk.block.text || ""));
      else if (chunk.type === "finish" && chunk.reason && chunk.reason.kind && chunk.reason.kind !== "stop") throw Object.assign(new Error("architecture LLM finished with " + chunk.reason.kind), { code: "ARCHITECTURE_LLM_FINISH" });
    }
    const indexes = [.../* @__PURE__ */ new Set([...chunks.keys(), ...completed.keys()])].sort((a, b) => a - b);
    const text = indexes.map((index) => chunks.get(index) || completed.get(index) || "").join("").trim();
    if (!text) throw Object.assign(new Error("architecture LLM returned no text"), { code: "ARCHITECTURE_LLM_EMPTY" });
    return text;
  } finally {
    clearTimeout(timer);
  }
}
async function collectEvidence(fs, projectPath, scan, config) {
  const allFiles = (scan.files || []).filter((file) => !isGeneratedOrVendor(file));
  const readmePath = allFiles.find((file) => README_NAMES.test(file.split("/").pop()));
  const readme = readmePath ? { path: readmePath, content: cleanText(await readProjectFile(fs, projectPath, readmePath), 9e3) } : null;
  const manifests = [];
  for (const path2 of allFiles.filter((file) => MANIFEST_NAMES.test(file.split("/").pop())).slice(0, 12)) {
    const content = cleanText(await readProjectFile(fs, projectPath, path2), 6e3);
    manifests.push({ path: path2, content, hash: hashText(content) });
  }
  const sourceFiles = allFiles.filter((file) => SOURCE_EXTENSIONS.test(file)).sort((a, b) => evidencePriority(b, scan) - evidencePriority(a, scan) || a.localeCompare(b)).slice(0, clamp(Number(config.architectureMaxFiles) || 240, 20, 1e3));
  const sourceFacts = [];
  let totalBytes = 0;
  for (const file of sourceFiles) {
    if (totalBytes >= 12e5) break;
    const text = (await readProjectFile(fs, projectPath, file)).slice(0, 1e5);
    totalBytes += text.length;
    const language = languageOf(file);
    sourceFacts.push({ file, language, imports: extractImports(text, language), symbols: extractSymbols(text, language), excerpt: sourceExcerpt(text), hash: hashText(text) });
  }
  return { allFiles, readme, manifests, sourceFacts };
}
function resolveSessionRoute(session) {
  try {
    const context = session && typeof session.requestContext === "function" ? session.requestContext() : null;
    if (context && context.provider && context.model) return { provider: context.provider, model: context.model };
  } catch (e) {
  }
  try {
    const header = session && typeof session.requestHeader === "function" ? session.requestHeader() : null;
    const config = header && header.config;
    if (config && config.provider && config.model) return { provider: config.provider, model: config.model };
  } catch (e) {
  }
  try {
    const events = session && Array.isArray(session.events) ? session.events : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index] || {};
      if (event.type === "request/context") {
        const data = event.data || {};
        if (data.provider && data.model) return { provider: data.provider, model: data.model };
      }
      if (event.type === "request/header") {
        const data = event.data || {};
        const eventConfig = data.header && data.header.config || data.config;
        if (eventConfig && eventConfig.provider && eventConfig.model) {
          return { provider: eventConfig.provider, model: eventConfig.model };
        }
      }
    }
  } catch (e) {
  }
  return null;
}
function createLlmRuntime(ctx, initialService = null) {
  let service = initialService && typeof initialService.stream === "function" ? initialService : null;
  if (!service && ctx) {
    try {
      const current = ctx.get ? ctx.get("llm") : ctx.llm;
      if (current && typeof current.stream === "function") service = current;
    } catch (e) {
    }
  }
  return { get: () => service };
}
async function buildArchitecture({ fs, projectPath, scan, previous, config = {}, llm, route, getRoute, sessionId } = {}) {
  const evidence = await collectEvidence(fs, projectPath, scan, config);
  const local = buildLocalArchitecture(scan, evidence, previous, config);
  const requested = config.architectureLlmEnabled !== false;
  const includeSource = config.architectureLlmIncludeSource !== false;
  local.llm.requested = requested;
  if (!requested) return local;
  if (!local.changed && previous && previous.schemaVersion === 2 && previous.llm && previous.llm.used) return { ...previous, generatedAt: Date.now(), changed: false };
  if (!llm || typeof llm.stream !== "function") {
    local.llm.error = {
      code: "ARCHITECTURE_LLM_SERVICE_UNAVAILABLE",
      message: "DSH \u672A\u5411\u63D2\u4EF6\u63D0\u4F9B LLM \u670D\u52A1\uFF0C\u5DF2\u751F\u6210\u672C\u5730\u6982\u5FF5\u67B6\u6784",
      details: { serviceAvailable: false, routeAvailable: Boolean(route) }
    };
    return local;
  }
  if (!route && typeof getRoute === "function") {
    try {
      route = getRoute();
    } catch (e) {
      route = null;
    }
  }
  if (!route) {
    local.llm.error = {
      code: "ARCHITECTURE_LLM_SESSION_ROUTE_UNAVAILABLE",
      message: "\u5F53\u524D Session \u5C1A\u672A\u4EA7\u751F\u53EF\u590D\u7528\u7684\u6A21\u578B\u8DEF\u7531\uFF0C\u8BF7\u5148\u5B8C\u6210\u4E00\u6B21\u5BF9\u8BDD\u540E\u91CD\u8BD5",
      details: { serviceAvailable: true, routeAvailable: false, sessionId: sessionId || null }
    };
    return local;
  }
  local.llm.provider = route.provider;
  local.llm.model = route.model;
  try {
    const text = await streamText(llm, route, llmPrompt(local, evidence, includeSource), sessionId, config.architectureLlmTimeoutMs || 6e4);
    let enriched;
    let repaired = false;
    try {
      enriched = parseLlmArchitecture(text, local, evidence.allFiles);
    } catch (firstError) {
      if (firstError.code !== "ARCHITECTURE_LLM_INVALID_JSON" && firstError.code !== "ARCHITECTURE_LLM_SCHEMA") throw firstError;
      const repairedText = await streamText(
        llm,
        route,
        repairArchitecturePrompt(text),
        sessionId,
        Math.min(config.architectureLlmTimeoutMs || 6e4, 45e3),
        { purpose: "project-architecture-json-repair", maxTokens: 6200, system: "Repair the supplied architecture output into one strict JSON object. Output JSON only." }
      );
      enriched = parseLlmArchitecture(repairedText, local, evidence.allFiles);
      repaired = true;
    }
    enriched.llm = { requested: true, used: true, provider: route.provider, model: route.model, attempts: repaired ? 2 : 1, repaired, error: null };
    enriched.evidence = { ...local.evidence, sourceSnippetsShared: includeSource };
    return enriched;
  } catch (error) {
    local.llm.error = { code: error.code || "ARCHITECTURE_LLM_FAILED", message: String(error.message || error) };
    return local;
  }
}
function architectureRelevantFiles(files) {
  return (files || []).some((file) => !isGeneratedOrVendor(file) && (SOURCE_EXTENSIONS.test(file) || MANIFEST_NAMES.test(String(file).split("/").pop()) || README_NAMES.test(String(file).split("/").pop())));
}

// src/tools.js
function emitPreviewChanged(exec, projectPath) {
  try {
    const executor = exec && exec.ctx || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {
  }
}
function resolveWritePolicy2(sandboxPolicy) {
  if (!sandboxPolicy) return null;
  try {
    if (typeof sandboxPolicy.resolve === "function") {
      return sandboxPolicy.resolve({ mode: "danger-full-access" });
    }
  } catch (e) {
  }
  return sandboxPolicy;
}
async function scanAndWrite(fs, sandboxPolicy, args, toolLabel, runtime = {}) {
  const startMs = Date.now();
  const explicit = args && typeof args.path === "string" && args.path.trim() ? args.path.trim() : null;
  if (!explicit) {
    return {
      ok: false,
      data: {
        error: { code: "E_NO_PATH", message: "path \u53C2\u6570\u5FC5\u4F20\uFF08\u4E0D\u4F20\u4F1A\u626B\u5230 DSH Desktop \u5B89\u88C5\u76EE\u5F55\uFF09" },
        scanDurationMs: Date.now() - startMs
      }
    };
  }
  const projectPath = explicit;
  const dryRun = Boolean(args && args.dryRun);
  let scan;
  try {
    scan = await scanProject(fs, projectPath);
  } catch (e) {
    return {
      ok: false,
      data: {
        error: { code: "E_SCAN_FAILED", message: String(e && e.message || e) },
        scanDurationMs: Date.now() - startMs
      }
    };
  }
  let existing;
  try {
    existing = await readJson(fs, brainPath(projectPath, "project.json"));
  } catch (e) {
    existing = null;
  }
  const isRescan = Boolean(existing && existing.id);
  let previousArchitecture = null;
  try {
    previousArchitecture = await readJson(fs, brainPath(projectPath, "architecture.json"));
  } catch (e) {
  }
  const architectureConfig = runtime.getMemoryConfig ? runtime.getMemoryConfig() : {};
  let architecture = null;
  if (architectureConfig.architectureEnabled !== false) {
    try {
      architecture = await buildArchitecture({
        fs,
        projectPath,
        scan,
        previous: previousArchitecture && !previousArchitecture.__error ? previousArchitecture : null,
        config: architectureConfig,
        llm: runtime.getLlm ? runtime.getLlm() : null,
        route: runtime.llmRoute || null,
        getRoute: runtime.getLlmRoute || null,
        sessionId: runtime.sessionId || null
      });
    } catch (e) {
      architecture = { error: { code: e.code || "ARCHITECTURE_FAILED", message: String(e && e.message || e) } };
    }
  }
  const now = Date.now();
  const projectName = scan.projectName || projectPath.split(/[\\/]/).filter(Boolean).pop() || "untitled";
  const existingDescription = sanitizeProjectDescription(existing && existing.description);
  const scannedDescription = sanitizeProjectDescription(scan.description);
  const projectData = {
    id: isRescan ? existing.id : makeId("brain", now),
    name: projectName,
    rootPath: projectPath,
    description: existingDescription && existingDescription !== "Auto-generated by dsh-project-brain" ? existingDescription : scannedDescription || "Auto-generated by dsh-project-brain",
    techStack: scan.techStack,
    languages: scan.languages,
    tooling: scan.tooling || [],
    size: { files: scan.fileCount },
    entrypoints: scan.entrypoints,
    topLevel: scan.topLevel,
    directoryMap: existing && existing.directoryMap || [],
    createdAt: isRescan ? existing.createdAt : now,
    updatedAt: now,
    lastScannedAt: now
  };
  if (!dryRun) {
    const writePolicy = resolveWritePolicy2(sandboxPolicy);
    const wroteProject = await writeJson(fs, brainPath(projectPath, "project.json"), projectData, writePolicy);
    if (!wroteProject) {
      return {
        ok: false,
        data: {
          error: { code: "E_WRITE_FAILED", message: "failed to write " + brainPath(projectPath, "project.json") + "\uFF08\u53EF\u80FD\u662F sandbox \u62D2\u7EDD\uFF09" },
          scanDurationMs: Date.now() - startMs
        }
      };
    }
    if (architecture && !architecture.error) {
      const wroteArchitecture = await writeJson(fs, brainPath(projectPath, "architecture.json"), architecture, writePolicy);
      if (!wroteArchitecture) {
        architecture = { error: { code: "ARCHITECTURE_WRITE_FAILED", message: "\u67B6\u6784\u6570\u636E\u5199\u5165\u5931\u8D25\uFF0C\u9879\u76EE\u57FA\u7840\u626B\u63CF\u4ECD\u5DF2\u5B8C\u6210" } };
      }
    }
    try {
      await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
        id: makeId("evt", now),
        title: isRescan ? "\u5B8C\u6210\u91CD\u626B\uFF08" + toolLabel + "\uFF09" : "\u5B8C\u6210 project_init \u626B\u63CF",
        eventType: isRescan ? "rescan" : "init",
        occurredAt: now,
        detail: "languages=" + (Object.keys(scan.languages).join("/") || "none") + " files=" + scan.fileCount + (architecture && !architecture.error ? " modules=" + architecture.stats.modules + " edges=" + architecture.stats.edges + " architecture=" + architecture.source : "")
      }, writePolicy);
    } catch (e) {
    }
  }
  return {
    ok: true,
    data: {
      projectId: projectData.id,
      name: projectName,
      isRescan,
      createdAtPreserved: isRescan,
      scanDurationMs: Date.now() - startMs,
      stats: {
        files: scan.fileCount,
        languages: scan.languages,
        techStack: scan.techStack,
        tooling: scan.tooling || [],
        entrypoints: scan.entrypoints,
        topLevel: scan.topLevel
      },
      partial: Boolean(architecture && architecture.error),
      architecture: architecture && !architecture.error ? {
        generated: true,
        changed: architecture.changed,
        version: architecture.version,
        source: architecture.source,
        modules: architecture.stats.modules,
        edges: architecture.stats.edges,
        llm: architecture.llm
      } : {
        generated: false,
        error: architecture && architecture.error ? architecture.error : null
      },
      dryRun
    }
  };
}
var baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
    code: { type: "string" },
    message: { type: "string" }
  }
};
var pathParam = { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4\u4ECE\u5F53\u524D DSH Session \u7684 workspace \u81EA\u52A8\u89E3\u6790\uFF09" };
var dryRunParam = { type: "boolean", description: "\u4EC5\u9884\u89C8\uFF0C\u4E0D\u5199\u6587\u4EF6\uFF08\u9ED8\u8BA4 false\uFF09" };
function executionRoute(exec) {
  if (!exec) return null;
  return resolveSessionRoute(exec.session) || resolveSessionRoute(exec.currentSession) || resolveSessionRoute(exec.agent && exec.agent.session) || resolveSessionRoute(exec.agent) || resolveSessionRoute(exec.ctx && exec.ctx.session);
}
function executionSessionId(exec) {
  return exec && (exec.sessionId || exec.session && exec.session.id || exec.agent && exec.agent.sessionId || exec.agent && exec.agent.session && exec.agent.session.id) || null;
}
function buildInitTool({ fs, sandboxPolicy, getMemoryConfig, getLlm }) {
  return defineTool({
    name: "project_init",
    description: "dsh-project-brain: \u626B\u63CF\u76EE\u6807\u9879\u76EE\u3001\u8BC6\u522B\u6280\u672F\u6808\u3001\u751F\u6210 .project-brain/project.json\uFF08\u542B timeline init \u4E8B\u4EF6\uFF09\u3002\u9996\u6B21\u8BBF\u95EE\u65B0\u9879\u76EE\u65F6\u8C03\u7528\u4E00\u6B21\uFF1B\u91CD\u590D\u8C03\u7528\u5B89\u5168\uFF08\u4FDD\u7559 projectId/createdAt\uFF09\uFF1B\u589E\u91CF\u66F4\u65B0\u7528 project_rescan\u3002\u9ED8\u8BA4\u81EA\u52A8\u4F7F\u7528\u5F53\u524D DSH Session \u7684 workspace\uFF1B\u4EC5 CLI/\u65E7\u5BBF\u4E3B\u9700\u8981\u663E\u5F0F\u4F20 path\u3002",
    parameters: { path: pathParam, dryRun: dryRunParam },
    // 关键修复（P0.4.3）：render 必须嵌套在 output 里（dsh-tools 0.1.0-rc.x 期望
    // options.output.render）。之前误把 render 放 top-level，导致 userRender 变 undefined，
    // 框架调用时抛 "userRender is not a function"。
    output: { schema: baseOutputSchema, render: (_args, value) => renderProjectTool(value, "project init") },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, data: { error: { code: "E_NO_PATH", message: "\u65E0\u6CD5\u4ECE\u5F53\u524D Session \u89E3\u6790 workspace \u8DEF\u5F84" } } };
        }
        const resolvedArgs = Object.assign({}, args || {}, { path: projectPath });
        const result = await scanAndWrite(fs, sandboxPolicy, resolvedArgs, "project_init", {
          getMemoryConfig,
          getLlm,
          llmRoute: executionRoute(exec),
          getLlmRoute: () => executionRoute(exec),
          sessionId: executionSessionId(exec)
        });
        if (result.ok && !(args && args.dryRun)) {
          emitPreviewChanged(exec, projectPath);
        }
        return result;
      } catch (e) {
        return {
          ok: false,
          data: { error: { code: "E_SCAN_FAILED", message: String(e && e.message || e) } }
        };
      }
    }
  });
}
function buildRescanTool({ fs, sandboxPolicy, getMemoryConfig, getLlm }) {
  return defineTool({
    name: "project_rescan",
    description: "dsh-project-brain: \u91CD\u626B\u5DF2\u6709 .project-brain \u7684\u9879\u76EE\u5E76\u589E\u91CF\u5237\u65B0 project.json\uFF08\u4FDD\u7559 projectId/createdAt/\u8BB0\u5FC6/\u5F85\u529E\uFF0C\u53EA\u66F4\u65B0\u6280\u672F\u6808/\u5165\u53E3/\u8BED\u8A00\u7EDF\u8BA1\uFF09\uFF0C\u8FFD\u52A0 timeline rescan \u4E8B\u4EF6\u3002\u9879\u76EE\u7ED3\u6784\u53D8\u5316\u540E\u8C03\u7528\uFF1B\u9ED8\u8BA4\u81EA\u52A8\u4F7F\u7528\u5F53\u524D DSH Session \u7684 workspace\u3002",
    parameters: { path: pathParam, dryRun: dryRunParam },
    output: { schema: baseOutputSchema, render: (_args, value) => renderProjectTool(value, "rescan") },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, data: { error: { code: "E_NO_PATH", message: "\u65E0\u6CD5\u4ECE\u5F53\u524D Session \u89E3\u6790 workspace \u8DEF\u5F84" } } };
        }
        const resolvedArgs = Object.assign({}, args || {}, { path: projectPath });
        const result = await scanAndWrite(fs, sandboxPolicy, resolvedArgs, "project_rescan", {
          getMemoryConfig,
          getLlm,
          llmRoute: executionRoute(exec),
          getLlmRoute: () => executionRoute(exec),
          sessionId: executionSessionId(exec)
        });
        if (result.ok && !(args && args.dryRun)) {
          emitPreviewChanged(exec, projectPath);
        }
        return result;
      } catch (e) {
        return {
          ok: false,
          data: { error: { code: "E_SCAN_FAILED", message: String(e && e.message || e) } }
        };
      }
    }
  });
}
function renderProjectTool(value, toolLabel) {
  if (!value || typeof value !== "object") {
    return [{ type: "text", text: `dsh-project-brain: ${toolLabel} FAILED - non-object result: ` + String(value) }];
  }
  if (value.ok) {
    const d = value.data || {};
    if (d.error) {
      return [{ type: "text", text: `dsh-project-brain: ${toolLabel} FAILED - ${d.error.code}: ${d.error.message}` }];
    }
    return [
      { type: "text", text: `dsh-project-brain: ${toolLabel} OK` },
      { type: "text", text: `  projectId: ${d.projectId}` },
      { type: "text", text: `  name: ${d.name}` },
      { type: "text", text: `  isRescan: ${d.isRescan}\uFF08id/createdAt \u5DF2\u4FDD\u7559\uFF09` },
      { type: "text", text: `  scanDurationMs: ${d.scanDurationMs}` },
      { type: "text", text: `  stats: ${JSON.stringify(d.stats)}` },
      { type: "text", text: `  architecture: ${JSON.stringify(d.architecture || {})}` },
      ...d.dryRun ? [{ type: "text", text: "  (dry run)" }] : []
    ];
  }
  if (value.data && value.data.error) {
    return [{ type: "text", text: `dsh-project-brain: ${toolLabel} FAILED - ${value.data.error.code}: ${value.data.error.message}` }];
  }
  return [{ type: "text", text: `dsh-project-brain: ${toolLabel} FAILED - ` + JSON.stringify(value) }];
}
function buildProjectInitTool(opts) {
  return buildInitTool(opts);
}
function buildProjectRescanTool(opts) {
  return buildRescanTool(opts);
}

// src/tools/memory.js
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";
function emitPreviewChanged2(exec, projectPath) {
  try {
    const executor = exec && exec.ctx || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {
  }
}
function buildMemoryAddTool({ fs, sandboxPolicy }) {
  return defineTool2({
    name: "project_memory_add",
    description: "dsh-project-brain: \u4E3A\u5F53\u524D\u9879\u76EE\u5199\u5165\u4E00\u6761\u7ED3\u6784\u5316\u9879\u76EE\u8BB0\u5FC6\uFF08" + MEMORY_TYPES.join("/") + "\uFF09\u3002\u5728\u505A\u51FA\u91CD\u8981\u51B3\u7B56\u3001\u53D1\u73B0 bug/\u8E29\u5751\u3001\u67B6\u6784\u53D8\u5316\u3001\u9700\u6C42\u53D8\u66F4\u540E\u8C03\u7528\uFF1B importance 0~1\uFF08\u8D8A\u9AD8\u8D8A\u5BB9\u6613\u5728 continue \u65F6\u53EC\u56DE\uFF09\u3002",
    parameters: {
      type: { type: "string", description: "\u8BB0\u5FC6\u7C7B\u578B\uFF0C\u679A\u4E3E\uFF1A" + MEMORY_TYPES.join(" | ") },
      title: { type: "string", description: "\u6807\u9898\uFF08\u4E00\u53E5\u8BDD\uFF0C<=200 \u5B57\u7B26\uFF09" },
      content: { type: "string", description: "\u6B63\u6587\uFF1Awhat + why\uFF08\u51B3\u7B56\u9700\u542B\u7406\u7531\u4E0E\u88AB\u5426\u65B9\u6848\uFF09" },
      importance: { type: "number", description: "\u91CD\u8981\u6027 0~1\uFF0C\u9ED8\u8BA4 0.5" },
      confidence: { type: "number", description: "\u53EF\u4FE1\u5EA6 0~1\uFF0C\u9ED8\u8BA4 0.7" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "\u76F8\u5173\u6587\u4EF6\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09" },
      tags: { type: "array", items: { type: "string" }, description: "\u6807\u7B7E\uFF08\u53EF\u9009\uFF09" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          return [{ type: "text", text: `dsh-project-brain: memory added [${d.type}] ${d.title} (${d.id})` }];
        }
        return [{ type: "text", text: `dsh-project-brain: memory add FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const type = normalizeMemoryType(args && args.type);
        if (!type) {
          return { ok: false, code: "E_INVALID_TYPE", message: "type \u5FC5\u987B\u662F " + MEMORY_TYPES.join("/") + " \u4E4B\u4E00" };
        }
        if (!args || !args.title || !String(args.title).trim()) {
          return { ok: false, code: "E_NO_TITLE", message: "title \u5FC5\u586B" };
        }
        const now = Date.now();
        const sessionId = exec && (exec.sessionId || exec.session && exec.session.id);
        const entry = makeMemoryEntry({
          type,
          title: args.title,
          content: args.content,
          importance: args.importance,
          confidence: args.confidence,
          relatedFiles: args.relatedFiles,
          tags: args.tags,
          source: { kind: "agent", ...sessionId ? { sessionId: String(sessionId) } : {} }
        }, now);
        const wrote = await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry);
        if (!wrote) {
          return { ok: false, code: "E_WRITE_FAILED", message: "failed to write memory.jsonl" };
        }
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "\u65B0\u589E\u8BB0\u5FC6[" + type + "]\uFF1A" + entry.title,
          eventType: "memory",
          occurredAt: now
        });
        emitPreviewChanged2(exec, projectPath);
        return { ok: true, data: { id: entry.id, type: entry.type, title: entry.title, importance: entry.importance, confidence: entry.confidence } };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_ADD_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}
function buildMemoryListTool({ fs, sandboxPolicy }) {
  return defineTool2({
    name: "project_memory_list",
    description: "dsh-project-brain: \u8BFB\u53D6\u5F53\u524D\u9879\u76EE\u7684\u9879\u76EE\u8BB0\u5FC6\uFF0C\u6309\u91CD\u8981\u5EA6\u6392\u5E8F\u8FD4\u56DE\uFF08\u53EF\u6309 type \u8FC7\u6EE4\uFF09\u3002\u56DE\u7B54\u201C\u4E3A\u4EC0\u4E48\u8FD9\u4E48\u8BBE\u8BA1/\u4E4B\u524D\u8E29\u8FC7\u4EC0\u4E48\u5751\u201D\u7C7B\u95EE\u9898\u524D\u5148\u8C03\u7528\u3002",
    parameters: {
      type: { type: "string", description: "\u53EA\u770B\u8BE5\u7C7B\u578B\uFF08\u53EF\u9009\uFF09\uFF1A" + MEMORY_TYPES.join(" | ") },
      limit: { type: "number", description: "\u8FD4\u56DE\u6761\u6570\u4E0A\u9650\uFF0C\u9ED8\u8BA4 10" },
      includeArchived: { type: "boolean", description: "\u662F\u5426\u5305\u542B archived/superseded \u8BB0\u5FC6\uFF0C\u9ED8\u8BA4 false" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          const lines = [{ type: "text", text: `dsh-project-brain: ${d.total} memories (${d.shown} shown)` }];
          for (const m of d.memories || []) {
            lines.push({ type: "text", text: `  [${m.type}] ${m.title} (imp=${m.importance})` });
          }
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: memory list FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        const visible = args && args.includeArchived ? memories : memories.filter(isActiveMemory);
        const filtered = normalizeMemoryType(args && args.type) ? visible.filter((m) => m.type === normalizeMemoryType(args.type)) : visible;
        const limit = Math.max(1, Math.min(50, Number(args && args.limit || 10)));
        const sorted = topMemories(filtered, limit);
        return {
          ok: true,
          data: {
            total: filtered.length,
            shown: sorted.length,
            memories: sorted.map((m) => ({
              id: m.id,
              type: m.type,
              title: m.title,
              content: String(m.content || "").slice(0, 300),
              importance: m.importance,
              createdAt: m.createdAt
            }))
          }
        };
      } catch (e) {
        return { ok: false, code: "E_MEMORY_LIST_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}

// src/tools/todo.js
import { defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";
function emitPreviewChanged3(exec, projectPath) {
  try {
    const executor = exec && exec.ctx || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {
  }
}
function buildTodoAddTool({ fs, sandboxPolicy }) {
  return defineTool3({
    name: "project_todo_add",
    description: "dsh-project-brain: \u4E3A\u5F53\u524D\u9879\u76EE\u6DFB\u52A0\u4E00\u6761\u5F00\u53D1\u5F85\u529E\uFF08\u5199\u5165 .project-brain/todo.jsonl\uFF09\u3002\u89C4\u5212\u51FA\u4E0B\u4E00\u6B65\u4EFB\u52A1\u3001\u6216\u7528\u6237\u63D0\u51FA\u65B0\u9700\u6C42\u65F6\u8C03\u7528\uFF1B\u5B8C\u6210\u65F6\u7528 project_todo_done \u5173\u95ED\u3002",
    parameters: {
      title: { type: "string", description: "\u5F85\u529E\u6807\u9898\uFF08\u4E00\u53E5\u8BDD\uFF09" },
      description: { type: "string", description: "\u8BE6\u60C5\uFF08\u53EF\u9009\uFF09" },
      priority: { type: "string", description: "\u4F18\u5148\u7EA7\uFF1Aurgent | high | medium\uFF08\u9ED8\u8BA4\uFF09 | low" },
      relatedFiles: { type: "array", items: { type: "string" }, description: "\u76F8\u5173\u6587\u4EF6\uFF08\u53EF\u9009\uFF09" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF1B\u4E0D\u4F20\u4F1A\u7528\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          return [{ type: "text", text: `dsh-project-brain: todo added [${d.priority}] ${d.title} (${d.id})\uFF0C\u6D3B\u8DC3\u5F85\u529E ${d.activeCount}` }];
        }
        return [{ type: "text", text: `dsh-project-brain: todo add FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (!args || !args.title || !String(args.title).trim()) {
          return { ok: false, code: "E_NO_TITLE", message: "title \u5FC5\u586B" };
        }
        const now = Date.now();
        const entry = makeTodoEntry({ title: args.title, description: args.description, priority: args.priority, relatedFiles: args.relatedFiles }, now);
        const wrote = await appendJsonl(fs, brainPath(projectPath, "todo.jsonl"), entry);
        if (!wrote) return { ok: false, code: "E_WRITE_FAILED", message: "failed to write todo.jsonl" };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "\u65B0\u589E\u5F85\u529E\uFF1A" + entry.title,
          eventType: "todo",
          occurredAt: now
        });
        emitPreviewChanged3(exec, projectPath);
        const todos = await readJsonl(fs, brainPath(projectPath, "todo.jsonl"));
        return { ok: true, data: { id: entry.id, title: entry.title, priority: entry.priority, activeCount: todoStats(todos).pendingTodos } };
      } catch (e) {
        return { ok: false, code: "E_TODO_ADD_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}
function buildTodoListTool({ fs, sandboxPolicy }) {
  return defineTool3({
    name: "project_todo_list",
    description: "dsh-project-brain: \u8BFB\u53D6\u5F53\u524D\u9879\u76EE\u5F85\u529E\u5217\u8868\uFF08\u9ED8\u8BA4\u6D3B\u8DC3\u9879\uFF0C\u6309\u4F18\u5148\u7EA7\u6392\u5E8F\uFF09\u3002\u6062\u590D\u5F00\u53D1\u4E0A\u4E0B\u6587\u3001\u786E\u5B9A\u4E0B\u4E00\u6B65\u65F6\u8C03\u7528\u3002",
    parameters: {
      status: { type: "string", description: "\u8FC7\u6EE4\u72B6\u6001\uFF08\u53EF\u9009\uFF09\uFF1Apending | in_progress | blocked | done | cancelled | all\uFF08\u9ED8\u8BA4\u6D3B\u8DC3\u9879\uFF09" },
      limit: { type: "number", description: "\u8FD4\u56DE\u6761\u6570\u4E0A\u9650\uFF0C\u9ED8\u8BA4 20" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          const lines = [{ type: "text", text: `dsh-project-brain: todos - ${d.active} active / ${d.done} done` }];
          for (const t of d.todos || []) {
            lines.push({ type: "text", text: `  [${t.priority}/${t.status}] ${t.title} (${t.id})` });
          }
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: todo list FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const todos = await readJsonl(fs, brainPath(projectPath, "todo.jsonl"));
        const stats = todoStats(todos);
        const statusFilter = normalizeStatus(args && args.status);
        const wantAll = args && args.status === "all";
        let list;
        if (wantAll || statusFilter) {
          list = todos.filter((t) => wantAll ? true : t.status === statusFilter);
          list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        } else {
          list = activeTodos(todos);
        }
        const limit = Math.max(1, Math.min(100, Number(args && args.limit || 20)));
        return {
          ok: true,
          data: {
            active: stats.pendingTodos,
            done: stats.completedTodos,
            total: stats.total,
            todos: list.slice(0, limit).map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, updatedAt: t.updatedAt }))
          }
        };
      } catch (e) {
        return { ok: false, code: "E_TODO_LIST_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}
function buildTodoDoneTool({ fs, sandboxPolicy }) {
  return defineTool3({
    name: "project_todo_done",
    description: "dsh-project-brain: \u5173\u95ED\u4E00\u6761\u5F85\u529E\uFF08status -> done\uFF0C\u5199 timeline \u4E8B\u4EF6\uFF09\u3002\u6309 todo id\uFF08\u652F\u6301\u524D\u7F00\uFF09\u6216\u6807\u9898\u7CBE\u786E\u5339\u914D\u3002",
    parameters: {
      id: { type: "string", description: "todo id \u6216\u5176\u524D\u7F00\uFF08\u4E0E title \u4E8C\u9009\u4E00\uFF09" },
      title: { type: "string", description: "todo \u6807\u9898\u7CBE\u786E\u5339\u914D\uFF08\u4E0E id \u4E8C\u9009\u4E00\uFF09" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          return [{ type: "text", text: `dsh-project-brain: todo done \u2713 ${d.title}\uFF0C\u5269\u4F59\u6D3B\u8DC3 ${d.activeCount}` }];
        }
        return [{ type: "text", text: `dsh-project-brain: todo done FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const ref = args && (args.id || args.title) || "";
        if (!ref) return { ok: false, code: "E_NO_REF", message: "id \u6216 title \u5FC5\u586B\u4E00\u9879" };
        const todoPath = brainPath(projectPath, "todo.jsonl");
        const todos = await readJsonl(fs, todoPath);
        const target = findTodo(todos, ref);
        if (!target) {
          return { ok: false, code: "E_NOT_FOUND", message: "\u672A\u627E\u5230\u5339\u914D\u7684\u6D3B\u8DC3\u5F85\u529E\uFF1A" + ref };
        }
        const now = Date.now();
        for (const t of todos) {
          if (t.id === target.id) {
            t.status = "done";
            t.updatedAt = now;
          }
        }
        const wrote = await writeText(fs, todoPath, serializeJsonl(todos));
        if (!wrote) return { ok: false, code: "E_WRITE_FAILED", message: "failed to rewrite todo.jsonl" };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "\u5B8C\u6210\u5F85\u529E\uFF1A" + target.title,
          eventType: "todo",
          occurredAt: now
        });
        emitPreviewChanged3(exec, projectPath);
        return { ok: true, data: { id: target.id, title: target.title, activeCount: todoStats(todos).pendingTodos } };
      } catch (e) {
        return { ok: false, code: "E_TODO_DONE_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}

// src/tools/todo-update.js
import { defineTool as defineTool4 } from "@deepseek-ai/dsh-tools";
function emitPreviewChanged4(exec, projectPath) {
  try {
    const executor = exec && exec.ctx || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {
  }
}
var baseOutputSchema2 = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true }
  }
};
function buildTodoUpdateTool({ fs, sandboxPolicy }) {
  return defineTool4({
    name: "project_todo_update",
    description: "dsh-project-brain: \u66F4\u65B0\u4E00\u6761\u5F85\u529E\uFF08\u6309 id \u6216 title \u5339\u914D\uFF09\u3002\u53EF\u6539 status\uFF08pending/in_progress/blocked/done/cancelled\uFF09\u3001title\u3001description\u3001priority\uFF08low/medium/high/urgent\uFF09\u3002\u5B8C\u6210\u540E\u5199 timeline \u4E8B\u4EF6\u5E76\u89E6\u53D1 preview \u5237\u65B0\u3002",
    parameters: {
      id: { type: "string", description: "todo id \u6216\u5176\u524D\u7F00\uFF08\u4E0E title \u4E8C\u9009\u4E00\uFF09" },
      title: { type: "string", description: "todo \u6807\u9898\u7CBE\u786E\u5339\u914D\uFF08\u4E0E id \u4E8C\u9009\u4E00\uFF09" },
      status: { type: "string", description: "\u65B0\u72B6\u6001\uFF1A" + TODO_STATUSES.join(" | ") },
      newTitle: { type: "string", description: "\u65B0\u6807\u9898\uFF08\u53EF\u9009\uFF09" },
      description: { type: "string", description: "\u65B0\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09" },
      priority: { type: "string", description: "\u65B0\u4F18\u5148\u7EA7\uFF1A" + TODO_PRIORITIES.join(" | ") },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: { schema: baseOutputSchema2, render: (_args, value) => renderTodoUpdate(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const ref = args && (args.id || args.title) || "";
        if (!ref) return { ok: false, data: { error: { code: "E_NO_REF", message: "id \u6216 title \u5FC5\u586B\u4E00\u9879" } } };
        const todoPath = brainPath(projectPath, "todo.jsonl");
        const todos = await readJsonl(fs, todoPath);
        const target = findTodo(todos, ref);
        if (!target) return { ok: false, data: { error: { code: "E_NOT_FOUND", message: "\u672A\u627E\u5230\u5339\u914D\u7684\u6D3B\u8DC3\u5F85\u529E\uFF1A" + ref } } };
        const now = Date.now();
        let changed = [];
        for (const t of todos) {
          if (t.id !== target.id) continue;
          if (args.status != null) {
            const ns = normalizeStatus(args.status);
            if (!ns) return { ok: false, data: { error: { code: "E_INVALID_STATUS", message: "status \u5FC5\u987B\u662F " + TODO_STATUSES.join("/") } } };
            if (t.status !== ns) {
              t.status = ns;
              changed.push("status=" + ns);
            }
          }
          if (args.priority != null) {
            const np = normalizePriority(args.priority);
            if (!np) return { ok: false, data: { error: { code: "E_INVALID_PRIORITY", message: "priority \u5FC5\u987B\u662F " + TODO_PRIORITIES.join("/") } } };
            if (t.priority !== np) {
              t.priority = np;
              changed.push("priority=" + np);
            }
          }
          if (args.newTitle != null && String(args.newTitle).trim()) {
            t.title = String(args.newTitle).slice(0, 200);
            changed.push("title");
          }
          if (args.description != null) {
            t.description = String(args.description);
            changed.push("description");
          }
          t.updatedAt = now;
        }
        const wrote = await writeText(fs, todoPath, serializeJsonl(todos));
        if (!wrote) return { ok: false, data: { error: { code: "E_WRITE_FAILED", message: "failed to rewrite todo.jsonl" } } };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "\u66F4\u65B0\u5F85\u529E[" + target.id + "]\uFF1A" + target.title + (changed.length ? "\uFF08" + changed.join(",") + "\uFF09" : ""),
          eventType: "todo_update",
          occurredAt: now
        });
        emitPreviewChanged4(exec, projectPath);
        const stats = todoStats(todos);
        return { ok: true, data: { id: target.id, title: target.title, status: target.status, priority: target.priority, changed, activeCount: stats.pendingTodos } };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_TODO_UPDATE_FAILED", message: String(e && e.message || e) } } };
      }
    }
  });
}
function renderTodoUpdate(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: todo update FAILED - non-object result: " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    if (d.error) return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + d.error.code + ": " + d.error.message }];
    return [{ type: "text", text: `dsh-project-brain: todo updated [${d.priority}/${d.status}] ${d.title} (${d.id})${d.changed && d.changed.length ? " \u2014 changed: " + d.changed.join(",") : ""}` }];
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: todo update FAILED - " + JSON.stringify(value) }];
}

// src/tools/continue.js
import { defineTool as defineTool5 } from "@deepseek-ai/dsh-tools";
function buildContinueTool({ fs, sandboxPolicy }) {
  return defineTool5({
    name: "project_continue",
    description: "dsh-project-brain: \u6062\u590D\u5F53\u524D\u9879\u76EE\u7684\u5F00\u53D1\u4E0A\u4E0B\u6587\uFF08\u7528\u6237\u8BF4\u300C\u7EE7\u7EED\u4E0A\u6B21\u7684\u5F00\u53D1\u300D\u65F6\u8C03\u7528\uFF09\u3002\u8FD4\u56DE\u9879\u76EE\u6982\u8981\u3001\u6700\u8FD1\u6D3B\u52A8\u3001Top-5 \u8BB0\u5FC6\uFF08\u6309\u91CD\u8981\u5EA6+\u65F6\u95F4\u6392\u5E8F\uFF09\u3001\u6D3B\u8DC3\u5F85\u529E\u4E0E\u5EFA\u8BAE\u4E0B\u4E00\u6B65\uFF0C\u636E\u6B64\u53EF\u76F4\u63A5\u7EED\u63A5\u5F00\u53D1\uFF0C\u65E0\u9700\u7528\u6237\u91CD\u65B0\u63CF\u8FF0\u9879\u76EE\u3002",
    parameters: {
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\uFF0C\u9ED8\u8BA4 sandboxPolicy.workspaceRoot" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" }
        }
      },
      render: (_args, value) => {
        if (value.ok) {
          const d = value.data || {};
          const lines = [{ type: "text", text: `dsh-project-brain: continue context` }];
          if (d.project) {
            lines.push({ type: "text", text: `  Project: ${d.project.name} (${d.project.type})` });
          }
          lines.push({ type: "text", text: `  Suggested next: ${d.suggestedNextStep}` });
          lines.push({ type: "text", text: `  Stats: pending ${d.stats.pendingTodos} / done ${d.stats.completedTodos} / decisions ${d.stats.decisions} / memories ${d.stats.memories}` });
          for (const m of d.topMemories || []) {
            lines.push({ type: "text", text: `  mem[${m.type}] ${m.title}` });
          }
          for (const t of d.pendingTodos || []) {
            lines.push({ type: "text", text: `  todo[${t.priority}] ${t.title} (${t.status})` });
          }
          if (d.warning) lines.push({ type: "text", text: `  warning: ${d.warning}` });
          return lines;
        }
        return [{ type: "text", text: `dsh-project-brain: continue FAILED - ${value && value.code}: ${value && value.message}` }];
      }
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const brain = await readBrain(fs, projectPath);
        const data = buildContinueData(brain, Date.now());
        if (!data.initialized) {
          return {
            ok: false,
            code: "E_NOT_INITIALIZED",
            message: "\u8BE5\u9879\u76EE\u8FD8\u6CA1\u6709 .project-brain/project.json\uFF0C\u8BF7\u5148\u8C03\u7528 project_init"
          };
        }
        return { ok: true, data };
      } catch (e) {
        return { ok: false, code: "E_CONTINUE_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}

// src/tools/status.js
import { defineTool as defineTool6 } from "@deepseek-ai/dsh-tools";

// src/host/memory/retrieval.js
function activeMemories(memories) {
  return (memories || []).filter(isActiveMemory);
}
function tokenizeMemoryText(value) {
  const text = String(value || "").toLowerCase();
  const tokens = [];
  for (const part of text.match(/[a-z0-9_./:@-]+|[\u4e00-\u9fff]+/g) || []) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      if (part.length === 1) tokens.push(part);
      else {
        for (let i = 0; i < part.length - 1; i++) tokens.push(part.slice(i, i + 2));
      }
    } else if (part.length > 1) {
      tokens.push(part);
    }
  }
  return tokens.slice(0, 2e3);
}
function memoryDocument(memory) {
  return [
    memory && memory.title,
    memory && memory.title,
    memory && memory.content,
    memory && Array.isArray(memory.tags) ? memory.tags.join(" ") : "",
    memory && Array.isArray(memory.relatedFiles) ? memory.relatedFiles.join(" ") : "",
    memory && memory.type
  ].filter(Boolean).join("\n");
}
function termCounts(tokens) {
  const map = /* @__PURE__ */ new Map();
  for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
  return map;
}
function bm25Scores(memories, query, options = {}) {
  const docs = (memories || []).map((memory) => tokenizeMemoryText(memoryDocument(memory)));
  const queryTokens = [...new Set(tokenizeMemoryText(query))];
  const scores = /* @__PURE__ */ new Map();
  if (docs.length === 0 || queryTokens.length === 0) return scores;
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1;
  const k1 = typeof options.k1 === "number" ? options.k1 : 1.2;
  const b = typeof options.b === "number" ? options.b : 0.75;
  const dfs = /* @__PURE__ */ new Map();
  for (const token of queryTokens) {
    let count = 0;
    for (const doc of docs) if (doc.includes(token)) count += 1;
    dfs.set(token, count);
  }
  docs.forEach((doc, index) => {
    const counts = termCounts(doc);
    let score = 0;
    for (const token of queryTokens) {
      const tf = counts.get(token) || 0;
      if (!tf) continue;
      const df = dfs.get(token) || 0;
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += idf * (tf * (k1 + 1) / (tf + k1 * (1 - b + b * doc.length / avgLength)));
    }
    scores.set(memories[index].id, score);
  });
  return scores;
}
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : 0;
}
function normalizeScoreMap(map) {
  let max = 0;
  for (const value of map.values()) if (value > max) max = value;
  const out = /* @__PURE__ */ new Map();
  for (const [key, value] of map) out.set(key, max > 0 ? value / max : 0);
  return out;
}
function recencyScore(memory, now) {
  const created = memory.updatedAt || memory.createdAt || 0;
  const ageDays = Math.max(0, (now - created) / 864e5);
  return ageDays <= 7 ? 1 : Math.max(0, 1 - ageDays / 180);
}
function tokenJaccard(a, b) {
  const aa = new Set(tokenizeMemoryText(memoryDocument(a)));
  const bb = new Set(tokenizeMemoryText(memoryDocument(b)));
  if (aa.size === 0 || bb.size === 0) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection += 1;
  return intersection / (aa.size + bb.size - intersection);
}
function retrieveMemories({ memories, query = "", topK = 5, now = Date.now(), vectors, queryVector, config = {} } = {}) {
  const candidates = activeMemories(memories);
  const keyword = normalizeScoreMap(bm25Scores(candidates, query));
  const vectorRaw = /* @__PURE__ */ new Map();
  if (queryVector && vectors) {
    for (const memory of candidates) {
      const vector2 = vectors instanceof Map ? vectors.get(memory.id) : vectors[memory.id];
      if (vector2) vectorRaw.set(memory.id, Math.max(0, cosineSimilarity(queryVector, vector2)));
    }
  }
  const vector = normalizeScoreMap(vectorRaw);
  const hasQuery = tokenizeMemoryText(query).length > 0;
  const hasVector = vector.size > 0;
  const weights = {
    keyword: hasQuery ? Number(config.keywordWeight ?? 0.45) : 0,
    vector: hasVector ? Number(config.vectorWeight ?? 0.35) : 0,
    importance: hasQuery ? Number(config.importanceWeight ?? 0.1) : 0.55,
    confidence: hasQuery ? Number(config.confidenceWeight ?? 0.05) : 0.1,
    recency: hasQuery ? Number(config.recencyWeight ?? 0.05) : 0.2,
    type: hasQuery ? 0 : 0.15
  };
  const ranked = candidates.map((memory) => {
    const importance = typeof memory.importance === "number" ? memory.importance : 0.5;
    const confidence = typeof memory.confidence === "number" ? memory.confidence : 0.6;
    const stableType = ["decision", "requirement", "architecture", "bug", "lesson"].includes(memory.type) ? 1 : 0.35;
    const relevance = (keyword.get(memory.id) || 0) * weights.keyword + (vector.get(memory.id) || 0) * weights.vector + importance * weights.importance + confidence * weights.confidence + recencyScore(memory, now) * weights.recency + stableType * weights.type;
    return { memory, relevance, keywordScore: keyword.get(memory.id) || 0, vectorScore: vector.get(memory.id) || 0 };
  }).sort((a, b) => b.relevance - a.relevance);
  const selected = [];
  const remaining = ranked.slice();
  while (selected.length < Math.max(1, topK) && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let similarityPenalty = 0;
      let sameType = 0;
      for (const chosen of selected) {
        similarityPenalty = Math.max(similarityPenalty, tokenJaccard(candidate.memory, chosen.memory));
        if (candidate.memory.type === chosen.memory.type) sameType += 1;
      }
      const diversityScore = candidate.relevance - similarityPenalty * 0.22 - Math.max(0, sameType - 1) * 0.08;
      if (diversityScore > bestScore) {
        bestScore = diversityScore;
        bestIndex = i;
      }
    }
    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push({ ...picked, score: bestScore });
  }
  return selected;
}

// src/host/memory/config.js
import z from "@deepseek-ai/schemastery";
var MEMORY_SETTINGS_NS = "dsh-project-brain";
var Config = z.object({
  retrievalMode: z.union(["keyword", "hybrid"]).default("hybrid"),
  vectorEnabled: z.boolean().default(false),
  embeddingBaseURL: z.string().default(""),
  embeddingModel: z.string().default(""),
  embeddingApiKeyEnv: z.string().role("credential-ref").default("PROJECT_BRAIN_EMBEDDING_API_KEY"),
  embeddingDimensions: z.number().step(1).min(0).default(0),
  embeddingBatchSize: z.number().step(1).min(1).max(128).default(16),
  embeddingMaxIndexPerRun: z.number().step(1).min(1).max(500).default(64),
  embeddingTimeoutMs: z.number().step(1).min(1e3).max(12e4).default(2e4),
  keywordWeight: z.number().min(0).max(1).default(0.45),
  vectorWeight: z.number().min(0).max(1).default(0.35),
  importanceWeight: z.number().min(0).max(1).default(0.1),
  confidenceWeight: z.number().min(0).max(1).default(0.05),
  recencyWeight: z.number().min(0).max(1).default(0.05),
  architectureEnabled: z.boolean().default(true),
  architectureLlmEnabled: z.boolean().default(true),
  architectureLlmIncludeSource: z.boolean().default(true),
  architectureMaxFiles: z.number().step(1).min(20).max(1e3).default(240),
  architectureMaxNodes: z.number().step(1).min(6).max(60).default(24),
  architectureLlmTimeoutMs: z.number().step(1).min(5e3).max(12e4).default(6e4)
});
function normalizeMemoryConfig(value) {
  const input = value && typeof value === "object" ? value : {};
  const num = (key, fallback, min, max) => {
    const raw = Number(input[key]);
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, raw));
  };
  const integer = (key, fallback, min, max) => Math.round(num(key, fallback, min, max));
  return Object.freeze({
    retrievalMode: input.retrievalMode === "keyword" ? "keyword" : "hybrid",
    vectorEnabled: input.vectorEnabled === true,
    embeddingBaseURL: typeof input.embeddingBaseURL === "string" ? input.embeddingBaseURL.trim() : "",
    embeddingModel: typeof input.embeddingModel === "string" ? input.embeddingModel.trim() : "",
    embeddingApiKeyEnv: typeof input.embeddingApiKeyEnv === "string" ? input.embeddingApiKeyEnv.trim() : "PROJECT_BRAIN_EMBEDDING_API_KEY",
    embeddingDimensions: Number.isSafeInteger(input.embeddingDimensions) && input.embeddingDimensions > 0 ? input.embeddingDimensions : null,
    embeddingBatchSize: integer("embeddingBatchSize", 16, 1, 128),
    embeddingMaxIndexPerRun: integer("embeddingMaxIndexPerRun", 64, 1, 500),
    embeddingTimeoutMs: integer("embeddingTimeoutMs", 2e4, 1e3, 12e4),
    keywordWeight: num("keywordWeight", 0.45, 0, 1),
    vectorWeight: num("vectorWeight", 0.35, 0, 1),
    importanceWeight: num("importanceWeight", 0.1, 0, 1),
    confidenceWeight: num("confidenceWeight", 0.05, 0, 1),
    recencyWeight: num("recencyWeight", 0.05, 0, 1),
    architectureEnabled: input.architectureEnabled !== false,
    architectureLlmEnabled: input.architectureLlmEnabled !== false,
    architectureLlmIncludeSource: input.architectureLlmIncludeSource !== false,
    architectureMaxFiles: integer("architectureMaxFiles", 240, 20, 1e3),
    architectureMaxNodes: integer("architectureMaxNodes", 24, 6, 60),
    architectureLlmTimeoutMs: integer("architectureLlmTimeoutMs", 6e4, 5e3, 12e4)
  });
}
function publicMemoryConfig(config) {
  const c = normalizeMemoryConfig(config);
  const configured = Boolean(c.vectorEnabled && c.embeddingBaseURL && c.embeddingModel);
  return {
    requestedMode: c.retrievalMode,
    configuredMode: configured && c.retrievalMode === "hybrid" ? "hybrid" : "keyword",
    fallbackMode: "keyword",
    vectorEnabled: c.vectorEnabled,
    vectorConfigured: configured,
    embeddingModel: c.embeddingModel || null,
    embeddingDimensions: c.embeddingDimensions,
    architecture: {
      enabled: c.architectureEnabled,
      llmEnabled: c.architectureLlmEnabled,
      llmIncludeSource: c.architectureLlmIncludeSource,
      maxFiles: c.architectureMaxFiles,
      maxNodes: c.architectureMaxNodes
    }
  };
}
function createMemoryConfigRuntime(ctx, entryConfig) {
  let current = normalizeMemoryConfig(entryConfig);
  let credentials = null;
  if (ctx && typeof ctx.inject === "function") {
    try {
      ctx.inject(["settings"], (settingsCtx) => {
        let settings;
        try {
          settings = settingsCtx.get ? settingsCtx.get("settings") : settingsCtx.settings;
        } catch (e) {
          settings = null;
        }
        if (!settings || typeof settings.register !== "function") return;
        const scope = settings.register(MEMORY_SETTINGS_NS, Config, { base: entryConfig || {} });
        try {
          current = normalizeMemoryConfig(scope.get());
        } catch (e) {
        }
        if (scope && typeof scope.watch === "function") {
          scope.watch((next) => {
            current = normalizeMemoryConfig(next);
          });
        }
      });
    } catch (e) {
    }
    try {
      ctx.inject(["credentials"], (credentialsCtx) => {
        try {
          credentials = credentialsCtx.get ? credentialsCtx.get("credentials") : credentialsCtx.credentials;
        } catch (e) {
          credentials = null;
        }
        if (credentialsCtx && typeof credentialsCtx.effect === "function") {
          try {
            credentialsCtx.effect(() => {
              credentials = null;
            }, "dsh-project-brain:credentials");
          } catch (e) {
          }
        }
      });
    } catch (e) {
    }
  }
  return {
    get: () => current,
    async resolveCredential(ref) {
      if (!ref) return null;
      if (credentials && typeof credentials.resolve === "function") {
        try {
          const hit = await credentials.resolve(ref);
          if (hit && typeof hit.value === "string" && hit.value.trim()) return hit.value.trim();
        } catch (e) {
        }
      }
      const value = typeof process !== "undefined" && process.env ? process.env[ref] : null;
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
  };
}

// src/tools/status.js
var baseOutputSchema3 = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true }
  }
};
function buildStatusTool({ fs, sandboxPolicy, getMemoryConfig }) {
  return defineTool6({
    name: "project_status",
    description: "dsh-project-brain: \u8FD4\u56DE\u5F53\u524D\u9879\u76EE\u7684\u5FEB\u901F\u72B6\u6001\u5FEB\u7167\uFF08\u9879\u76EE\u5143\u4FE1\u606F + \u5404\u7C7B\u578B Memory \u8BA1\u6570 + TODO \u7EDF\u8BA1 + \u6700\u8FD1\u6D3B\u52A8 + \u662F\u5426\u521D\u59CB\u5316\uFF09\u3002\u6BD4 project_continue \u66F4\u8F7B\u3001\u4E0D\u9700\u8981\u6392\u5E8F\u7B97\u6CD5\u3002",
    parameters: {
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF09\uFF0C\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD" }
    },
    output: { schema: baseOutputSchema3, render: (_args, value) => renderStatus(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const brain = await readBrain(fs, projectPath);
        const p = brain && brain.project;
        if (!p || p.__error) {
          return { ok: false, data: { error: { code: "E_NOT_INITIALIZED", message: "\u8BE5\u9879\u76EE\u5C1A\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5148\u8C03\u7528 project_init", projectPath }, projectPath } };
        }
        const tStats = todoStats(brain.todos);
        const visibleMemories = activeMemories(brain.memories);
        const memoryCounts = {};
        for (const m of visibleMemories) {
          const k = m.type || "context";
          memoryCounts[k] = (memoryCounts[k] || 0) + 1;
        }
        const recent = recentTimeline(brain.timeline, 3).map((e) => ({
          id: e.id,
          title: e.title,
          occurredAt: e.occurredAt,
          eventType: e.eventType
        }));
        const now = Date.now();
        const lastActivityAt = recent.length > 0 ? recent[0].occurredAt : p.updatedAt || p.lastScannedAt || null;
        return {
          ok: true,
          data: {
            projectPath,
            initialized: true,
            project: {
              id: p.id,
              name: p.name,
              rootPath: p.rootPath,
              type: techStackToType(p.techStack),
              lastUpdateAt: p.updatedAt || p.lastScannedAt || null,
              lastScannedAt: p.lastScannedAt || null
            },
            stats: {
              files: p.size && p.size.files || null,
              memories: visibleMemories.length,
              archivedMemories: (brain.memories || []).length - visibleMemories.length,
              todos: tStats.total,
              pendingTodos: tStats.pendingTodos,
              completedTodos: tStats.completedTodos,
              timelineEvents: (brain.timeline || []).length,
              lastActivityAt,
              uptimeMs: lastActivityAt ? now - lastActivityAt : null
            },
            memoryCounts,
            retrieval: publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {}),
            recentActivity: recent
          }
        };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_STATUS_FAILED", message: String(e && e.message || e) } } };
      }
    }
  });
}
function renderStatus(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: status FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: project status` }];
    if (d.project) lines.push({ type: "text", text: `  Project: ${d.project.name} (${d.project.type})` });
    lines.push({ type: "text", text: `  Memories: ${d.stats.memories} (${Object.entries(d.memoryCounts).map(([k, v]) => k + ":" + v).join(", ")})` });
    lines.push({ type: "text", text: `  Todos: pending ${d.stats.pendingTodos} / done ${d.stats.completedTodos} / total ${d.stats.todos}` });
    lines.push({ type: "text", text: `  Timeline: ${d.stats.timelineEvents} events` });
    if (d.retrieval) {
      lines.push({ type: "text", text: `  Retrieval: ${d.retrieval.configuredMode === "hybrid" ? "hybrid configured (fallback: keyword)" : "local keyword"}` });
    }
    if (d.stats.lastActivityAt) {
      const ageMin = Math.round((Date.now() - d.stats.lastActivityAt) / 6e4);
      lines.push({ type: "text", text: `  Last activity: ${ageMin} min ago` });
    }
    for (const e of d.recentActivity || []) {
      lines.push({ type: "text", text: `  activity: ${e.title}` });
    }
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: status FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: status FAILED - " + JSON.stringify(value) }];
}

// src/tools/ask.js
import { defineTool as defineTool7 } from "@deepseek-ai/dsh-tools";

// src/host/memory/embeddings.js
import { createHash } from "node:crypto";
var CACHE_FILE = "cache/embeddings.jsonl";
function embeddingContentHash(memory) {
  return createHash("sha256").update(memoryDocument(memory), "utf8").digest("hex");
}
function embeddingModelKey(config) {
  return [config.embeddingBaseURL || "", config.embeddingModel || "", config.embeddingDimensions || "auto"].join("|");
}
function embeddingEndpoint(baseURL) {
  const base = String(baseURL || "").replace(/\/+$/, "");
  return /\/embeddings$/i.test(base) ? base : base + "/embeddings";
}
function validVector(value) {
  return Array.isArray(value) && value.length > 0 && value.every((n) => Number.isFinite(Number(n)));
}
async function fetchEmbeddings({ texts, config, apiKey, signal, fetchImpl = fetch }) {
  if (!config.embeddingBaseURL || !config.embeddingModel) {
    const error = new Error("Embedding endpoint or model is not configured");
    error.code = "EMBEDDING_NOT_CONFIGURED";
    throw error;
  }
  const timeoutSignal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(config.embeddingTimeoutMs || 2e4) : void 0;
  const combinedSignal = signal && timeoutSignal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeoutSignal]) : signal || timeoutSignal;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  const body = { model: config.embeddingModel, input: texts };
  if (config.embeddingDimensions) body.dimensions = config.embeddingDimensions;
  const response = await fetchImpl(embeddingEndpoint(config.embeddingBaseURL), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: combinedSignal
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error("Embedding API error " + response.status + (detail ? ": " + detail.slice(0, 160) : ""));
    error.code = "EMBEDDING_API_ERROR";
    throw error;
  }
  const payload = await response.json();
  const data = payload && Array.isArray(payload.data) ? payload.data.slice().sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
  const vectors = data.map((item) => item && item.embedding);
  if (vectors.length !== texts.length || vectors.some((vector) => !validVector(vector))) {
    const error = new Error("Embedding API returned invalid vectors");
    error.code = "EMBEDDING_INVALID_RESPONSE";
    throw error;
  }
  const dimensions = vectors[0].length;
  if (vectors.some((vector) => vector.length !== dimensions)) {
    const error = new Error("Embedding API returned inconsistent dimensions");
    error.code = "EMBEDDING_DIMENSION_MISMATCH";
    throw error;
  }
  return vectors.map((vector) => vector.map(Number));
}
async function readCache(fs, projectPath) {
  try {
    return await readJsonl(fs, brainPath(projectPath, CACHE_FILE));
  } catch (e) {
    return [];
  }
}
async function ensureEmbeddingIndex({ fs, projectPath, memories, config, resolveCredential, signal, fetchImpl } = {}) {
  const active = activeMemories(memories);
  const modelKey = embeddingModelKey(config);
  const rows = await readCache(fs, projectPath);
  const currentById = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row || row.modelKey !== modelKey || !validVector(row.vector)) continue;
    currentById.set(row.memoryId, row);
  }
  const pending = active.filter((memory) => {
    const row = currentById.get(memory.id);
    return !row || row.contentHash !== embeddingContentHash(memory);
  });
  const limit = Math.min(pending.length, config.embeddingMaxIndexPerRun || 64);
  const toIndex = pending.slice(0, limit);
  let error = null;
  let indexedNow = 0;
  if (toIndex.length > 0) {
    try {
      const apiKey = config.embeddingApiKeyEnv && resolveCredential ? await resolveCredential(config.embeddingApiKeyEnv) : null;
      if (config.embeddingApiKeyEnv && !apiKey) {
        const missing = new Error("Embedding credential is not configured: " + config.embeddingApiKeyEnv);
        missing.code = "EMBEDDING_CREDENTIAL_MISSING";
        throw missing;
      }
      const batchSize = config.embeddingBatchSize || 16;
      for (let offset = 0; offset < toIndex.length; offset += batchSize) {
        const batch = toIndex.slice(offset, offset + batchSize);
        const vectors2 = await fetchEmbeddings({
          texts: batch.map(memoryDocument),
          config,
          apiKey,
          signal,
          fetchImpl
        });
        batch.forEach((memory, index) => {
          currentById.set(memory.id, {
            memoryId: memory.id,
            contentHash: embeddingContentHash(memory),
            modelKey,
            model: config.embeddingModel,
            dimensions: vectors2[index].length,
            vector: vectors2[index],
            updatedAt: Date.now()
          });
          indexedNow += 1;
        });
      }
    } catch (caught) {
      error = caught;
    }
  }
  if (indexedNow > 0) {
    const activeIds = new Set(active.map((memory) => memory.id));
    const wrote = await writeJsonl(fs, brainPath(projectPath, CACHE_FILE), [...currentById.values()].filter((row) => activeIds.has(row.memoryId)));
    if (!wrote && !error) {
      error = Object.assign(new Error("Embedding cache could not be written"), { code: "EMBEDDING_CACHE_WRITE_FAILED" });
    }
  }
  const vectors = /* @__PURE__ */ new Map();
  for (const memory of active) {
    const row = currentById.get(memory.id);
    if (row && row.contentHash === embeddingContentHash(memory)) vectors.set(memory.id, row.vector);
  }
  return {
    vectors,
    indexed: vectors.size,
    total: active.length,
    indexedNow,
    pending: Math.max(0, active.length - vectors.size),
    error: error ? { code: error.code || "EMBEDDING_FAILED", message: String(error.message || error) } : null,
    model: config.embeddingModel,
    dimensions: vectors.size ? vectors.values().next().value.length : config.embeddingDimensions
  };
}
async function embedQuery({ query, config, resolveCredential, signal, fetchImpl } = {}) {
  const apiKey = config.embeddingApiKeyEnv && resolveCredential ? await resolveCredential(config.embeddingApiKeyEnv) : null;
  if (config.embeddingApiKeyEnv && !apiKey) {
    const error = new Error("Embedding credential is not configured: " + config.embeddingApiKeyEnv);
    error.code = "EMBEDDING_CREDENTIAL_MISSING";
    throw error;
  }
  return (await fetchEmbeddings({ texts: [query], config, apiKey, signal, fetchImpl }))[0];
}

// src/tools/ask.js
var baseOutputSchema4 = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true }
  }
};
function tokenize(s) {
  if (!s) return [];
  const out = [];
  const en = String(s).toLowerCase().split(/[^a-z0-9_\u4e00-\u9fff]+/i);
  for (const tok of en) {
    const t = tok && tok.trim();
    if (t && t.length >= 2) out.push(t);
  }
  return out;
}
function scoreEntry(entry, tokens, fields) {
  if (!entry || tokens.length === 0) return 0;
  let score = 0;
  let hits = 0;
  for (const tok of tokens) {
    for (const f of fields) {
      const v = entry[f];
      if (v == null) continue;
      const s = String(v).toLowerCase();
      if (s.indexOf(tok) >= 0) {
        score += 1;
        hits += 1;
        if (f === "title") score += 1;
        break;
      }
    }
  }
  return hits > 0 ? score : -1;
}
function buildRagPrompt(question, sources, projectInfo) {
  const parts = [];
  parts.push("\u4F60\u662F dsh-project-brain \u52A9\u624B\u3002\u7528\u6237\u95EE\u4E86\u4E00\u4E2A\u5173\u4E8E\u9879\u76EE\u7684\u95EE\u9898\uFF0C\u8BF7\u4EC5\u57FA\u4E8E\u4E0B\u9762\u63D0\u4F9B\u7684 sources \u56DE\u7B54\uFF0C\u4E0D\u8981\u7F16\u9020\u4FE1\u606F\u3002");
  parts.push("");
  if (projectInfo) {
    parts.push("\u3010\u9879\u76EE\u6982\u51B5\u3011");
    parts.push("- \u540D\u79F0: " + (projectInfo.name || "(\u672A\u547D\u540D)"));
    if (projectInfo.type) parts.push("- \u7C7B\u578B: " + projectInfo.type);
    parts.push("");
  }
  parts.push("\u3010\u76F8\u5173 Memory / TODO / Timeline\uFF08Top sources\uFF09\u3011");
  sources.forEach((s, i) => {
    const tag = s.kind + " + " + (s.type || s.status || s.eventType || "");
    parts.push(`[${i + 1}] (${tag}) ${s.title}`);
    if (s.snippet) parts.push("    " + s.snippet);
    parts.push("");
  });
  parts.push("\u3010\u7528\u6237\u95EE\u9898\u3011");
  parts.push(question);
  parts.push("");
  parts.push("\u8BF7\u7528\u7B80\u6D01\u7684\u4E2D\u6587\u56DE\u7B54\uFF083-5 \u53E5\u8BDD\uFF09\uFF0C\u5E76\u5728\u672B\u5C3E\u5217\u51FA\u5F15\u7528\u7684\u6765\u6E90\u7F16\u53F7 [1][2]...\u3002\u5982\u679C sources \u65E0\u6CD5\u56DE\u7B54\uFF0C\u76F4\u63A5\u8BF4\u300E\u4FE1\u606F\u4E0D\u8DB3\u300F\u3002");
  return parts.join("\n");
}
async function synthesizeAnswer(exec, question, sources, projectInfo) {
  if (!sources || sources.length === 0) return null;
  let llm = null;
  try {
    const ctx = exec && exec.ctx;
    llm = ctx && (ctx.get ? ctx.get("llm") : ctx.llm);
  } catch (e) {
    llm = null;
  }
  if (!llm || typeof llm.stream !== "function") return null;
  const prompt = buildRagPrompt(question, sources, projectInfo);
  const options = {
    // provider 留空：DSH 通常有默认 route；不传让系统选
    messages: [{ role: "user", content: prompt }]
  };
  try {
    const iterable = llm.stream(options);
    if (!iterable || typeof iterable[Symbol.asyncIterator] !== "function") return null;
    let collected = "";
    for await (const chunk of iterable) {
      if (!chunk) continue;
      if (typeof chunk.text === "string") collected += chunk.text;
      else if (typeof chunk.content === "string") collected += chunk.content;
      else if (typeof chunk.delta === "string") collected += chunk.delta;
      if (collected.length > 8e3) break;
    }
    return collected.trim() || null;
  } catch (e) {
    return null;
  }
}
function buildAskTool({ fs, sandboxPolicy, getMemoryConfig, resolveEmbeddingCredential }) {
  return defineTool7({
    name: "project_ask",
    description: "dsh-project-brain: \u81EA\u7136\u8BED\u8A00\u67E5\u8BE2\u9879\u76EE\u8111\u3002\u9ED8\u8BA4\u4F7F\u7528\u672C\u5730 BM25 \u68C0\u7D22\uFF1B\u914D\u7F6E\u540E\u53EF\u4F7F\u7528\u6DF7\u5408\u5411\u91CF\u68C0\u7D22\uFF0C\u8FD4\u56DE Top-K sources + \u9879\u76EE\u6982\u89C8\u3002useLLM=true \u65F6\u989D\u5916\u8C03 LLM \u5408\u6210\u7B54\u6848\uFF08RAG \u98CE\u683C\uFF09\u3002\u53EF\u7528\u4E8E\u56DE\u7B54\u300C\u4E3A\u4EC0\u4E48\u8FD9\u4E48\u8BBE\u8BA1 / \u4E4B\u524D\u8E29\u8FC7\u4EC0\u4E48\u5751 / \u6700\u8FD1\u6539\u4E86\u4EC0\u4E48\u300D\u7B49\u95EE\u9898\u3002",
    parameters: {
      question: { type: "string", description: "\u81EA\u7136\u8BED\u8A00\u95EE\u9898\uFF08\u5FC5\u586B\uFF09" },
      topK: { type: "number", description: "\u8FD4\u56DE\u6761\u76EE\u6570\u4E0A\u9650\uFF0C\u9ED8\u8BA4 5" },
      useLLM: { type: "boolean", description: "\u662F\u5426\u8C03 LLM \u5408\u6210\u7B54\u6848\uFF08\u9ED8\u8BA4 false\uFF0C\u7EAF\u89C4\u5219\u8FD4\u56DE sources\uFF09" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: { schema: baseOutputSchema4, render: (_args, value) => renderAsk(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const question = args && args.question ? String(args.question).trim() : "";
        if (!question) return { ok: false, data: { error: { code: "E_NO_QUESTION", message: "question \u5FC5\u586B" } } };
        const topK = Math.max(1, Math.min(20, Number(args && args.topK) || 5));
        const useLLM = Boolean(args && args.useLLM);
        const tokens = tokenize(question);
        const memoryConfig = normalizeMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        const projectJson = await readJson(fs, brainPath(projectPath, "project.json")).catch(() => null);
        const memories = await readJsonlSafe(fs, brainPath(projectPath, "memory.jsonl"));
        const todos = await readJsonlSafe(fs, brainPath(projectPath, "todo.jsonl"));
        const timeline = await readJsonlSafe(fs, brainPath(projectPath, "timeline.jsonl"));
        const activeMemoryList = activeMemories(memories);
        let vectors = null;
        let queryVector = null;
        let vectorState = {
          requested: memoryConfig.vectorEnabled && memoryConfig.retrievalMode === "hybrid",
          used: false,
          indexed: 0,
          total: activeMemoryList.length,
          pending: activeMemoryList.length,
          model: memoryConfig.embeddingModel || null,
          dimensions: memoryConfig.embeddingDimensions,
          fallbackReason: null
        };
        if (vectorState.requested) {
          if (!memoryConfig.embeddingBaseURL || !memoryConfig.embeddingModel) {
            vectorState.fallbackReason = { code: "EMBEDDING_NOT_CONFIGURED", message: "\u5411\u91CF\u68C0\u7D22\u5DF2\u542F\u7528\uFF0C\u4F46 endpoint \u6216 model \u672A\u914D\u7F6E" };
          } else {
            const indexState = await ensureEmbeddingIndex({
              fs,
              projectPath,
              memories: activeMemoryList,
              config: memoryConfig,
              resolveCredential: resolveEmbeddingCredential
            });
            vectors = indexState.vectors;
            vectorState = { ...vectorState, ...indexState, requested: true, used: false, fallbackReason: indexState.error };
            try {
              queryVector = await embedQuery({
                query: question,
                config: memoryConfig,
                resolveCredential: resolveEmbeddingCredential
              });
              const indexedVector = vectors.size > 0 ? vectors.values().next().value : null;
              if (indexedVector && indexedVector.length !== queryVector.length) {
                queryVector = null;
                vectorState.fallbackReason = {
                  code: "EMBEDDING_DIMENSION_MISMATCH",
                  message: "\u67E5\u8BE2\u5411\u91CF\u7EF4\u5EA6\u4E0E\u7D22\u5F15\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u914D\u7F6E\u6216\u5220\u9664\u6D3E\u751F\u7F13\u5B58\u540E\u91CD\u8BD5"
                };
              } else {
                vectorState.used = vectors.size > 0;
              }
            } catch (error) {
              vectorState.fallbackReason = {
                code: error.code || "EMBEDDING_QUERY_FAILED",
                message: String(error.message || error)
              };
            }
          }
        }
        const memScored = retrieveMemories({
          memories: activeMemoryList,
          query: question,
          topK,
          vectors,
          queryVector,
          config: memoryConfig
        });
        const todoScored = (todos || []).map((t) => {
          const s = scoreEntry(t, tokens, ["title", "description"]);
          return s < 0 ? null : { ...t, _score: s };
        }).filter(Boolean);
        todoScored.sort((a, b) => (b._score || 0) - (a._score || 0));
        const tlScored = (timeline || []).map((e) => {
          const s = scoreEntry(e, tokens, ["title", "detail"]);
          return s < 0 ? null : { ...e, _score: s };
        }).filter(Boolean);
        tlScored.sort((a, b) => (b._score || 0) - (a._score || 0));
        const memSources = memScored.map((hit) => ({
          kind: "memory",
          id: hit.memory.id,
          type: hit.memory.type,
          title: hit.memory.title,
          snippet: String(hit.memory.content || "").slice(0, 200),
          score: Number(Math.max(0, hit.relevance || 0).toFixed(4)),
          keywordScore: Number((hit.keywordScore || 0).toFixed(4)),
          vectorScore: Number((hit.vectorScore || 0).toFixed(4)),
          importance: hit.memory.importance,
          confidence: hit.memory.confidence,
          relatedFiles: hit.memory.relatedFiles || null
        }));
        const todoSources = todoScored.slice(0, Math.max(1, Math.floor(topK / 2))).map((t) => ({
          kind: "todo",
          id: t.id,
          status: t.status,
          priority: t.priority,
          title: t.title,
          snippet: String(t.description || "").slice(0, 120),
          score: Number((t._score || 0).toFixed(2))
        }));
        const tlSources = tlScored.slice(0, 2).map((e) => ({
          kind: "timeline",
          id: e.id,
          eventType: e.eventType,
          title: e.title,
          occurredAt: e.occurredAt,
          score: Number((e._score || 0).toFixed(2))
        }));
        const sources = memSources.concat(todoSources).concat(tlSources);
        const projectInfo = projectJson ? {
          name: projectJson.name,
          type: techStackToType(projectJson.techStack),
          lastUpdateAt: projectJson.updatedAt || projectJson.lastScannedAt || null
        } : null;
        let answer = null;
        let llmUsed = false;
        let llmError = null;
        if (useLLM) {
          try {
            answer = await synthesizeAnswer(exec, question, sources, projectInfo);
            llmUsed = answer != null;
          } catch (e) {
            llmError = String(e && e.message || e);
          }
        }
        const ret = {
          ok: true,
          data: {
            projectPath,
            question,
            tokens,
            project: projectInfo,
            sources,
            counts: {
              memories: activeMemoryList.length,
              archivedMemories: (memories || []).length - activeMemoryList.length,
              todos: (todos || []).length,
              timeline: (timeline || []).length,
              matched: sources.length
            },
            confidence: sources.length > 0 ? Math.min(1, memSources.length > 0 ? memSources[0].score : 0.3) : 0,
            retrieval: {
              requestedMode: memoryConfig.retrievalMode,
              actualMode: vectorState.used ? "hybrid" : "keyword",
              vectorRequested: vectorState.requested,
              vectorUsed: vectorState.used,
              indexed: vectorState.indexed,
              total: vectorState.total,
              pending: vectorState.pending,
              model: vectorState.model,
              dimensions: vectorState.dimensions,
              fallbackReason: vectorState.fallbackReason
            },
            answer,
            llm: {
              used: llmUsed,
              requested: useLLM,
              error: llmError
            },
            hint: sources.length === 0 ? "\u6CA1\u6709\u5339\u914D\u6761\u76EE\u3002\u53EF\u8003\u8651\u653E\u5BBD\u5173\u952E\u8BCD\uFF0C\u6216\u5148\u8C03\u7528 project_init / project_memory_add \u5F55\u5165\u66F4\u591A\u4E0A\u4E0B\u6587\u3002" : null
          }
        };
        try {
          const roundtrip = JSON.parse(JSON.stringify(ret));
          return roundtrip;
        } catch (e) {
          ret.data._diag = "JSON.stringify FAIL: " + String(e && e.message || e);
          return ret;
        }
      } catch (e) {
        return { ok: false, data: { error: { code: "E_ASK_FAILED", message: String(e && e.message || e) } } };
      }
    }
  });
}
async function readJsonlSafe(fs, path2) {
  try {
    return await readJsonl(fs, path2);
  } catch (e) {
    return [];
  }
}
function renderAsk(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: ask \u2014 matched ${d.counts.matched} sources (confidence ${(d.confidence || 0).toFixed(2)}, llm=${d.llm && d.llm.used ? "yes" : "no"})` }];
    if (d.answer) {
      lines.push({ type: "text", text: "\n\u3010LLM \u7B54\u6848\u3011" });
      lines.push({ type: "text", text: d.answer });
    }
    for (const s of d.sources || []) {
      lines.push({ type: "text", text: `  [${s.kind}/${s.id}] ${s.title}${s.snippet ? " \u2014 " + s.snippet.slice(0, 80) : ""}` });
    }
    if (d.llm && d.llm.error) lines.push({ type: "text", text: `  llm_error: ${d.llm.error}` });
    if (d.hint) lines.push({ type: "text", text: `  hint: ${d.hint}` });
    if (d._diag) lines.push({ type: "text", text: `  \u26A0\uFE0F DIAG: ${d._diag}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: ask FAILED - " + JSON.stringify(value) }];
}

// src/tools/dream.js
import { defineTool as defineTool8 } from "@deepseek-ai/dsh-tools";
var baseOutputSchema5 = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true }
  }
};
function buildDreamTool({ fs, sandboxPolicy }) {
  return defineTool8({
    name: "project_dream",
    description: "dsh-project-brain: \u9879\u76EE\u8111\u8F7B\u91CF\u6574\u5408\uFF08Dream \u6A21\u5F0F\uFF09\u3002\u626B\u63CF memory.jsonl \u505A\u53BB\u91CD\u5019\u9009 +\u5F52\u6863\u5EFA\u8BAE\uFF0C\u8F93\u51FA plannedActions\uFF1B\u9ED8\u8BA4 dryRun=true\uFF08\u4E0D\u76F4\u63A5\u6539 jsonl\uFF09\uFF0CdryRun=false \u65F6\u5B9E\u9645 commit\uFF08merge + archive\uFF09\u3002full \u6A21\u5F0F\uFF08v0.3.12\uFF09\uFF1A\u5728 light \u57FA\u7840\u4E0A\u989D\u5916\u6E05\u7406 archived \u884C + \u6309 importance \u91CD\u6392\uFF1B\u67B6\u6784 diff / \u5411\u91CF\u5408\u5E76\u7559\u4F5C v0.4.x\u3002",
    parameters: {
      mode: { type: "string", description: "light\uFF08\u9ED8\u8BA4\uFF09\u6216 full\uFF08\u9884\u7559\uFF09" },
      dryRun: { type: "boolean", description: "\u53EA\u8FD4\u56DE\u8BA1\u5212\uFF08\u9ED8\u8BA4 true\uFF1B\u8BBE false \u5B9E\u9645\u5199\u6587\u4EF6\uFF09" },
      mergeThreshold: { type: "number", description: "title \u76F8\u4F3C\u5EA6\u9608\u503C\uFF08\u9ED8\u8BA4 0.92\uFF09" },
      archiveImportance: { type: "number", description: "\u5F52\u6863\u91CD\u8981\u6027\u9608\u503C\uFF08\u9ED8\u8BA4 0.15\uFF09" },
      archiveAgeDays: { type: "number", description: "\u5F52\u6863\u6700\u5C0F\u5E74\u9F84\uFF08\u5929\uFF0C\u9ED8\u8BA4 30\uFF09" },
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u9ED8\u8BA4\u4ECE session cwd \u63A8\u65AD\uFF09" }
    },
    output: { schema: baseOutputSchema5, render: (_args, value) => renderDream(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const mode = args && args.mode || "light";
        const dryRun = args && args.dryRun !== false;
        const opts = {
          now: Date.now(),
          mergeThreshold: args && typeof args.mergeThreshold === "number" ? args.mergeThreshold : 0.92,
          archiveImportance: args && typeof args.archiveImportance === "number" ? args.archiveImportance : 0.15,
          archiveAgeDays: args && typeof args.archiveAgeDays === "number" ? args.archiveAgeDays : 30
        };
        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        if (mode !== "light" && mode !== "full") {
          return { ok: true, data: { mode, plannedActions: [], note: "mode \u4EC5\u652F\u6301 light / full\uFF08" + mode + " \u672A\u5B9E\u73B0\uFF09" } };
        }
        const computed = computeDreamActions(memories, opts);
        const plannedActions = computed.plannedActions;
        if (dryRun) {
          return {
            ok: true,
            data: {
              mode,
              dryRun: true,
              scannedMemories: memories.length,
              plannedActions,
              summary: {
                mergeCandidates: computed.mergeCount,
                archiveCandidates: computed.archiveCount,
                estimatedMs: 0
              },
              note: "dryRun=true\uFF0C\u672A\u5199\u6587\u4EF6\uFF1B\u82E5\u8981 commit\uFF0C\u8BF7\u8BBE\u7F6E dryRun=false\u3002"
            }
          };
        }
        const now = opts.now;
        const nextMemories = applyDreamCommit(memories, plannedActions, now, mode);
        const merges = plannedActions.filter((a) => a.action === "merge");
        const archives = plannedActions.filter((a) => a.action === "archive_candidate");
        const dropIds = /* @__PURE__ */ new Set();
        for (const m of merges) for (const id of m.dropIds) dropIds.add(id);
        const mergeLog = merges.map((m) => ({ keepId: m.keepId, dropped: m.dropIds.slice() }));
        const archiveLog = archives.map((a) => ({ id: a.id, title: a.title, importance: a.importance, ageDays: a.ageDays }));
        const memPath = brainPath(projectPath, "memory.jsonl");
        const wroteMem = await writeJsonl(fs, memPath, nextMemories);
        if (!wroteMem) {
          return { ok: false, data: { error: { code: "E_DREAM_WRITE_FAILED", message: "write memory.jsonl failed" } } };
        }
        const tlEntry = {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "Dream commit \u5B8C\u6210\uFF08merge " + merges.length + " \xB7 archive " + archives.length + "\uFF09",
          eventType: "dream",
          occurredAt: now,
          detail: "mergeCount=" + merges.length + " archiveCount=" + archives.length
        };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), tlEntry);
        try {
          if (exec && exec.ctx && typeof exec.ctx.emit === "function") {
            exec.ctx.emit("project_brain/preview.changed", { projectPath });
          }
        } catch (e) {
        }
        return {
          ok: true,
          data: {
            mode,
            dryRun: false,
            scannedMemories: memories.length,
            plannedActions,
            committed: {
              mergeLog,
              archiveLog,
              beforeCount: memories.length,
              afterCount: nextMemories.length
            },
            summary: {
              mergeCandidates: computed.mergeCount,
              archiveCandidates: computed.archiveCount,
              mergedDropped: dropIds.size,
              estimatedMs: Date.now() - now
            },
            note: "dream commit \u5B8C\u6210\uFF1A\u5DF2\u5199 memory.jsonl + timeline.jsonl\uFF1B\u4E0B\u6B21 build \u81EA\u52A8\u53CD\u6620\u5230 sidebar\u3002"
          }
        };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_DREAM_FAILED", message: String(e && e.message || e) } } };
      }
    }
  });
}
function renderDream(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: dream (${d.mode}) \u2014 scanned ${d.scannedMemories} memories, dryRun=${d.dryRun}` }];
    if (d.summary) {
      lines.push({ type: "text", text: `  merge: ${d.summary.mergeCandidates}, archive candidates: ${d.summary.archiveCandidates}, ms=${d.summary.estimatedMs || 0}` });
    }
    for (const a of (d.plannedActions || []).slice(0, 10)) {
      if (a.action === "merge") lines.push({ type: "text", text: `  [merge] keep ${a.keepId} (${a.keepTitle}) drop ${a.dropIds.join(",")}` });
      else if (a.action === "archive_candidate") lines.push({ type: "text", text: `  [archive] ${a.id} (${a.title}) importance=${a.importance} age=${a.ageDays}d` });
    }
    if (d.committed) {
      lines.push({ type: "text", text: `  \u2713 committed: ${d.committed.beforeCount} -> ${d.committed.afterCount} memories` });
    }
    if (d.note) lines.push({ type: "text", text: `  note: ${d.note}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + JSON.stringify(value) }];
}

// src/tools/diff.js
import { defineTool as defineTool9 } from "@deepseek-ai/dsh-tools";

// src/host/diff/detector.js
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
function inflateGitObject(compressed) {
  try {
    const inflated = inflateSync(compressed);
    const nullIdx = inflated.indexOf(0);
    if (nullIdx < 0) return null;
    const header = inflated.slice(0, nullIdx).toString("binary");
    const spaceIdx = header.indexOf(" ");
    if (spaceIdx < 0) return null;
    const type = header.slice(0, spaceIdx);
    const content = inflated.slice(nullIdx + 1);
    return { type, content };
  } catch (e) {
    return null;
  }
}
function readLooseObject(gitDir, hash) {
  if (!/^[0-9a-f]{40}$/i.test(hash)) return null;
  const objPath = join(gitDir, "objects", hash.slice(0, 2), hash.slice(2));
  if (!existsSync(objPath)) return null;
  let compressed;
  try {
    compressed = readFileSync(objPath);
  } catch (e) {
    return null;
  }
  return inflateGitObject(compressed);
}
var OBJ_COMMIT = 1;
var OBJ_TREE = 2;
var OBJ_BLOB = 3;
var OBJ_TAG = 4;
var OBJ_OFS_DELTA = 6;
var OBJ_REF_DELTA = 7;
function readBE32(buf, off) {
  return (buf[off] << 24 | buf[off + 1] << 16 | buf[off + 2] << 8 | buf[off + 3]) >>> 0;
}
function parseIdxV2(idxBytes) {
  if (idxBytes.length < 8 + 1024) return null;
  if (idxBytes[0] !== 255 || idxBytes[1] !== 116 || idxBytes[2] !== 79 || idxBytes[3] !== 99) return null;
  const version = readBE32(idxBytes, 4);
  if (version !== 2) return null;
  const n = readBE32(idxBytes, 8 + 255 * 4);
  const minSize = 1072 + n * 28;
  if (idxBytes.length < minSize) return null;
  const hashStart = 8 + 1024;
  const offsetStart = hashStart + n * 20 + n * 4;
  const map = /* @__PURE__ */ new Map();
  let skipped = 0;
  for (let i = 0; i < n; i++) {
    const hStart = hashStart + i * 20;
    const hash = idxBytes.slice(hStart, hStart + 20).toString("hex");
    const oStart = offsetStart + i * 4;
    const packOffset = readBE32(idxBytes, oStart);
    if ((packOffset & 2147483648) !== 0) {
      const largeOffsetStart = offsetStart + n * 4;
      skipped++;
      continue;
    }
    map.set(hash, packOffset);
  }
  return map;
}
var idxCache = /* @__PURE__ */ new Map();
function loadIdxMap(gitDir, idxPath) {
  const key = gitDir + "|" + idxPath;
  if (idxCache.has(key)) return idxCache.get(key);
  let bytes;
  try {
    bytes = readFileSync(idxPath);
  } catch (e) {
    idxCache.set(key, null);
    return null;
  }
  const map = parseIdxV2(bytes);
  idxCache.set(key, map);
  return map;
}
function readPackEntryHead(buf, offset) {
  let b = buf[offset];
  const t = b >> 4 & 7;
  let size = b & 15;
  let p = offset + 1;
  let shift = 4;
  while (b & 128) {
    if (p >= buf.length) return null;
    b = buf[p++];
    size |= (b & 127) << shift;
    shift += 7;
  }
  return { type: t, size, dataOffset: p };
}
function readOFSOffset(buf, offset) {
  let p = offset;
  let b = buf[p++];
  let ofs = b & 127;
  while (b & 128) {
    if (p >= buf.length) return null;
    b = buf[p++];
    ofs = ofs + 1 << 7 | b & 127;
  }
  return { offset: ofs, nextPos: p };
}
function applyDelta(base, deltaBytes) {
  let p = 0;
  function readVarint() {
    let result = 0;
    let shift = 0;
    while (p < deltaBytes.length) {
      const b = deltaBytes[p++];
      result |= (b & 127) << shift;
      if ((b & 128) === 0) return result;
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
    if (inst === 0) return null;
    if (inst < 128) {
      if (p + inst > deltaBytes.length) return null;
      deltaBytes.copy(out, outPos, p, p + inst);
      p += inst;
      outPos += inst;
    } else {
      const szN = inst >> 4 & 7;
      const offN = inst & 15;
      let copyOff = 0;
      let copySz = 0;
      if (offN > 0 && offN <= 4) {
        for (let i = 0; i < offN; i++) {
          if (p >= deltaBytes.length) return null;
          copyOff = copyOff << 8 | deltaBytes[p++];
        }
      } else if (offN === 0) {
        copyOff = 65536;
      } else {
        return null;
      }
      if (szN > 0 && szN <= 3) {
        for (let i = 0; i < szN; i++) {
          if (p >= deltaBytes.length) return null;
          copySz = copySz << 8 | deltaBytes[p++];
        }
      } else if (szN === 0) {
        copySz = 65536;
      } else {
        return null;
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
var packCache = /* @__PURE__ */ new Map();
var gitDirCurrent = "";
function readPackEntryByOffset(packPath, packBytes, offset) {
  let cache2 = packCache.get(packPath);
  if (!cache2) {
    cache2 = /* @__PURE__ */ new Map();
    packCache.set(packPath, cache2);
  }
  if (cache2.has(offset)) return cache2.get(offset);
  const head = readPackEntryHead(packBytes, offset);
  if (!head) return null;
  const { type, dataOffset } = head;
  if (type === OBJ_OFS_DELTA) {
    const ofs = readOFSOffset(packBytes, dataOffset);
    if (!ofs) return null;
    const baseOffset = offset - ofs.offset;
    if (baseOffset <= 0) return null;
    const baseRes = readPackEntryByOffset(packPath, packBytes, baseOffset);
    if (!baseRes) return null;
    let delta;
    try {
      delta = inflateSync(packBytes.slice(ofs.nextPos));
    } catch (e) {
      return null;
    }
    if (!delta) return null;
    const result = applyDelta(baseRes.content, delta);
    if (!result) return null;
    const nullIdx = result.indexOf(0);
    if (nullIdx < 0) return null;
    const objType = result.slice(0, nullIdx).toString("binary").split(" ")[0];
    const ret = { type: objType, content: result.slice(nullIdx + 1) };
    cache2.set(offset, ret);
    return ret;
  } else if (type === OBJ_REF_DELTA) {
    const baseHash = packBytes.slice(dataOffset, dataOffset + 20).toString("hex");
    const dataStart = dataOffset + 20;
    let baseRes = readLooseObject(gitDirCurrent, baseHash);
    if (!baseRes) baseRes = readPackObjectInternal(gitDirCurrent, baseHash);
    if (!baseRes) return null;
    let delta;
    try {
      delta = inflateSync(packBytes.slice(dataStart));
    } catch (e) {
      return null;
    }
    if (!delta) return null;
    const result = applyDelta(baseRes.content, delta);
    if (!result) return null;
    const nullIdx = result.indexOf(0);
    if (nullIdx < 0) return null;
    const objType = result.slice(0, nullIdx).toString("binary").split(" ")[0];
    const ret = { type: objType, content: result.slice(nullIdx + 1) };
    cache2.set(offset, ret);
    return ret;
  } else if (type === OBJ_COMMIT || type === OBJ_TREE || type === OBJ_BLOB || type === OBJ_TAG) {
    let content;
    try {
      content = inflateSync(packBytes.slice(dataOffset));
    } catch (e) {
      return null;
    }
    if (!content) return null;
    const typeName = ["", "commit", "tree", "blob", "tag", "", "ofs_delta", "ref_delta"][type];
    const ret = { type: typeName, content };
    cache2.set(offset, ret);
    return ret;
  }
  return null;
}
function readPackObjectInternal(gitDir, hash) {
  const packDir = join(gitDir, "objects", "pack");
  if (!existsSync(packDir)) return null;
  let files;
  try {
    files = readdirSync(packDir);
  } catch (e) {
    return null;
  }
  for (const f of files) {
    if (!f.endsWith(".idx")) continue;
    const idxPath = join(packDir, f);
    const map = loadIdxMap(gitDir, idxPath);
    if (!map) continue;
    const off = map.get(hash);
    if (off === void 0) continue;
    const packFile = idxPath.replace(/\.idx$/, ".pack");
    if (!existsSync(packFile)) continue;
    let packBytes;
    try {
      packBytes = readFileSync(packFile);
    } catch (e) {
      continue;
    }
    return readPackEntryByOffset(packFile, packBytes, off);
  }
  return null;
}
function readPackObject(gitDir, hash) {
  gitDirCurrent = gitDir;
  return readPackObjectInternal(gitDir, hash);
}
function readGitObject(gitDir, hash) {
  const loose = readLooseObject(gitDir, hash);
  if (loose) return loose;
  return readPackObject(gitDir, hash);
}
function readHead(gitDir) {
  const headPath = join(gitDir, "HEAD");
  if (!existsSync(headPath)) return null;
  let head;
  try {
    head = readFileSync(headPath, "utf8").trim();
  } catch (e) {
    return null;
  }
  if (!head) return null;
  if (head.startsWith("ref: ")) {
    const refPath = join(gitDir, head.slice("ref: ".length));
    let commit = null;
    if (existsSync(refPath)) {
      try {
        commit = readFileSync(refPath, "utf8").trim();
      } catch (e) {
      }
    }
    if (!commit) {
      const packedRefsPath = join(gitDir, "packed-refs");
      if (existsSync(packedRefsPath)) {
        try {
          const content = readFileSync(packedRefsPath, "utf8");
          for (const line of content.split(/\r?\n/)) {
            if (line.startsWith("#") || !line.trim()) continue;
            const m = line.match(/^([0-9a-f]{40})\s+(\S+)$/);
            if (m && m[2] === head.slice("ref: ".length)) {
              commit = m[1];
              break;
            }
          }
        } catch (e) {
        }
      }
    }
    if (!commit) return null;
    return { branch: head.slice("refs/heads/".length), commit };
  }
  return { branch: null, commit: head };
}
function parseTree(treeContent) {
  const entries = {};
  let i = 0;
  while (i < treeContent.length) {
    const spaceIdx = treeContent.indexOf(32, i);
    if (spaceIdx < 0) break;
    const mode = treeContent.slice(i, spaceIdx).toString("binary");
    i = spaceIdx + 1;
    const nullIdx = treeContent.indexOf(0, i);
    if (nullIdx < 0) break;
    const name2 = treeContent.slice(i, nullIdx).toString("utf8");
    i = nullIdx + 1;
    if (i + 20 > treeContent.length) break;
    const hashBuf = treeContent.slice(i, i + 20);
    const hash = hashBuf.toString("hex");
    i += 20;
    entries[name2] = { mode, hash };
  }
  return entries;
}
function collectTreeFiles(gitDir, treeHash, prefix = "") {
  const obj = readGitObject(gitDir, treeHash);
  if (!obj || obj.type !== "tree") return {};
  const tree = parseTree(obj.content);
  const files = {};
  for (const [name2, entry] of Object.entries(tree)) {
    const path2 = prefix ? `${prefix}/${name2}` : name2;
    if (entry.mode === "160000" || name2 === "node_modules" || name2 === ".git") {
      continue;
    }
    if (parseInt(entry.mode, 8) === 16384) {
      Object.assign(files, collectTreeFiles(gitDir, entry.hash, path2));
    } else {
      files[path2] = entry.hash;
    }
  }
  return files;
}
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
    else if (line === "") break;
  }
  return tree ? { tree, parents } : null;
}
async function detectChanges({ projectPath, since = "1 day ago" }) {
  const gitDir = join(projectPath, ".git");
  if (!existsSync(gitDir)) {
    return { files: [], stat: "", commits: [], error: "not a git repository (no .git directory)" };
  }
  let sinceN = 1;
  const m = String(since).match(/^(\d+)/);
  if (m) sinceN = Math.max(1, Math.min(100, parseInt(m[1], 10)));
  const head = readHead(gitDir);
  if (!head || !head.commit) {
    return { files: [], stat: "", commits: [], error: "cannot read HEAD" };
  }
  if (!/^[0-9a-f]{40}$/i.test(head.commit)) {
    return { files: [], stat: "", commits: [], error: "HEAD is not a valid commit hash: " + head.commit };
  }
  const curCommit = readCommit(gitDir, head.commit);
  if (!curCommit) {
    return {
      files: [],
      stat: "",
      commits: [],
      error: "cannot read current commit " + head.commit + "\uFF08commit object \u53EF\u80FD\u5728 .pack \u4E2D\uFF0C\u9700 pack \u652F\u6301\uFF0C\u6216 git repack -d \u89E3\u5F00 loose object\uFF09"
    };
  }
  const curFiles = collectTreeFiles(gitDir, curCommit.tree);
  let parentHash = head.commit;
  let parentCommit = null;
  for (let i = 0; i < sinceN; i++) {
    const cur = readCommit(gitDir, parentHash);
    if (!cur || !cur.parents || cur.parents.length === 0) {
      break;
    }
    parentHash = cur.parents[0];
  }
  if (parentHash !== head.commit) {
    parentCommit = readCommit(gitDir, parentHash);
  }
  const parentFiles = parentCommit ? collectTreeFiles(gitDir, parentCommit.tree) : {};
  const files = [];
  for (const [path2, hash] of Object.entries(curFiles)) {
    if (!parentFiles[path2]) {
      files.push({ path: path2, type: "added", hash });
    } else if (parentFiles[path2] !== hash) {
      files.push({ path: path2, type: "modified", hash });
    }
  }
  for (const path2 of Object.keys(parentFiles)) {
    if (!curFiles[path2]) {
      files.push({ path: path2, type: "deleted" });
    }
  }
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
    files: files.map((f) => f.path),
    // 简化为路径数组（兼容 v0.4.1 smoke）
    changes: files,
    // 详细 change 列表（new field）
    stat: files.length === 0 ? "" : ` ${files.filter((f) => f.type === "added").length} files added, ${files.filter((f) => f.type === "modified").length} modified, ${files.filter((f) => f.type === "deleted").length} deleted`,
    commits,
    since: "commit+" + sinceN,
    scannedAt: Date.now()
  };
}
function buildDiffPrompt({ changes, projectPath, maxChars = 4e3 }) {
  const fileList = (changes.changes || changes.files || []).map(
    (f) => typeof f === "string" ? `  - ${f}` : `  - [${f.type}] ${f.path}`
  ).join("\n") || "  (\u65E0\u6587\u4EF6\u53D8\u66F4)";
  const commitList = (changes.commits || []).map((c) => `  - ${c}`).join("\n") || "  (\u65E0 commit \u8BB0\u5F55)";
  const prompt = `\u4F60\u662F\u4E00\u4E2A\u9879\u76EE\u67B6\u6784\u5206\u6790\u5E08\u3002\u8BF7\u57FA\u4E8E\u4EE5\u4E0B git diff \u4FE1\u606F\uFF0C\u8F93\u51FA JSON \u683C\u5F0F\u7684\u67B6\u6784\u53D8\u66F4\u5206\u6790\u3002

\u9879\u76EE\u8DEF\u5F84: ${projectPath}
\u626B\u63CF\u65F6\u95F4\u7A97\u53E3: since=${changes.since || "commit+1"}

\u53D8\u66F4\u6587\u4EF6:
${fileList}

\u6700\u8FD1 commit:
${commitList}

\u53D8\u66F4\u7EDF\u8BA1:
${changes.stat ? changes.stat : "(\u65E0\u7EDF\u8BA1)"}

\u8BF7\u8F93\u51FA JSON\uFF08\u4E0D\u8981 markdown code block\uFF0C\u4E0D\u8981\u5176\u4ED6\u6587\u5B57\uFF09\uFF1A
{
  "changes": [{"file": "\u76F8\u5BF9\u8DEF\u5F84", "type": "added|modified|deleted", "summary": "\u4E00\u53E5\u8BDD\u63CF\u8FF0"}],
  "architectureMemory": {
    "title": "\u67B6\u6784\u53D8\u66F4\u4E00\u53E5\u8BDD\u6807\u9898\uFF08<=50 \u5B57\uFF09",
    "content": "what + why\uFF08200-400 \u5B57\uFF0C\u8BF4\u660E\u67B6\u6784\u5C42\u9762\u7684\u53D8\u5316\uFF09"
  }
}

\u8981\u6C42\uFF1A
- \u5173\u6CE8\u67B6\u6784\u5C42\u9762\u53D8\u5316\uFF08\u65B0\u6A21\u5757\u3001\u65B0\u4F9D\u8D56\u3001\u65B0\u6A21\u5F0F\uFF09\uFF0C\u4E0D\u8981\u9010\u6587\u4EF6\u63CF\u8FF0
- \u5982\u679C\u53EA\u662F\u6587\u6863\u4FEE\u6539\u6216\u6742\u9879\u53D8\u66F4\uFF0CarchitectureMemory.title \u5199 "\u975E\u67B6\u6784\u53D8\u66F4\uFF08\u6742\u9879\uFF09"
- content \u7528\u4E2D\u6587`;
  return prompt.slice(0, maxChars);
}

// src/host/integrations/llm.js
var MOCK_RESPONSE_TEXT = JSON.stringify({
  changes: [
    { file: "src/auth/login.ts", type: "modified", summary: "\u8BA4\u8BC1\u903B\u8F91\u8C03\u6574" },
    { file: "src/auth/oauth.ts", type: "added", summary: "\u65B0\u589E OAuth2 \u63A5\u5165" }
  ],
  architectureMemory: {
    title: "\u67B6\u6784\u53D8\u66F4\uFF1A\u4ECE session \u8BA4\u8BC1\u8FC1\u79FB\u5230 OAuth2",
    content: "\u672C\u6B21\u91CD\u6784\u5C06 auth \u6A21\u5757\u4ECE session-based \u8BA4\u8BC1\u8FC1\u79FB\u5230 OAuth2\uFF0C\u65B0\u589E oauth.ts \u6A21\u5757\u5C01\u88C5 OAuth2 client\uFF0C\u5904\u7406 token \u5237\u65B0 + \u56DE\u8C03\u8DEF\u7531\u3002"
  },
  commit: "git@HEAD",
  note: "[MOCK_LLM] DSH llm service \u4E0D\u53EF\u7528\u6216\u672A\u914D\u7F6E API key\uFF0C\u8FD4\u56DE mock \u6570\u636E\u3002\u8BF7\u914D\u7F6E llmApiUrl/llmApiKey/llmModel \u53C2\u6570\u6216 DSH_LLM_API_URL/KEY/MODEL env\u3002"
});
async function mockFetchLLM({ prompt }) {
  const preview = prompt.slice(0, 200).replace(/"/g, '\\"');
  return MOCK_RESPONSE_TEXT.replace(
    '"[MOCK_LLM] DSH llm service \u4E0D\u53EF\u7528\u6216\u672A\u914D\u7F6E API key\uFF0C\u8FD4\u56DE mock \u6570\u636E\u3002\u8BF7\u914D\u7F6E llmApiUrl/llmApiKey/llmModel \u53C2\u6570\u6216 DSH_LLM_API_URL/KEY/MODEL env\u3002"',
    `"[MOCK_LLM] \u7528\u6237 prompt \u524D 200 \u5B57: ${preview}\u3002\u8BF7\u914D\u7F6E llmApiUrl/llmApiKey/llmModel \u53C2\u6570\u6216 DSH_LLM_API_URL/KEY/MODEL env\u3002"`
  );
}
function detectProtocol(apiUrl) {
  if (!apiUrl) return "openai";
  if (/anthropic/i.test(apiUrl)) return "anthropic";
  return "openai";
}
async function fetchAnthropic({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  if (!apiUrl || !apiKey) throw new Error("apiUrl/apiKey not configured");
  const url = apiUrl.replace(/\/$/, "") + "/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model || "claude-3-5-sonnet-20240620",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens || 2e3
    }),
    signal
  });
  if (!res.ok) {
    const text2 = await res.text();
    throw new Error("LLM API error " + res.status + ": " + text2.slice(0, 200));
  }
  const data = await res.json();
  const text = data && data.content && data.content[0] && data.content[0].text;
  if (!text) throw new Error("LLM API returned empty content: " + JSON.stringify(data).slice(0, 200));
  return String(text);
}
async function fetchOpenAI({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  if (!apiUrl || !apiKey) throw new Error("apiUrl/apiKey not configured");
  const url = apiUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens || 2e3,
      stream: false
    }),
    signal
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("LLM API error " + res.status + ": " + text.slice(0, 200));
  }
  const data = await res.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error("LLM API returned empty content: " + JSON.stringify(data).slice(0, 200));
  return String(content);
}
async function realFetchLLM({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  const protocol = detectProtocol(apiUrl);
  if (protocol === "anthropic") {
    return await fetchAnthropic({ prompt, maxTokens, apiUrl, apiKey, model, signal });
  }
  return await fetchOpenAI({ prompt, maxTokens, apiUrl, apiKey, model, signal });
}
async function callLLMWithFallback({ prompt, maxTokens, apiUrl, apiKey, model, signal } = {}) {
  if (apiUrl && apiKey) {
    try {
      return await realFetchLLM({ prompt, maxTokens, apiUrl, apiKey, model, signal });
    } catch (e) {
      return await mockFetchLLM({ prompt });
    }
  }
  return await mockFetchLLM({ prompt });
}
function parseLLMArchitectureResponse(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.architectureMemory && parsed.architectureMemory.title) {
      return parsed;
    }
  } catch (e) {
  }
  return {
    changes: [],
    architectureMemory: {
      title: "\u67B6\u6784\u53D8\u66F4\uFF08\u672A\u7ED3\u6784\u5316\uFF09",
      content: text.slice(0, 1e3)
    },
    note: "[parse-fallback] LLM \u8F93\u51FA\u975E JSON\uFF0C\u5DF2\u5305\u6210 fallback"
  };
}

// src/tools/diff.js
function buildDiffTool({ fs, sandboxPolicy }) {
  return defineTool9({
    name: "project_diff",
    description: "dsh-project-brain v0.4.2: \u7528 node \u5185\u7F6E fs/zlib \u8BFB .git \u4ED3\u5E93\uFF08\u4E0D\u4F9D\u8D56 DSH shell service\uFF09\u2192 \u8C03 user-configured LLM\uFF08OpenAI \u517C\u5BB9 API\uFF09\u5206\u6790\u67B6\u6784\u53D8\u5316 \u2192 \u751F\u6210 architecture memory\u3002 \u4E0E project_dream \u533A\u522B\uFF1Adream \u6E05\u7406\u91CD\u590D memory\uFF0Cdiff \u4E3B\u52A8\u7406\u89E3\u4EE3\u7801\u5C42\u67B6\u6784\u53D8\u5316\uFF08\u65B0\u589E\u6A21\u5757 / \u65B0\u4F9D\u8D56 / \u65B0\u6A21\u5F0F\uFF09\u3002 dryRun=true \u65F6\u53EA\u626B\u63CF\u4E0D\u5199 memory\uFF1B\u9ED8\u8BA4 false \u4F1A\u8FFD\u52A0 type=architecture / type=change \u7684 memory \u5230 memory.jsonl\u3002",
    parameters: {
      path: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u5FC5\u4F20\uFF09" },
      since: { type: "string", description: "git diff \u7A97\u53E3\uFF08commit \u6570\uFF0C\u9ED8\u8BA4 1 \u2014 \u5BF9\u6BD4 HEAD vs HEAD~1\uFF1B\u4E5F\u652F\u6301 '5' \u7B49\u6574\u6570\uFF09" },
      maxTokens: { type: "number", description: "LLM \u8F93\u51FA token \u9884\u7B97\uFF08\u9ED8\u8BA4 2000\uFF09" },
      dryRun: { type: "boolean", description: "\u53EA\u626B\u63CF\u4E0D\u5199 memory\uFF08\u9ED8\u8BA4 false\uFF09" },
      llmApiUrl: { type: "string", description: "LLM API endpoint\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4\u8BFB env DSH_LLM_API_URL \u6216 fallback mock\uFF09" },
      llmApiKey: { type: "string", description: "LLM API key\uFF08\u53EF\u9009\uFF1B\u9ED8\u8BA4\u8BFB env DSH_LLM_API_KEY\uFF09" },
      llmModel: { type: "string", description: "LLM \u6A21\u578B\u540D\uFF08\u9ED8\u8BA4\u8BFB env DSH_LLM_MODEL \u6216 'gpt-4o-mini'\uFF09" }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" }
        }
      },
      render: (_args, value) => renderDiff(value)
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const since = args && typeof args.since === "string" && args.since.trim() ? args.since.trim() : "1";
        const maxTokens = args && typeof args.maxTokens === "number" ? args.maxTokens : 2e3;
        const dryRun = !!(args && args.dryRun);
        const llmApiUrl = args && typeof args.llmApiUrl === "string" && args.llmApiUrl.trim() ? args.llmApiUrl.trim() : typeof process !== "undefined" && process.env && process.env.DSH_LLM_API_URL || null;
        const llmApiKey = args && typeof args.llmApiKey === "string" && args.llmApiKey.trim() ? args.llmApiKey.trim() : typeof process !== "undefined" && process.env && process.env.DSH_LLM_API_KEY || null;
        const llmModel = args && typeof args.llmModel === "string" && args.llmModel.trim() ? args.llmModel.trim() : typeof process !== "undefined" && process.env && process.env.DSH_LLM_MODEL || "gpt-4o-mini";
        const changes = await detectChanges({ projectPath, since });
        if (changes.error) {
          return { ok: false, code: "E_DIFF_SCAN_FAILED", message: changes.error };
        }
        if (!changes.files.length && !changes.changes.length) {
          return { ok: true, data: { changes, llmSkipped: "no changes detected", note: "\u65E0\u4EE3\u7801\u53D8\u66F4\uFF0C\u65E0\u9700\u8C03 LLM" } };
        }
        const prompt = buildDiffPrompt({ changes, projectPath });
        const rawText = await callLLMWithFallback({
          prompt,
          maxTokens,
          apiUrl: llmApiUrl,
          apiKey: llmApiKey,
          model: llmModel
        });
        const parsed = parseLLMArchitectureResponse(rawText);
        if (!dryRun && parsed.architectureMemory && parsed.architectureMemory.title) {
          const now = Date.now();
          const archMem = makeMemoryEntry({
            type: "architecture",
            title: parsed.architectureMemory.title,
            content: parsed.architectureMemory.content || "",
            importance: 0.75,
            confidence: 0.7,
            relatedFiles: (parsed.changes || []).map((c) => c.file).filter(Boolean).slice(0, 20),
            source: { kind: "project_diff", model: llmModel, since }
          }, now);
          await appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), archMem);
          const tl = {
            id: "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            title: "project_diff \u5B8C\u6210\uFF08" + (parsed.changes ? parsed.changes.length : 0) + " \u6587\u4EF6\u53D8\u5316\uFF09",
            eventType: "diff",
            occurredAt: Date.now(),
            detail: "since=" + since + " files=" + (changes.files ? changes.files.length : changes.changes ? changes.changes.length : 0)
          };
          await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), tl);
        }
        return {
          ok: true,
          data: {
            changes: {
              files: changes.files || [],
              changes: changes.changes || [],
              stat: changes.stat,
              commits: changes.commits,
              since: changes.since
            },
            architectureMemory: parsed.architectureMemory,
            changeDetails: parsed.changes || [],
            note: parsed.note || "dr=" + (dryRun ? "true" : "false") + " llm=" + (parsed.note ? "fallback" : "ok")
          }
        };
      } catch (e) {
        return { ok: false, code: "E_DIFF_FAILED", message: String(e && e.message || e) };
      }
    }
  });
}
function renderDiff(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: project_diff FAILED - " + String(value) }];
  if (!value.ok) {
    return [{ type: "text", text: "dsh-project-brain: project_diff FAILED - " + (value.code || "") + ": " + (value.message || "") }];
  }
  const d = value.data || {};
  const lines = [{ type: "text", text: "dsh-project-brain: project_diff \u5B8C\u6210" }];
  if (d.changes) {
    const files = d.changes.files || [];
    const commits = d.changes.commits || [];
    const detailed = d.changes.changes || [];
    lines.push({ type: "text", text: "  \u53D8\u66F4\u6587\u4EF6: " + files.length + " \u4E2A / commits: " + commits.length + " \u6761 / detailed: " + detailed.length + " \u6761" });
    if (d.changes.since) lines.push({ type: "text", text: "  \u65F6\u95F4\u7A97\u53E3: " + d.changes.since });
  }
  if (d.architectureMemory && d.architectureMemory.title) {
    lines.push({ type: "text", text: "  \u2713 architecture memory: " + d.architectureMemory.title });
  }
  if (d.changeDetails && d.changeDetails.length) {
    for (const c of d.changeDetails.slice(0, 5)) {
      lines.push({ type: "text", text: "    [" + (c.type || "?") + "] " + (c.file || "?") + " \u2014 " + (c.summary || "") });
    }
  }
  if (d.note) lines.push({ type: "text", text: "  note: " + d.note });
  return lines;
}

// src/host/sidebar/aggregator.js
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import path from "node:path";
var CACHE_TTL_MS = 5e3;
var cache = /* @__PURE__ */ new Map();
function invalidateAggregatorCache(projectPath) {
  if (projectPath) {
    cache.delete(projectPath);
  } else {
    cache.clear();
  }
}
function readJsonSync(filePath) {
  if (!existsSync2(filePath)) return null;
  try {
    return JSON.parse(readFileSync2(filePath, "utf8"));
  } catch (e) {
    return { __error: String(e && e.message || e) };
  }
}
function readJsonlSync(filePath) {
  if (!existsSync2(filePath)) return [];
  const out = [];
  for (const line of readFileSync2(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch (e) {
    }
  }
  return out;
}
function deriveFallbackPhase(p) {
  const now = Date.now();
  const ts = p && (p.updatedAt || p.lastScannedAt) || now;
  const ageMs = now - ts;
  if (ageMs < 6e4) {
    return { title: "Project Brain \u5DF2\u5C31\u7EEA", progress: { done: 1, total: 1 } };
  }
  if (ageMs < 24 * 36e5) {
    return { title: "\u4ECA\u65E5\u6D3B\u8DC3", progress: { done: 1, total: 2 } };
  }
  return { title: "\u7EF4\u62A4\u4E2D", progress: { done: 1, total: 3 } };
}
function derivePhase(p, todos) {
  const active = todos.filter((t) => t && t.status !== "cancelled");
  if (active.length === 0) return deriveFallbackPhase(p);
  const done = active.filter((t) => t.status === "done").length;
  const inProgress = active.filter((t) => t.status === "in_progress");
  const title = inProgress.length > 0 ? "\u8FDB\u884C\u4E2D\uFF1A" + inProgress[0].title : "\u5F85\u529E " + (active.length - done) + " \u9879";
  return { title, progress: { done, total: active.length } };
}
function buildSidebarPreview(projectPath) {
  if (!projectPath) projectPath = ".";
  const cached = cache.get(projectPath);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const brainDir = path.join(projectPath, ".project-brain");
  const p = readJsonSync(path.join(brainDir, "project.json"));
  const architecture = readJsonSync(path.join(brainDir, "architecture.json"));
  const timeline = readJsonlSync(path.join(brainDir, "timeline.jsonl"));
  const memories = readJsonlSync(path.join(brainDir, "memory.jsonl"));
  const visibleMemories = memories.filter(isActiveMemory);
  const todos = readJsonlSync(path.join(brainDir, "todo.jsonl"));
  let data;
  if (!p) {
    data = { initialized: false, empty: true, projectPath };
  } else if (p.__error) {
    data = { initialized: false, error: p.__error, projectPath };
  } else {
    const activity = recentTimeline(timeline, 3).map((e) => ({
      id: e.id,
      title: e.title,
      occurredAt: e.occurredAt,
      eventType: e.eventType
    }));
    const stats = todoStats(todos);
    data = {
      initialized: true,
      projectPath,
      project: {
        id: p.id,
        name: p.name,
        type: techStackToType(p.techStack),
        lastUpdateAt: p.updatedAt || p.lastScannedAt || Date.now()
      },
      phase: derivePhase(p, todos),
      recentActivity: activity.length > 0 ? activity : p.lastScannedAt ? [{
        id: "scan",
        title: "\u5B8C\u6210 project_init \u626B\u63CF",
        occurredAt: p.lastScannedAt,
        eventType: "init"
      }] : [],
      memories: visibleMemories.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3),
      todos,
      architecture: architecture && !architecture.__error ? architecture : null,
      stats: {
        pendingTodos: stats.pendingTodos,
        completedTodos: stats.completedTodos,
        decisions: visibleMemories.filter((m) => m.type === "decision").length
      }
    };
  }
  cache.set(projectPath, { ts: Date.now(), data });
  return data;
}
async function buildWorkspacePreview(fs, workspaceRoot) {
  if (!workspaceRoot) workspaceRoot = ".";
  const root = String(workspaceRoot).replace(/[\\/]+$/, "");
  async function readJson2(file) {
    try {
      const target = await fs.resolve(root + "/" + file);
      const text = await fs.readText(target);
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  async function readJsonl2(file) {
    let text;
    try {
      const target = await fs.resolve(root + "/" + file);
      text = await fs.readText(target);
    } catch (e) {
      return [];
    }
    const out = [];
    for (const line of String(text).split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try {
        out.push(JSON.parse(s));
      } catch (e) {
      }
    }
    return out;
  }
  const [p, timelineAll, memoriesAll, todosAll, codegraph, architecture] = await Promise.all([
    readJson2(".project-brain/project.json"),
    readJsonl2(".project-brain/timeline.jsonl"),
    readJsonl2(".project-brain/memory.jsonl"),
    readJsonl2(".project-brain/todo.jsonl"),
    readJson2(".project-brain/codegraph.json"),
    readJson2(".project-brain/architecture.json")
  ]);
  if (!p) {
    return {
      generatedAt: Date.now(),
      initialized: false,
      workspaceRoot: root,
      project: null,
      phase: null,
      recentActivity: [],
      memories: [],
      memoriesAll: [],
      todos: [],
      timelineAll: [],
      architecture: null,
      stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 }
    };
  }
  const timeline = timelineAll.slice().sort((a, b) => (b.occurredAt || 0) - (a.occurredAt || 0));
  const visibleMemories = memoriesAll.filter(isActiveMemory);
  const recentActivity = timeline.slice(0, 5).map((e) => ({ id: e.id, title: e.title, occurredAt: e.occurredAt, eventType: e.eventType }));
  const memories = visibleMemories.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 3);
  const stats = todoStats(todosAll);
  const inProgress = todosAll.filter((t) => t && t.status === "in_progress");
  const activeForPhase = todosAll.filter((t) => t && t.status !== "cancelled");
  const phase = activeForPhase.length > 0 ? {
    title: inProgress.length > 0 ? "\u8FDB\u884C\u4E2D\uFF1A" + inProgress[0].title : "\u5F85\u529E " + stats.pendingTodos + " \u9879",
    progress: { done: stats.completedTodos, total: activeForPhase.length }
  } : {
    title: "\u5DF2\u626B\u63CF\uFF08" + (p.entrypoints ? p.entrypoints.length : 0) + " \u4E2A\u5165\u53E3\uFF09",
    progress: { done: 1, total: 1 }
  };
  const todosActive = activeTodos(todosAll);
  const todosDone = todosAll.filter((t) => t && t.status === "done");
  const todos = todosActive.concat(todosDone).slice(0, 50);
  return {
    generatedAt: Date.now(),
    initialized: true,
    workspaceRoot: root,
    project: {
      id: p.id,
      name: p.name || "(unnamed)",
      type: techStackToType(p.techStack),
      description: sanitizeProjectDescription(p.description) || "",
      techStack: p.techStack || {},
      tooling: p.tooling || [],
      languages: p.languages || {},
      entrypoints: p.entrypoints || [],
      lastUpdateAt: p.updatedAt || p.lastScannedAt || Date.now()
    },
    phase,
    recentActivity: recentActivity.length > 0 ? recentActivity : p.lastScannedAt ? [{
      id: "scan",
      title: "\u5B8C\u6210 project_init \u626B\u63CF",
      occurredAt: p.lastScannedAt,
      eventType: "init"
    }] : [],
    memories,
    memoriesAll: visibleMemories.slice().sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 50),
    todos,
    timelineAll: timeline.slice(0, 50),
    codegraph,
    architecture,
    stats: {
      pendingTodos: stats.pendingTodos,
      completedTodos: stats.completedTodos,
      decisions: visibleMemories.filter((m) => m.type === "decision").length,
      archivedMemories: memoriesAll.length - visibleMemories.length
    }
  };
}

// src/host/rpc/sidebar.js
var PROJECT_BRAIN_RPC_CHANNEL = "/project-brain";
function getCwdBySession(ctx, sessionId) {
  if (!sessionId) return null;
  let sessions;
  try {
    sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
  } catch (e) {
    sessions = void 0;
  }
  if (!sessions || typeof sessions.get !== "function") return null;
  try {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return session.meta && session.meta.cwd || session.header && session.header.cwd || session.cwd || null;
  } catch (e) {
    return null;
  }
}
function getSession(ctx, sessionId) {
  if (!sessionId) return null;
  let sessions;
  try {
    sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
  } catch (e) {
    sessions = null;
  }
  try {
    return sessions && typeof sessions.get === "function" ? sessions.get(sessionId) : null;
  } catch (e) {
    return null;
  }
}
function rpcOk(value) {
  return { ok: true, value };
}
function rpcError(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      details: details && typeof details === "object" ? details : {}
    }
  };
}
function resolveRpcProjectPath(ctx, payload) {
  return getCwdBySession(ctx, payload && payload.sessionId);
}
function registerConnectionRpc({ connection, ctx, fs, sandboxPolicy, tools, logger, getMemoryConfig, getLlm }) {
  if (!connection || !connection.rpc || typeof connection.rpc.handle !== "function") {
    if (logger && typeof logger.warn === "function") {
      logger.warn("[dsh-project-brain] connection.rpc unavailable; runtime preview disabled");
    }
    return false;
  }
  connection.rpc.handle(
    PROJECT_BRAIN_RPC_CHANNEL,
    async (endpoint, payload) => {
      const projectPath = resolveRpcProjectPath(ctx, payload || {});
      const session = getSession(ctx, payload && payload.sessionId);
      const architectureRuntime = {
        getMemoryConfig,
        getLlm,
        llmRoute: resolveSessionRoute(session),
        getLlmRoute: () => resolveSessionRoute(getSession(ctx, payload && payload.sessionId)),
        sessionId: payload && payload.sessionId
      };
      if (!projectPath) {
        return rpcError(
          "WORKSPACE_NOT_FOUND",
          "\u65E0\u6CD5\u4ECE\u5F53\u524D Session \u89E3\u6790 workspace \u8DEF\u5F84",
          { sessionId: payload && payload.sessionId ? payload.sessionId : null }
        );
      }
      if (endpoint === "preview") {
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          projectPath,
          preview
        });
      }
      if (endpoint === "init") {
        const result = await scanAndWrite(
          fs,
          sandboxPolicy,
          { path: projectPath, dryRun: false },
          "project_init",
          architectureRuntime
        );
        if (!result || !result.ok) {
          const error = result && result.data && result.data.error;
          return rpcError(
            error && error.code || "INIT_FAILED",
            error && error.message || "\u9879\u76EE\u5927\u8111\u521D\u59CB\u5316\u5931\u8D25",
            { projectPath }
          );
        }
        invalidateAggregatorCache(projectPath);
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          projectPath,
          scan: result.data,
          preview
        });
      }
      if (endpoint === "action") {
        const action = payload && typeof payload.action === "string" ? payload.action : "";
        const toolActions = {
          todos: { name: "project_todo_list", args: { limit: 50 }, mutates: false },
          dream: { name: "project_dream", args: { mode: "light", dryRun: true }, mutates: false },
          dreamCommit: { name: "project_dream", args: { mode: "light", dryRun: false }, mutates: true },
          overview: { name: "project_continue", args: {}, mutates: false }
        };
        if (action === "rescan") {
          const result2 = await scanAndWrite(
            fs,
            sandboxPolicy,
            { path: projectPath, dryRun: false },
            "project_rescan",
            architectureRuntime
          );
          if (!result2 || !result2.ok) {
            const error = result2 && result2.data && result2.data.error;
            return rpcError(
              error && error.code || "RESCAN_FAILED",
              error && error.message || "\u91CD\u65B0\u626B\u63CF\u5931\u8D25",
              { action, projectPath }
            );
          }
          invalidateAggregatorCache(projectPath);
          const preview2 = await buildWorkspacePreview(fs, projectPath);
          preview2.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
          return rpcOk({
            action,
            projectPath,
            result: result2,
            preview: preview2
          });
        }
        const definition = toolActions[action];
        if (!definition) {
          return rpcError("ACTION_NOT_ALLOWED", "\u4E0D\u652F\u6301\u7684 Project Brain \u64CD\u4F5C\uFF1A" + action, { action });
        }
        if (!tools || typeof tools.execute !== "function") {
          return rpcError("TOOLS_UNAVAILABLE", "DSH tools service unavailable", { action });
        }
        let result;
        try {
          result = await tools.execute({
            name: definition.name,
            args: Object.assign({}, definition.args, { path: projectPath })
          });
        } catch (error) {
          return rpcError(
            "ACTION_FAILED",
            String(error && error.message || error),
            { action, tool: definition.name }
          );
        }
        if (!result || result.ok === false) {
          const nested = result && result.data && result.data.error;
          return rpcError(
            nested && nested.code || result && result.code || "ACTION_FAILED",
            nested && nested.message || result && result.message || "\u64CD\u4F5C\u6267\u884C\u5931\u8D25",
            { action, tool: definition.name }
          );
        }
        if (definition.mutates) invalidateAggregatorCache(projectPath);
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          action,
          projectPath,
          result,
          preview
        });
      }
      return rpcError("METHOD_NOT_FOUND", "\u672A\u77E5 Project Brain RPC \u65B9\u6CD5\uFF1A" + endpoint, { endpoint });
    },
    { authority: "loopback" }
  );
  return true;
}
function registerSidebarRpc({ harness, ctx, fs, tools, getDefaultProjectPath, logger }) {
  const disposers = [];
  if (!harness || typeof harness.handle !== "function") {
    (logger && typeof logger.warn === "function" ? logger : { warn: (m) => console.warn(m) }).warn("[dsh-project-brain] harness builtin unavailable, skip RPC registration (host-side features will not work; restart DSH to load normally)");
    return disposers;
  }
  const getPreviewDisposer = harness.handle("project_brain/sidebar.getPreview", async (args) => {
    let projectPath = null;
    try {
      if (args && args.sessionId) {
        projectPath = getCwdBySession(ctx, args.sessionId);
      }
    } catch (e) {
    }
    if (!projectPath) projectPath = getDefaultProjectPath();
    return buildSidebarPreview(projectPath);
  });
  disposers.push(getPreviewDisposer);
  const initDisposer = harness.handle("project_brain/initProject", async (args) => {
    if (!tools || typeof tools.execute !== "function") {
      return { ok: false, code: "E_NO_TOOLS", message: "tools service unavailable" };
    }
    const userArgs = Object.assign({}, args && args.args || {});
    if (!userArgs.path && userArgs.sessionId) {
      try {
        const resolved = getCwdBySession(ctx, userArgs.sessionId);
        if (resolved) {
          userArgs.path = resolved;
          if (ctx && ctx.logger && typeof ctx.logger.info === "function") {
            try {
              ctx.logger.info("[dsh-project-brain] initProject: sessionId " + String(userArgs.sessionId).slice(0, 12) + "\u2026 \u2192 cwd " + resolved);
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
    }
    try {
      const result = await tools.execute({
        name: "project_init",
        args: userArgs
      });
      return result;
    } catch (e) {
      return { ok: false, code: "E_INIT_FAILED", message: String(e && e.message || e) };
    }
  });
  disposers.push(initDisposer);
  const continueDisposer = harness.handle("project_brain/continueSession", async (args) => {
    if (!tools || typeof tools.execute !== "function") {
      return { ok: false, code: "E_NO_TOOLS", message: "tools service unavailable" };
    }
    try {
      const result = await tools.execute({
        name: "project_continue",
        args: args && args.args || {}
      });
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, code: "E_CONTINUE_FAILED", message: String(e && e.message || e) };
    }
  });
  disposers.push(continueDisposer);
  return disposers;
}

// src/host/injector.js
var DEFAULT_MAX_TOKENS = 1500;
var projectCache = /* @__PURE__ */ new Map();
var sessionProjects = /* @__PURE__ */ new Map();
function cwdFrom(value) {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.cwd,
    value.meta && value.meta.cwd,
    value.header && value.header.cwd,
    value.header && value.header.meta && value.header.meta.cwd
  ];
  for (const cwd of candidates) {
    if (typeof cwd === "string" && cwd.trim()) return cwd.trim();
  }
  return null;
}
function sessionFrom(value) {
  if (!value || typeof value !== "object") return null;
  return value.session || value.agent && value.agent.session || value.initiator && value.initiator.session || value.currentSession || null;
}
function sessionIdFrom(value) {
  if (!value || typeof value !== "object") return null;
  const session = sessionFrom(value);
  return value.sessionId || value.id || session && (session.id || session.meta && session.meta.id) || null;
}
function resolveContextProject(context, sessions) {
  const direct = cwdFrom(context) || cwdFrom(sessionFrom(context));
  if (direct) return direct;
  const sid = sessionIdFrom(context);
  if (sid && sessionProjects.has(sid)) return sessionProjects.get(sid);
  if (sid && sessions && typeof sessions.get === "function") {
    try {
      const cwd = cwdFrom(sessions.get(sid));
      if (cwd) return cwd;
    } catch (e) {
    }
  }
  if (projectCache.size === 1) return projectCache.keys().next().value;
  return null;
}
function estimateTokens(text) {
  if (!text) return 0;
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const other = text.length - cn;
  return Math.ceil(cn / 1.5 + other / 4);
}
function truncateToTokens(md, maxTokens) {
  if (estimateTokens(md) <= maxTokens) return md;
  const lines = md.split("\n");
  let used = 0;
  const out = [];
  for (const line of lines) {
    const t = estimateTokens(line);
    if (used + t > maxTokens) {
      out.push("\n\u2026\uFF08\u5185\u5BB9\u8D85\u51FA token \u9884\u7B97\u5DF2\u622A\u65AD\uFF0C\u53EF\u8C03\u7528 project_continue / project_memory_list \u83B7\u53D6\u5B8C\u6574\u5185\u5BB9\uFF09");
      break;
    }
    out.push(line);
    used += t;
  }
  return out.join("\n");
}
function topKMemories(memories, n) {
  return retrieveMemories({ memories, topK: n }).map((hit) => hit.memory);
}
function renderContext(projectData, memories, todos, recentEvents, activeTodo) {
  const lines = [];
  lines.push("## Project Brain Context\uFF08\u81EA\u52A8\u6CE8\u5165 \xB7 v0.3.0\uFF09");
  lines.push("");
  lines.push("> \u4EE5\u4E0B\u5185\u5BB9\u7531 dsh-project-brain \u81EA\u52A8\u4ECE `.project-brain/` \u8BFB\u53D6\uFF0C\u7528\u4E8E\u8BA9\u4F60\uFF08LLM\uFF09\u4E00\u8FDB\u5165 session \u5C31\u638C\u63E1\u9879\u76EE\u4E0A\u4E0B\u6587\u3002\u53EF\u8C03\u7528 `project_continue` / `project_memory_list` / `project_todo_list` \u83B7\u53D6\u66F4\u8BE6\u7EC6\u6570\u636E\u3002");
  lines.push("");
  if (projectData) {
    lines.push("### \u9879\u76EE\u6982\u51B5");
    lines.push(`- \u540D\u79F0: ${projectData.name || "(\u672A\u547D\u540D)"}`);
    if (projectData.type) lines.push(`- \u7C7B\u578B: ${projectData.type}`);
    if (projectData.techStack) {
      const ts = Object.entries(projectData.techStack).map(([k, v]) => `${k}=${v}`).join(", ");
      if (ts) lines.push(`- \u6280\u672F\u6808: ${ts}`);
    }
    if (projectData.description) lines.push(`- \u7B80\u4ECB: ${projectData.description}`);
    lines.push("");
  }
  if (memories.length > 0) {
    lines.push("### \u5173\u952E\u8BB0\u5FC6\uFF08\u6309\u91CD\u8981\u5EA6+\u65F6\u65B0\u6027\u6392\u5E8F\uFF0CTop " + memories.length + "\uFF09");
    for (const m of memories) {
      const tag = m.type ? `[${m.type}] ` : "";
      lines.push(`- ${tag}${m.title}`);
      if (m.content) {
        const snippet = String(m.content).slice(0, 200).replace(/\n+/g, " ");
        lines.push(`  ${snippet}`);
      }
    }
    lines.push("");
  }
  if (todos.length > 0) {
    lines.push("### \u6D3B\u8DC3 TODO\uFF08\u6700\u591A 5\uFF09");
    for (const t of todos.slice(0, 5)) {
      const prio = t.priority ? `[${t.priority}] ` : "";
      const status = t.status === "in_progress" ? "\u23F3 " : "";
      lines.push(`- ${status}${prio}${t.title}`);
    }
    lines.push("");
  }
  if (recentEvents.length > 0) {
    lines.push("### \u6700\u8FD1\u6D3B\u52A8");
    for (const e of recentEvents) {
      const date = new Date(e.occurredAt);
      const ymd = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
      lines.push(`- ${ymd}: ${e.title}`);
    }
    lines.push("");
  }
  if (activeTodo) {
    lines.push(`> \u26A1 \u5F53\u524D\u8FDB\u884C\u4E2D\uFF1A**${activeTodo.title}** \uFF08\u4F18\u5148\u7EA7 ${activeTodo.priority || "medium"}\uFF09`);
  }
  lines.push("");
  lines.push("### \u9879\u76EE\u8BB0\u5FC6\u7EA6\u5B9A");
  lines.push("- \u5F00\u53D1\u4E2D\u51FA\u73B0\u7A33\u5B9A\u7684\u67B6\u6784\u51B3\u7B56\u3001\u9700\u6C42\u7EA6\u675F\u3001Bug \u6839\u56E0\u6216\u53EF\u590D\u7528\u6559\u8BAD\u65F6\uFF0C\u8C03\u7528 `project_memory_add` \u6301\u4E45\u5316\u3002");
  lines.push("- \u65B0\u4EFB\u52A1\u7528 `project_todo_add`\uFF0C\u72B6\u6001\u53D8\u5316\u7528 `project_todo_update` / `project_todo_done`\uFF0C\u4E0D\u8981\u53EA\u7559\u5728\u5F53\u524D\u5BF9\u8BDD\u91CC\u3002");
  lines.push("- \u9879\u76EE\u7ED3\u6784\u53D1\u751F\u660E\u663E\u53D8\u5316\u540E\u8C03\u7528 `project_rescan`\uFF1B\u9700\u8981\u7406\u89E3\u6700\u8FD1\u4EE3\u7801\u53D8\u5316\u65F6\u8C03\u7528 `project_diff`\u3002");
  return lines.join("\n");
}
async function loadProjectDataForInjection(fs, projectPath) {
  try {
    const [project, memories, todos, timeline] = await Promise.all([
      readJson(fs, brainPath(projectPath, "project.json")),
      readJsonl(fs, brainPath(projectPath, "memory.jsonl")),
      readJsonl(fs, brainPath(projectPath, "todo.jsonl")),
      readJsonl(fs, brainPath(projectPath, "timeline.jsonl"))
    ]);
    return { project, memories: memories || [], todos: todos || [], timeline: timeline || [] };
  } catch (e) {
    return { project: null, memories: [], todos: [], timeline: [] };
  }
}
async function refreshCache(fs, projectPath) {
  if (!fs || !projectPath) return;
  const data = await loadProjectDataForInjection(fs, projectPath);
  if (!data.project || data.project.__error) {
    projectCache.delete(projectPath);
    return;
  }
  projectCache.set(projectPath, { data, ts: Date.now() });
}
function getCachedSection(projectPath) {
  const cached = projectPath ? projectCache.get(projectPath) : null;
  if (!cached || !cached.data) return null;
  const { project, memories, todos, timeline } = cached.data;
  const stats = todoStats(todos);
  const activeTodos2 = todos.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const top = topKMemories(memories, 5);
  const recent = recentTimeline(timeline, 3);
  const inProgress = activeTodos2.find((t) => t.status === "in_progress");
  let md = renderContext(project, top, activeTodos2, recent, inProgress);
  md = truncateToTokens(md, DEFAULT_MAX_TOKENS);
  return md;
}
function setupInjector(ctx, fs, sandboxPolicy) {
  if (!ctx) return;
  let systemPrompt = null;
  try {
    systemPrompt = ctx.get ? ctx.get("systemPrompt") : ctx.systemPrompt;
  } catch (e) {
    systemPrompt = null;
  }
  let sessions = null;
  try {
    sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
  } catch (e) {
    sessions = null;
  }
  const logger = (level, msg) => {
    try {
      if (ctx.logger && typeof ctx.logger[level] === "function") ctx.logger[level]("[dsh-project-brain] " + msg);
      else if (typeof console !== "undefined") console.log("[dsh-project-brain] " + msg);
    } catch (e) {
    }
  };
  if (systemPrompt && typeof systemPrompt.section === "function") {
    try {
      const section = {
        name: "project-brain-context",
        order: 100,
        // harness=-100, persona=0, tool guidance=100-199; 我们放在工具指引区间内
        text: (context) => {
          try {
            const projectPath = resolveContextProject(context, sessions);
            const md = getCachedSection(projectPath);
            if (!md) return "";
            return md;
          } catch (e) {
            return "";
          }
        }
      };
      const disposer = systemPrompt.section(section);
      if (typeof ctx.effect === "function") {
        try {
          ctx.effect(() => disposer, "dsh-project-brain:injector:section");
        } catch (e) {
        }
      }
      logger("info", "injector: systemPrompt section registered (v0.3.1: text \u5B57\u6BB5\u4FEE\u590D)");
    } catch (e) {
      logger("warn", "injector: section registration failed: " + String(e && e.message || e));
    }
  } else {
    logger("warn", "injector: systemPrompt service unavailable, skip section registration");
  }
  if (ctx.on) {
    try {
      ctx.on("agent/session-start", (payload) => {
        try {
          const session = sessionFrom(payload);
          let projectPath = cwdFrom(session) || cwdFrom(payload);
          const sid = sessionIdFrom(payload);
          if (!projectPath && sandboxPolicy) {
            projectPath = sandboxPolicy.workspaceRoot || null;
          }
          if (projectPath && fs) {
            if (sid) sessionProjects.set(sid, projectPath);
            refreshCache(fs, projectPath).catch((e) => logger("warn", "injector: refresh cache failed: " + String(e && e.message || e)));
            logger("info", "injector: session-start cached project=" + projectPath);
          } else {
            logger("info", "injector: session-start without projectPath, skip");
          }
        } catch (e) {
        }
      });
    } catch (e) {
      logger("warn", "injector: agent/session-start subscription failed: " + String(e && e.message || e));
    }
  }
  if (ctx.on) {
    try {
      ctx.on("project_brain/preview.changed", (payload) => {
        try {
          const projectPath = payload && payload.projectPath;
          if (projectPath && fs) {
            refreshCache(fs, projectPath).catch(() => {
            });
          }
        } catch (e) {
        }
      });
    } catch (e) {
    }
  }
}

// src/host/summarizer.js
function sessionCwd(session) {
  if (!session) return null;
  try {
    if (typeof session.cwd === "string" && session.cwd.trim()) return session.cwd;
    if (session.meta && typeof session.meta.cwd === "string" && session.meta.cwd.trim()) return session.meta.cwd;
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd.trim()) return session.header.cwd;
    if (session.header && session.header.meta && typeof session.header.meta.cwd === "string" && session.header.meta.cwd.trim()) return session.header.meta.cwd;
  } catch (e) {
  }
  return null;
}
function changeFingerprint(diff) {
  const files = (diff.files || []).filter(Boolean).slice().sort();
  const commits = (diff.commits || []).map((c) => c && (c.hash || c.id || c.commit || c.message || "")).filter(Boolean);
  const input = JSON.stringify([files, commits, diff.stat || ""]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "git-" + (hash >>> 0).toString(16).padStart(8, "0");
}
async function summarizeOne({ fs, projectPath, sessionId, logger }) {
  const log = (level, msg) => {
    try {
      const tag = "[dsh-project-brain] ";
      if (logger && typeof logger[level] === "function") logger[level](tag + msg);
      else if (typeof console !== "undefined") console.log(tag + msg);
    } catch (e) {
    }
  };
  const brain = await readBrain(fs, projectPath);
  if (!brain.project || brain.project.__error) {
    log("info", "summarizer: project not initialized, skip");
    return { skipped: "not_initialized", changedFiles: 0, files: [] };
  }
  if (sessionId && (brain.timeline || []).some((e) => e && e.eventType === "session_summary" && e.sessionId === sessionId)) {
    log("info", "summarizer: session already summarized, skip " + sessionId);
    return { skipped: "session_already_summarized", changedFiles: 0, files: [] };
  }
  let diff;
  try {
    diff = await detectChanges({ projectPath, since: "1" });
  } catch (e) {
    diff = { files: [], stat: "", error: String(e && e.message || e) };
  }
  if (diff.error) {
    log("info", "summarizer: no git diff (" + diff.error + ")");
  }
  const changedFiles = (diff.files || []).filter(Boolean);
  const fingerprint = changedFiles.length ? changeFingerprint(diff) : null;
  const duplicateChange = Boolean(fingerprint && (brain.memories || []).some(
    (m) => m && m.source && m.source.kind === "session_summary" && m.source.fingerprint === fingerprint
  ));
  const now = Date.now();
  const writes = [];
  if (changedFiles.length > 0 && !duplicateChange) {
    const title = `\u672C\u6B21 session \u6539\u52A8 ${changedFiles.length} \u4E2A\u6587\u4EF6`;
    const content = "\u6539\u52A8\u7684\u6587\u4EF6\uFF1A\n" + changedFiles.map((f) => "- " + f).join("\n") + (diff.stat ? "\n\ngit diff --stat:\n" + diff.stat : "");
    const entry = makeMemoryEntry({
      type: "change",
      title,
      content,
      importance: 0.55,
      relatedFiles: changedFiles.slice(0, 20),
      source: { kind: "session_summary", fingerprint, sessionId: sessionId || null }
    }, now);
    writes.push(
      appendJsonl(fs, brainPath(projectPath, "memory.jsonl"), entry).then((ok) => log(ok ? "info" : "warn", `summarizer: change memory ${ok ? "appended" : "FAILED"} (${entry.id})`))
    );
    log("info", `summarizer: detected ${changedFiles.length} changed files`);
  } else if (duplicateChange) {
    log("info", "summarizer: unchanged git window already recorded (" + fingerprint + ")");
  } else {
    log("info", "summarizer: no git diff (non-git repo or no changes)");
  }
  const timelineEntry = {
    id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    title: "Session \u6458\u8981\u5B8C\u6210" + (changedFiles.length > 0 ? "\uFF08" + changedFiles.length + " \u6587\u4EF6\u53D8\u66F4\uFF09" : "\uFF08\u65E0\u53D8\u66F4\uFF09"),
    eventType: "session_summary",
    occurredAt: now,
    detail: "sessionId=" + (sessionId || "?") + " changedFiles=" + changedFiles.length,
    sessionId: sessionId || null,
    changeFingerprint: fingerprint,
    deduplicated: duplicateChange
  };
  writes.push(
    appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), timelineEntry).then((ok) => log(ok ? "info" : "warn", `summarizer: timeline event ${ok ? "appended" : "FAILED"} (${timelineEntry.id})`))
  );
  await Promise.all(writes);
  try {
    if (typeof __require !== "undefined") {
    }
  } catch (e) {
  }
  return { changedFiles: changedFiles.length, files: changedFiles, fingerprint, deduplicated: duplicateChange };
}
function setupSummarizer(ctx, fs, sandboxPolicy, runtime = {}) {
  if (!ctx || typeof ctx.on !== "function") return;
  let logger = null;
  try {
    logger = ctx.logger || null;
  } catch (e) {
  }
  const log = (level, msg) => {
    try {
      const tag = "[dsh-project-brain] ";
      if (logger && typeof logger[level] === "function") logger[level](tag + msg);
      else if (typeof console !== "undefined") console.log(tag + msg);
    } catch (e) {
    }
  };
  log("info", "summarizer: subscribed to session/disposed (pure-node git, no shell)");
  ctx.on("session/disposed", (session) => {
    try {
      const sessionId = session && (session.id || session.meta && session.meta.id);
      const projectPath = sessionCwd(session);
      if (!projectPath) {
        log("info", "summarizer: session/disposed without cwd, skip");
        return;
      }
      log("info", `summarizer: session/disposed cwd=${projectPath}`);
      const work = summarizeOne({ fs, projectPath, sessionId, logger }).then(async (r) => {
        if (r && r.changedFiles > 0 && architectureRelevantFiles(r.files)) {
          const refreshed = await scanAndWrite(
            fs,
            sandboxPolicy,
            { path: projectPath, dryRun: false },
            "auto_architecture_refresh",
            {
              getMemoryConfig: runtime.getMemoryConfig,
              getLlm: runtime.getLlm,
              llmRoute: resolveSessionRoute(session),
              sessionId
            }
          );
          if (!refreshed || !refreshed.ok) log("warn", "summarizer: architecture auto-refresh failed");
        }
        try {
          if (ctx && typeof ctx.emit === "function") {
            ctx.emit("project_brain/preview.changed", { projectPath });
          }
        } catch (e) {
        }
        return r;
      }).catch((e) => log("warn", "summarizer: failed: " + String(e && e.message || e)));
      if (typeof ctx.effect === "function") {
        try {
          ctx.effect(() => work, "dsh-project-brain:summarizer");
        } catch (e) {
        }
      }
    } catch (e) {
      log("warn", "summarizer: listener failed: " + String(e && e.message || e));
    }
  });
}

// src/index.js
var name = "dsh-project-brain";
var inject = ["tools", "fs", "sandboxPolicy", "connection", "sessions", "llm"];
var apply = (ctx, config) => {
  try {
    return applyImpl(ctx, config);
  } catch (e) {
    if (ctx && ctx.logger && typeof ctx.logger.error === "function") {
      try {
        ctx.logger.error("[dsh-project-brain] apply fatal:", String(e && e.message || e));
      } catch {
      }
    }
  }
};
function applyImpl(ctx, config) {
  function safeGet(name2) {
    try {
      return ctx[name2];
    } catch (e) {
      return void 0;
    }
  }
  const fs = safeGet("fs");
  const tools = safeGet("tools");
  const sandboxPolicy = safeGet("sandboxPolicy");
  const connection = safeGet("connection");
  const llm = safeGet("llm");
  const memoryRuntime = createMemoryConfigRuntime(ctx, config);
  const llmRuntime = createLlmRuntime(ctx, llm);
  const getDefaultProjectPath = () => {
    try {
      const root = sandboxPolicy && sandboxPolicy.workspaceRoot;
      if (typeof root === "string" && root.trim() && !/[\\/]DSH Desktop\\.app/i.test(root)) {
        return root;
      }
    } catch (e) {
    }
    return ".";
  };
  if (!fs || !tools) {
    if (ctx.logger && typeof ctx.logger.error === "function") {
      ctx.logger.error("[dsh-project-brain] required services (fs, tools) unavailable");
    }
    return;
  }
  const toolBuilders = [
    buildProjectInitTool,
    buildProjectRescanTool,
    buildContinueTool,
    buildStatusTool,
    buildMemoryAddTool,
    buildMemoryListTool,
    buildTodoAddTool,
    buildTodoListTool,
    buildTodoDoneTool,
    buildTodoUpdateTool,
    buildAskTool,
    buildDreamTool,
    buildDiffTool
  ];
  let registered = 0;
  for (let i = 0; i < toolBuilders.length; i++) {
    try {
      const tool = toolBuilders[i]({
        fs,
        sandboxPolicy,
        getMemoryConfig: memoryRuntime.get,
        resolveEmbeddingCredential: memoryRuntime.resolveCredential,
        getLlm: llmRuntime.get
      });
      const disposer = tools.register(tool);
      registered += 1;
      if (ctx.effect) {
        try {
          ctx.effect(() => disposer, "dsh-project-brain:tool:" + (tool && tool.name ? tool.name : i));
        } catch (e) {
        }
      }
    } catch (e) {
      if (ctx.logger) try {
        ctx.logger.warn("[dsh-project-brain] tool register failed:", String(e && e.message || e));
      } catch {
      }
    }
  }
  let harness;
  try {
    harness = ctx.get ? ctx.get("harness") : ctx.harness;
  } catch (e) {
    harness = void 0;
  }
  if (ctx.logger && typeof ctx.logger.info === "function") {
    try {
      ctx.logger.info("[dsh-project-brain] [diagnose] harness available: " + (!!harness && typeof harness.handle === "function"));
    } catch (e) {
    }
  }
  try {
    const rpcDisposers = registerSidebarRpc({
      harness,
      ctx,
      fs,
      tools,
      getDefaultProjectPath,
      logger: ctx.logger
    });
    for (let i = 0; i < rpcDisposers.length; i++) {
      try {
        if (ctx.effect) ctx.effect(rpcDisposers[i], "dsh-project-brain:rpc:register:" + i);
      } catch (e) {
        if (ctx.logger) try {
          ctx.logger.warn("[dsh-project-brain] rpc effect " + i + " failed:", String(e && e.message || e));
        } catch {
        }
      }
    }
  } catch (e) {
    if (ctx.logger) try {
      ctx.logger.warn("[dsh-project-brain] sidebar RPC registration failed:", String(e && e.message || e));
    } catch {
    }
  }
  try {
    registerConnectionRpc({
      connection,
      ctx,
      fs,
      sandboxPolicy,
      tools,
      logger: ctx.logger,
      getMemoryConfig: memoryRuntime.get,
      getLlm: llmRuntime.get
    });
  } catch (e) {
    if (ctx.logger) try {
      ctx.logger.warn("[dsh-project-brain] connection RPC registration failed:", String(e && e.message || e));
    } catch {
    }
  }
  try {
    if (ctx.on) {
      ctx.on("project_brain/preview.changed", (payload) => {
        try {
          invalidateAggregatorCache(payload && payload.projectPath);
        } catch (e) {
        }
      });
    }
  } catch (e) {
    if (ctx.logger) try {
      ctx.logger.warn("[dsh-project-brain] event subscription failed:", String(e && e.message || e));
    } catch {
    }
  }
  try {
    if (typeof ctx.inject === "function") {
      ctx.inject(["systemPrompt"], (promptCtx) => setupInjector(promptCtx, fs, sandboxPolicy));
    } else {
      setupInjector(ctx, fs, sandboxPolicy);
    }
  } catch (e) {
    if (ctx.logger) try {
      ctx.logger.warn("[dsh-project-brain] setupInjector failed:", String(e && e.message || e));
    } catch {
    }
  }
  try {
    setupSummarizer(ctx, fs, sandboxPolicy, {
      getMemoryConfig: memoryRuntime.get,
      getLlm: llmRuntime.get
    });
  } catch (e) {
    if (ctx.logger) try {
      ctx.logger.warn("[dsh-project-brain] setupSummarizer failed:", String(e && e.message || e));
    } catch {
    }
  }
  if (ctx.logger && typeof ctx.logger.info === "function") {
    try {
      ctx.logger.info("[dsh-project-brain] host loaded (runtime RPC, tools registered: " + registered + ")");
    } catch {
    }
  }
}
export {
  Config,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
