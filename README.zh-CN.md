# dsh-project-brain

[English](./README.md) · **简体中�?*

[![Version](https://img.shields.io/badge/version-1.3.1-blue)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.19-339933)](./package.json)
[![Status](https://img.shields.io/badge/status-stable-success)](./RELEASE_CHECKLIST.md)

**DSH 的持久化项目智能与记忆插件�?* 它分析当前工作区、解释项目架构、保存开发决策与历史，并在后�?Session 中自动恢复正确的项目上下文�?

它的目标不是让每个新对话重新理解仓库，而是把重要知识沉淀在项目内部，随着持续开发越来越熟悉项目�?

> 当前版本：`1.3.1` 补丁�?�?新增**导入导出 / 本地备份恢复**（跨机器同步场景）。端到端 20/20 smoke suite + 46/46 host-acceptance 通过；数据格式与 v1.3.0 完全兼容�?

**v1.3.1 新特�?*：�?**导入导出 / 备份恢复**
- Dashboard 顶部新增 **💾 备份 / 📥 恢复 / �?回滚** 三个按钮（与项目�?+ techStack chip 同一行）
- 一键把整个项目脑打�?zip（含 timeline + cache + manifest + sha256 校验）→ 跨机器传文件 �?在另一台机器一键还�?
- 导入前自动预览影响清单（即将覆盖的脑 / 旧脑备份路径 / rootPath 改写）；主按钮文案「覆盖并恢复」明确提�?
- 每次导入/回滚前自动备份当前脑�?`.project-brain.backup-<ts>/`；可随时回滚到任一历史备份
- 4 个新 Tool：`project_export` / `project_import` / `project_rollback_backup` / `project_cleanup_backups`

[GitHub 预发布](https://github.com/yj-liuzepeng/dsh-project-brain/releases/tag/v1.3.1) · [DSH 社区展示帖](https://github.com/deepseek-ai/deepseek-harness/discussions/5121) · [MyDSH 插件详情](https://mydsh.dev/plugin?repo=yj-liuzepeng%2Fdsh-project-brain)

## 界面预览

### 项目大脑启动入口（首次扫描前�?

![启动前引导页：列出三项核心能力（读懂项目 / 跨会话记�?/ 接着往下做），底部展示当前 workspace 路径与大号「启动项目大脑」按钮](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/01.png)

### 项目状态卡 + 实时数字

![项目卡片：项目名、自动识别的技术栈 chip（GitHub Actions / Monorepo）、项目描述、上次更新时间，下方三栏数字（待�?0 / 项目记忆 3 / 已完�?3�? 当前阶段进度�?100%](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/02.png)

### Dashboard 概览 + 智能续接建议 + Quick Action

![Dashboard · 项目全景顶栏 + SuggestionCard「你今天可能想推�?· AI 推荐 · 置信�?45%�? 四个 Quick Action（重新扫�?/ 整理待办 / 整理记忆 / 项目全景�? 概览 tab 的技术栈 / 语言 / 开发入口三列](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/03.png)

### 架构 tab · 并列泳道分层�?

![架构 tab：项目定位、架构风格标签、「插件式分层架构�?「DSH LLM 增强」徽标，5 层泳道（接口与桥接层 / 工具与扫描层 / 存储�?/ 记忆子系�?/ 构建与脚本层），层名靠左、组件靠右](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/04.png)

### 架构 tab · 单层展开运行路径

![点选「会话抽取与混合检索」层后展开的运行路径：横向编号步骤（记忆子系统 �?记忆子系�?�?记忆子系�?�?记忆子系�?�?Brain 存储），每步一句职责说明，下方附属文件/风险](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/05.png)

### 任务动�?· 待办 + 时间�?

![任务动�?tab：左侧已完成待办（实时交互记�?/ 会话摘要重构 / 跨对话高保真续接�? 右侧时间线，按时间倒序展示记忆整理、项目重扫、新增记忆条目](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/06.png)

### 项目记忆 · 类型徽章 + 重要度星�?

![项目记忆 tab：当�?Core（每轮注入）· 7 张卡片网格，每张卡片含类�?chip（决�?/ Bug / 架构 / 教训 / 备注）、重要度星级、一行摘要、日期、查看详情按钮；底部可展开休眠记忆](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/07.png)

### 设置 · 向量检�?+ Embedding 配置

![设置 tab · 检索与向量区域：混合检索模式、启用向量检索开关、Embedding 地址 / 模型 / API Key 输入框、向量维度，顶部绿色提示「配置可写，未点保存不会生效」](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/08.png)

### 设置 · 检索权�?+ 测试连�?

![设置 tab · 检索权重区域：关键�?/ 向量 / 重要�?/ 可信�?/ 时新性五项权重输入（0.15 / 0.25 / 0.3 / 0.1 / 0.2），每项下方一行配置提示；右下角小号浅蓝「测试向量连通」按钮一键探�?Embedding 端点](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/09.png)

### Git 历史 tab · VSCode 风格时间�?

![Git 历史 tab：分支切换器（main · 32 个提�?· 1 个其他分支）、HEAD bd3df6、自动刷�?30s 开关；下方 commit 时间线含 graph 圆点、提交标题、short hash、作者、相对时间、改动文件数摘要；右侧分�?chip](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.1/docs/screenshots/10.png)

## 为什么需要它

AI 编程对话通常是短期的，但软件项目会长期演进。架构选择的原因、生产问题的解决方案、当前正在处理的任务和关键代码入口，经常散落在不同对话里�?

dsh-project-brain 把这些内容变成按工作区隔离的本地知识层：

- **快速理解仓�?*：识别语言、框架、工具链、入口文件、manifest、README 元数据、符号和 import�?
- **解释架构而不是罗列目�?*：生成项目定位、架构风格、概念分层、组件职责、关系、运行流程、关键文件、阅读顺序和风险�?
- **复用当前 DSH 模型**：架构分析默认使用当�?Session 已选择�?provider/model，无需单独填写对话模型密钥�?
- **跨对话长期记�?*：持续保存决策、需求、架构、Bug、经验、变更、待办和活动记录�?
- **自动恢复上下�?*：新 Session 自动获得高价值记忆、活跃待办和最近活动�?
- **项目严格隔离**：Host 根据实时 Session 工作区解析路径，不从其他项目猜测数据�?
- **默认不需要向量模�?*：零配置使用本地 BM25；Embedding 是可选语义增强�?
- **AI 不可用仍能工�?*：架构分析和记忆检索都有本地降级路径�?

## 工作原理

```text
当前 DSH Session
       �?可信的实�?Session cwd
       �?
工作区扫描器 ─────────�?项目事实与源码证�?
       �?
       ├──�?当前 DSH LLM ───�?语义架构报告
       �?         �?不可�?/ 超时 / 输出异常
       �?         └─────────�?本地架构降级
       �?
       ├──�?.project-brain/ ─�?记忆、待办、时间线、架�?
       �?
       ├──�?上下文注入器 ───�?�?Session System Prompt
       �?
       └──�?Connection RPC ─�?Dashboard �?TodoStrip
```

浏览器侧不能指定任意文件路径，所有运行时操作都由 Host 根据当前 DSH Session 解析目标工作区�?

## 本地数据

每个项目拥有独立的数据目录：

```text
.project-brain/
├── project.json          # 项目元数据、技术栈、语言和入�?
├── architecture.json     # 定位、分层、组件、流程和证据
├── memory.jsonl          # 结构化长期项目记�?
├── todo.jsonl            # 项目待办及状�?
├── timeline.jsonl        # 扫描、记忆、待办与 Session 活动
├── codegraph.json        # 可选的旧版 AST �?
└── cache/
    └── embeddings.jsonl  # 可选、可删除、可重建的派生缓�?
```

切换对话或升级插件不会丢失这些数据，卸载插件也不会删�?`.project-brain/`�?

## 记忆机制

记忆类型包括 `decision`、`requirement`、`architecture`、`change`、`bug`、`lesson`、`issue` �?`context`�?

V2 记忆包含重要性、可信度、生命周期状态、来源、时间、标签和相关文件。已归档、已替代或已删除的记忆不会进入普通检索、自动上下文注入、状态统计和 Dashboard�?

记忆主要通过三条路径产生�?

1. Agent 使用 `project_memory_add` 主动记录稳定决策和经验�?
2. Session 结束时，记录去重后的 Git 变更摘要，并复用当前 DSH 模型抽取少量、有证据的长期项目事实。凭据、工具输出和非文本内容会被过滤；模型不可用或输出异常时安全降级为�?Git 记忆�?
3. 架构差异分析生成 architecture/change 类型记忆�?

“整理记忆”会先预览合并和归档候选，只有用户确认后才真正写入�?

Session 抽取可通过 `sessionSemanticMemoryEnabled`、`sessionSemanticMaxChars`、`sessionSemanticMaxItems` �?`sessionSemanticTimeoutMs` 配置；关闭后仍保留纯 Git 摘要�?

## 记忆检�?

默认检索使用本�?BM25，搜索标题、正文、标签、相关文件和类型，并综合重要性、可信度、时效性、稳定记忆类型和结果多样性排序�?

如需语义增强，可在插件设置中启用混合向量检索：

```yaml
retrievalMode: hybrid
vectorEnabled: true
embeddingBaseURL: https://your-provider.example/v1
embeddingModel: your-embedding-model
embeddingApiKeyEnv: PROJECT_BRAIN_EMBEDDING_API_KEY
```

向量索引按内容哈希懒加载更新。凭据缺失、网络失败、响应异常或维度不一致时，会自动降级为本地关键词检索�?

> 启用远程 Embedding 后，记忆标题、正文、标签和相关文件名会发送到配置的服务。私有项目建议使用本地模型或可信服务�?

## 架构分析

初始化和重扫会先收集确定性的本地事实。当当前 DSH Session 已建立可用模型路由时，插件会�?README、manifest、相对路径、符�?import 和受长度限制的关键源码摘要发送给当前模型，生成概念架构报告�?

主要安全和可靠性措施：

- 不向模型发送绝对路径；
- 源码摘要、最大文件数和组件数均可配置�?
- 严格提取、修复并规范�?JSON�?
- 验证证据文件路径和组件关系；
- 不渲染模型生成的 HTML�?
- 无路由、超时或非法输出时自动本地降级；
- 使用架构指纹避免无意义的重复分析�?

设置 `architectureLlmIncludeSource: false` 可只发送结构事实；设置 `architectureLlmEnabled: false` 可完全使用本地分析�?

## 快速开�?

将已发布的公测标签安装到你正在使用的 DSH profile�?

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v0.7.0-beta.2
```

例如，`dsh web` 通常使用 `--profile web`；如果你�?Desktop 发行版运�?`desktop` profile，则使用 `--profile desktop`。安装或升级后需要重启当�?DSH 进程；使�?DSH Desktop 时应完全退出并重新打开。发布包已包含预构建 Host/Client bundle，普通用户无需安装 Node.js 或本地编译�?

### 运行环境兼容�?

- Host 插件为兼容的 DSH profile 提供工作区分析�?3 �?`project_*` 工具、长期记忆、上下文注入、待办和架构分析�?
- Dashboard �?TodoStrip �?DSH Web Client 插件（`platform: web`），可用�?DSH Web，以及承�?DSH Web Client �?Desktop 发行版�?
- �?CLI/TUI 客户端不会显�?Dashboard；当对应 profile 提供插件所需�?DSH Host services 时，仍可使用核心 Host 能力。非 Web profile 的真实兼容矩阵仍在公测验证中�?

参与源码开发时需�?Node.js `22.19+` �?`24+`�?

```bash
git clone https://github.com/yj-liuzepeng/dsh-project-brain.git
cd dsh-project-brain
npm install
npm test
npm run build
npm run verify:release
npm run verify:install
```

源码贡献者可将仓库链接进目标 DSH profile workspace，并�?bundle 配置中启�?`dsh-project-brain`�?

安装后：

1. �?DSH 中打开一个项目工作区�?
2. 进入顶部“项目”页�?
3. 点击“启动项目大脑”�?
4. 查看概览、架构、任务动态和项目记忆四个页签�?
5. 新建对话，确认项目上下文能够自动恢复�?

详细步骤和故障排查见 [INSTALL.md](./INSTALL.md)�?

## 工具列表

| 能力 | 工具 |
|---|---|
| 初始�?/ 重扫 | `project_init`, `project_rescan` |
| 状�?/ 续接 | `project_status`, `project_continue` |
| 长期记忆 | `project_memory_add`, `project_memory_list` |
| 待办管理 | `project_todo_add`, `project_todo_list`, `project_todo_update`, `project_todo_done` |
| 查询 / 整理 | `project_ask`, `project_dream` |
| Git + LLM 架构差异 | `project_diff` |

Dashboard 快捷操作会在后台执行这些工作流，并提供加载、确认、成功、错误和重试状态�?

## 隐私与安�?

- 项目知识保存�?`<workspace>/.project-brain/`；只有显式启用的模型能力才会向对应服务发送受限制的内容�?
- Session 语义记忆会把受长度限制的用户/助手文本发送给 DSH 当前选择的模型服务；发送前会排除工具输出、System 消息并清洗可识别凭据。可设置 `sessionSemanticMemoryEnabled: false` 关闭�?
- Client RPC 不能传入文件路径，Host 只使用实�?Session 工作区�?
- 工具执行优先使用可信 Session 路径，而不是模型提供的参数�?
- 未初始化项目不会�?Session summarizer 静默创建数据�?
- 向量能力默认关闭�?
- Embedding 密钥通过 DSH Credentials 或环境变量引用解析，不写入记忆文件或 Client RPC�?
- 发布构建不会嵌入开发者工作区、Session ID、项目记忆、凭据或本机路径�?
- `.project-brain/` 可能包含内部决策�?Bug 历史，提�?Git 前请先审查�?

## 开发与发布验证

```bash
npm test
npm run build
npm run verify:release
npm run verify:install
npm audit
```

自动化覆盖运行时工作区解析、跨项目隔离、跨 Session 记忆、本�?LLM 架构路径、Memory V2、BM25/混合检索、Session 去重、Scanner、Dashboard/TodoStrip、主题、Git pack/delta �?LLM 协议�?

`verify:release` 会验证包元数据、入口和 npm 文件白名单，并扫描本机路径、Session ID、凭据、私钥、日志、归档文件和项目脑数据。`verify:install` 会把实际发布包安装进临时空项目，提前发现 peer 依赖冲突或构建产物缺失�?

## 当前限制

- Session 语义抽取有严格长度与数量限制，只保存少量稳定事实；关键意图仍建议通过记忆�?TODO 工具显式沉淀�?
- Session 第一次正常模型请求前可能没有可复用的 DSH 模型路由；此时先进行一次对话再重扫�?
- `project_diff` 使用独立�?OpenAI/Anthropic-compatible 配置；初始化架构分析使用当前 DSH Session 模型�?
- Git multi-pack-index（MIDX）尚未完整支持�?
- Host bundle 升级后需要重启当�?DSH 进程；Desktop 用户应完整退出并重新打开应用�?

## 文档

- [English README](./README.md)
- [安装说明](./INSTALL.md)
- [发布检查清单](./RELEASE_CHECKLIST.md)
- [更新日志](./CHANGELOG.md)
- [设计说明](./DESIGN.md)
- [技术规格](./SPEC.md)
- [商店文案](./STORE_LISTING.md)

## License

[MIT](./LICENSE)
