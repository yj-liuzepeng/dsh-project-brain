# DSH Community Showcase 更新文案

> **帖子**：[discussions/5121](https://github.com/deepseek-ai/deepseek-harness/discussions/5121)
> **目的**：在已有 showcase 主帖更新 v1.0.0 发布（不创建新帖，避免分散关注）

---

## 帖子正文（追加到原帖末尾）

### 🎉 v1.0.0 stable released

经过 39 项端到端验收 + 用户实测，**dsh-project-brain 1.0.0** 作为首个稳定版发布，npm dist-tag 已从 `0.7.0-beta.2` 切换到 `latest`。

**这一版本主要做了什么**

- **7 项 P0 发布阻塞修复**：干净环境 `npm install` ERESOLVE、`dsh-tools` peer 阻塞 smoke、Windows 下 verify 脚本 ENOENT、`run-smoke` 失败隔离、跨平台 smoke 兼容性
- **拆分 `scanAndWrite` 纯逻辑层**：去除 `dsh-tools` 对 smoke 的传递依赖
- **一键开发工具**：`scripts/dev-reload.mjs`
- **39 项 host-acceptance 自动化覆盖**：AC-1 ~ AC-11 全过
- **DSH Desktop UI 实测通过**（2026-09-09）：Dashboard、TodoStrip、Architecture、Memory、Git History 在真实环境验证

**升级路径**

```bash
# Web / Desktop 通用
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0

# 已装旧版本的用户
dsh plugin --profile web update dsh-project-brain
# 然后完全退出 DSH Desktop 并重新打开
```

**数据完全兼容**，无需任何迁移。16 个 `project_*` 工具 API 不变。

**新功能（v0.7.0 ~ v1.0.0 增量）**

- `project_suggest_next` —— Session 开始时主动给出"💡 你今天可能想推进 X"+依据（结合活跃 TODO / 近期记忆 / 最近活动，本地规则 + 可选 LLM 升级）
- TodoStrip 折叠（composer 上方折叠 / 展开）
- GitTab VSCode 风格 UI（时间线 + 分支切换 + 提交详情）
- 双通道记忆机制 + 跨对话高保真续接
- Dashboard 自建设置入口（检索模式 / Embedding 配置，即时生效）
- 本地 AST 分析 6 语言（JS / TS / Python / Go / Java / Rust / C/C++）

**新截图（README 已更新）**

| 主题 | 内容 |
|------|------|
| Dashboard 总览 | SuggestionCard + 4 Quick Action + Tab 导航 |
| 多语言技术栈 | 6 语言识别（结构 / 框架 / 入口） |
| 架构分层 | 项目定位 + 架构风格 + 4 层分层图 |
| 项目记忆 | 真实 type=change 记忆演示 |
| 自建设置 | 检索模式 / Embedding 配置 + 即时生效 |
| Git 历史 | VSCode 风格时间线 + 分支切换 |

**验证自动化**

```bash
npm test                    # 16 / 16 smoke suites
npm run test:acceptance     # 39 / 39 host-acceptance
npm run verify:release      # 14 / 14
npm run verify:install      # CLEAN_TARBALL_INSTALL_PASS
npm audit                   # 0 vulnerabilities
```

欢迎在试用中遇到任何问题提 issue / discussion，也欢迎分享你的工作流（Show and tell）！

---

**链接**

- GitHub release: https://github.com/yj-liuzepeng/dsh-project-brain/releases/tag/v1.0.0
- npm: https://www.npmjs.com/package/dsh-project-brain
- MyDSH 商店: https://mydsh.dev/plugin?repo=yj-liuzepeng%2Fdsh-project-brain