> **Unofficial community plugin** — not maintained or endorsed by the DeepSeek Harness team.
> **非官方社区插件** —— 不由 DeepSeek Harness 团队维护或背书。

## dsh-project-brain · v1.3.0 稳定版

为 [DSH（DeepSeek Harness）](https://github.com/deepseek-ai/deepseek-harness) 设计的持久化项目智能与记忆插件。在每个 DSH workspace 里建立独立的"项目大脑"，让 AI 助手在新 Session 里不再失忆。

- 仓库地址：https://github.com/yj-liuzepeng/dsh-project-brain
- npm：https://www.npmjs.com/package/dsh-project-brain
- 许可证：MIT
- 文档语言：英文 + 简体中文 README
- 最新稳定版：**v1.3.0**（2026-09-15）

## 核心功能

- 扫描**当前运行的工作区**，自动识别 6 种语言（JS/TS / Python / Go / Java / Rust / C-C++）、框架、入口文件、CI 配置、模块布局；技术栈按 **runtime / 交付 / 结构 / 语言** 四层口径分层，主视野只展示运行时技术，CI、IaC、观测下沉到「交付」次行（v1.3.0 `stack-taxonomy` 模块）
- 生成语义化的架构报告（项目定位、架构风格、分层、组件职责、关系、运行流程、关键文件、阅读顺序）。架构 Tab 采用**并列泳道**展示（层名靠左、组件靠右；点层才展开经过该层的主链路）。可用当前 DSH LLM 时走 LLM 增强路径，否则自动降级为本地确定性分析
- 持久化 **8 种结构化记忆类型**（`decision` / `change` / `bug` / `lesson` / `requirement` / `architecture` / `issue` / `context`）到 `<workspace>/.project-brain/`，按 workspace 隔离
- **Durable Core 站立记忆**（v1.3.0）：新 Session 开始时自动注入 `active` 记忆（全量，上限 15 条 / 约 800 token），溢出进 `dormant`；changelog / 活动汇报走规则门槛，不再挤 Core——注入始终是跨会话仍为真的决策、约束、架构事实与教训
- **主路径加权检索**（v1.3.0）：`project_ask` 默认按 BM25 + 重要度 + 时效 + 类型稳定性 + 多样性**五因子加权**排序，向量只作加分项。可选 Embedding 启用混合召回时，RRF（k=60）仍保留为可测算法（`scripts/smoke-retrieval-rrf.mjs`）——不再当 ask 主合同，避免「同一接口不同 query 走不同排序」
- Session 结束自动从当前 DSH LLM 抽取最多 4 条稳定语义记忆，含隐私清洗、长度限制、去重、失败兜底（LLM 不可用不崩）
- 交互式 Dashboard（**6 个 Tab**：概览 / 架构 / 任务动态 / 项目记忆 / 设置 / Git 历史）+ 启动入口 + SuggestionCard 智能续接建议 + 4 个 Quick Action（重新扫描 / 整理待办 / 整理记忆 / 项目全景），支持重扫、状态查询、整理记忆、查看工作活动

## v1.3.0 重点更新

- **Durable Core 站立记忆**（commit `712601b`）：active 记忆全量注入新 Session，上限 15 条 / 约 800 token；溢出自动进 dormant（Dashboard 项目记忆 Tab 显示，不进自动注入）。changelog / 活动汇报走规则门槛，不再挤 Core，保证注入始终是跨会话仍为真的决策、约束、架构事实与教训
- **设置页联通测试 + API Key 直填**：可一键测试 Embedding 与当前 DSH Session LLM 的连通性，实时反馈成功 / 失败原因。API Key 改为可直填（全大写名如 `PROJECT_BRAIN_EMBEDDING_API_KEY` 才会被识别为环境变量引用，否则作为密钥直接使用）
- **架构图改为并列泳道**（commit `bd3ddf6`）：层名靠左、组件靠右；不再把同层模块画成顺序链路（只有真实运行路径才出现编号箭头）；点层看并列关系与层职责，点模块看详情。架构 Tab 第一屏只保留短定位、风格标签和分层（分层鸟瞰）
- **单层展开运行路径**：点选一层才展开经过该层的主链路，每步一句职责、文件 / 风险作为附属信息，不再单独铺开
- **初始化页收敛 3 条重点**：读懂项目 / 跨会话记住 / 接着往下做；其余能力收成一行，避免清单过长。副标题补上「快速上手，越用越懂，长期把项目做下去」
- **技术栈抽 `src/stack-taxonomy.js` 模块**（commit `6627b64`）：按 runtime / 交付 / 结构 / 语言四层口径分层，scanner 与 aggregator 共用同一份规则。技术栈卡片主视野只展示运行时框架 / 网关 / 数据 / 容器；CI、IaC、观测下沉到「交付」次行；Monorepo 等结构标签与 Lint / 测试工具保持弱展示
- **Dockerfile 即 Docker**：存在 Dockerfile 时写入 `stack.container`，不再只在 `FROM nginx` 时才出现基础设施
- **Agent 栈识别补齐**：LangGraph 进入框架 chip；MCP 归入 API 层；项目内自定义 `energy_mcp.py` 等不会被误标成框架
- **Python 依赖文件兼容常见拼写**：识别 `requirment.txt` / `requirement.txt` / `requirements-*.txt`
- **截图从 7 张扩到 10 张**：新增启动入口、项目状态卡、设置·向量配置、设置·检索权重
- **URL 锁 v1.3.0 tag**：从 commit SHA 改为 git tag 形式（`.../v1.3.0/docs/screenshots/0X.png`），npm 商店页面与 discussion 主帖永远指向 v1.3.0 release commit 的截图
- **smoke 套件 17 → 19**：新增 `smoke-durable-core.mjs`（覆盖 active / dormant 分层、规则门槛、15 条上限、跨会话稳定性）+ `smoke-settings-probe.mjs`（覆盖 Embedding / LLM 联通探测、API Key 直填 vs 环境变量名、保存提示与即时生效）。`smoke-scanner-techstack.mjs` 从 22 扩到 60 项

## 工具清单

**16 个 `project_*` 工具**已注册到 Host：

| 能力 | 工具 |
|---|---|
| 初始化 / 重扫 | `project_init`, `project_rescan` |
| 状态 / 续接 | `project_status`, `project_continue`, `project_suggest_next` |
| 长期记忆 | `project_memory_add`, `project_memory_list`, `project_memory_archive`, `project_memory_supersede` |
| 待办管理 | `project_todo_add`, `project_todo_list`, `project_todo_update`, `project_todo_done` |
| 查询 / 整理 | `project_ask`, `project_dream` |
| Git + LLM 架构差异 | `project_diff` |

## 快速开始

在你使用的 DSH profile 里安装最新稳定版：

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.3.0
```

`dsh web` 用 `--profile web`；你的 DSH Desktop 分发版通常用 `--profile desktop`。安装或升级后**必须完全退出并重新打开** DSH Desktop（host bundle 改动不热重载）。

详细安装：https://github.com/yj-liuzepeng/dsh-project-brain/blob/main/INSTALL.md

## 截图

**项目大脑启动入口**（首次扫描前 — 列出 3 项核心能力 + 大号「启动项目大脑」按钮）：

![01](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/01.png)

**项目状态卡** —— 自动识别的技术栈 chip + 实时数字（待办 / 记忆 / 已完成）+ 阶段进度条：

![02](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/02.png)

**Dashboard 概览**（SuggestionCard「你今天可能想推进」+ 4 个 Quick Action + 5 个 Tab 导航 + 概览 tab 的技术栈 / 语言 / 开发入口）：

![03](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/03.png)

**架构 tab · 并列泳道** —— 5 层分层图（接口与桥接 / 工具与扫描 / 存储 / 记忆 / 构建），层名靠左、组件靠右：

![04](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/04.png)

**架构 tab · 单层展开** —— 点选一层后展开的运行路径（横向编号步骤 + 文件 / 风险附属）：

![05](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/05.png)

**任务动态 tab** —— 待办列表 + 项目开发时间线：

![06](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/06.png)

**项目记忆 tab** —— 8 种结构化记忆类型（决策 / 变更 / Bug / 经验 / 需求 / 架构 / Issue / 上下文），类型徽章 + 重要度星级：

![07](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/07.png)

**设置 · 向量检索 + Embedding 配置** —— 混合检索模式 / 启用开关 / Embedding 地址 / 模型 / API Key / 向量维度：

![08](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/08.png)

**设置 · 检索权重 + 测试连通** —— 关键词 / 向量 / 重要性 / 可信度 / 时新性五项权重 + 一键探测 Embedding 端点：

![09](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/09.png)

**Git 历史 tab** —— VSCode 风格时间线（分支切换器 + HEAD hash + 自动刷新开关 + 提交标题 / hash / 作者 / 改动文件数）：

![10](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/10.png)

## 版本更新摘要（v0.7.0 → v1.3.0）

**v1.3.0**（2026-09-15）—— Durable Core 站立记忆（active 15 条全量注入 / 溢出 dormant）+ 设置页联通测试与 API Key 直填；架构图改为并列泳道（5 层鸟瞰 + 单层展开运行路径）+ 初始化页收敛 3 条重点；技术栈抽 `stack-taxonomy` 模块，按 runtime / 交付 / 结构 / 语言四层口径分层（Dockerfile 即 Docker、LangGraph / MCP 识别、Python 拼写兼容）；截图从 7 张扩到 10 张（启动入口 / 项目状态卡 / 设置·向量 / 设置·权重）。
**v1.2.0**（2026-09-15）—— 6 项客户端/Host 修复 + 功能：Onboarding 升级为 8 项能力清单；记忆卡片查看改弹框模式；架构兜底条人话化 + 内联重试；语言 chip 按使用率排序 + 百分比 + 长尾聚合；切项目时显示 loading 占位；切项目/切 session banner 闪退修复。
**v1.1.1**（2026-09-12）—— Patch：修复 npm README 截图渲染（用 SHA 锁定的绝对 URL）。
**v1.1.0**（2026-09-12）—— 双通道检索：关键词 + 向量 + Reciprocal Rank Fusion（k=60）。新增 3 个 embedding smoke / e2e 脚本。
**v1.0.0**（2026-09-09）—— **首个稳定版本。** 修复 7 项 P0 发布阻塞（npm install ERESOLVE、dsh-tools peer 阻塞 smoke、Windows verify ENOENT）。拆分 `scanAndWrite` 纯逻辑层。39/39 host-acceptance 全过。
**v0.7.0** —— SuggestionCard、TodoStrip 折叠、GitTab VSCode 风格 UI、Dashboard 自建设置入口、双通道记忆机制、6 语言 AST 分析。

## 验证数据

```bash
npm test                        # 19 / 19 smoke suites
npm run test:runtime-workspace  # 30 / 30 runtime workspace RPC
npm run test:project-memory     # 59 / 59 project memory isolation
npm run test:acceptance         # 39 / 39 host-acceptance scenarios
npm run verify:release          # 14 / 14 checks（版本、文件白名单、隐私）
npm run verify:install          # CLEAN_TARBALL_INSTALL_PASS
npm audit                       # 0 vulnerabilities
```

## 隐私与安全

- 所有项目数据保存在 `<workspace>/.project-brain/`，**完全本地化**，不离开本机
- 架构分析复用当前 DSH LLM 路由，仅发送 README + manifest + 相对路径 + 受长度限制的源码摘要（不发送绝对路径）；源码摘要与 LLM 可分别关闭
- Client RPC 不能接收任意文件路径，Host 严格使用实时 Session 工作区
- Embedding（启用时）会向配置的端点发送记忆标题 + 正文 + 标签 + 文件名
- 发布包不含开发者工作区数据、Session ID、凭据或本机路径

## 反馈邀请

不同 DSH profile、客户端、Harness 版本、项目类型（单仓库 / monorepo / 多语言混合 / 学术写作）会对插件的不同侧面形成验证。特别欢迎以下反馈：

- Session 开始上下文注入选错记忆的边界情况
- Embedding 兜底行为（纯 BM25 vs 混合检索）
- Monorepo 中跨 workspace 的隔离
- 非 Web Host 兼容性（DSH Desktop / headless）

可复现的问题请到：https://github.com/yj-liuzepeng/dsh-project-brain/issues

如果你有真实工作流想分享，欢迎在本 Discussions 区开一个 **Show and tell** 帖 —— 真实用户故事是目前最有价值的贡献。