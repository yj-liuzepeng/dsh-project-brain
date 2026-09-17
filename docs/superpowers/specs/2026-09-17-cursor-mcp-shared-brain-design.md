# SPEC: Cursor MCP 共用项目脑（同机读写）

> 状态：Active
> 日期：2026-09-17
> 关联：v1.3.1 导入导出已完成；本阶段不替代 zip 跨机器，只打通同一台电脑上的 Cursor
> 前置决策：共用 `.project-brain/`；读写（方案 B）；适配形态为 MCP；第一期只做 Cursor

---

## 1. 目标

让 **Cursor** 和 **DSH Desktop** 在同一台电脑、同一个项目目录里，读写同一份 `.project-brain/`。

成功标准（人工验收，必须同时成立）：

1. 在本仓库用 Cursor 列出待办、新增一条记忆。
2. 不导出 zip、不复制目录，打开 DSH Dashboard，能看到那条记忆。
3. 在 DSH 把一条待办标完成，回到 Cursor 再 list，状态已更新。
4. 全程不要求 DSH 进程在跑。

---

## 2. 范围与非目标

### 范围内

- 新增 stdio MCP server，用 Node 直接读写项目下的 `.project-brain/`
- Cursor 通过项目级 MCP 配置连上该 server
- 第一期暴露与 DSH 同名的读写工具子集（见 §4）
- 抽出可复用的 Node `fs` 适配器，供 MCP 与现有 store/scan 逻辑共用，避免再写一套 jsonl 格式
- smoke：MCP 工具对临时项目 init → memory_add → todo_add → todo_done → 文件内容断言

### 明确不做（本阶段）

- Claude Code / Codex 的独立安装说明与默认配置（MCP 协议兼容，但不在本期验收；已由 `2026-09-17-cc-codex-mcp-shared-brain-design.md` 完成）
- 换机器、git 提交 `.project-brain/`、云同步
- 把 DSH Dashboard / Connection RPC 搬进 Cursor
- Dream、diff、suggest、导入导出、备份回滚进 MCP
- 把向量 API Key 写入项目目录
- 多进程同时狂写同一 jsonl 的文件锁（沿用现有追加语义；文档注明不要两边同时批量写入）

---

## 3. 架构

```
Cursor Agent
    │  MCP stdio（工具名与 DSH 对齐）
    ▼
src/mcp/server.js          ← 新；不依赖 cordis / DSH Desktop
    │  projectPath = Cursor workspace root
    ▼
src/host/store/node-fs.js  ← 新；实现 brain-files 需要的 resolve/readText/writeText/mkdir/append
    │
    ▼
现有 scanAndWrite / memory / todo / ask / continue / status
    │
    ▼
<project>/.project-brain/  ← 与 DSH 同一目录、同一 schema
```

DSH 插件保持现状：仍用 `defineTool` + Connection RPC。两边只约定磁盘格式，不互相 RPC。

**项目路径**：MCP 启动时以 `process.cwd()` 为默认项目根（Cursor 为该 workspace 启动 MCP 时 cwd 即项目根）。若 MCP 客户端传 `roots`，优先用第一个 `file://` root。工具仍接受可选 `path`，仅当 cwd 不是项目根时使用；禁止把 DSH Desktop 安装路径当项目根（复用 `assertSafeProjectPath`）。

**密钥**：`project_ask` 的 hybrid/向量与 DSH 相同，读本机环境变量 / 已有 `normalizeMemoryConfig` 默认值。MCP **不** 读 DSH settings 服务（DSH 没开着时不存在）。因此：

- 未设环境变量、也未把 Key 写进环境时，MCP 侧 `project_ask` 走关键词检索，不报崩。
- 不在 `.project-brain/` 里存 API Key。

向量开关若用户只配在 DSH 设置里、没配环境变量，Cursor 侧第一期可以没有向量——这是可接受的；记忆/待办读写不依赖向量。

---

## 4. MCP 工具面

工具名、参数语义与现有 DSH Tool **同名同义**，返回 JSON `{ ok, data?, code?, message? }`。

| 工具 | 读写 | 第一期 |
|------|------|--------|
| `project_status` | 读 | 要 |
| `project_continue` | 读 | 要 |
| `project_ask` | 读 | 要 |
| `project_memory_list` | 读 | 要 |
| `project_todo_list` | 读 | 要 |
| `project_init` | 写 | 要 |
| `project_rescan` | 写 | 要 |
| `project_memory_add` | 写 | 要 |
| `project_todo_add` | 写 | 要 |
| `project_todo_update` | 写 | 要 |
| `project_todo_done` | 写 | 要 |

未列出的 DSH 工具第一期不注册。调用未注册名 → MCP 标准 `unknown tool` 错误。

未初始化项目：读工具返回 `ok: false, code: E_NOT_INITIALIZED`；写记忆/待办同错；`project_init` 可创建脑。

---

## 5. Cursor 接入

在本仓库增加 **项目级** `.cursor/mcp.json`，指向：

```
node <repo>/src/mcp/server.js
```

（若构建策略要求打包，则改为 `node <repo>/dsh-project-brain/lib/mcp.js`，由 `build.js` 多打一个 entry。默认第一期用 `src/mcp/server.js` 直跑 ESM，与现有 `src/*.js` 一致，减少发布耦合。）

Agent 说明：在 Cursor 规则或 MCP 工具 description 里写清「跨会话项目事实用这些工具，不要把 changelog 当记忆」。不强制用户安装 Skill；工具 description 足够让 Agent 发现。

`.gitignore`：`.cursor/mcp.json` **提交进仓库**（无密钥，只有本地 node 启动命令），方便本仓库开发者一开 Cursor 就能验。用户机器上的绝对路径用相对仓库根的命令，避免写死 `C:\Users\...`。

---

## 6. 错误与共存

| 场景 | 行为 |
|------|------|
| `.project-brain/` 不存在 | 读失败 `E_NOT_INITIALIZED`；提示先 `project_init` |
| path 不安全 / DSH 安装目录 | `E_UNSAFE_PROJECT_PATH` |
| jsonl 某行坏掉 | 与现有 store 一致：跳过坏行，不整文件失败 |
| DSH 与 Cursor 先后写 | jsonl 追加可见；整文件 JSON（`project.json` / `architecture.json`）后写覆盖先写。验收不要求同时双开狂点保存 |
| DSH Dashboard 仍显示旧数据 | 已知：聚合有缓存。用户切 tab / 重新扫描即可。MCP 不调用 DSH RPC 失效缓存 |

失败信息用人话 + `code`，与现有 Tool 风格一致。

---

## 7. 测试与验收

- 新脚本 `scripts/smoke-mcp-brain.mjs`：临时目录 init → add memory → add todo → done → 读 jsonl 断言；再模拟「DSH 风格」直接改 todo.jsonl 后 list 能读到。
- 接到 `scripts/run-smoke.mjs`。
- 人工：本仓库 Cursor 按 §1 四条走一遍。

不测：真实 Embedding HTTP、DSH Desktop UI 自动化。

---

## 8. 文件结构（预期）

```
src/mcp/server.js                 # MCP stdio 入口
src/mcp/tools.js                  # 把现有 execute 逻辑绑到 MCP
src/host/store/node-fs.js         # Node fs ↔ brain-files 适配
.cursor/mcp.json                  # 本仓库 Cursor 配置
scripts/smoke-mcp-brain.mjs
docs/superpowers/specs/2026-09-17-cursor-mcp-shared-brain-design.md
```

尽量 **调用** 现有 `src/tools/*.js` 的 execute，而不是复制业务。若 `defineTool` 在无 DSH 下无法构造，则把 execute 函数抽到 `src/host/brain-ops/*.js`（或 tools 文件内 export `runX`），DSH `defineTool` 与 MCP 两边调同一 `runX`。第一期以「抽 runX、不复制 jsonl 规则」为准，不做更大重构。

---

## 9. 版本与后续

- 本能力是 **v1.4.0 方向的加法**（新 MCP 入口），不改 v1.3.1 的 zip 格式。
- 下一阶段（换机器）：继续用已有导出/导入，或再评估是否让 `.project-brain/` 进 git；不在本期展开。
- 再下一阶段：同一 MCP 配进 Claude Code / Codex，不改磁盘契约。

---

## 10. 验收清单（DoD）

- [x] AC-1 MCP `project_init` 在空目录写出合法 `.project-brain/`
- [x] AC-2 `project_memory_add` 追加一行，DSH 可读的 jsonl 格式
- [x] AC-3 `project_todo_add` / `project_todo_done` 与 DSH 工具写入字段兼容
- [x] AC-4 `project_status` / `project_continue` / `project_ask` / list 类只读不改文件
- [x] AC-5 未初始化返回 `E_NOT_INITIALIZED`，不创建目录（除 init）
- [x] AC-6 smoke-mcp-brain 接入 run-smoke 且通过
- [x] AC-7 本仓库 `.cursor/mcp.json` 可启动 server（相对路径，无本机绝对路径、无密钥）
- [x] AC-8 README / CHANGELOG 各加一段「Cursor 同机 MCP」说明（实现时写，评审本 spec 不必先改）
