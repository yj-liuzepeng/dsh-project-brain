# Twitter / X 构建日记 5 条

> **目标账号**：@yj_liuzepeng（如果有）或个人账号
> **节奏**：每天 1 条，共 5 天
> **标签**：#buildinpublic #DSH #AIcoding #LocalAI

---

## Day 1（v0.6.0 → v0.7.0-beta 基础）

**Tweet**：
```
🚀 启动 dsh-project-brain：让 DSH 持久理解你的项目

每次新对话都要重新介绍项目吗？架构、决策、踩过的坑、关键文件 —— 你说得累，AI 听得糊。

dsh-project-brain 把每个 DSH 工作区变成一个本地「项目大脑」：
✅ 自动架构分析
✅ 跨 Session 长期记忆
✅ 工作区隔离

v0.6.0-beta 已发布在 npm。

#buildinpublic #DSH
```

---

## Day 2（v0.7.0-beta.1 多语言 AST）

**Tweet**：
```
🌳 v0.7.0-beta.1：把 6 种语言纳入本地 AST 分析

之前只能用 JS/TS + Python。现在支持：
• Go（gin / gorm）
• Java（Spring / JPA）
• Rust（tokio / axum）
• C/C++（基础 #include）

为什么？DSH LLM 不一定可用，本地分析必须兜底完整。

#buildinpublic #AIcoding #LocalAI
```

---

## Day 3（v0.7.0 记忆机制优化）

**Tweet**：
```
🧠 记忆机制 v2：双通道 + 跨对话高保真续接

dsh-project-brain 默认 BM25 检索（零配置），可选 Embedding 混合。
Session 关闭时自动抽取语义记忆，注入到下次对话的 system prompt。

关键设计：本地规则 vs LLM 升级失败降级，绝对不阻塞 Session 启动。

#DSH #LocalFirst
```

---

## Day 4（v0.7.0 TodoStrip + GitTab）

**Tweet**：
```
✨ v0.7.0 UI 进化：
• TodoStrip 折叠 —— composer 上方不挡视野
• GitTab VSCode 风格时间线 —— 纯 Node.js，无 shell 依赖
• Dashboard 自建设置入口 —— Embedding 配置即时生效

每一个改动都从真实使用场景出发，不是为了炫技。

#buildinpublic #UI
```

---

## Day 5（v1.0.0 stable 发布）

**Tweet**：
```
🎉 dsh-project-brain v1.0.0 稳定版发布

7 项 P0 修复 + 39/39 端到端验收 + 用户实测通过。

第一个真正可以推荐给所有 DSH 用户的版本。

📦 npm: dsh-project-brain@1.0.0
🚀 安装：dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0
⭐ GitHub: github.com/yj-liuzepeng/dsh-project-brain

下一个里程碑：v1.1 跨 Session 共享模式 + 多 Workspace 联动。

#DSH #buildinpublic
```

---

## Twitter 发布 checklist

- [ ] 每条配 1 张截图（01.png ~ 07.png）
- [ ] 每条独立成 thread，第一条 hook 最强
- [ ] 时间：每个工作日 10:00 AM（本地时间），中国时间 22:00 也行
- [ ] @deepseek_ai（DSH 官方）+ 几个 DSH 圈 KOL
- [ ] 24 小时内回应所有 reply
- [ ] 把这些 thread 归档到 GitHub Discussions：[Show and tell] tag

## Bonus：发完 5 条后做什么

- 周报：把 5 条串成一篇 blog post（中文 + 英文）
- 数据：观察哪些推文 engagement 最高，下一轮针对该主题深挖
- 转化：在 bio 里加 GitHub 链接，置顶一条「我是做什么的」
- 长期：每月一条 update，1 周年时回顾完整历程（最容易上 trending）