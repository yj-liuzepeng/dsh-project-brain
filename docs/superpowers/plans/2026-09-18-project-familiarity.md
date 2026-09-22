# Project Familiarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 人第一屏与 Agent 注入共用四句 briefing；关会话轻扫/稀架构刷新并标记过期；任务动态升级为 Session 主干图（时间边 + 硬证据边）。

**Architecture:** 新增两个无 I/O 纯函数 `buildProjectBriefing`、`buildSessionGraph`。Injector / continue / aggregator 只消费它们。`scanAndWrite` 增加 `architectureMode`。`architectureRelevantFiles` 拆成轻扫与架构触发。不新增 json 库、不调用 LLM 画边。

**Tech Stack:** 现有 Node ESM、jsonl、`scripts/smoke-*.mjs`、`npm test` / `npm run test:acceptance`。

**Spec:** `docs/superpowers/specs/2026-09-18-project-familiarity-design.md`  
**Flow:** `docs/superpowers/specs/2026-09-18-project-familiarity-flow.md`

## Global Constraints

- Durable Core 不推翻：`admitMemory` 单写者，Core 15 / 800，无 Jaccard 删除。
- briefing 与 injection 四段必须同源；continue.injection === injector markdown。
- `architectureMode: "light"` 不得覆盖 `architecture.json`。
- README / CHANGELOG / lockfile / 纯测试 不得单独触发 full 架构。
- 图纯函数禁止 LLM。
- 未初始化项目不写假节点。
- 用户未要求时不要 git commit。

---

### Task 1: Briefing 纯函数 + 注入改接

**Files:**
- Create: `src/host/memory/briefing.js`
- Modify: `src/host/memory/inject-context.js`
- Modify: `src/tools/continue.js`（若它只调 `buildInjectionContext` 则可能零改）
- Test: `scripts/smoke-project-briefing.mjs`（新建）并加入 `scripts/run-smoke.mjs`

**Interfaces:**

```js
export function buildProjectBriefing(brain, now = Date.now())
// returns { stale, purpose, startHere, stuck, lastWhy, lastWhySource, markdown }

export function isArchitectureStale(brain, now) // used by briefing; fingerprint fields optional in v1
export function buildInjectionContext(brain) // must start with briefing.markdown then Core
```

- [ ] **Step 1: 写失败测试** `scripts/smoke-project-briefing.mjs`

覆盖 PF-1、PF-2、PF-3、PF-9、PF-10：

```js
import { buildProjectBriefing } from "../src/host/memory/briefing.js";
import { buildInjectionContext } from "../src/host/memory/inject-context.js";

const brain = {
  project: { name: "demo", description: "A plugin", techStack: { backend: "Express" }, entrypoints: ["src/index.js"] },
  architecture: { overview: { purpose: "Persistent project brain" }, keyFiles: [{ path: "src/host/injector.js" }] },
  todos: [{ id: "t1", title: "Fix inject", status: "in_progress", priority: "high" }],
  timeline: [{ eventType: "session_summary", summary: "Locked briefing to match the sidebar.", occurredAt: 2 }],
  memories: [{ id: "m1", type: "decision", status: "active", title: "Session cwd wins", content: "Always resolve path from session cwd.", importance: 0.9, createdAt: 1, updatedAt: 1 }],
};

const b = buildProjectBriefing(brain);
assert(b.markdown.includes("从哪改"));
assert(b.startHere.includes("src/index.js"));
assert(b.stuck[0].id === "t1");
assert(b.lastWhySource === "session_summary");
const inj = buildInjectionContext(brain);
assert(inj.includes(b.markdown));
assert(inj.includes("Session cwd wins"));

const changelogBrain = { ...brain, timeline: [{ eventType: "session_summary", summary: "改了 8 个文件", occurredAt: 2 }] };
const b2 = buildProjectBriefing(changelogBrain);
assert(b2.lastWhySource !== "session_summary" || !/改了\s*\d+\s*个文件/.test(b2.lastWhy));

const staleBrain = { ...brain, architectureStale: true };
const b3 = buildProjectBriefing(staleBrain);
assert(b3.stale === true);
assert(!b3.startHere.includes("src/host/injector.js"));
```

changelog 否决复用 `isChangelogGenre`（从 `admit.js` import），不要复制一份正则。

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/smoke-project-briefing.mjs`  
Expected: `ERR_MODULE_NOT_FOUND` 或断言失败（`buildProjectBriefing` 不存在）。

- [ ] **Step 3: 实现 `briefing.js` 并改 `buildInjectionContext`**

`markdown` 固定中文小标题（注入给当前中文为主的 Agent；UI 第一屏用 i18n，但 **字段** 仍是同一 `startHere`/`stuck`/`lastWhy`）：

```text
### 这是什么
### 从哪改
### 现在卡在哪
### 最近为什么
```

过期时「从哪改」只输出 entrypoints，并加一行 `架构可能过期，关键文件按扫描入口降级。`

Core 段保持现有列表格式。删掉注入里重复的「活跃 TODO」大段（TODO 只在 stuck）。「上次会话」blockquote 合并进「最近为什么」，不要两段各写一次 summary。

`architectureStale` v1：若 `brain.architectureStale === true` 或 `brain.architecture.stale === true` 或 `brain.project.architectureStale === true` 则 stale。指纹字段可在 Task 3 写入 project.json 后再接到 `isArchitectureStale`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/smoke-project-briefing.mjs`  
Expected: 进程 exit 0，打印 `PASS`。

- [ ] **Step 5: 把脚本加入 `scripts/run-smoke.mjs` 列表并跑 `npm test` 确认无回归**

---

### Task 2: Session 图纯函数

**Files:**
- Create: `src/host/memory/session-graph.js`
- Test: `scripts/smoke-session-graph.mjs`（新建）并加入 `scripts/run-smoke.mjs`

**Interfaces:**

```js
export function buildSessionGraph(brain)
// {
//   nodes: [{ id, sessionId, occurredAt, label, files, filesMore, important, trunk: true }],
//   edges: [{ from, to, kind: "time" | "evidence", reason: "todo"|"supersede"|"architecture" }],
//   collapsedEmptyCount: number,
//   hiddenCount: number // 抽稀藏起的 trunk 节点
// }
```

- [ ] **Step 1: 写失败测试**

```js
import { buildSessionGraph } from "../src/host/memory/session-graph.js";

// PF-6: empty summary, no files, no todo → collapsed
const empty = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "s0", summary: "  ", occurredAt: 1 }],
  todos: [], memories: [],
});
assert(empty.nodes.length === 0);
assert(empty.collapsedEmptyCount >= 1);

// PF-7: talk-only with summary
const talk = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "s1", summary: "We chose RPC over embed.", occurredAt: 2, files: [] }],
  todos: [], memories: [],
});
assert(talk.nodes.length === 1);
assert(/RPC/.test(talk.nodes[0].label));
assert(talk.edges.length === 0);

// time edges + evidence todo
const g = buildSessionGraph({
  timeline: [
    { eventType: "session_summary", sessionId: "a", summary: "Added inject briefing.", occurredAt: 1, files: ["src/a.js"] },
    { eventType: "todo", sessionId: "a", todoId: "t1", occurredAt: 1 },
    { eventType: "session_summary", sessionId: "b", summary: "Finished inject briefing.", occurredAt: 2, files: ["src/b.js"] },
    { eventType: "todo", sessionId: "b", todoId: "t1", todoStatus: "done", occurredAt: 2 },
  ],
  todos: [{ id: "t1", status: "done" }],
  memories: [],
});
assert(g.nodes.length === 2);
assert(g.edges.some((e) => e.kind === "time"));
assert(g.edges.some((e) => e.kind === "evidence" && e.reason === "todo"));

// PF-8: no hallucinated edges
const chain = buildSessionGraph({
  timeline: [
    { eventType: "session_summary", sessionId: "a", summary: "One.", occurredAt: 1 },
    { eventType: "session_summary", sessionId: "b", summary: "Two.", occurredAt: 2 },
  ],
  todos: [], memories: [],
});
assert(chain.edges.every((e) => e.kind === "time"));
assert(chain.edges.length === 1);

// changelog summary not used as label
const cl = buildSessionGraph({
  timeline: [{ eventType: "session_summary", sessionId: "c", summary: "改了 8 个文件", occurredAt: 1, files: ["src/x.js"] }],
  todos: [], memories: [],
});
assert(cl.nodes[0].label === "代码有变更（无摘要）");
```

现有 `todo` timeline 可能没有 `todoId`。图实现应对：`detail` 解析 `id=` 或条目上的 `todoId`；都没有则 **不画** todo 证据边（只 time）。测试里用显式 `todoId`。

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/smoke-session-graph.mjs`  
Expected: 模块不存在。

- [ ] **Step 3: 实现 `session-graph.js`**

抽稀：`nodes.length > 40` 时 `important` = 有 evidence 边端点、或 files、或 label 来自 summary。非 important 计入 `hiddenCount`，默认 `nodes` 仍返回全部并带 `hidden: true`，方便 UI 折叠。

- [ ] **Step 4: 测试通过并 `npm test`**

---

### Task 3: 两档刷新 + 触发文件拆分 + summary 结构化

**Files:**
- Modify: `src/host/architecture/analyzer.js`（拆 `sourceChangeFiles` / `architectureTriggerFiles`；保留 `architectureRelevantFiles` 作为 deprecated wrapper = trigger，避免漏改调用方）
- Modify: `src/host/scan-and-write.js`（`runtime.architectureMode`: `"full"` 默认 | `"light"` | `"none"`）
- Modify: `src/host/summarizer.js`
- Modify: `src/host/memory/session-extractor.js`（prompt：summary 1–3 句 what+why，禁止改了 N 个文件）
- Test: `scripts/smoke-architecture-triggers.mjs`（新建）+ 扩展 `scripts/smoke-session-lifecycle.mjs` 或 durable-core 若已断言 refresh

**Interfaces:**

```js
export function sourceChangeFiles(files) // boolean, spec §6.1
export function architectureTriggerFiles(files) // boolean, spec §6.1
export async function scanAndWrite(fs, sandboxPolicy, args, toolLabel, runtime)
// runtime.architectureMode === "light" → 写 project.json，不调用 buildArchitecture，不写 architecture.json
```

- [ ] **Step 1: 失败测试 PF-4 PF-5**

```js
import { sourceChangeFiles, architectureTriggerFiles } from "../src/host/architecture/analyzer.js";

assert(sourceChangeFiles(["src/index.js"]) === true);
assert(architectureTriggerFiles(["README.md"]) === false);
assert(architectureTriggerFiles(["package-lock.json"]) === false);
assert(architectureTriggerFiles(["src/foo.test.js"]) === false);
assert(architectureTriggerFiles(["package.json"]) === true);
assert(architectureTriggerFiles(["src/host/injector.js"]) === true);
```

再测 `scanAndWrite` light：用现有 smoke 的 memfs/fixture，断言调用前后 `architecture.json` mtime/内容不变，`project.json` 更新。若 fixture 过重，测 `architectureMode` 分支：light 时 spy/flag `buildArchitecture` 未被调用（把 analyzer 调用包在 `if (mode !== "light")`）。

- [ ] **Step 2: 跑测试确认失败**（README 当前会令 `architectureRelevantFiles` 为 true）

- [ ] **Step 3: 实现拆分与 summarizer 顺序**

`summarizeOne` timeline 条目增加 `files: changedFiles.slice(0, 20)`。`summary` 经 `isChangelogGenre(title, summary)` 则清空。

刷新：

```js
if (sourceChangeFiles(r.files)) {
  await scanAndWrite(fs, sandboxPolicy, { path: projectPath }, "auto_light_refresh", { ...runtime, architectureMode: "light" });
}
if (architectureTriggerFiles(r.files)) {
  await scanAndWrite(fs, sandboxPolicy, { path: projectPath }, "auto_architecture_refresh", { ...runtime, architectureMode: "full" });
}
```

`project_init` / `project_rescan` / 手动 RPC 保持默认 `full`。

light 失败、full 失败：不 throw。full 失败时 `project.json.architectureStale = true`（能写则写）。full 成功则 `architectureStale = false`。

- [ ] **Step 4: 测试通过；`isArchitectureStale` 读 `project.architectureStale`**

- [ ] **Step 5: `npm test`**

---

### Task 4: Aggregator + Client 第一屏 + 任务动态图

**Files:**
- Modify: `src/host/sidebar/aggregator.js`（preview 增加 `briefing`、`sessionGraph`）
- Modify: `src/client.js`（概览主视野四句；任务动态 Tab 渲染节点+边；i18n zh/en）
- Test: 扩展 `scripts/smoke-todostrip.mjs` 或新建 `scripts/smoke-familiarity-client.mjs` 对 **源码字符串** 断言（与现有 todostrip 一样扫 `src/client.js` / 构建产物）

**Interfaces:** preview JSON 增加：

```js
briefing: buildProjectBriefing(...)
sessionGraph: buildSessionGraph(...)
```

- [ ] **Step 1: 失败测试**

Client 源码须含 `data-block="briefing"`、`data-block="session-graph"`、`data-graph-kind`。Aggregator 单元：对内存 brain 调 `buildSidebarPreview` 或抽出的 `buildRuntimePreview`（若 preview 组装在 aggregator 后半段 `buildPreviewFromParts`，优先抽 20 行纯函数避免 fs）。

若 `buildSidebarPreview` 强依赖磁盘，则测 `buildRuntimePreview(p, architecture, timeline, memories, todos)` —— **本任务允许**从 aggregator 抽出该函数，避免新 fs fixture。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: UI**

概览：四句用 `briefing` 字段，不要再拼一套。stale 时 Callout 文案「架构可能过期」。  
任务动态：按 `occurredAt` 竖向时间链画 trunk 节点；`evidence` 边用短标注（TODO / 替代 / 架构）。`collapsedEmptyCount > 0` 显示「已折叠 N 次空会话」。点节点展开 `label` 全文 + files。Git Tab 不动。

不要把 40+ 节点默认全展开：`hidden === true` 默认不画，提供「展开全部」。

- [ ] **Step 4: 测试通过 + `npm run build` + `npm test` + `npm run test:acceptance`**

验收 AC：host-acceptance 若断言 injection 含「活跃 TODO」标题，改为断言含「现在卡在哪」或 briefing 小标题。改测试以符合 spec，不要为迁就旧文案破坏 PF-1。

---

## Spec coverage

| Spec | Task |
| --- | --- |
| §4 第一屏四句 | 1, 4 |
| §5 共用 briefing / 不重复 TODO | 1 |
| §6 过期与两档刷新 | 3 |
| §7 summary 合同 | 3 |
| §8 图 | 2, 4 |
| PF-1..10 | 见各 task 测试 |

## Placeholder scan

无 TBD。手动里程碑明确不做。`todoId` 缺失则不强行画证据边。
