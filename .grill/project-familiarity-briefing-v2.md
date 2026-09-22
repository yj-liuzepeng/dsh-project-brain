# Grill: First-screen briefing v2
Date: 2026-09-21

## Intent
第一屏给「自己隔天回来接着干」看懂项目、看见最近在做什么。不要再塞入口路径和「为什么」独立行。

## Constraints
- 打开 Tab 不再调 LLM；purpose 复用 `architecture.overview.purpose`。
- 人第一屏与 Agent 字段同源；Agent 仍保留「从哪改」。
- Durable Core 不推翻；挤占时先截 recentWork。
- changelog 体裁 summary 不当「最近做什么」。

## Key decisions
- Decision: 人第一屏只留「这是什么」「最近做什么」。Reason: 四句标签失败、内容错位。Alternative considered: 修文案仍保留四句。
- Decision: 「这是什么」只用 LLM purpose（否则 description / 项目名）。Reason: `名字 · CI · Monorepo` 不是项目定义。Alternative considered: 每次打开再调 LLM。
- Decision: 「最近做什么」= 上次合格 session_summary；否则仅 `in_progress` 待办并加「进行中」前缀。pending-only 不当近况。Reason: 已完成/排队待办不是最近工作。Alternative considered: 退回任何活跃 TODO。
- Decision: 「从哪改」只进注入，且丢掉 npm script 入口。Reason: 人第一屏不靠它动手；Agent 仍需要文件锚点。Alternative considered: 人屏也留、或注入也删。

## Out of scope
- 为 briefing 新增独立 LLM 调用。
- 手动钉里程碑。
