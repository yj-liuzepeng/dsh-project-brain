# DSH 插件市场文案

## 名称

dsh-project-brain

## 一句话描述

让 DSH 持久理解当前项目：自动分析工作区，跨对话保留决策、变更、待办和开发上下文。

## 长描述

dsh-project-brain 为每个 DSH workspace 建立独立的本地“项目大脑”。首次启动会分析技术栈、语言、工具链、入口文件和项目结构；后续把架构决策、需求约束、Bug 根因、经验教训、Git 变化和待办持续沉淀到项目自己的 `.project-brain/`。

切换对话时，插件会自动恢复当前项目的关键记忆、活跃待办和最近活动。切换 workspace 时，Host 根据 live Session 安全解析对应目录，项目之间不会串数据。Sidebar 与 TodoStrip 使用运行时 RPC 实时读取，无需重新构建插件。

所有数据默认保存在本地。记忆查询默认使用本地 BM25；用户可选配置 Embedding 服务启用混合向量检索。只有主动配置的 LLM/Embedding 功能会把所需上下文发送到所选服务，失败时自动降级，不阻断基础功能。

## 能力

- 任意 DSH workspace 自动识别和初始化
- 13 个项目分析、记忆、待办、查询和 Git diff 工具
- 跨 Session 项目上下文注入
- 默认本地检索 + 可选混合向量语义召回
- Memory V2 状态、来源与可信度字段，归档内容不会污染上下文
- Session 变更摘要与重复记录抑制
- 多 workspace 强隔离
- 中英文界面与 DSH 主题适配
- 发布构建不携带开发者本机项目数据

## 标签

`developer-tools`, `project-management`, `memory`, `context`, `local-first`, `sidebar`, `ai-assistant`

## 隐私摘要

- 项目数据存储在 `<workspace>/.project-brain/`
- Client 无法指定任意 Host 文件路径
- 默认不联网；可选 LLM/Embedding 调用由用户自行配置
- 向量缓存位于 `.project-brain/cache/`，属于可删除、可重建的派生数据
- 发布包不嵌入本地 Session ID、workspace 路径或项目记忆

## 发布前检查

- [x] `npm test`：11 组 smoke suite（含 Memory V2 与混合检索）通过
- [x] 默认构建为 release-safe runtime RPC 模式
- [x] npm 发布文件 allowlist
- [x] MIT License
- [ ] 在目标 DSH Desktop 版本完成一次真实安装和跨项目切换验收
- [ ] 补充 Sidebar、TodoStrip、项目初始化和跨 Session 恢复截图
