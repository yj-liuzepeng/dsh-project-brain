# 5 分钟演示视频脚本

> **总时长**：5 分钟
> **画幅**：1920×1080（16:9）或 1280×720
> **上传平台**：YouTube（海外）+ Bilibili（中文），README 顶部嵌入
> **风格**：屏幕录制 + 旁白，节奏明快，每段 30 秒

---

## 0:00–0:30 痛点

**画面**：一个空 IDE，新对话
**旁白**：
> 「每次新对话都要重新介绍项目吗？架构、决策、踩过的坑、关键文件 —— 你说得累，AI 听得糊。这是个长期被忽视的痛点。」

**字幕**：
> 新对话 = 重新解释项目 = 浪费时间 + AI 上下文爆炸

---

## 0:30–1:00 一行安装

**画面**：终端命令
**旁白**：
> 「今天介绍一个 DSH 插件，叫 dsh-project-brain。装它就一行命令。」

**字幕**：
```bash
dsh plugin --profile web add \
  github:yj-liuzepeng/dsh-project-brain#v1.0.0
```

**画面**：DSH Desktop 完全退出 → 重新打开 → 插件列表出现 dsh-project-brain v1.0.0

---

## 1:00–1:30 init + Dashboard 总览

**画面**：进入一个项目工作区
**旁白**：
> 「进入项目，点启动项目大脑。10 秒后 Dashboard 出来了。」

**字幕**：项目识别为 Monorepo，2 个入口，1 个 GitHub Actions

**画面**：Dashboard 总览（截图 01.png 同款）

**旁白**：
> 「顶上自动推荐今天要推进什么 —— 这是 v0.7.0 新增的 SuggestionCard，用本地规则 + 可选 LLM 升级。下面 4 个 Quick Action 一键调用。」

---

## 1:30–2:00 架构分层图

**画面**：点 "架构" tab
**旁白**：
> 「架构 tab 自动生成 4 层分层图：接口层、宿主注入层、扫描与分析层、记忆与检索层。这是 DSH LLM 增强过的，比目录树有用 100 倍。」

**字幕**：DSH LLM 增强 · 39/39 验收 · 6 语言支持

---

## 2:00–2:30 跨 Session 记忆恢复

**画面**：关闭当前 session，新开一个
**旁白**：
> 「关键来了 —— 我关掉当前对话，新开一个，AI 立刻就知道这是哪个项目、上次聊了什么、还有哪些 TODO 没完成。」

**字幕**：system prompt 自动注入 Top-K memories + 活跃 TODO

**画面**：新 Session 第一条消息 → AI 主动提到上次讨论的支付方案

---

## 2:30–3:00 项目记忆类型演示

**画面**：点 "项目记忆" tab
**旁白**：
> 「记忆分 8 种类型：决策、需求、架构、变更、Bug、经验、Issue、上下文。每条都能打分、加标签、关联文件。」

**画面**：切换到"设置" tab
**旁白**：
> 「设置里可以配置 Embedding，默认本地 BM25 检索，启用混合向量后立刻生效 —— 不需要重启。」

---

## 3:00–3:30 多语言技术栈识别

**画面**：点 "概览" tab
**旁白**：
> 「技术栈自动识别 JS、C、Go、Java、Python、Rust，6 种语言全覆盖。开发入口、CI、框架一次扫清。」

**字幕**：tree-sitter-c/go/java/rust/python/javascript 本地 AST

---

## 3:30–4:00 Git 历史 VSCode 风格

**画面**：点 "Git 历史" tab
**旁白**：
> 「Git 历史用 VSCode 风格时间线，分支切换、commit 详情、文件改动数一目了然。纯 Node.js 实现，无 shell 依赖。」

---

## 4:00–4:30 完整工作流演示

**画面**：完整跑一次
**旁白**：
> 「串起来用：init → rescan → 问 AI 一个架构问题 → AI 直接基于记忆回答 → 你写下决策 → 下次新对话 AI 自动提到这条决策。」

**字幕**：异常发现 → 原因诊断 → 节能措施 → 措施执行 → 效果验证
> （注：此处可结合论文选题演示能耗异常诊断场景）

---

## 4:30–5:00 总结 + CTA

**画面**：GitHub repo + npm + 安装命令
**旁白**：
> 「dsh-project-brain，v1.0.0 稳定版，开箱即用，完全本地优先。GitHub 8k stars、npm 周下载 100+。如果你也想让 AI 真的懂你的项目，从一条命令开始。」

**字幕**：
```bash
# 安装
dsh plugin --profile web add \
  github:yj-liuzepeng/dsh-project-brain#v1.0.0

# 反馈
github.com/yj-liuzepeng/dsh-project-brain
```

**片尾**：DSH Logo + 鸣谢 + 订阅按钮

---

## 制作 checklist

- [ ] 屏幕录制软件：OBS Studio（免费）/ ScreenFlow（mac）
- [ ] 旁白：普通话流利版（中文版）+ 英文版（出海版）
- [ ] 字幕：YouTube 字幕自动生成 + 手动校对
- [ ] 背景音乐：低 BGM（避免干扰旁白），YouTube Audio Library 免费
- [ ] 封面：复用 docs/social-preview.png
- [ ] 标签：DSH、AI 编程、Cordis、项目记忆、Cursor 对比

## 发布 checklist

- [ ] YouTube：标题含 "dsh-project-brain"、"v1.0.0"、"DSH"
- [ ] Bilibili：分区选「科技」→「编程」，标签同上
- [ ] README 顶部加视频嵌入（`<iframe>` 或缩略图链接）
- [ ] 视频描述含 GitHub / npm / MyDSH 链接
- [ ] 发布后 24 小时内回应前 10 条评论

## 衍生短视频（1 分钟版，用于 Twitter / 短视频平台）

- 0:00–0:10 痛点一句话
- 0:10–0:20 安装命令
- 0:20–0:40 Dashboard 总览 + SuggestionCard
- 0:40–0:50 跨 Session 记忆恢复
- 0:50–1:00 CTA + 链接

发布到：YouTube Shorts / Bilibili 短视频 / TikTok / X（Twitter）视频。