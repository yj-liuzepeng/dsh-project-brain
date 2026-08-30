// 一次性：为 dsh-project-brain 项目写入 TODO 条目（用共享逻辑）
import { join } from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { makeTodoEntry } from "../src/host/store/brain-logic.js";

const w = process.argv[2] || ".";
const dir = join(w, ".project-brain");
mkdirSync(dir, { recursive: true });
const file = join(dir, "todo.jsonl");
let todos = [];
if (existsSync(file)) {
  todos = readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}
const now = Date.now();
const items = [
  { title: "P0.5 Session 摘要（session/disposed 监听 -> 自动记忆）", priority: "high" },
  { title: "补全 init/rescan/continue 工具与 RPC continueSession 联调验证", priority: "medium" },
  { title: "更新 README/TODO/SPEC 至 P0.4.1 并提交 git", priority: "medium" },
  { title: "Dashboard 完善 + conversation.input.dock TODO strip（P0.7 入口）", priority: "low" },
];
for (const it of items) todos.push(makeTodoEntry(it, now));
writeFileSync(file, todos.map((t) => JSON.stringify(t)).join("\n") + "\n", "utf8");
console.log("todos written:", todos.length);
for (const t of todos) console.log(`  [${t.priority}] ${t.title} (${t.id})`);
