# Grill: Project familiarity (two views, one store)
Date: 2026-09-18

## Intent
做一个项目插件：随长期开发越来越熟悉该项目。新手打开就能建立心智模型；老手越用越好用；能看清从建仓以来重要开发做了什么、改了什么。熟悉的主体是「人 + Agent 同一条开发线」，不是一份越堆越大的知识库。

## Constraints
- 一份 `.project-brain/` 数据，两套视图：站立事实给 Agent；架构 / 第一屏 briefing / 变更链路给人（Agent 注入复用同一份 briefing，不另造事实源）。
- Precision over recall：changelog、git 文件清单、聊天原文、工具调用轨迹不是 Core，也不当链路节点正文。
- Core 硬顶仍有效（约 15 条 / 800 token）；挤占时先砍 briefing 里「最近为什么」的长度，不砍 Core。
- 架构过期不得假装确定；LLM 不得编造因果边。
- 不把向量检索当可靠性主路径。

## Key decisions
- Decision: 人 + Agent 两套视图、一份数据（选项 C）。Reason: 只服务 Agent 则新手仍要读代码；只服务人则每次 prompt 会被历史污染。Alternative considered: 只优化 Agent 续接，或只优化 Dashboard 认知。
- Decision: 项目 Tab 第一屏只回答四件事——这是什么、从哪改、现在卡在哪、最近为什么变成这样。Reason: 认识项目和变更全史抢第一屏。Alternative considered: 第一屏直接铺变更史。
- Decision: 「从哪改」= 入口 + 最多 5 个关键文件 / 主路径，不是目录树，也不是整张泳道当第一屏。Reason: 新手要能动手，不要先学分层图。Alternative considered: 目录、架构泳道占满第一屏。
- Decision: 新 Session 注入 = 同一份 4 句 briefing + Core 站立事实。Reason: 人看懂了模型仍乱摸仓，产品失败。Alternative considered: 人看 4 句、Agent 只吃 Core + TODO。
- Decision: 「最近为什么」= 上次 `session_summary`，否则最新一条 decision；不放 git 文件清单。Reason: 文件列表不是因果。Alternative considered: 把 diff 文件列表写入注入。
- Decision: Session 结束且相关文件有变更 → 自动轻扫；失败不阻塞关会话，只记 timeline。过期时第一屏和注入标明架构可能过期，「从哪改」降级为扫描入口，旧泳道不当真理。Reason: 共用 briefing 过期会把人和模型一起带偏。Alternative considered: 过期仍展示上次 LLM 泳道；或仅手动重扫。
- Decision: 轻扫勤、LLM 架构稀。轻扫：源码变动即刷新入口/技术栈/语言。LLM 架构：仅 `architectureRelevantFiles`（入口、分层目录、manifest、核心模块）。README / CHANGELOG / lockfile / 纯测试 / 格式化提交不触发 LLM。Reason: 每次关会话全量 LLM 又慢又脏。Alternative considered: 关会话一律全量架构分析。
- Decision: 变更史主视图是项目脑时间链路，不是 Git 主史，也不是独立编年史文档。Reason: Git 不知为何；另写叙事会和 Core/timeline 抢事实。Alternative considered: 只要 Git；或每里程碑一篇人写叙事。
- Decision: 链路节点 = 一次 Session（或明确里程碑），不是每一轮对话。节点：1 句做成了什么 + 折叠的模块/关键文件（默认 3–5）。边：主干为时间链；额外边仅硬证据（同一 TODO 生命周期、supersede、架构重扫由哪些相关文件触发）。空会话（无摘要、无 git、无记忆/TODO）不进主干，只保留折叠计数。Reason: 全量交互图会变成聊天回放；LLM 因果边不可信。Alternative considered: 每轮人机交互一个点；模型推断因果图。
- Decision: 只讨论、没改代码、也没调记忆/待办的 Session，只要有非空 `session_summary` 就进主干（可无文件）；摘要也空则折叠。Reason: 设计回合不能从史上消失；聊天原文仍不当节点。Alternative considered: 没 git 一律不进图。
- Decision (recommended default, user: 按你建议即可): `session_summary` 合同与记忆闸门一致——1–3 句「做了什么重要的 + 为什么」；git 文件只作节点附件；changelog 体裁不得当摘要。关会话抽取失败 = 该次交互在图上等于没发生，除非用户当时「记住」或事后补 decision。Reason: 图、第一屏第 4 条、talk-only 节点都依赖摘要质量。Alternative considered: 用「改了 N 个文件」当节点标题。
- Decision (recommended default, user: 按你建议即可): 链路图放在现有「任务动态 / 时间线」位置升级为主干图，Git Tab 仍是证据视图；不新造第三套事实存储。Reason: 减少入口。Alternative considered: 独立「演进」Tab。

## Surfaced assumptions
- 关会话抽取能稳定产出一句人话摘要；否则 talk-only 重要回合会丢。
- `architectureRelevantFiles` 足以判断该不该跑 LLM 架构。
- TODO id 能跨 Session 存活，因果边才画得出。
- 用户接受「没留下摘要的交互，史里不存在」。
- Durable Core 闸门（changelog 不进 Core、`project_memory_add` 视作自动写入）仍然有效；本 grill 不推翻 `.grill/durable-core-memory.md`。

## Open questions
- 里程碑是否允许用户手动钉一个 Session 当「版本节点」（例如 v1.3.1），还是完全由系统抽稀。未问；默认先全自动，手动钉选可后加。
- 主干图在超长历史下的抽稀算法（按周合并空档 vs 只按重要度）。未问；默认：超过一屏先按「有决策 / 有架构重扫 / 有 TODO 完成」抽稀，其余进展开。

## Out of scope
- 聊天原文入库或可回放。
- 用 LLM 生成独立「项目编年史」或推断无证据的因果边。
- 把变更全史、目录树、完整泳道塞进第一屏或每次注入。
- 向量检索作为续接主路径。
- 跨项目记忆联邦、再扩 AST 语言、用本插件替代 Jira。
- 每轮对话粒度的交互图。
