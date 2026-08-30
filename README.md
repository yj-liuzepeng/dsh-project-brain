# dsh-project-brain

DSH Desktop 的本地项目大脑插件。它分析当前工作区，把项目结构、长期记忆、开发历史和待办保存在项目自己的 `.project-brain/` 中，让新的对话也能继续理解和维护同一个项目。

> 当前版本：`0.7.0-beta.1` 公测版。核心功能、发布构建和自动化测试已通过，可以安装试用；正式稳定版仍需在更多 DSH Desktop 版本、普通仓库和 Monorepo 中完成真实安装验收。详见 [发布检查清单](./RELEASE_CHECKLIST.md)。

## 核心能力

- **快速理解项目**：识别技术栈、语言、工具链、入口文件、顶层结构和 README / package 元数据。
- **架构认知报告**：说明项目定位、使用者、架构风格、概念分层、核心组件、协作关系、运行流程、关键文件、阅读顺序和设计风险；目录只作为证据。
- **当前 DSH 模型分析**：默认复用当前 Session 正在使用的 provider/model，结合 README、manifest、入口、符号、import 和关键源码摘要生成语义架构；无需单独填写模型或密钥，失败自动降级。
- **跨对话长期记忆**：架构决策、需求约束、Bug 根因、经验教训和变更记录持久保存在项目目录中。
- **分层记忆检索**：默认用本地 BM25 + 重要度/可信度/时效性和多样性排序；可选启用兼容 OpenAI Embeddings API 的混合向量检索。
- **自动恢复上下文**：新 Session 启动时按当前 workspace 注入高价值记忆、活跃待办和最近活动。
- **持续沉淀**：Session 结束后记录 Git 变更；相同 Session 和相同变更窗口会自动去重。
- **项目隔离**：Host 只信任当前 DSH Session 的 `cwd`，切换项目不会读取或写入另一个 workspace。
- **实时界面**：Sidebar 和 TodoStrip 通过 DSH Connection RPC 读取当前项目，每 5 秒轻量刷新；不需要为数据变化重新 build。
- **Local First 基线**：项目数据和架构事实默认落在本地；架构语义增强默认使用当前 DSH 模型，可关闭；Embedding 仍需用户主动配置。

## 工作方式

```text
当前 DSH Session
      │ live sessionId
      ▼
Host 解析可信 workspace cwd
      │
      ├── 扫描代码与项目元数据
      ├── 读写 .project-brain/
      ├── 注入跨 Session 上下文
      └── Connection RPC → Sidebar / TodoStrip
```

每个项目的数据彼此独立：

```text
.project-brain/
├── project.json       # 项目结构、技术栈、入口、语言和扫描时间
├── architecture.json  # 项目定位、架构层、概念组件、流程、关键文件与证据
├── memory.jsonl       # 决策、架构、需求、变更、Bug、教训等长期记忆
├── todo.jsonl         # 项目待办及状态
├── timeline.jsonl     # 初始化、重扫、记忆、待办和 Session 活动
├── codegraph.json     # 旧版可选 AST 代码图（兼容读取）
└── cache/
    └── embeddings.jsonl # 可删除、可重建的向量派生缓存（仅启用后生成）
```

## 记忆检索模式

零配置时，`project_ask` 使用本地 BM25 检索，并综合 `importance`、`confidence`、时间和记忆类型排序；已归档/已替代记忆不会进入查询、自动注入和 Dashboard。新写入的记忆采用 V2 字段，包含 `status`、`confidence`、`source` 和更新时间，旧数据无需迁移即可继续读取。

向量检索是可选增强。启用 `vectorEnabled` 并配置 `embeddingBaseURL` 与 `embeddingModel` 后，插件会按内容哈希增量建立缓存，并将关键词分数与余弦相似度混合排序。服务不可用、凭据缺失或返回异常时自动降级为本地检索，不影响项目大脑使用。

主要配置项：

| 配置 | 默认值 | 说明 |
|---|---:|---|
| `retrievalMode` | `hybrid` | `keyword` 强制本地；`hybrid` 在向量可用时增强 |
| `vectorEnabled` | `false` | 向量能力总开关 |
| `embeddingBaseURL` | 空 | OpenAI-compatible API 基址，可直接以 `/embeddings` 结尾 |
| `embeddingModel` | 空 | Embedding 模型名 |
| `embeddingApiKeyEnv` | `PROJECT_BRAIN_EMBEDDING_API_KEY` | DSH credential ref；设为空可调用无需鉴权的本地服务 |
| `embeddingMaxIndexPerRun` | `64` | 单次查询最多增量索引的记忆数 |

> 启用远程 Embedding 后，记忆的标题、正文、标签和相关文件名会发送到所配置服务。请根据项目保密要求选择本地模型或可信服务。

## 架构分析模式

初始化和重扫先收集本地事实，再调用当前 DSH Session 的模型生成概念架构。默认会发送 README、项目清单、相对路径、符号/import，以及经过长度限制的关键源码摘要，让模型能够理解职责而不是复述目录；不会发送绝对路径。模型输出必须通过严格 JSON、真实文件路径和组件关系校验，不能生成或注入 HTML。没有可用模型、超时或校验失败时，`architecture.json` 仍会以 `source: "local"` 生成职责级降级报告，并在界面显示降级原因。

插件直接复用当前 Session 已选择的 provider/model，无需单独填写模型配置。新建 Session 在首次模型请求前还没有可复用路由；此时先完成一次正常对话，再点击重扫即可。诊断码会区分 DSH LLM 服务未注入与 Session 路由尚未建立。

正常扫描只调用一次 LLM；如果模型返回的 JSON 带说明文字、代码围栏或轻微语法问题，插件会先本地提取修复，必要时自动追加一次 JSON 修复调用，因此复杂项目可能比普通项目多等待几十秒。扫描结束后结果会立即刷新，不需要停留在页面继续等待。

| 配置 | 默认值 | 说明 |
|---|---:|---|
| `architectureEnabled` | `true` | 生成并维护架构图 |
| `architectureLlmEnabled` | `true` | 复用当前 DSH 模型做语义增强；关闭后完全本地 |
| `architectureLlmIncludeSource` | `true` | 向当前 DSH 模型发送有限的关键源码摘要；关闭后只发送结构事实 |
| `architectureMaxFiles` | `240` | 单次最多读取并提取 import 的源码文件数 |
| `architectureMaxNodes` | `24` | 最多概念组件数 |
| `architectureLlmTimeoutMs` | `60000` | LLM 分析超时，超时自动降级 |

Session 结束后如果 Git 变更包含源码或关键项目配置，插件会自动重扫。架构指纹不变时沿用旧的 LLM 语义结果，不重复请求模型。

## 使用

1. 在 DSH Desktop 中打开目标项目。
2. 打开顶部“项目”页，点击“启动项目大脑”。
3. 插件自动使用当前 Session 的 workspace，无需手动输入绝对路径。
4. 后续在不同对话中继续开发；插件会恢复项目记忆和待办。

项目重要信息出现时，Agent 可以调用这些工具持续沉淀：

| 能力 | 工具 |
|---|---|
| 初始化 / 重扫 | `project_init`, `project_rescan` |
| 项目概览 / 续接 | `project_status`, `project_continue` |
| 长期记忆 | `project_memory_add`, `project_memory_list` |
| 待办管理 | `project_todo_add`, `project_todo_list`, `project_todo_update`, `project_todo_done` |
| 查询 / 整理 | `project_ask`, `project_dream` |
| Git + LLM 架构变化分析 | `project_diff` |

## 隐私与安全

- Client 不能指定任意文件路径；运行时 RPC 只使用 Host Session header 中的 workspace。
- 工具执行时 live Session 路径优先于模型提供的 `path`，防止跨项目静默写入。
- 未初始化的项目不会被 Session summarizer 自动创建 `.project-brain/`。
- 默认发布构建不嵌入本机 workspace、Session ID 或项目脑内容。
- 架构 LLM 默认发送有限关键源码摘要但不发送绝对路径；可关闭 `architectureLlmIncludeSource` 只发送结构事实，或关闭 `architectureLlmEnabled` 完全本地分析。
- `.project-brain/` 是否提交 Git 由用户决定；其中可能包含项目内部决策，请按仓库隐私要求处理。

## 开发与验证

要求 Node.js 22.19+ 或 24+。

```bash
npm install
npm test
npm run build
npm run verify:release
npm audit
```

默认 `npm run build` 使用 release-safe runtime RPC 模式，不扫描或嵌入开发者本机项目。`--workspace=<path>` 和 `--workspace-all` 仅用于显式的本地调试快照。

当前自动化覆盖 12 组 smoke suite，包括运行时新 Session、跨 workspace 隔离、架构本地/LLM 双路径、长期记忆隔离、Memory V2、BM25/混合向量检索、Session 幂等、scanner、TodoStrip、主题、Git pack/delta 和 LLM 协议。`verify:release` 额外检查 npm 文件白名单和本机路径、Session ID、凭据泄漏。

## 当前限制

- 自动 Session 摘要以 Git commit 窗口为基础；未提交的对话语义仍需通过 `project_memory_add` / TODO 工具沉淀。
- `project_diff` 的真实 LLM 分析需要用户配置兼容的 OpenAI 或 Anthropic API；未配置时使用本地 fallback。
- Host 代码升级后需要完整重启一次 DSH Desktop；正常切换项目和数据更新不需要重启或 rebuild。

安装说明见 [INSTALL.md](./INSTALL.md)，版本记录见 [CHANGELOG.md](./CHANGELOG.md)，试用发布标准见 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)。

## License

MIT
