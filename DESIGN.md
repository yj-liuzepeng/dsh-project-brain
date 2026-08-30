# dsh-project-brain 设计方案

**版本：** v0.3.8
**状态：** Active — v0.3.8 已就绪，等用户重启 DSH 后做最终验证
**对应需求文档：** `REQUIREMENTS.md` / **SPEC.md**

---

# 0. 写在前面

本文档回答 4 个问题：

1. dsh-project-brain 在 DSH 生态中是什么、不是什么？
2. v0.3.8 实际架构是什么？模块边界在哪？
3. MVP 怎么落地，经历了哪些阶段？
4. 哪些是关键设计决策与风险？

> 阅读建议：先看 §1 定位与原则，再看 §3 实际架构、§4 数据通道、§7 关键决策。

---

# 1. 定位与边界

## 1.1 它是什么

* **DSH 的项目级长期记忆与认知系统**，项目绑定、跨 Session 持续演进
* 一个 **Cordis static 插件**（host + client 双面），通过 `cordis.patch.yml` 嵌入 DSH profile
* 一个 **Project Knowledge Graph**（简化版）：代码 + 记忆 + 时间线 + 摘要的复合知识库
* 一套 **Local-First** 的本地存储系统，数据落在目标项目自己的 `.project-brain/` 目录下

## 1.2 它不是什么

* **不是**代码静态分析 IDE（虽然内部用 tree-sitter）
* **不是**通用 RAG / 文档检索系统（主路径是项目结构化记忆；语义向量仅作为可选召回增强）
* **不是** Session 聊天记录归档（summarizer 只写"change memory"摘要，不存聊天原文）
* **不是**项目管理系统（Jira / Linear 替代品）

## 1.3 核心设计原则（不变）

| 原则 | 工程含义 |
| --- | --- |
| 只记长期有价值的内容 | Memory 必须有 `importance` 评分；Dream 周期做合并/淘汰 |
| 记录 What 与 Why | Decision / Architecture / Lesson 类型强制要求 `reason` 字段 |
| 知识属于 Project 而非 Session | 所有数据落 `.project-brain/`，跨 Session、跨机器迁移都跟随项目走 |
| 持续演进 | 静态扫描 + 写入即更新（build-time embed）+ Session 摘要 |
| 知识可追溯 | 每条 Memory 有 source / createdAt；Timeline 记录每次操作 |

---

# 2. 与 DSH 的集成形态

## 2.1 集成形态

dsh-project-brain 作为 **Cordis static 插件**（不是 dynamic），通过 DSH profile 的 `node_modules/dsh-project-brain/`（本地开发时可链接到插件工作区）被 DSH 加载。

集成点：

| 集成点 | 提供方 | 接收方 / 注册目标 |
| --- | --- | --- |
| Tool 工具（Host） | dsh-project-brain | `@deepseek-ai/dsh-tools` → DSH agent 可见 |
| Host Service 调用 | dsh-project-brain | 其它插件可通过 `ctx.tools.execute` 调用 |
| Event 订阅（Host） | dsh-project-brain | `agent/session-start`、`session/disposed`、`preview.changed`（自定） |
| Event 发布（Host） | dsh-project-brain | `preview.changed` |
| Client Slot 注册 | dsh-project-brain | `conversation.view`（SidebarPreview）+ `conversation.input.dock`（TODO strip） |
| Client Service（locale / slots / timer） | DSH | dsh-project-brain 的 client 部分使用 |

## 2.2 **不再**集成

* ❌ Client → Host RPC（`host.call`）—— 静态 plugin fiber 下 `host` builtin 未注入（P0.4.6 确认）
* ❌ webServer route `/plugins/.../preview.json` —— P0.4.5 失败 + P0.4.6 放弃 + v0.3.0-v0.3.3 多次重试失败 + v0.3.4 完全回退
* ❌ Dynamic plugin（cordis_inspect_list 列举可见）—— 当前是 static plugin

---

# 3. 实际架构（v0.3.8）

## 3.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Client 层（DSH WebView / Electron renderer）                  │
│  ├── SidebarPreview（`conversation.view` order=35）           │
│  │   - 纯函数组件 + build-time embed 数据                      │
│  │   - 8 区块 + Dashboard 折叠展开                              │
│  ├── TodoStrip（`conversation.input.dock` order=10）          │
│  │   - 10s 轮询 live preview 数据                              │
│  │   - Top-5 active todos chip，点击复制提示词                  │
│  └── locale / slots / theme client services                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │ (无 host→client 数据通道)
┌──────────────────────┴──────────────────────────────────────────┐
│  Host 层（DSH Node.js / Electron main process）                │
│  ├── src/index.js                                              │
│  │   - 注册 12 tools（harness.defineTool）                       │
│  │   - 订阅 preview.changed → 触发 setupAutoRebuild             │
│  │   - 调用 setupInjector → systemPrompt.service.section()    │
│  │   - 调用 setupSummarizer → 监听 session/disposed             │
│  └── tools.js / scanner.js / tools/{memory,todo,continue,...}   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────────┐
│  引擎层（无状态模块）                                          │
│  ├── scanner.js（FS + FsDirEntry.type + 递归 e.target）         │
│  ├── host/store/                                              │
│  │   ├── brain-files.js（jsonl 读写 + sandboxPolicy 解析）     │
│  │   ├── brain-logic.js（memory/todo 排序、活跃判断）           │
│  │   └── path-resolver.js（session cwd 反推 + 跳过污染）       │
│  ├── host/summarizer.js（git diff → change memory）              │
│  ├── host/injector.js（Top-K 记忆 → system prompt 注入）        │
│  └── host/rebuild.js（spawn build.js → clientModules.rebuilt）   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                   .project-brain/
                   ├── project.json
                   ├── todo.jsonl
                   ├── memory.jsonl
                   ├── timeline.jsonl
                   ├── codegraph.json
                   └── build-time embed via build.js
```

## 3.2 数据通道（核心）

```
用户调工具 → execute(args, exec)
            ↓
   resolveProjectPath(args, exec, sandboxPolicy)
            ↓
   优先级：args.path → exec.session → workspaceRegistry → sandboxPolicy(非 DSH Desktop)
            ↓
   appendJsonl(fs, projectPath/brain.jsonl, entry, danger-full-access)
            ↓
   emitPreviewChanged(exec, projectPath)
            ↓
   ctx.emit("project_brain/preview.changed")
            ↓
   setupAutoRebuild 监听 → shell.run(node build.js)
            ↓
   build.js 重写 dsh-project-brain/lib/client.js
            ↓
   clientModules.rebuilt("dsh-project-brain", hash)
            ↓
   DSH renderer 自动热重载 client bundle
            ↓
   1-3 秒后 sidebar 显示新数据
```

## 3.3 关键模块

| 模块 | 职责 | 状态 |
| --- | --- | --- |
| `src/index.js` | Host entry：12 tools + summarizer + injector + auto-rebuild | ✅ |
| `src/tools.js` | project_init / rescan / status | ✅ |
| `src/scanner.js` | FS 扫描（FsDirEntry.type + e.target 修复） | ✅ |
| `src/client.js` | SidebarPreview + TodoStrip（纯函数组件） | ✅ |
| `src/host/summarizer.js` | session/disposed → git diff → change memory | ✅ |
| `src/host/injector.js` | systemPrompt.service.section() 自动注入 | ✅（需验证） |
| `src/host/rebuild.js` | preview.changed → shell.run build.js | ✅ |
| `src/host/store/path-resolver.js` | session cwd 反推（v0.3.8） | ✅ |
| `src/host/store/brain-files.js` | jsonl 读写 + danger-full-access 默认 | ✅ |
| `src/host/store/brain-logic.js` | memory/todo 排序、active 判断 | ✅ |
| `build.js` | esbuild 打包 + multi-workspace embed + findBrainsUnder 排除 plugin | ✅ |
| `scripts/smoke-test.mjs` | 30 项离线测试 | ✅ |
| `scripts/codegraph-scan.mjs` | tree-sitter 3 语言扫描 | ✅ |
| `scripts/brain-memory.mjs` | timeline/memory CLI | ✅ |

---

# 4. 数据通道详解（v0.3.8）

## 4.1 为什么放弃 webServer live fetch

v0.3.0 重新启用 webServer route，**v0.3.4 彻底回退**。理由：

1. **static plugin fiber 没有 webServer service**：`webServer.register` 在 `dsh-market` 子 fiber 里调用时要么抛错要么静默失败（v0.3.5 实测返回 HTTP 404）
2. **DSH Desktop Electron fetch 走 IPC bridge**：renderer 的 `fetch('/preview.json')` 不直接打 webServer HTTP，需要 IPC 桥接
3. **DSH 静态 fallback 抢先 404**：即使绕过 IPC，DSH `frontend-static` fallback 会响应 404 给所有 named route
4. **browser 模式也是 404**：用户实测 `http://127.0.0.1:43120/` 也是 404，证明不只是 Electron 问题

**结论**：在 DSH 当前架构下，static plugin 无法实现真正的 host→client 实时数据通道。build-time embed + auto-rebuild 是唯一可行方案。

## 4.2 build-time embed + auto-rebuild

### build-time（同步）

- `build.js` 扫 `~/.dsh/storages/workspace.json` 拿所有 DSH workspace
- 对每个 `workspace.path` 递归找 `.project-brain/`（plugin 自己目录有 `cordis.patch.yml` 会被排除）
- 产出 previewData：project / phase / recentActivity / memories / todos / timeline / stats
- 构建 `(sessionId → workspaceId → previewData)` map + `workspacePaths` map
- 全部 inline 进 `lib/client.js` 的 `__ALL_WORKSPACES_JSON__` 常量

### auto-rebuild（异步）

- 任意工具调用 `project_*_add/list/done/update` 都会 `emit("project_brain/preview.changed")`
- `setupAutoRebuild` 监听 → 调 DSH `shell.service.run(node build.js)`（v0.3.7 改用 shell service 避开 sandbox EPERM）
- build.js 重写 `lib/client.js` → 计算 sha256 hash → 调 `ctx.clientModules.rebuilt("dsh-project-brain", hash)`
- DSH Electron renderer 收到 `clientModules.rebuilt` 通知 → 自动重新加载 `lib/client.js`
- 1-3 秒后 sidebar 显示新数据

### 代价与收益

| 维度 | build-time embed | webServer live fetch（不可行） |
| --- | --- | --- |
| 实时性 | 1-3 秒延迟（build 时间） | <100ms（理论） |
| 实现复杂度 | 低（已有 build.js） | 高（需要 IPC + webServer） |
| Token 消耗 | 0 | 0 |
| DSH 兼容性 | ✅ 全兼容 | ❌ static plugin fiber 不可用 |
| 用户体验 | 等待 1-3 秒 | 即时（但当前无法实现） |

**结论**：build-time embed 是当前架构下"实时同步"的唯一可行实现。1-3 秒延迟在用户视角"重大更新"语义下可接受。

---

# 5. Context Injector（v0.3.0 起，待验证）

## 5.1 设计目标

新 session 自动注入 Top-K 记忆 + 项目概况 + 活跃 TODO 到 system prompt，**无需用户主动调 `project_continue`**。

## 5.2 实现

- `src/host/injector.js` 通过 `systemPrompt.service.section()` 注册 `project-brain-context` section
- section.text 是 `(context) => string` 函数（**不是 render**，DSH PromptSection 合约 v0.3.1 修复）
- 监听 `agent/session-start` 预读 `.project-brain/` 到 module cache
- 监听 `preview.changed` 刷新 cache
- Top-K 选择算法（SPEC §4.5）：`score = importance * 0.5 + recency_score * 0.3 + moduleMatch * 0.2`
- recency：7 天内 = 1.0，90 天线性衰减到 0
- moduleMatch：cwd 命中 relatedFiles/relatedModules 加分（弱相关）
- token 预算 1500，超出按段落截断
- 输出 markdown：`## Project Brain Context` 标题 + 项目概况 + Top-5 记忆 + 活跃 TODO + 最近活动 + 当前进行中提示

## 5.3 风险

- v0.3.0 误传 `render` 字段 → DSH 合并 sections 时 `undefined.indexOf` 抛错（**v0.3.1 修复**成 `text`）
- plugin fiber 下的 `ctx.systemPrompt.section` 可能不可用（与 webServer 类似的子 fiber 限制），需运行时探测

---

# 6. 跨项目隔离

## 6.1 问题

DSH static plugin fiber 里 `sandboxPolicy.workspaceRoot` 是 **DSH Desktop 安装目录**（不是用户当前 session 的 workspace）。所有不带 `path` 的工具调用都误写到那里。

v0.3.8 验证：DSH Desktop 安装目录下的 `.project-brain/` 曾被错误写入。

## 6.2 解决

`src/host/store/path-resolver.js` 的优先级链：

1. `args.path`（显式传入，最可靠）
2. `exec.session.cwd` / `exec.session.meta.cwd` 等
3. `exec.ctx.session` / `exec.ctx.agent.session`
4. `exec.sessionId + ctx.get('sessions').get(sid)`
5. `ctx.get('agents').currentInitiator()` 拿当前 session
6. **`ctx.get('sessions').list()` 拿所有 session 的 cwd**（v0.3.8 新增，绕过 sandboxPolicy）
7. `sandboxPolicy.workspaceRoot`（**v0.3.8 跳过 DSH Desktop 安装路径**：`C:\*\Programs\DSH Desktop` 或 `*\DSH Desktop.app`）
8. `"."` 兜底

## 6.3 sandboxPolicy 默认写权限

v0.3.7：`brain-files.writeText` 默认从 `fs.sandboxPolicy` 取 `danger-full-access` mode，绕过 workspace 路径限制。避免工具调 `fs.writeText` 时被 sandbox 拒绝。

---

# 7. 关键设计决策（已变更）

| 决策 | 选择 A | 选择 B | 选 A 的理由 |
| --- | --- | --- | --- |
| 数据通道 | **build-time embed + auto-rebuild**（v0.3.4） | webServer live fetch（v0.3.0-v0.3.3，已回退） | 实测 webServer 在 static plugin fiber 不可用；build-time 是唯一可行路径 |
| Client Component | **纯函数组件**（v0.3.4） | class component + setInterval + fetch | hooks 在静态 workspace client 崩溃；fetch 通道不可用；纯函数 + build-time embed 已足够 |
| PromptSection | **`text` 字段**（v0.3.1） | `render` 字段（v0.3.0） | DSH `PromptSection` 合约规定 `text`，不是 `render` |
| build 路径 | **multi-workspace embed**（v0.3.4） | 单 workspace（`--workspace=<path>`） | 切换 workspace 必须重新 build；embed 一次支持所有 workspace |
| Plugin 类型 | **static plugin**（`cordis.patch.yml`） | dynamic plugin（cordis_inspect 可见） | static 性能更好、加载更快；dynamic 适合调试但不必要 |
| Session 摘要数据源 | **git diff HEAD~1**（v0.3.0） | LLM 抽取聊天记录 | LLM 成本 + 隐私；git diff 客观、可追溯、零 token |
| Memory 去重 | **title Jaccard ≥ 0.92**（v0.3.0） | 向量相似度 | 整理操作保持确定性，不依赖外部服务 |
| 工具实现技术 | **`@deepseek-ai/dsh-tools defineTool`** | 直接注册 `ctx.tools.register` | defineTool 是官方约定，自带 schema/render/execute 标准化 |
| 客户端 React 风格 | **`React.createElement`**（不用 JSX） | JSX | dynamic plugin 运行时 ESM bundle，esbuild 不编译 JSX |
| 12 工具 vs 合并 | **每场景一工具**（v0.3.0+） | project.do(action, ...) | LLM 选工具更准；schema 严格；用户易调试 |

---

# 8. 风险 & 缓解（v0.3.8）

| 风险 | 现状 | 缓解 |
| --- | --- | --- |
| DSH host bundle 不自动热重载 | 改 `src/index.js` / `src/tools/*` 必须重启 DSH | README / TODO 显式提示；client bundle 通过 `clientModules.rebuilt` 自动热重载 |
| auto-rebuild 触发需要 session cwd 在 git repo | summarizer 跳过非 git 项目 | 设计如此；可后续增强 |
| SidebarPreview 性能（多 workspace embed） | bundle 含多个 workspace 数据 | 当前规模（5 workspaces × ~5KB）< 30KB；V2 可拆 dynamic chunks |
| Context Injector 触发 `system-prompt/assemble` 异常 | v0.3.0 误传 render 字段曾让整个 DSH 崩 | v0.3.1 修字段名；injector 注册 try/catch |
| 跨项目污染（DSH Desktop 安装目录污染） | v0.3.8 修复 path-resolver | isDshDesktopInstall 检测跳过 + workspaceRegistry 优先 |
| build.js 单次扫描开销 | 当前 ~200ms | 可接受；未来可缓存 workspace.json 的 mtime |

---

# 9. 阶段交付历史

| 阶段 | 交付 | 状态 |
| --- | --- | --- |
| P0.1 hello world | cordis_inspect + 工程脚手架 | ✅ |
| P0.2a workspace 接入 | project_init + Client tab | ✅ |
| P0.2b SidebarPreview 5 区块 | 5 区块 + Onboarding + mock | ✅ |
| P0.3a Code Graph | tree-sitter 3 语言 | ✅ |
| P0.4 Memory / Timeline | jsonl + brain-memory.mjs CLI | ✅ |
| P0.4.1 工具面补全 | 8 工具 + Stats + Dashboard | ✅ |
| P0.4.2 多 workspace embed | build-time `(sessionId → workspaceId)` map | ✅ |
| P0.4.8 scanner 递归修复 | FsDirEntry.type + e.target | ✅ |
| P0.4.9 跨项目隔离 | resolveProjectPath 优先级链 | ✅ |
| P0.5 Session 摘要 | session/disposed → git diff | ✅ |
| P0.5.x 工具面补全 | status / todo_update / ask / dream | ✅ |
| v0.3.0 架构重做 | （已回退） | ⚠️ |
| v0.3.4 完整回退 | build-time embed 复活 | ✅ |
| v0.3.5 build.js 排除 plugin | findBrainsUnder 检测 cordis.patch.yml | ✅ |
| v0.3.6 tools schema path + output schema | 6 工具加 path，output schema 改 true | ✅ |
| v0.3.7 sandbox 写权限 | brain-files 默认 danger-full-access | ✅ |
| v0.3.8 path-resolver 完整修复 | workspaceRegistry + 跳过 DSH Desktop | ✅ |

---

# 10. V2 / 远期（不做承诺）

| 功能 | 描述 | 状态 |
| --- | --- | --- |
| Git Commit 深度分析 | 自动生成 timeline | 远期 |
| Memory 向量检索 | 可选混合增强，失败回退 BM25 | ✅ |

## Memory V2 与分层检索（v0.6.x）

原始事实仍以 `memory.jsonl` 为唯一数据源。新记录包含 `schemaVersion/status/confidence/source/updatedAt`；缺少这些字段的旧记录按 active 和默认可信度读取。`archived/superseded/deleted` 不参与查询、自动上下文注入、项目续接和 Dashboard 统计。

检索分两层：默认层使用中文 bigram + 英文/代码 token 的 BM25，并融合重要度、可信度、时效性和类型稳定性，再用贪心多样性惩罚避免 Top-K 被重复变更记录占满。可选层调用用户配置的 OpenAI-compatible Embeddings API，将向量余弦分数与关键词分数混合；任何配置或网络错误都只改变 `actualMode` 和诊断信息，不影响基础结果。

向量索引是派生缓存，不是记忆事实。缓存按 `endpoint + model + dimensions + memory content hash` 判定有效性，懒加载、限批更新，可安全删除。远程服务只在显式启用后调用，凭据不进入 JSONL、日志或 Client RPC。
| Architecture Diff | Dream 输出代码架构差异 | 远期 |
| 多 DSH Desktop / 多 profile | 跨设备同步 .project-brain/ | 远期 |
| Sidebar 子菜单 | 项目切换/最近项目 | 可选 |
| 全屏 Dashboard 视图 | 当前是折叠展开区，可独立 route | 可选 |

---

# 11. 一句话总结

> **dsh-project-brain 是一个 Local-First、项目绑定、跨 Session 演进的 DSH 项目大脑插件，通过 build-time embed + auto-rebuild 实现"重大更新实时同步"，让 DSH 从"读代码"进化为"懂项目"——所有数据落 `.project-brain/`，零 token，零外部依赖，零网络。**
