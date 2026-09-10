# Show HN 帖文（4 标题变体 + 完整正文）

> **目标平台**：[news.ycombinator.com](https://news.ycombinator.com/) 的 Show HN
> **最佳发布时机**：周二 / 周三 / 周四 美东上午 8-10 点（Pacific 5-7am / 北京 21-23 点）
> **准备清单**：landing page、3 张截图、demo video（如有）、issue tracker、discussion 区

---

## 标题候选（A/B 测试）

### 变体 1（推荐）：明确痛点 + 解决方案

> **Show HN: dsh-project-brain – Persistent project memory for DSH (1.0.0)**

### 变体 2：差异化定位

> **Show HN: dsh-project-brain – A plugin that gives your AI coding assistant a long-term memory of your codebase**

### 变体 3：技术卖点

> **Show HN: dsh-project-brain – Host/Client split architecture + 6-language AST analysis for AI coding tools**

### 变体 4：本地化 / 隐私强调

> **Show HN: dsh-project-brain – Local-first project memory for DSH (no cloud, no lock-in)**

---

## 正文模板（推荐长度 400-800 字）

```markdown
Hi HN,

I've been working on **dsh-project-brain** for the past few months — a plugin
for [DSH (Development Shell Host)](https://github.com/deepseek-ai/deepseek-harness)
that gives your AI coding assistant a persistent, project-aware memory.

## The problem

Every new AI conversation starts from scratch: the model doesn't know your
project structure, your past decisions, the bugs you fixed last week, or which
files form the critical path. You're constantly re-explaining your codebase.

## What it does

dsh-project-brain turns each DSH workspace into a local "project brain":

- **Auto-architecture analysis** — scans the repo, identifies languages,
  frameworks, entry points, and produces a layered architecture report
  (project purpose, architecture style, components, flows, key files,
  reading order, risks). Uses the current DSH model if available, falls back
  to local analysis if not.
- **Cross-session memory** — decisions, requirements, architecture notes,
  bugs, lessons, changes, and TODOs persist in `<workspace>/.project-brain/`.
  New sessions automatically receive high-value memories, active TODOs,
  and recent activity through the system prompt.
- **Workspace isolation** — Host resolves the live Session workspace;
  one project's memory is never guessed from another project.
- **Git history + worktree** — pure-Node git history view (no shell
  dependency) with VSCode-style timeline UI.
- **In-Dashboard settings** — retrieval mode, embedding config, all live.

## How it's built

- **Host/Client split**: Host runs in Node.js (file ops, scanning,
  memory, RPC); Client runs in the browser (Dashboard UI, TodoStrip,
  SuggestionCard). Communication via Package-private JSON methods.
- **No language lock-in**: 16 tools, 6 languages supported for local
  AST analysis (JS/TS/Python/Go/Java/Rust/C++).
- **Local-first**: BM25 retrieval is the default. Embedding is an
  optional upgrade. All project data lives in your workspace.

## Verification

- 39/39 host-acceptance scenarios pass (`npm run test:acceptance`)
- 16/16 smoke suites pass (`npm test`)
- `verify:install` produces a clean tarball install with 0 vulnerabilities
- DSH Desktop UI verified manually on 2026-09-09

## Install

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0
```

## Links

- GitHub: https://github.com/yj-liuzepeng/dsh-project-brain
- npm: https://www.npmjs.com/package/dsh-project-brain
- Screenshots in README

Happy to answer any questions — and looking forward to your feedback!
```

---

## HN 发布 checklist（发布前 30 分钟）

- [ ] 在 https://news.ycombinator.com/shownew.html 准备草稿（先不提交）
- [ ] GitHub README 顶部 demo gif / 视频链接就位（目前没有，待录）
- [ ] Social preview 图已设到 GitHub repo（Settings → Social preview）
- [ ] 至少 3 个 issues 已关闭或回应（避免 "issues are empty" 批评）
- [ ] Discussion 区有 1-2 个种子帖（让用户有地方讨论）
- [ ] Twitter 上同步发同一条，@hn_frontpage_pages 之类账号
- [ ] 自己 + 1-2 个朋友准备好 1 小时内回应评论（HN 前 2 小时评论密度决定上首页）

## HN 后续动作（前 24 小时）

- 1 小时内回应每一条评论（HN 算法看早期评论密度）
- 准备 3-5 条 FAQ 答案（避免重复回答）
- 如果被顶到首页：发 Twitter 庆祝，链接回 HN
- 如果被拍：感谢批评，记录到 issue，不要反驳（HN 文化）