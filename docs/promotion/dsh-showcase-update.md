# DSH Community Showcase 主帖 v1.3.0 更新文案

> **帖子**：[discussions/5121](https://github.com/deepseek-ai/deepseek-harness/discussions/5121)
> **作者**：yj-liuzepeng（OP，可编辑主帖）
> **更新策略**：直接重写主帖（替换 v0.7.0-beta.1 旧内容为 v1.3.0 最新版），保留 GitHub edit history

---

## 帖子正文（v1.3.0 完整版 · 直接替换主帖）

````markdown
> **Unofficial community plugin** — not maintained or endorsed by the DeepSeek Harness team.
> **非官方社区插件** —— 不由 DeepSeek Harness 团队维护或背书。

## dsh-project-brain · v1.3.0 stable

Persistent project intelligence and memory plugin for [DSH (DeepSeek Harness)](https://github.com/deepseek-ai/deepseek-harness). For every DSH workspace, dsh-project-brain builds an independent "project brain" — so AI assistants stop losing context every time you start a new Session.

- Repository: https://github.com/yj-liuzepeng/dsh-project-brain
- npm: https://www.npmjs.com/package/dsh-project-brain
- License: MIT
- Languages: English + 简体中文 README
- Latest stable: **v1.3.0** (2026-09-15)

## What it does

- Scans the **current runtime workspace**, recognizing 6 languages (JS/TS / Python / Go / Java / Rust / C-C++), frameworks, entry points, CI, and module layout.
- Produces a semantic architecture report (project purpose, architecture style, layers, responsibilities, relationships, runtime flows, key files, reading order). Uses the current DSH LLM route when available, falls back to deterministic local analysis otherwise.
- Persists **8 structured memory types** (`decision` / `change` / `bug` / `lesson` / `requirement` / `architecture` / `issue` / `context`) under `<workspace>/.project-brain/`, isolated per workspace.
- Injects a compact context summary into new Sessions, so a fresh conversation continues with accumulated project knowledge (high-value decisions, active TODOs, recent activity).
- **Hybrid retrieval by design**: zero-configuration local BM25 default; optional Embedding endpoint enables dual-channel (keyword + vector) recall with Reciprocal Rank Fusion (k=60) — both channels contribute, missing channels gracefully fall back to weighted scoring.
- Session-end automatically extracts up to 4 stable semantic memories from current DSH LLM, with privacy filtering, length limits, deduplication, and failure fallback (no crash if LLM is unavailable).
- Interactive Dashboard (4 tabs: Overview / Architecture / Activity / Memories / Settings / Git History) for rescan, status, dream memory cleanup, and work activity inspection.

## Tool surface

**16 `project_*` tools** registered with the Host:

| Capability | Tools |
|---|---|
| Init / Rescan | `project_init`, `project_rescan` |
| Status / Continue | `project_status`, `project_continue`, `project_suggest_next` |
| Memory | `project_memory_add`, `project_memory_list`, `project_memory_archive`, `project_memory_supersede` |
| Todos | `project_todo_add`, `project_todo_list`, `project_todo_update`, `project_todo_done` |
| Query / Cleanup | `project_ask`, `project_dream` |
| Git + LLM diff | `project_diff` |

## Quick start

Install the latest stable release into the DSH profile you use:

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.3.0
```

Use `--profile web` with `dsh web`, or the profile your DSH distribution runs (e.g. `--profile desktop`). After install or upgrade, **completely quit and reopen** DSH Desktop (host bundle changes do not hot-reload).

Detailed setup: https://github.com/yj-liuzepeng/dsh-project-brain/blob/main/INSTALL.md

## Screenshots

**Project Brain activation entry** (initial onboarding with 3 core capabilities):

![01](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/01.png)

**Project card** — auto-detected stack + live status (pending TODOs / memories / completed):

![02](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/02.png)

**Dashboard overview** — SuggestionCard + 4 Quick Actions + 5 tabs (Overview / Architecture / Activity / Memories / Settings / Git History):

![03](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/03.png)

**Architecture tab** — lane-based layered overview (5 layers, left=layer / right=components):

![04](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/04.png)

**Architecture tab** — expanded runtime path for a single layer:

![05](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/05.png)

**Activity tab** — TODOs + development timeline:

![06](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/06.png)

**Memories tab** — structured project memory (8 types, importance stars, view-details modal):

![07](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/07.png)

**Settings — vector retrieval and Embedding config** (hybrid mode, Embedding URL / model / API key, vector dim):

![08](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/08.png)

**Settings — retrieval weights and probe button** (keyword / vector / importance / confidence / recency, live probe):

![09](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/09.png)

**Git history tab** — VSCode-style timeline with branch / commit / file-changes summary:

![10](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/10.png)

## Changelog highlights (v0.7.0 → v1.3.0)

**v1.3.0** (2026-09-15) — Durable Core 站立记忆 (active 15 条全量注入 / 溢出 dormant) + 设置页联通测试与 API Key 直填；架构图改为并列泳道（5 层鸟瞰 + 单层展开运行路径）+ 初始化页收敛 3 条重点；技术栈抽 `stack-taxonomy` 模块，按 runtime / 交付 / 结构 / 语言四层口径分层（Dockerfile 即 Docker、LangGraph / MCP 识别、Python 拼写兼容）；截图从 7 张扩到 10 张（启动入口 / 项目状态卡 / 设置·向量 / 设置·权重）。
**v1.2.0** (2026-09-15) — 6 fixes & features: Onboarding 升级为 8 项能力清单；记忆卡片查看改弹框模式；架构兜底条人话化 + 内联重试；语言 chip 按使用率排序 + 百分比 + 长尾聚合；切项目时显示 loading 占位；切项目/切 session banner 闪退修复。
**v1.1.1** (2026-09-12) — Patch: fix npm README screenshot rendering (use SHA-locked absolute URLs).
**v1.1.0** (2026-09-12) — Hybrid retrieval: dual-channel (keyword + vector) with Reciprocal Rank Fusion (k=60). 3 new embedding smoke / e2e scripts.
**v1.0.0** (2026-09-09) — **First stable release.** 7 P0 publish-blocking fixes (npm install ERESOLVE, dsh-tools peer smoke, Windows verify ENOENT). Split `scanAndWrite` pure logic layer. 39/39 host-acceptance scenarios pass.
**v0.7.0** — SuggestionCard, TodoStrip collapse, GitTab VSCode-style UI, Dashboard settings entry, dual-channel memory mechanism, 6-language AST analysis.

## Verification

```bash
npm test                        # 19 / 19 smoke suites
npm run test:runtime-workspace  # 30 / 30 runtime workspace RPC
npm run test:project-memory     # 59 / 59 project memory isolation
npm run test:acceptance         # 39 / 39 host-acceptance scenarios
npm run verify:release          # 14 / 14 checks (version, allowlist, privacy)
npm run verify:install          # CLEAN_TARBALL_INSTALL_PASS
npm audit                       # 0 vulnerabilities
```

## Privacy

- All project data stays in `<workspace>/.project-brain/`; nothing leaves the local machine.
- Architecture analysis uses the current DSH LLM route and sends only README + manifests + relative paths + bounded source excerpts (no absolute paths); both source excerpts and LLM can be disabled separately.
- Client RPC cannot accept arbitrary file paths; Host uses the live Session workspace.
- Embedding (when enabled) sends memory titles + bodies + tags + file names to the configured endpoint.
- Release artifacts contain zero developer workspace data, Session IDs, credentials, or local paths.

## Feedback

Different DSH profiles, clients, Harness versions, and project shapes (single-repo / monorepo / polyglot / academic writing) exercise the plugin differently. Feedback is especially welcome on:

- Edge cases where Session-start context injection picks the wrong memories
- Embedding fallback behavior (BM25-only vs hybrid)
- Cross-workspace isolation in monorepo setups
- Non-Web Host compatibility (DSH Desktop / headless)

Please report reproducible issues at: https://github.com/yj-liuzepeng/dsh-project-brain/issues

If you have a real workflow to share, please open a **Show and tell** in this Discussions section — real user stories are the most valuable contribution right now.
````

---

## 🚀 三种更新方式

### 方式 A：浏览器手动编辑（推荐 · 最简单）

1. 打开 https://github.com/deepseek-ai/deepseek-harness/discussions/5121
2. 右上角点 **"Edit"** 按钮（你是 OP，会有这个按钮）
3. 全选原内容 → 删除 → 粘贴上面的"帖子正文"
4. 点 **"Update comment"**
5. 刷新页面，确认 v1.3.0 内容已显示

⏱️ **耗时：3 分钟**

### 方式 B：gh CLI 编辑（适合批量 / 自动化）

```bash
# 1. 上面"帖子正文"的 markdown 保存为本地文件（去掉外层 ````markdown ... ```` 包裹）
#    文件名: docs/promotion/discussion-5121-new-body.md

# 2. 用 gh CLI 编辑
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/deepseek-ai/deepseek-harness/discussions/5121 \
  -f body="$(cat docs/promotion/discussion-5121-new-body.md)"
```

⏱️ **耗时：5 分钟**（包含提取 body）

### 方式 C：追加评论（保留历史）

如果不想替换原帖，可以在帖子下加一条新评论（你也是 OP，可以加编辑过的置顶评论）：

```
🎉 v1.3.0 stable released (2026-09-15)

After 162 suite-level checks (smoke + runtime-workspace + project-memory + host-acceptance + release-verify) + DSH Desktop user testing, v1.3.0 is now the recommended stable release.

Quick start:
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.3.0

What's new since v1.2.0:
- **Durable Core 站立记忆**：active 全量注入 15 条 / 约 800 token，溢出进 dormant；changelog / 活动汇报走规则门槛，不再挤 Core
- **设置页联通测试 + API Key 直填**：可一键测试 Embedding 与会话 LLM；API Key 直接粘贴（全大写名才识别为环境变量）
- **架构图改为并列泳道**：层名靠左、组件靠右；点层才展开经过该层的主链路，组件只保留一句职责
- **架构 Tab 分层鸟瞰 + 单层展开运行路径**：第一屏只保留短定位、风格标签和分层
- **初始化页收敛 3 条重点**：读懂项目 / 跨会话记住 / 接着往下做
- **技术栈抽 stack-taxonomy 模块**：runtime / 交付 / 结构 / 语言四层口径分层；Dockerfile 即 Docker；LangGraph / MCP 识别；Python 拼写兼容
- **截图从 7 张扩到 10 张**：新增启动入口、项目状态卡、设置·向量、设置·权重
- **smoke 套件 17 → 19**：新增 smoke-durable-core + smoke-settings-probe

Full changelog: https://github.com/yj-liuzepeng/dsh-project-brain/blob/main/CHANGELOG.md
```

⏱️ **耗时：1 分钟**

---

## 🎯 推荐方式 A

浏览器手动编辑最直观，且 GitHub 会保留 edit history（你可以看每次改了什么）。

如果你时间紧，先**方式 C**追加一条评论，告知最新版本；后续再**方式 A**替换主帖。

---

## ⚠️ 注意：截图 URL 锁定

新的截图 URL 用 `v1.3.0` tag 锁定（不是 commit SHA）。这样：
- 主帖永远显示 v1.3.0 时刻的截图（与 v1.3.0 npm 包一致）
- 未来发 v1.4 时，截图会自动指向 v1.3.0（如要更新，需改 discussion body）

---

## ✅ 更新后验证

更新完请：
1. 刷新 discussion 页面，确认新内容已显示
2. 点击 10 个截图链接，确认 GitHub raw CDN 能正常打开（注意 CDN 缓存，可能需要等几分钟或绕过）
3. 24 小时内回复任何评论，建立 DSH 圈口碑