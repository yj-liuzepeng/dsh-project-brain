# DSH 插件市场文案

> 发布状态：`0.7.0-beta.2` 公测候选。允许 GitHub 用户安装试用；完成目标 DSH profiles、Web Client 与 Desktop 承载环境的真实安装矩阵后再提交稳定版。

## 名称

dsh-project-brain

## 一句话描述

让 DSH 持久理解当前项目：自动分析工作区，跨对话保留决策、变更、待办和开发上下文。

## 长描述

dsh-project-brain 为每个 DSH workspace 建立独立的本地“项目大脑”。首次启动会生成架构认知报告，说明项目定位、架构风格、概念分层、职责组件、运行流程、关键文件和阅读顺序；目录只作为证据。默认复用当前 DSH Session 的模型深入分析，模型不可用时自动使用本地职责模型。后续把架构决策、需求约束、Bug 根因、经验教训、Git 变化和待办持续沉淀到项目自己的 `.project-brain/`。

切换对话时，插件会自动恢复当前项目的关键记忆、活跃待办和最近活动。切换 workspace 时，Host 根据 live Session 安全解析对应目录，项目之间不会串数据。Sidebar 与 TodoStrip 使用运行时 RPC 实时读取，无需重新构建插件。

所有项目脑数据保存在本地。架构分析默认向当前 DSH 模型发送 README、manifest、结构事实和有限关键源码摘要，可关闭源码摘要或完全关闭 LLM。记忆查询默认使用本地 BM25；Embedding 服务仍需用户主动配置。

## 能力

- 任意 DSH workspace 自动识别和初始化
- 初始化/重扫自动维护架构认知报告，源码变化后按内容指纹增量刷新
- 当前 DSH LLM 零配置语义增强 + 本地静态分析降级
- 13 个项目分析、记忆、待办、查询和 Git diff 工具
- 跨 Session 项目上下文注入
- 默认本地检索 + 可选混合向量语义召回
- Memory V2 状态、来源与可信度字段，归档内容不会污染上下文
- Session Git 变更摘要 + 当前 DSH LLM 语义记忆抽取，并带隐私过滤、数量限制、去重与失败降级
- 多 workspace 强隔离
- 中英文界面与 DSH 主题适配
- 发布构建不携带开发者本机项目数据

## 标签

`developer-tools`, `project-management`, `memory`, `context`, `local-first`, `sidebar`, `ai-assistant`

## 隐私摘要

- 项目数据存储在 `<workspace>/.project-brain/`
- Client 无法指定任意 Host 文件路径
- 架构分析默认复用当前 DSH 模型并发送有限关键源码摘要，不发送绝对路径；源码摘要与 LLM 均可分别关闭
- 向量缓存位于 `.project-brain/cache/`，属于可删除、可重建的派生数据
- 发布包不嵌入本地 Session ID、workspace 路径或项目记忆

## 发布前检查

- [x] `npm test`：13 组 smoke suite（含架构、Session 语义记忆、Memory V2 与混合检索）通过
- [x] 默认构建为 release-safe runtime RPC 模式
- [x] npm 发布文件 allowlist
- [x] 发布隐私自动检查：无本机路径、Session ID、凭据或 `.project-brain/` 数据
- [x] `npm audit`：0 vulnerabilities
- [x] MIT License
- [x] README 已包含 Dashboard、架构分层和任务时间线截图
- [ ] 在目标 DSH profile 与客户端环境完成一次真实安装和跨项目切换验收
- [ ] 补充 TodoStrip、项目初始化和跨 Session 恢复截图
