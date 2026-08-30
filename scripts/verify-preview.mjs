// 一次性验证：buildWorkspacePreview 按不同 workspace 读 .project-brain 是否正确
// 用 DSH fs 服务适配器（node 实现）跑，模拟"已生成 A 项目 / 未生成 B 项目"
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspacePreview } from "../src/host/sidebar/aggregator.js";
import { scanProject } from "../src/scanner.js";

const fsAdapter = {
  async resolve(p, opts) { return opts && opts.cwd ? join(opts.cwd, p) : p; },
  async readText(target) { return readFileSync(target, "utf8"); },
  async writeText(target, content) { const d = target.slice(0, target.lastIndexOf("/")); if (!existsSync(d)) mkdirSync(d, { recursive: true }); writeFileSync(target, content, "utf8"); },
  async listDir(target) { return readdirSync(target, { withFileTypes: true }).map((e) => ({ name: e.name, isFile: e.isFile(), isDirectory: e.isDirectory() })); },
  processPath(target) { return target; },
};

const base = mkdtempSync(join(tmpdir(), "dsh-preview-ver-"));
const projA = join(base, "projA");
const projB = join(base, "projB");
mkdirSync(join(projA, "src"), { recursive: true });
mkdirSync(join(projB, "src"), { recursive: true });
writeFileSync(join(projA, "package.json"), JSON.stringify({ name: "projA", dependencies: { express: "4" } }));
writeFileSync(join(projA, "src", "index.js"), "const a=1;");
writeFileSync(join(projB, "package.json"), JSON.stringify({ name: "projB", dependencies: { react: "18" } }));
writeFileSync(join(projB, "src", "index.js"), "const b=2;");

// 只给 A 生成 .project-brain（project.json + todo + memory + timeline）
const brainA = join(projA, ".project-brain");
mkdirSync(brainA, { recursive: true });
const scanA = await scanProject(fsAdapter, projA);
writeFileSync(join(brainA, "project.json"), JSON.stringify({ id: "brain-A", name: "projA", techStack: scanA.techStack, languages: scanA.languages, updatedAt: 1000, lastScannedAt: 1000 }));
writeFileSync(join(brainA, "todo.jsonl"), JSON.stringify({ id: "t1", title: "projA 待办", status: "pending", priority: "high", createdAt: 1000, updatedAt: 1000 }) + "\n");
writeFileSync(join(brainA, "memory.jsonl"), JSON.stringify({ id: "m1", type: "decision", title: "projA 决策", content: "c", importance: 0.9, createdAt: 1000 }) + "\n");
writeFileSync(join(brainA, "timeline.jsonl"), JSON.stringify({ id: "e1", title: "projA init", eventType: "init", occurredAt: 1000 }) + "\n");

let failed = 0;
function check(name, cond, extra) { if (cond) console.log("  PASS  " + name); else { failed++; console.log("  FAIL  " + name + (extra ? " -> " + extra : "")); } }

console.log("== A 已生成 ==");
const pa = await buildWorkspacePreview(fsAdapter, projA);
check("A initialized", pa.initialized === true);
check("A project.name == projA", pa.project && pa.project.name === "projA");
check("A stats.pendingTodos == 1", pa.stats.pendingTodos === 1);
check("A memories 决策 == 1", pa.stats.decisions === 1);
check("A timelineAll == 1", pa.timelineAll.length === 1);
check("A phase 待办", pa.phase && String(pa.phase.title).indexOf("待办") >= 0, JSON.stringify(pa.phase));

console.log("== B 未生成 ==");
const pb = await buildWorkspacePreview(fsAdapter, projB);
check("B not initialized", pb.initialized === false);
check("B project null", pb.project === null);
check("B stats zero", pb.stats.pendingTodos === 0);

console.log(`\n== RESULT: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} ==`);
process.exit(failed > 0 ? 1 : 0);
