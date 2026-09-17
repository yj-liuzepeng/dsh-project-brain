# Claude Code / Codex 共用项目脑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已有的 `src/mcp/server.js` 用项目级配置接到 Claude Code 与 Codex，三端启动同一命令、同一份 `.project-brain/`。

**Architecture:** 不改 MCP server / 工具面 / 磁盘格式。提交 `.mcp.json` 与 `.codex/config.toml`，命令与 Cursor `.cursor/mcp.json` 一致：`node` + `src/mcp/server.js`。smoke 只读仓库配置文件并断言字段，不启动真实客户端。

**Tech Stack:** 现有 Node ESM smoke（`scripts/smoke-mcp-brain.mjs`）、JSON.parse、TOML 字符串匹配、无新 npm 依赖。

## Global Constraints

- 不修改 `src/mcp/server.js` / `protocol.js` / `session.js` / 任何 `src/tools*`
- 不新增 npm 依赖（包括 TOML 解析库）
- 不把 API Key 写入配置；禁止本机绝对路径（`C:`、`/Users/`、`API_KEY`）
- 服务名一律 `dsh-project-brain`
- 启动命令一律 `command = "node"`，`args = ["src/mcp/server.js"]`（相对工作区根）
- `.gitignore` 不要为了本任务去忽略 `.mcp.json` 或 `.codex/`
- 对照 spec：`docs/superpowers/specs/2026-09-17-cc-codex-mcp-shared-brain-design.md`
- Commit 步仅在用户明确要求提交时执行；否则跳过所有 Commit 步

---

**Files (map):**

| 文件 | 职责 |
|------|------|
| `scripts/smoke-mcp-brain.mjs` | 追加 client config 断言（`.mcp.json` / `.codex/config.toml` / `.cursor/mcp.json`） |
| `.mcp.json` | Claude Code 项目 MCP |
| `.codex/config.toml` | Codex 项目 MCP（仅此一段） |
| `README.md` / `README.zh-CN.md` / `CHANGELOG.md` | 启用说明 |
| spec 文首 | Draft → Active |

不新增 `src/` 文件。`scripts/run-smoke.mjs` 已包含 `smoke-mcp-brain.mjs`，不必改。

---

### Task 1: 配置文件 + smoke 断言

**Files:**
- Modify: `scripts/smoke-mcp-brain.mjs`
- Create: `.mcp.json`
- Create: `.codex/config.toml`

**Interfaces:**
- Consumes: 仓库根已有 `.cursor/mcp.json`（`command: "node"`, `args: ["src/mcp/server.js"]`）
- Produces: 三个客户端配置启动命令一致；`node scripts/smoke-mcp-brain.mjs` 配置段全部 PASS

- [ ] **Step 1: Write the failing smoke (client config)**

在 `scripts/smoke-mcp-brain.mjs` 里，`SRC` 定义之后增加：

```js
const REPO = join(__dirname, "..");
```

在 summary 之前、`=== MCP handleRequest ===` 块之后插入：

```js
console.log("=== client MCP configs ===");
{
  function forbidden(text) {
    return text.indexOf("C:") >= 0 || text.indexOf("/Users/") >= 0 || text.indexOf("API_KEY") >= 0;
  }
  function argsOk(args) {
    return Array.isArray(args) && args.length === 1 && args[0] === "src/mcp/server.js";
  }

  const cursorPath = join(REPO, ".cursor", "mcp.json");
  const cursorRaw = readFileSync(cursorPath, "utf8");
  const cursor = JSON.parse(cursorRaw);
  const cursorSrv = cursor && cursor.mcpServers && cursor.mcpServers["dsh-project-brain"];
  check("cursor mcp exists", !!(cursorSrv && cursorSrv.command === "node" && argsOk(cursorSrv.args)));
  check("cursor mcp no secrets/abs", !forbidden(JSON.stringify(cursor)));

  const ccPath = join(REPO, ".mcp.json");
  check("claude .mcp.json exists", existsSync(ccPath));
  if (existsSync(ccPath)) {
    const ccRaw = readFileSync(ccPath, "utf8");
    const cc = JSON.parse(ccRaw);
    const srv = cc && cc.mcpServers && cc.mcpServers["dsh-project-brain"];
    check("claude command/args", !!(srv && srv.command === "node" && argsOk(srv.args)));
    check("claude type stdio or omitted", !srv.type || srv.type === "stdio");
    check("claude no secrets/abs", !forbidden(JSON.stringify(cc)));
  }

  const codexPath = join(REPO, ".codex", "config.toml");
  check("codex config.toml exists", existsSync(codexPath));
  if (existsSync(codexPath)) {
    const toml = readFileSync(codexPath, "utf8");
    check("codex section", toml.indexOf("[mcp_servers.dsh-project-brain]") >= 0);
    check("codex command node", /command\s*=\s*"node"/.test(toml));
    check("codex args", toml.indexOf('args = ["src/mcp/server.js"]') >= 0);
    check("codex no secrets/abs", !forbidden(toml));
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: 已有 27 项仍 PASS；新增项 FAIL：`claude .mcp.json exists`、`codex config.toml exists`（以及被 `if (existsSync)` 跳过的后续项不会跑）。exit code ≠ 0。

- [ ] **Step 3: Create `.mcp.json` at repo root**

内容必须是（无绝对路径、无 env/key）：

```json
{
  "mcpServers": {
    "dsh-project-brain": {
      "type": "stdio",
      "command": "node",
      "args": ["src/mcp/server.js"]
    }
  }
}
```

- [ ] **Step 4: Create `.codex/config.toml`**

```toml
# Project-scoped MCP. Codex loads this only after the project is trusted.
# https://developers.openai.com/codex/config-reference

[mcp_servers.dsh-project-brain]
command = "node"
args = ["src/mcp/server.js"]
```

不要在 `.codex/` 下添加其它文件。不要改 `.gitignore`。

- [ ] **Step 5: Run smoke to verify it passes**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: 含 client config 段在内全部 PASS，exit 0。配置段至少包括：

- `cursor mcp exists`
- `claude .mcp.json exists`
- `claude command/args`
- `codex config.toml exists`
- `codex section`
- `codex args`

- [ ] **Step 6: Commit**（仅用户要求时）

```bash
git add scripts/smoke-mcp-brain.mjs .mcp.json .codex/config.toml
git commit -m "feat(mcp): add Claude Code and Codex project MCP configs"
```

---

### Task 2: 文档、spec Active、关闭待办

**Files:**
- Modify: `README.md`（Cursor MCP 三条之后追加 CC/Codex）
- Modify: `README.zh-CN.md`（同上）
- Modify: `CHANGELOG.md` Unreleased
- Modify: `docs/superpowers/specs/2026-09-17-cc-codex-mcp-shared-brain-design.md` 文首 `Draft` → `Active`，§10 勾选 AC-1…AC-6（AC-7 在关闭待办后勾）

**Interfaces:**
- Consumes: Task 1 已落地的 `.mcp.json` / `.codex/config.toml`
- Produces: 文档可按文操作；待办 `todo-mu58h2yw-umjihy` status=done

- [ ] **Step 1: README.md**

在现有三条 Cursor MCP 说明之后（约 L22–24）追加：

```markdown
- **Claude Code:** this repo ships `.mcp.json`. Open the project in Claude Code and approve the `dsh-project-brain` project MCP (it runs `node src/mcp/server.js` from the workspace root).
- **Codex:** this repo ships `.codex/config.toml`. Trust this project first (project-scoped Codex config loads only then), then start Codex; same command `node src/mcp/server.js`.
- Cursor, Claude Code, Codex, and DSH share the same `.project-brain/` on this machine. A matching CLI must be installed for that client; CI does not launch Claude Code or Codex.
```

可把原来「Cursor and DSH share…」那条改成上面第三条，避免重复。最终 Cursor/CC/Codex 各至少一行启用说明，且 Codex 行必须含 **trust**。

- [ ] **Step 2: README.zh-CN.md**

在 Cursor 三条之后追加：

```markdown
- **Claude Code：** 本仓库已包含 `.mcp.json`。在项目根打开 Claude Code，批准项目 MCP `dsh-project-brain`（从工作区根执行 `node src/mcp/server.js`）。
- **Codex：** 本仓库已包含 `.codex/config.toml`。先信任本项目（项目级配置仅在信任后加载），再打开 Codex；命令同样是 `node src/mcp/server.js`。
- Cursor、Claude Code、Codex 与 DSH 共用同一份 `.project-brain/`。对应客户端需本机已安装；CI 不启动 Claude Code / Codex。
```

- [ ] **Step 3: CHANGELOG.md Unreleased**

在现有 Cursor 条下追加：

```markdown
- Claude Code（`.mcp.json`）与 Codex（`.codex/config.toml`）可通过同一 `src/mcp/server.js` 读写这份 `.project-brain/`；Codex 需先信任项目。需本机已装对应 CLI。
```

- [ ] **Step 4: Spec 状态**

`docs/superpowers/specs/2026-09-17-cc-codex-mcp-shared-brain-design.md` 文首改为 `状态：Active`。§10 将 AC-1 到 AC-6 改为 `- [x]`。

- [ ] **Step 5: 确认未改 MCP 源码**

Run: `git diff --stat -- src/mcp`

Expected: 空（相对本任务开始时无新 diff）。若有意外改动，还原。

- [ ] **Step 6: 再跑 smoke + 关闭待办**

Run: `node scripts/smoke-mcp-brain.mjs`

Expected: 全部 PASS。

然后调用 `project_todo_done`（或等价写入 `.project-brain/todo.jsonl`）：`id = todo-mu58h2yw-umjihy`。勾选 spec AC-7。

不要用 changelog 冒充记忆去 `project_memory_add`。

- [ ] **Step 7: Commit**（仅用户要求时）

```bash
git add README.md README.zh-CN.md CHANGELOG.md docs/superpowers/specs/2026-09-17-cc-codex-mcp-shared-brain-design.md
git commit -m "docs: Claude Code and Codex same-machine MCP setup"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| AC-1 `.mcp.json` | Task 1 |
| AC-2 `.codex/config.toml` | Task 1 |
| AC-3 三端命令一致 | Task 1 smoke 同时读 Cursor/CC/Codex |
| AC-4 smoke 配置段 | Task 1；run-smoke 已挂该 suite |
| AC-5 README/CHANGELOG + Codex 信任 | Task 2 |
| AC-6 不改 MCP server | Task 2 `git diff --stat -- src/mcp` |
| AC-7 关闭待办 | Task 2 |
| 不做真实 CC/Codex CI | 无对应实现任务（有意） |
| 不改磁盘/工具面 | Global Constraints |

**Self-review:** 无 TBD；无新 src 文件；smoke 断言与 spec §7 字段名一致（`mcpServers.dsh-project-brain`、`[mcp_servers.dsh-project-brain]`、`src/mcp/server.js`）。
