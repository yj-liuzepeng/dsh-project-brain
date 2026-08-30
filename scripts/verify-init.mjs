// verify-init.mjs — 独立复现 project_init 逻辑（Node fs 版）
// 用途：CLI 调试 / 离线验证 scanner 输出；与 src/scanner.js 保持同逻辑
// 用法：node scripts/verify-init.mjs [projectPath] [--dry-run]

import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", "target", ".DS_Store",
  ".idea", ".vscode", "coverage", ".turbo", ".cache", "out",
]);

const EXT_LANG = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java",
  ".rs": "rust",
};

async function readText(root, name) {
  try { return await fs.readFile(path.join(root, name), "utf8"); } catch { return null; }
}

export async function scanProjectNode(projectPath) {
  const result = { techStack: {}, languages: {}, fileCount: 0, topLevel: [], entrypoints: [] };
  let entries;
  try { entries = await fs.readdir(projectPath, { withFileTypes: true }); } catch (e) { return result; }
  const names = entries.map((e) => e.name);
  result.fileCount = 0;
  result.topLevel = names.filter((n) => !IGNORE_DIRS.has(n)).slice().sort();

  if (names.includes("package.json")) {
    const txt = await readText(projectPath, "package.json");
    if (txt) {
      try {
        const pkg = JSON.parse(txt);
        const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
        if (deps.next) result.techStack.fullstack = "Next.js";
        else if (deps.nuxt) result.techStack.fullstack = "Nuxt";
        else if (deps.express) result.techStack.backend = "Express";
        else if (deps.fastify) result.techStack.backend = "Fastify";
        else if (deps["@nestjs/core"]) result.techStack.backend = "NestJS";
        if (deps.react) result.techStack.frontend = "React";
        else if (deps.vue) result.techStack.frontend = "Vue";
        else if (deps.svelte) result.techStack.frontend = "Svelte";
        if (pkg.scripts && pkg.scripts.dev) result.entrypoints.push({ path: "npm run dev", type: "script" });
      } catch (e) {}
    }
  }

  const pyToml = names.includes("pyproject.toml") ? await readText(projectPath, "pyproject.toml") : null;
  const requirements = names.includes("requirements.txt") ? await readText(projectPath, "requirements.txt") : null;
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

  const entryCandidates = [
    ["main.ts", "service"], ["main.js", "service"],
    ["index.ts", "service"], ["index.js", "service"],
    ["app.py", "service"], ["server.py", "service"], ["manage.py", "cli"],
    ["cmd/main.go", "service"], ["main.go", "service"],
    ["src/main.ts", "service"], ["src/main.js", "service"],
  ];
  for (const [cand, type] of entryCandidates) if (names.includes(cand)) result.entrypoints.push({ path: cand, type });

  async function scanDepth(dir, prefix, depth) {
    if (depth > 3) return;
    let sub;
    try { sub = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of sub) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const subPath = prefix ? prefix + "/" + e.name : e.name;
      if (e.isFile()) {
        result.fileCount += 1;
        const lower = e.name.toLowerCase();
        for (const [ext, lang] of Object.entries(EXT_LANG)) {
          if (lower.endsWith(ext)) { result.languages[lang] = (result.languages[lang] || 0) + 1; break; }
        }
      } else if (e.isDirectory()) {
        await scanDepth(path.join(dir, e.name), subPath, depth + 1);
      }
    }
  }
  await scanDepth(projectPath, "", 0);

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const projectPath = args.filter((a) => !a.startsWith("--"))[0] || process.cwd();
  const start = Date.now();

  console.log(`[verify-init] scanning ${projectPath} (dryRun=${dryRun})`);
  const scan = await scanProjectNode(projectPath);

  const projectName = projectPath.split(/[\\/]/).filter(Boolean).pop() || "untitled";
  const projectId = "brain-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  const projectData = {
    id: projectId,
    name: projectName,
    rootPath: projectPath,
    description: "Auto-generated by dsh-project-brain",
    techStack: scan.techStack,
    languages: scan.languages,
    size: { files: scan.fileCount },
    entrypoints: scan.entrypoints,
    topLevel: scan.topLevel,
    directoryMap: [],
    createdAt: now,
    updatedAt: now,
    lastScannedAt: now,
  };

  if (!dryRun) {
    const brainDir = path.join(projectPath, ".project-brain");
    await fs.mkdir(brainDir, { recursive: true });

    // P0.4.1：重跑时保留已有 projectId / createdAt（与 src/tools.js 一致）
    const projFile = path.join(brainDir, "project.json");
    let existing = null;
    try {
      if (existsSync(projFile)) existing = JSON.parse(await fs.readFile(projFile, "utf8"));
    } catch (e) { existing = null; }
    if (existing && existing.id) {
      projectData.id = existing.id;
      projectData.createdAt = existing.createdAt;
      projectData.description = existing.description || projectData.description;
      projectData.directoryMap = existing.directoryMap || [];
    }
    const isRescan = Boolean(existing && existing.id);

    await fs.writeFile(projFile, JSON.stringify(projectData, null, 2), "utf8");
    console.log(`[verify-init] wrote ${projFile} (${isRescan ? "rescan, id preserved" : "first init"})`);

    // P0.4：追加 timeline 事件（记录 init/rescan 扫描）
    try {
      const timelineFile = path.join(brainDir, "timeline.jsonl");
      const timelineEntry = {
        id: "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
        title: isRescan ? "完成重扫（verify-init）" : "完成 project_init 扫描",
        eventType: isRescan ? "rescan" : "init",
        occurredAt: now,
        detail: `languages=${Object.keys(scan.languages).join("/") || "none"} files=${scan.fileCount}`,
      };
      await fs.appendFile(timelineFile, JSON.stringify(timelineEntry) + "\n", "utf8");
      console.log(`[verify-init] timeline event appended: ${timelineEntry.title}`);
    } catch (e) {
      console.warn(`[verify-init] timeline append failed (non-fatal): ${e && e.message || e}`);
    }
  }

  console.log(`[verify-init] projectId=${projectId} name=${projectName} durationMs=${Date.now() - start}`);
  console.log(`[verify-init] stats=${JSON.stringify({ files: scan.fileCount, languages: scan.languages, techStack: scan.techStack, entrypoints: scan.entrypoints, topLevel: scan.topLevel }, null, 2)}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  main().catch((e) => { console.error(e); process.exit(1); });
}