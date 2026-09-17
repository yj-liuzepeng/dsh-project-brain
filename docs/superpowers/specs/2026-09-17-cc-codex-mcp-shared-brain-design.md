# SPEC: Claude Code / Codex 共用项目脑（同机 MCP）

> 状态：Active
> 日期：2026-09-17
> 关联：Cursor 同机 MCP 已落地（`src/mcp/server.js`）；本阶段把同一入口配进 Claude Code 与 Codex
> 前置决策：共用 `.project-brain/`；不改磁盘契约；不改 MCP 工具面；只加项目级配置与文档

---

## 1. 目标

让 **Claude Code**、**Codex** 与已有的 **Cursor** / **DSH Desktop** 在同一台电脑、同一个项目目录里，读写同一份 `.project-brain/`。

成功标准：

1. 本仓库提交 Claude Code 项目配置：打开仓库后能发现名为 `dsh-project-brain` 的 stdio MCP，命令为 `node src/mcp/server.js`（相对工作区根）。
2. 本仓库提交 Codex 项目配置：信任该项目后，同样启动 `node src/mcp/server.js`。
3. 配置文件无本机绝对路径、无 API Key；密钥仍走环境变量。
4. 不新增 MCP 工具、不改 jsonl / `project.json` schema。
5. smoke 断言上述配置文件存在且字段正确；CI **不**启动真实 Claude Code / Codex 客户端。

人工验收（有对应客户端时；无客户端不阻塞合并）：

- 在本仓库用 Claude Code 或 Codex 调用 `project_todo_list`，能读到与 Cursor 相同的待办。
- 全程不要求 DSH 进程在跑。

---

## 2. 范围与非目标

### 范围内

- 新增 Claude Code 项目级 `.mcp.json`（提交进仓库）
- 新增 Codex 项目级 `.codex/config.toml`（提交进仓库；仅 MCP 段）
- README.md / README.zh-CN.md / CHANGELOG.md 补充启用说明（含 Codex 需信任项目）
- 扩展 `scripts/smoke-mcp-brain.mjs`：解析并断言两个配置文件
- 关闭待办「增加 Cursor、Claude Code、Codex 的共同支持」

### 明确不做

- 修改 `src/mcp/server.js` / `protocol.js` / `session.js` / 工具面（11 个工具保持原样）
- HTTP / SSE MCP、新 npm 依赖、配置生成器
- MCP `roots`、`project_memory_add` admit stub、DSH Dashboard 自动化
- Claude Desktop 全局配置、用户级 `~/.claude.json` / `~/.codex/config.toml`
- 换机器、git 提交 `.project-brain/`、云同步
- 真实 Claude Code / Codex 握手作为 CI 门槛

---

## 3. 架构

```
Claude Code / Codex / Cursor
    │  各自项目 MCP 配置（格式不同，命令相同）
    ▼
src/mcp/server.js          ← 已有；不改
    │  cwd = 工作区根
    ▼
<project>/.project-brain/  ← 与 DSH / Cursor 同一目录、同一 schema
```

三端只约定「如何启动同一个 stdio server」，不互相 RPC。默认 `projectPath` 仍是 `PROJECT_BRAIN_PATH` 或 `process.cwd()`。

---

## 4. 配置文件

服务名一律 `dsh-project-brain`，与 Cursor `.cursor/mcp.json` 对齐。

### 4.1 Claude Code：仓库根 `.mcp.json`

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

禁止写绝对路径、禁止 `env` 里放 Key。Claude Code 读取项目 `.mcp.json` 后可能弹出信任/启用提示，文档写明需批准。

### 4.2 Codex：`.codex/config.toml`

```toml
# Project-scoped MCP. Codex loads this only after the project is trusted.
# https://developers.openai.com/codex/config-reference

[mcp_servers.dsh-project-brain]
command = "node"
args = ["src/mcp/server.js"]
```

禁止写绝对路径、禁止在此文件放 API Key。文档必须写：项目级 `config.toml` **仅在信任该项目后**才会加载。

`.gitignore` 当前不忽略 `.mcp.json` 与 `.codex/`；不要为了本任务去忽略它们。不要提交 `.codex/` 下除 `config.toml` 以外的本机状态文件。

---

## 5. 文档

在现有 Cursor MCP 三条说明旁追加（中英 README 各一份，CHANGELOG Unreleased 一条）：

- Claude Code：仓库已含 `.mcp.json`；在项目根打开 Claude Code，批准项目 MCP `dsh-project-brain`。
- Codex：仓库已含 `.codex/config.toml`；先信任本项目，再开 Codex；命令同样是工作区根的 `node src/mcp/server.js`。
- 三端与 DSH 共用 `.project-brain/`；密钥仍走环境变量。

不强制用户安装 Skill。

---

## 6. 错误与共存

| 场景 | 行为 |
|------|------|
| 未批准 / 未信任项目 MCP | 客户端不连 server；脑文件不变。文档说明如何批准/信任 |
| 同时开 Cursor 与 CC 读写 | 与 Cursor 规格相同：jsonl 追加可见；整文件 JSON 后写覆盖先写；不保证同时狂写 |
| Codex 未信任项目 | 不加载 `.codex/config.toml`；不是 server bug |

---

## 7. 测试

在 `scripts/smoke-mcp-brain.mjs` 追加「client config」段（读仓库根文件，不启动 MCP 进程）：

1. `.mcp.json` 可 `JSON.parse`；`mcpServers["dsh-project-brain"]` 的 `command === "node"`，`args` 为 `["src/mcp/server.js"]`。`JSON.stringify` 后不得包含 `C:`、`/Users/`、`API_KEY`。
2. `.codex/config.toml` 存在；含 `[mcp_servers.dsh-project-brain]`、`command = "node"`、`args = ["src/mcp/server.js"]`。原文不得包含 `C:`、`/Users/`、`API_KEY`。
3. `.cursor/mcp.json` 一并检查 command/args 相同，避免三端漂移。

不引入 TOML 解析库：用 `readFileSync` + 字符串包含 / 简单行匹配。

不测：真实 CC/Codex 进程、Embedding HTTP、DSH UI。

`scripts/run-smoke.mjs` 已包含 `smoke-mcp-brain.mjs`，不必新增 suite 文件。

---

## 8. 文件结构（预期）

```
.mcp.json                                              # Claude Code 项目 MCP
.codex/config.toml                                     # Codex 项目 MCP
.cursor/mcp.json                                       # 已有；本阶段只做一致性断言
docs/superpowers/specs/2026-09-17-cc-codex-mcp-shared-brain-design.md
README.md / README.zh-CN.md / CHANGELOG.md
scripts/smoke-mcp-brain.mjs                            # 追加配置断言
```

不新增 `src/` 文件。

---

## 9. 版本与后续

- 仍是 **v1.4.0 方向的加法**（接入面），不改 v1.3.1 zip 格式。
- 关闭待办 `todo-mu58h2yw-umjihy` 的条件：配置 + 文档 + smoke 通过。人工客户端验收有则做、无则在 CHANGELOG/README 标明「需本机已装对应 CLI」。

---

## 10. 验收清单（DoD）

- [x] AC-1 仓库根 `.mcp.json`：stdio、`node`、`src/mcp/server.js`、相对路径、无密钥
- [x] AC-2 `.codex/config.toml`：`[mcp_servers.dsh-project-brain]`、同样命令、无密钥
- [x] AC-3 三端启动命令一致（Cursor / CC / Codex 都是 `node` + `src/mcp/server.js`）
- [x] AC-4 smoke-mcp-brain 配置段通过；run-smoke 仍挂该 suite
- [x] AC-5 README 中英 + CHANGELOG 说明 CC / Codex 启用与 Codex 信任项目
- [x] AC-6 不改 MCP server / 工具面 / `.project-brain` schema
- [x] AC-7 待办「增加 Cursor、Claude Code、Codex 的共同支持」标记 done
