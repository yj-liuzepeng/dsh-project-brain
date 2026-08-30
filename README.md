# dsh-project-brain

DSH Desktop 的本地项目大脑插件。它分析当前工作区，把项目结构、长期记忆、开发历史和待办保存在项目自己的 `.project-brain/` 中，让新的对话也能继续理解和维护同一个项目。

## 核心能力

- **快速理解项目**：识别技术栈、语言、工具链、入口文件、顶层结构和 README / package 元数据。
- **跨对话长期记忆**：架构决策、需求约束、Bug 根因、经验教训和变更记录持久保存在项目目录中。
- **分层记忆检索**：默认用本地 BM25 + 重要度/可信度/时效性和多样性排序；可选启用兼容 OpenAI Embeddings API 的混合向量检索。
- **自动恢复上下文**：新 Session 启动时按当前 workspace 注入高价值记忆、活跃待办和最近活动。
- **持续沉淀**：Session 结束后记录 Git 变更；相同 Session 和相同变更窗口会自动去重。
- **项目隔离**：Host 只信任当前 DSH Session 的 `cwd`，切换项目不会读取或写入另一个 workspace。
- **实时界面**：Sidebar 和 TodoStrip 通过 DSH Connection RPC 读取当前项目，每 5 秒轻量刷新；不需要为数据变化重新 build。
- **Local First**：默认不联网；只有用户主动配置的 LLM 或 Embedding API 才会向对应服务发送所需上下文。

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
├── memory.jsonl       # 决策、架构、需求、变更、Bug、教训等长期记忆
├── todo.jsonl         # 项目待办及状态
├── timeline.jsonl     # 初始化、重扫、记忆、待办和 Session 活动
├── codegraph.json     # 可选代码图数据
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
- `.project-brain/` 是否提交 Git 由用户决定；其中可能包含项目内部决策，请按仓库隐私要求处理。

## 开发与验证

要求 Node.js 22.19+ 或 24+。

```bash
npm install
npm test
npm run build
npm pack --dry-run
```

默认 `npm run build` 使用 release-safe runtime RPC 模式，不扫描或嵌入开发者本机项目。`--workspace=<path>` 和 `--workspace-all` 仅用于显式的本地调试快照。

当前自动化覆盖 11 组 smoke suite，包括运行时新 Session、跨 workspace 隔离、长期记忆隔离、Memory V2、BM25/混合向量检索、Session 幂等、scanner、TodoStrip、主题、Git pack/delta 和 LLM 协议。

## 当前限制

- 自动 Session 摘要以 Git commit 窗口为基础；未提交的对话语义仍需通过 `project_memory_add` / TODO 工具沉淀。
- `project_diff` 的真实 LLM 分析需要用户配置兼容的 OpenAI 或 Anthropic API；未配置时使用本地 fallback。
- Host 代码升级后需要完整重启一次 DSH Desktop；正常切换项目和数据更新不需要重启或 rebuild。

安装说明见 [INSTALL.md](./INSTALL.md)，版本记录见 [CHANGELOG.md](./CHANGELOG.md)。

## License

MIT
