// brain-memory.mjs — Timeline + Memory 持久化 CLI
// P0.4：管理 .project-brain/timeline.jsonl + memory.jsonl
// 用法：
//   node brain-memory.mjs timeline <workspace> add <title> <eventType>
//   node brain-memory.mjs memory <workspace> add <type> <title> <content>
//   node brain-memory.mjs list <workspace> [timeline|memory]
// 数据格式（每行一个 JSON）：
//   timeline: { id, title, eventType, occurredAt, detail? }
//   memory:   { id, type, title, content, importance, createdAt }

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";

const BRAIN_DIR = ".project-brain";
const TIMELINE_FILE = "timeline.jsonl";
const MEMORY_FILE = "memory.jsonl";

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function readLines(file) {
  if (!existsSync(file)) return [];
  const lines = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { lines.push(JSON.parse(trimmed)); } catch { /* skip bad line */ }
  }
  return lines;
}

function appendLine(file, obj) {
  ensureDir(dirname(file));
  appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
}

function makeId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// ─── Commands ───

function timelineAdd(workspace, title, eventType, detail) {
  const file = join(workspace, BRAIN_DIR, TIMELINE_FILE);
  const entry = {
    id: makeId("evt"),
    title,
    eventType: eventType || "change",
    occurredAt: Date.now(),
    ...(detail ? { detail } : {}),
  };
  appendLine(file, entry);
  console.log(`[timeline] added ${entry.id}: ${title}`);
  return entry;
}

function memoryAdd(workspace, type, title, content, importance) {
  const file = join(workspace, BRAIN_DIR, MEMORY_FILE);
  const entry = {
    id: makeId("mem"),
    type: type || "context",
    title,
    content: content || "",
    importance: importance != null ? Number(importance) : 0.5,
    createdAt: Date.now(),
  };
  appendLine(file, entry);
  console.log(`[memory] added ${entry.id} (${entry.type}): ${title}`);
  return entry;
}

function list(workspace, kind) {
  const timeline = readLines(join(workspace, BRAIN_DIR, TIMELINE_FILE));
  const memory = readLines(join(workspace, BRAIN_DIR, MEMORY_FILE));
  if (kind === "timeline") {
    console.log(`Timeline (${timeline.length}):`);
    for (const e of timeline.slice(-10)) {
      console.log(`  [${new Date(e.occurredAt).toISOString().slice(0, 16)}] ${e.eventType} - ${e.title}`);
    }
  } else if (kind === "memory") {
    console.log(`Memory (${memory.length}):`);
    for (const m of memory.slice(-10)) {
      console.log(`  [${m.type}] ${m.title} (imp=${m.importance})`);
    }
  } else {
    console.log(`Timeline: ${timeline.length} entries`);
    console.log(`Memory: ${memory.length} entries`);
  }
}

// ─── main ───
function main() {
  const [cmd, workspace, ...rest] = process.argv.slice(2);
  if (!cmd || !workspace) {
    console.log(`Usage:
  node brain-memory.mjs timeline <workspace> add <title> [eventType] [detail]
  node brain-memory.mjs memory <workspace> add <type> <title> [content] [importance]
  node brain-memory.mjs list <workspace> [timeline|memory]`);
    process.exit(1);
  }
  if (cmd === "timeline" && rest[0] === "add") {
    timelineAdd(workspace, rest[1], rest[2], rest[3]);
  } else if (cmd === "memory" && rest[0] === "add") {
    memoryAdd(workspace, rest[1], rest[2], rest[3], rest[4]);
  } else if (cmd === "list") {
    list(workspace, rest[0]);
  } else {
    console.error("Unknown command:", cmd);
    process.exit(1);
  }
}

main();
