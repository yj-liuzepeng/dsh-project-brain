# 更新日志（CHANGELOG）

> dsh-project-brain 项目的所有重要变更都记录在这里。
> 本文档遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

---

## Unreleased

### Changed（变更）

- **技术栈卡片按运行时口径分层**：主视野只展示框架 / 网关 / 数据 / 容器等运行时技术；CI、IaC、观测下沉到「交付」次行；Monorepo 等结构标签与 Lint/测试工具保持弱展示。旧 `techStack` 兜底不再把 `ci:` / `structure:` 顶到主 chip。
- **Dockerfile 即视为 Docker**：存在 Dockerfile 时写入 `stack.container`，不再只在 `FROM nginx` 时才出现基础设施。
- **架构合并不再把语言名标成框架**：Python / JavaScript / Go 等只留在语言统计，不进 FastAPI / Vue 同一行。
- **运行时预览补齐 stack**：Dashboard RPC 与 build embed 对齐，下发 `stack` / `structure` 并合并架构识别结果，避免磁盘已有 LangChain 但卡片显示为空。
- **Python 依赖文件兼容常见拼写**：识别 `requirment.txt` / `requirement.txt` / `requirements-*.txt`。
- **补齐 Agent 栈**：扫描与架构合并识别 LangGraph；MCP 归入 API 层，不把项目内自定义 `energy_mcp.py` 误标成框架。

---

## 升级到 v1.2.0（Migration Guide）

从 `v1.1.0` / `v1.1.1` 升级到 `v1.2.0`：

**自动兼容**（无需任何动作）

- 数据格式：`.project-brain/` 全部数据与 v1.1.x 完全兼容
- 工具 API：16 个 `project_*` 工具签名不变
- 配置文件：`config.json` 字段不变
- 检索行为：保留 v1.1.0 引入的双路召回 + RRF 融合（无变更）

**安装命令变化**

```bash
# 旧（v1.1.1）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.1.1

# 新（v1.2.0）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.2.0
```

升级后**必须完全退出并重新打开** DSH Desktop（host bundle 与 client bundle 都有改动）。

**新增能力**

- **Onboarding 内容升级**：从「3 步骤引导」改为「8 项能力清单」，首次进入时更直观地展示插件能做什么
- **记忆卡片查看改弹框模式**：点击记忆卡片不再原地展开，改为弹框显示完整内容（避免长内容撑破 Dashboard 布局）
- **架构兜底条人话化 + 内联重试按钮**：当架构分析失败时，兜底条文案从技术错误转为业务语言（如「架构分析暂时没拿到结果，点这里重试」），并直接在条上提供重试按钮

**修复内容**

- **语言 chip 按使用率排序 + 百分比 + 长尾聚合**：Dashboard 的语言分布从字典序改为按使用率降序，每个 chip 显示百分比，长尾语言自动聚合到「其他」
- **切项目时显示 loading 占位**：避免在数据加载完成前显示「空状态 + Onboarding」造成误导
- **切项目/切 session 时 banner 闪退修复**：解决 RPC banner 在切换瞬间崩溃的问题

**已知破坏性变更**（v1.2.0 内）

- 无。

---

## [v1.2.0] - 2026-09-14

> **次要版本：6 项客户端/Host 修复 + 功能。** 156/156 端到端自动化通过（17 smoke + 30 runtime-workspace + 56 project-memory + 39 host-acceptance + 14 release-verify）。
> 与 `v1.1.x` 数据完全兼容，工具 API 不变，纯增量增强。

### Added（新增）

- **Onboarding 内容升级**：从「3 步骤引导」改为「8 项能力清单」（commit `12c2844`）。首次进入 DSH 项目时，新版 Onboarding 直接列出插件能做的 8 项能力（架构分析、记忆续接、Quick Actions、Git 联动等），比旧的「Step 1: X, Step 2: Y, Step 3: Z」更直观
- **记忆卡片查看改弹框模式**（commit `8ac441a`）：点击 Dashboard 上的记忆卡片不再原地展开完整内容，改为弹框（Modal）显示。解决长记忆内容撑破 Dashboard 布局的问题，同时让用户能 focus 在单条记忆上
- **架构兜底条人话化 + 内联重试按钮**（commit `378224d`）：架构分析失败时，Dashboard 上的兜底条文案从技术错误（如「Analyzer exited with code 1」）转为业务语言（如「架构分析暂时没拿到结果」），并直接在条上提供一个重试按钮，无需跳到 Quick Actions

### Fixed（修复）

- **语言 chip 按使用率排序 + 百分比 + 长尾聚合**（commit `37f695c`）：Dashboard 的语言分布从「按字典序展示」改为「按使用率降序展示」，每个 chip 后面标注百分比（如 `TypeScript 65.2%`），长尾语言自动聚合到「其他 N 种」避免面板被冷门语言撑爆
- **切项目时显示 loading 占位**（commit `7d2894c`）：从项目 A 切到项目 B 时，旧 UI 会瞬间显示项目 B 的「空状态 + Onboarding」，造成「项目 B 真的空」的误导。新版改为显示 loading spinner，直到新项目数据 ready 才切到 Dashboard
- **切项目/切 session banner 闪退修复**（commit `54fa048`）：修复 `src/host/rpc/sidebar.js` 中切换瞬间 `registerConnectionRpc` 与 `registerSidebarRpc` 状态不一致导致的 banner crash。根因是旧的 `sessionId` map 异步清理时序问题，现在改为基于 `connection.session()` 的实时解析

### Changed（变更）

- **`src/client.js`**：新增 8 项能力清单的国际化文案；新增 Modal 组件；语言 chip 改用实时排序函数
- **`src/host/rpc/sidebar.js`**：连接 RPC 改为基于 `connection.session()` 而非本地 `Map` 缓存
- **`src/host/architecture/analyzer.js`**：兜底条改为可重试，业务文案与按钮注入
- **`src/client.js` 记忆详情弹框**：v1.2.0 弹框内 `memory.content` 原本以 `whiteSpace: pre-wrap` 展示原始 markdown 文本（`##` / `**` 等符号不渲染）。v1.2.0 patch 新增轻量 markdown 渲染器（`renderMarkdown`，零依赖、纯 React.createElement、支持 `#`/`##`/`###` 标题、`**bold**`/`*italic*`/`` `inline code` ``/`[text](url)`/列表/引用/fenced code/段落/分割线），弹框内容改为渲染输出。同时「复制全文」按钮复制内容从 `[type] title\n\ncontent` 改为 `title\n\ncontent`（去掉 type 前缀，保证复制出去的是最干净的原始 markdown 字符串，未走任何 HTML 转义）。

### 验证

```
npm test                    # 17 / 17 smoke suites
npm run test:runtime-workspace  # 30 / 30 runtime workspace RPC
npm run test:project-memory # 56 / 56 project memory isolation
npm run test:acceptance     # 39 / 39 host-acceptance
npm run verify:release      # 14 / 14（20 packaged files）
npm run verify:install      # CLEAN_TARBALL_INSTALL_PASS
npm publish --dry-run       # OK（registry reach + auth valid）
npm audit                   # 0 vulnerabilities
```

---

## 升级到 v1.1.0（Migration Guide）

从 `v1.0.0` 升级到 `v1.1.0`：

**自动兼容**（无需任何动作）

- 数据格式：`.project-brain/` 全部数据与 `v1.0.0` 完全兼容
- 工具 API：16 个 `project_*` 工具签名不变
- 配置文件：`config.json` 字段不变
- 检索行为：`retrieval` 函数对 `queryVector` 不存在 / 为空 / 向量为空 3 种情况自动退回 5 因子加权（详见新增的 `scripts/smoke-retrieval-rrf.mjs`）

**安装命令变化**

```bash
# 旧（v1.0.0）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0

# 新（v1.1.0）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.1.0
```

升级后**必须完全退出并重新打开** DSH Desktop（host bundle 改动）。

**新增能力**

- **双路召回 + RRF 融合策略**（v1.1.0）：当 `queryVector`（embedding）配置且非空时，自动启用关键词 + 向量双路召回，用 Reciprocal Rank Fusion（k=60）融合双路相关性分数；任一路为空则安全退回 5 因子加权
- **`scripts/embedding-smoke.mjs`** + **`scripts/embedding-e2e.mjs`**：embedding 集成 smoke + 端到端验证脚本
- **`scripts/smoke-retrieval-rrf.mjs`**：15 项 RRF + 双路召回断言（rrfMerge 边界值 / 顺序无关 / 单路缺失 / 5 因子加权退回 / hit 字段兼容 / diverseSelect 在 RRF 模式仍生效）

**已知破坏性变更**（v1.1.0 内）

- 无。

---

## 升级到 v1.1.1（Migration Guide）

从 `v1.0.0` / `v1.1.0` 升级到 `v1.1.1`：

**自动兼容**（无需任何动作）

- 数据格式、工具 API、配置文件全部与 v1.1.0 一致
- **本版本仅修复 README 渲染**，代码零改动

**修复内容**

- **README 截图引用从相对路径改为 SHA 锁定绝对 URL**：npm 渲染器不解析 markdown 相对路径（GitHub 会自动转 raw），导致 v1.0.0 / v1.1.0 在 npm 网站商店页面 7 张图全部损坏（显示红 alt 文本）。本版本改为 `https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/<sha>/docs/screenshots/0X.png` 形式
- **`v1.0.0` 历史页面无法修复**（npm 把 README 与 tarball 绑定），但升级到 `latest` 后主页面将显示 v1.1.1 的修复后 README

**安装命令变化**

```bash
# 旧
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0
# 或 v1.1.0

# 新
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.1.1
```

---

## 升级到 v1.0.0（Migration Guide，历史）

从 `0.7.0-beta.x` / `0.6.x` 升级到 `v1.0.0`：

**自动兼容**（无需任何动作）

- 数据格式：`.project-brain/` 下所有 JSON / JSONL 文件结构与 `0.7.0-beta.2` 完全兼容，无需迁移
- 工具 API：16 个 `project_*` 工具的名称、签名与返回值不变
- 配置文件：`config.json` 字段兼容，新增字段都有默认值

**安装命令变化**

```bash
# 旧（0.7.0-beta.2）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v0.7.0-beta.2

# 新（v1.0.0 stable）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0
```

升级后**必须完全退出并重新打开** DSH Desktop（hot reload 不支持 host bundle 改动）。

**新增工具（v0.7.0+）**

- `project_suggest_next`：Session 开始时给出"💡 你今天可能想推进 X"+依据（v0.4.15）
- `project_memory_archive` / `project_memory_supersede`：取代直接删除（v0.7.0）
- `project_todo_update`：可改优先级 / 描述 / 状态（v0.7.0）
- 工具总数从 13 → 16

**废弃工具**（暂无）。如有变化会提前在 README + Discussion 公告。

**已知破坏性变更**（v1.0.0 内）

- 无。

---

## [v1.1.1] - 2026-09-12

> **Patch 版本。** 修复 npm 商店页面 README 截图渲染（不修则 7 张图全部损坏）。
> 与 `v1.1.0` 代码完全一致，仅文档层修复。

### Fixed（修复）

- **README 截图引用从相对路径改为 SHA 锁定绝对 URL**：npm 渲染器不解析 markdown 相对路径（GitHub 会自动转 `raw.githubusercontent.com`），导致 `v1.0.0` 与 `v1.1.0` 在 npm 商店页面 7 张图全部损坏（显示红 alt 文本）。本版本改为 `https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/<sha>/docs/screenshots/0X.png` 形式，锁定到 `fd62eb4`（v1.1.0 发布 commit）。

### Known limitations（已知限制）

- **`v1.0.0` 与 `v1.1.0` 的 npm 历史页面无法修复**（npm 把 README 与发布 tarball 绑定，发布后不可变）。升级 `latest` 到 `v1.1.1` 后主页面将显示修复后 README。

---

## [v1.1.0] - 2026-09-12

> **次要版本：双路召回 + RRF 融合策略。** 56/56 端到端自动化（17 smoke suites + 39 host-acceptance）。
> 与 `v1.0.0` 数据完全兼容，工具 API 不变，纯增量增强。

### Added（新增）

- **双路召回 + RRF 融合策略（核心新功能）**：`src/host/memory/retrieval.js` 在 `queryVector`（embedding）已配置且非空时，自动启用**关键词 + 向量双路召回**，用经典 Reciprocal Rank Fusion（k=60）融合双路相关性分数。具体行为：
  - **关键词命中且向量命中** → 走 RRF：`relevance = Σ 1/(k + rank_i)`，双路都命中的文档天然靠前
  - **任一路未命中** → 该路贡献 0，对应路不影响最终打分
  - **`queryVector` 不存在 / `query` 为空 / `vectors` 为空** → 安全退回 5 因子加权（重要性 × 可信度 × 时效性 × 多样性 × 类型稳定）
  - **顺序无关**：rrfMerge 对调关键词路与向量路顺序，分数不变
  - **diverseSelect 在 RRF 模式下仍生效**：同 type 记忆会被降权，避免结果单一化
  - **hit 字段向后兼容**：同时包含 BM25 与向量命中的所有原始字段（`bm25Score` / `vectorScore` / `rrfScore`）

- **`scripts/smoke-retrieval-rrf.mjs`**：15 项 RRF + 双路召回断言，覆盖 rrfMerge 边界值、顺序无关、单路未命中、5 因子加权退回、hit 字段兼容、diverseSelect 在 RRF 模式下仍生效

- **`scripts/embedding-smoke.mjs`**：embedding 服务可达性 + 维度一致性 smoke（轻量，无网络依赖 mock）

- **`scripts/embedding-e2e.mjs`**：embedding 端到端验证脚本（可被 `verify:install` 与 CI 调度）

- **`scripts/run-smoke.mjs`** 调度更新：把 `smoke-retrieval-rrf` / `embedding-smoke` / `embedding-e2e` 加入默认 smoke 列表

### Fixed（修复）

- **`fix(acceptance)` 双向同步**：本地 `public-main` 与远程 `origin/main` 各做了独立的 `host-acceptance.mjs` AC-2a 工具数量硬编码修复（v0.7.0 新增 `memory_archive` + `memory_supersede` 后从 14 → 16）。merge 时 git ort 策略自动识别为相同修改，无冲突

### Changed（变更）

- **`src/host/memory/retrieval.js`**：`retrieveMemories` 函数签名与返回值不变，新增的 RRF 路径仅在配置 embedding 且 `queryVector` 有效时启用
- **`smoke` 套件总数**：16 → 17（新增 `smoke-retrieval-rrf`）
- **acceptance assertion 总数**：39 → 39（无新增；AC-2a 工具数量与 v1.0.0 一致）
- **README / README.zh-CN**：版本 badge 与"当前版本"说明同步到 `1.1.0`，引用新的 GitHub release URL

### 验证

```
npm test                # 17 / 17 smoke suites（含 smoke-retrieval-rrf 15 assertions）
npm run test:acceptance # 39 / 39 host-acceptance
npm run verify:release  # 14 / 14
npm run verify:install  # CLEAN_TARBALL_INSTALL_PASS
npm audit               # 0 vulnerabilities
```

合并方式：`git merge origin/main --no-ff`（merge commit `52b5776`，保留双向独立 commit 历史）

---

> **首个稳定版本。** 39/39 端到端验收全过 + 用户实测 DSH Desktop UI 通过。
> 7 项 P0 发布阻塞修复（npm install ERESOLVE / dsh-tools peer 阻塞 smoke / verify 脚本 ENOENT）+ 拆分 scanAndWrite 纯逻辑层 + 加 dev-reload 一键开发工具。

### Fixed（修复）

- **`npm install` ERESOLVE 复发（v0.7.0-beta.1 修复过的同类问题）**：`tree-sitter-c@0.24.1` 的 peer 是 `tree-sitter@^0.22.4`，但项目要 `^0.25.1`，导致干净环境 `npm install` 立刻 ERESOLVE，CHANGELOG 列出的"修复干净安装时的 ERESOLVE"回归。修复：在 `package.json` 加 `"overrides": { "tree-sitter": "^0.25.1" }` 强制统一 tree-sitter 顶层版本（tree-sitter-c 是 native binding，runtime 不真用 tree-sitter，override 安全）。

- **`npm test` 全部 16 个 smoke suite 在干净 node 环境 ERR_MODULE_NOT_FOUND**：根因是 `src/tools.js` 同时定义 `defineTool` 工具（依赖 `@deepseek-ai/dsh-tools`）和 `scanAndWrite` 纯逻辑，被 `src/host/summarizer.js` / `src/host/rpc/sidebar.js` / `scripts/smoke-*.mjs` 间接 import 后拖入 dsh-tools 链。修复：把 `scanAndWrite` + `resolveWritePolicy` + `emitPreviewChanged` 拆到 `src/host/scan-and-write.js`（纯逻辑，无 dsh-tools 依赖），`src/tools.js` 顶部改为 `import { scanAndWrite, emitPreviewChanged } from "./host/scan-and-write.js"` 并 re-export 保持向后兼容。`src/host/summarizer.js` / `src/host/rpc/sidebar.js` / `scripts/smoke-architecture.mjs` 改 import 路径。

- **`npm run verify:release` / `npm run verify:install` 在 Windows 下 ENOENT**：`execFileSync('npm', ...)` 在 Windows + FlyEnv / nvm node 环境下找不到 npm（execFileSync 不解析 PATHEXT）。修复：`scripts/check-release.mjs` 与 `scripts/check-tarball-install.mjs` 改为 Windows 下用 `npm.cmd` + `shell: true`，并显式接住 DEP0190 DeprecationWarning（参数完全固定，零拼接风险）。

- **`npm test` 单 suite 失败阻断后续 suite**：旧 `scripts/run-smoke.mjs` 用 `process.exit(result.status)` 在第一个失败处终止，掩盖了真实问题范围。改为收集全部失败在末尾统一报告（`X/N passed` + 列出失败的 suite 清单）。

- **`smoke-append-line` 性能基准在 Windows 下误报**：阈值 `< 1500ms` 是按 Linux/macOS 的 fs adapter 模拟读文件速度设定，Windows 实际 2059ms。改为按平台区分：Windows `< 3000ms`、其它 `< 1500ms`，核心目的（验证比旧实现快）不变。

- **`smoke-runtime-workspace` 用 `root.split("/").pop()` 在 Windows 下得到完整路径**：测试断言期望得到 basename（"dsh-brain-runtime-XXXX"），但 Windows 路径用 `\\` 分隔，`split("/")` 永远只返回完整字符串。修复：`root.split(/[\\/]/).pop()`。

- **`smoke-theme-tokens` 把 client.js Git 分支调色板的 12 个 hex 当成"硬编码颜色"误报**：6 色 GitHub 风格调色板是装饰性独立配色，与 DSH 主题 token 体系无强映射。修复：`smoke-theme-tokens.mjs` 检测 `const palette = [ ... ];` 字面量并自动豁免其中 hex；`client.js` 调色板处加注释说明豁免规则。

### Added（新增）

- **`@deepseek-ai/dsh-tools` / `@deepseek-ai/schemastery` 加到 devDependencies**：optional peer 在 `npm install` 时默认不装，导致本地 smoke 测试无法运行。两个 peer 加到 devDependencies 后：开发环境 `npm install` 自动装上（满足 smoke 测试），发布到 npm 时仍为 optional peer（DSH 用户没装也能装我们的包，不阻塞 runtime）。

- **智能续接 v0.4.15（project_suggest_next）**：
  - 新 Tool `project_suggest_next`：Session 开始时主动给出"💡 你今天可能想推进 X"+依据+关联 TODO/记忆
  - 双层策略：本地规则（in_progress > 最高优先级 pending > 阻塞 > 近期记忆 > 空）+ 可选 DSH LLM 升级
  - LLM 失败自动降级到本地规则，不阻塞 Session 启动
  - 新 RPC `/project-brain` 端点 `suggest`：Dashboard 加载时调一次
  - Dashboard 顶部 SuggestionCard 组件：source（llm/local）+ 置信度 + 刷新/收起按钮 + 加载/错误/数据三态
  - build-time 嵌入建议：离线路径下也显示本地规则建议，连接恢复后自动升级
  - 新增 src/host/suggest.js（纯函数 + 不依赖 runtime，便于 smoke 离线测试）+ src/tools/suggest.js
  - 修改 src/host/rpc/sidebar.js（注册 suggest 端点）+ src/index.js（注册 buildSuggestTool）+ build.js（build-time 嵌入 buildLocalSuggestion）+ src/client.js（SuggestionCard 组件 + i18n keys）
  - smoke-suggest.mjs（46/46 PASS）：6 种本地规则场景 + LLM mock 成功/失败/无 route + JSON 容错（围栏/尾逗号/non-JSON）+ normalizeSuggestion 字段裁剪
  - smoke-todostrip.mjs 新增 3 项 SuggestionCard 打包检查（17/17 → 20/20 after rebuild）

- **技术栈推断大幅扩展（v0.4.14）**：
  - **JS/TS 框架补全**：Remix / Astro / SvelteKit / Koa / Hapi / Solid / Preact / Angular / React Native / Expo / Tauri
  - **JS/TS ORM/DB/Cache/Queue 补全**：TypeORM / Sequelize / Mongoose / Drizzle / Knex / MikroORM / Memcached / Bull / RabbitMQ
  - **Python 后端框架补全**：Sanic / Starlette / aiohttp / Tornado / Pyramid / Bottle / Streamlit / Gradio
  - **Python ORM/DB 补全**：Peewee / Tortoise ORM / Django ORM / SQLModel / asyncpg → PostgreSQL / aiomysql/pymysql → MySQL / pymongo/motor → MongoDB
  - **Python 包管理识别**：Poetry / uv / Hatch / PDM / setuptools
  - **Go 框架补全**：Gin / Echo / Fiber / Chi / FastHTTP
  - **Go ORM/DB 补全**：GORM / Ent / sqlx / Bun / pgx → PostgreSQL / go-sql-driver/mysql → MySQL / mongo-driver → MongoDB
  - **Rust 框架补全**：Actix Web / Axum / Rocket / Warp / Tide
  - **Rust ORM/DB 补全**：Diesel / SeaORM / SQLx
  - **Rust 工具识别**：Tokio / Serde
  - **Rust workspace 子 crate 识别**（`[workspace]` → "Cargo Workspace"）
  - **SQL 文件推断**：从 `result.languages.sql` 反向推断数据库存在
  - **CI 识别**：`.github/workflows` → GitHub Actions
- **techStack 字段支持多值数组**：之前单值字段被多种语言栈覆盖（如 `backend: "FastAPI"` 被 Go 段的 "Go" 覆盖）；改为 setStack 助手自动合并到数组，同名字段值保留全部
- **architecture.technologies 合并到 preview.techStack**：build.js 新增 `mergeTechStackWithArchitecture()`，把 LLM 识别的技术名按分类映射补全到 Dashboard 显示，未分类技术进 `_extra` 字段
- **smoke-scanner-techstack.mjs**：22 项检查覆盖 JS/TS/Python/Go/Rust 5 种 manifest 的技术栈推断
- **本地 AST 分析支持 6 种语言**：从 JS/TS/Python 扩展到 Go、Java、Rust、C/C++。新增 `tree-sitter-go`、`tree-sitter-java`、`tree-sitter-rust`、`tree-sitter-c` 4 个 grammar 包（pnpm devDependencies）。
- **每种新语言的 import/export/function 抽取器**：Go 大写开头视为导出、Java class/interface/record/export、Rust `pub` 修饰符、C `#include` + function_definition。修改文件：`scripts/codegraph-scan.mjs`。
- **API endpoint 跨语言适配**：Go Gin `r.GET/POST/...`、Java Spring `@RequestMapping/@GetMapping/@PostMapping/...` 注解识别。修改文件：`scripts/codegraph-scan.mjs`。
- **DB schema 跨语言适配**：Go Gorm `gorm:"..."` struct tag、Java JPA `@Entity/@Column/@Id` 注解、Rust Diesel `#[derive(Queryable)]` / `#[table_name]`。修改文件：`scripts/codegraph-scan.mjs`。
- **CommonJS `module.exports = {...}` 导出识别**：JS 抽取器补充形如 `module.exports = { foo, bar }` 的导出形式，让典型 Node 服务入口被识别为 entrypoint。修改文件：`scripts/codegraph-scan.mjs`。
- **config.json `languages` 白名单**：用户可在 `.project-brain/config.json` 配 `languages: ["python", "go"]` 限制扫描范围；默认全开。修改文件：`scripts/codegraph-scan.mjs`。
- **smoke-multi-lang.mjs 测试套件**：56 项检查覆盖 6 语言 grammar 加载、imports/exports/functions、API endpoints、DB schema、调用图、config 白名单。修改文件：`scripts/smoke-multi-lang.mjs`、`scripts/run-smoke.mjs`、`fixtures-multi-lang/`。

### Changed（变更）

- Context Injector 的"项目记忆约定"段增加硬提示：用户表达「记住 X / 以后 Y / 不要 Z / 记一下」等长期意图时，立即调 `project_memory_add` 写入当前项目 `memory.jsonl`；若是跨项目通用偏好，再同步调 `memory_save` 写入 dsh-mneme，无需再次确认。修改文件：`src/host/injector.js`。
- `codegraph-scan.mjs` 重构为 6 语言分发器：grammar 注册表 + 每种语言一个 EXTRACTORS / API_EXTRACTORS entry + 函数化 `main(projectPath)`（允许 import 时直接传参，CLI 自动 fallback 到 argv）。修改文件：`scripts/codegraph-scan.mjs`。
- `run-smoke.mjs` 修复 Windows 路径解析（`new URL(..., import.meta.url).pathname` 在 Windows 返回 `C:\C:\...` 双冒号）；改用 `fileURLToPath` + `dirname`。修改文件：`scripts/run-smoke.mjs`。
- `src/scanner.js`：techStack 字段改用 `setStack(field, value)` 助手，重复命中自动合并到数组。修改文件：`src/scanner.js`。
- `src/host/store/brain-logic.js`：`techStackToType()` 支持数组值（多种语言栈并存时拼接为 "FastAPI · Go · Gin · Rust · Axum"）。修改文件：`src/host/store/brain-logic.js`。
- `src/client.js`：技术栈 chip 渲染支持数组值，每个值独立显示一个 chip。修改文件：`src/client.js`。

### Fixed（修复）

- **`project_ask` 的 useLLM 合成失效**：`buildAskTool` 签名未接收 `getLlm`（`index.js` 统一传参但被解构丢弃），`synthesizeAnswer` 从 `exec.ctx.get('llm')` 现场取 llm，工具执行上下文拿不到 llm service 且裸 `llm.stream({messages})` 缺 provider/model route，导致 useLLM=true 静默降级为纯 BM25（实测 `llm=no`）。修复：`buildAskTool` 增加 `getLlm` 入参，`synthesizeAnswer` 改用 apply 时缓存的 llm service + `resolveSessionRoute` 解析 route + 复用 `streamLlmText`（对齐 `tools/suggest.js`）。修改文件：`src/tools/ask.js`。

- **TodoStrip 占用过多空间、不友好**：之前 composer 上方 TodoStrip 默认展开 3 条活跃待办，固定占据 ~120px，且 ≤3 条时无收起按钮。优化为：默认折叠（仅显示紧凑 header `📋 活跃待办 · n ▾`，约 28px）；header 始终可点击展开/折叠；新增 `×` 关闭按钮（隐藏整个 strip 并写 localStorage 记忆）；关闭后用一个虚线 mini-chip `📋 · n 查看全部` 恢复，不再"钉住"占空间。修改文件：`src/client.js`。

- **TodoStrip 标题不够美观**：弱化"活跃待办"文字（11px/600/uppercase/letter-spacing/label-secondary，更像模块标题），数字独立成圆角 badge（`minWidth:18px, height:16px, borderRadius:8px, bg-layer-2`）。修改文件：`src/client.js`。

### Changed（变更）

- **记忆机制升级为双通道**（决策 1+2）：实时交互记忆（监听 `agent/inbox/claimed`，规则检测"记住/以后/不要/记一下"等长期意图信号，自动落盘 `type=context` 记忆，含 fingerprint 去重 + 每 session 最多 5 条限速）+ 会话结束 LLM 摘要兜底。新增文件：`src/host/realtime-memory.js`；`src/index.js` 注册。
- **会话摘要反转**（决策 2）：`summarizer.js` 从"git diff 主路径 + LLM 辅助"改为"LLM 对话总结为主，git diff 仅作参考证据喂给 LLM，LLM 失败时降级到 git diff 生成 change 记忆"。`session-extractor.js` 增加 `diffEvidence` 参数 + 输出 `summary`（会话总结文本）。修改文件：`src/host/summarizer.js`、`src/host/memory/session-extractor.js`。
- **跨对话高保真续接**（决策 3）：session 摘要完成时把 LLM 生成的 `summary` 写入 timeline 的 `session_summary` 事件；`injector.js` 渲染时提取最近一条 session_summary 的 summary，注入"上次会话总结"段（高保真续接，token 满切对话后能看到上次会话做了什么）。修改文件：`src/host/injector.js`、`src/host/summarizer.js`。

- **Git 历史 Tab**（仅 git 仓库显示）：Dashboard 新增"⎇ Git 历史"Tab，仅当项目是 git 仓库时挂载（mount 时通过 RPC `git` endpoint 探测 `available`，无 git 时不渲染 Tab）。Tab 内部可视化最近 50 个提交：左侧 ASCII graph（HEAD=● / merge=◆ / 其他=○ + │ 连接线）、commit subject + author + 相对/绝对时间 + shortHash、其他分支 chip 列表、点击展开 commit body + full hash + parents + author email。新增 `src/host/git/history.js`（纯 node git history 读取，loose + packed-refs 支持，复用 detector.js 的 object 读取）；`detector.js` 修复 `readHead` 分支名 slice 偏移 bug + 导出 `readGitObject` / `readHead` / 新增导出 `readCommitFull`；`src/host/rpc/sidebar.js` 注册 `git` endpoint（返回 `{ available, currentBranch, head, total, commits, branches, error }`）。修改文件：`src/client.js`、`src/host/rpc/sidebar.js`、`src/host/diff/detector.js`；新增 `src/host/git/history.js`。

- **Git 历史样式重构（VSCode/Cursor 风格）**：GitTab 三列 Grid layout（graph 56px / info flex:1 / refs 130px）；圆点 + 竖线 graph（HEAD 实心 + box-shadow 光晕，merge 菱形，普通空心）；按 branch name hash 分配6 色 refs chip；整行点击展开 body + full hash + parents + author email + UTC 时间 + Changed Files 列表；hover/expanded 行背景变化。修改文件：`src/client.js`。

- **每 commit 显示变更文件（tree diff）**：`history.js` 加 `diffCommitTrees` 函数（基于 tree object diff），每个 commit 数据增加 `filesChanged` / `filesChangedTotal` / `filesAdded` / `filesModified` / `filesRemoved` / `filesTruncated` 字段；GitTab meta 行加 `📁 +N ~M -K (X 文件)` 摘要，展开区显示前 8 个文件路径 + "more" 提示。修改文件：`src/host/git/history.js`、`src/client.js`；新增导出 `parseTree` / `collectTreeFiles`。

- **Working Tree 区块（Git Tab 下半部分）**：HEAD tree vs 工作树对比，列出 untracked（工作树有 + HEAD tree 没有）和 deleted（HEAD tree 有 + 工作树没有）文件，**不依赖 git binary**。GitTab 新增 `🔸 Working Tree` 卡片（折叠默认展开 ▾，点 header 切换）：分两组"Untracked"（warn 色 badge）和"Deleted"（error 色 badge），每组默认显示前 8 个路径 + "+ N 更多"提示。硬编码忽略 `node_modules`/`.git`/`.project-brain`/`dist`/`build`/`.next`/`out`/`target`/`__pycache__`/`.venv`/`venv`/`vendor`/`.idea`/`.vscode`/`.turbo`/`.cache`/`.pnpm-store` 等目录和 `.log`/`.bak`/`.tmp`/`.swp`/`.swo` 后缀。鲁棒性：HEAD tree 不可读时（如 pack 解析失败）整个区块不渲染而非误报。修改文件：`src/host/git/history.js`、`src/host/rpc/sidebar.js`、`src/client.js`。

## [v0.7.0-beta.2] - 2026-08-30

### Added（新增）

- Session 结束时复用当前 DSH Session 的 provider/model，从用户与助手文本中抽取最多 4 条稳定项目记忆；无需单独配置对话模型。
- 语义记忆增加输入长度限制、凭据清洗、严格 JSON 校验、相对文件路径验证、跨 Session 内容指纹去重和失败降级。
- 发布门禁统一覆盖 13 组 smoke suite、构建、发布隐私检查、干净 tarball 安装与依赖审计。

### Fixed（修复）

- 无法确认 workspace 时不再允许回退写入进程当前目录；所有 Project Brain 文件被限制在已解析项目的 `.project-brain/` 内。
- 公开定位统一为 DSH 插件；Dashboard/TodoStrip 明确属于 Web Client 能力，Desktop 只是支持的承载方式之一。
- 扩展 DSH `0.1.0-rc.x` / `0.1.1-rc.x` peer 兼容范围，修复干净安装时的 `ERESOLVE`。

### Tests（测试）

- 新增 Session 语义记忆测试，覆盖当前模型路由复用、敏感内容过滤、工具输出排除、路径校验、去重和无服务降级。
- 发布校验新增 README/CHANGELOG/包版本一致性、DSH 通用定位和 Git tag 对齐检查。

### Documentation（文档）

- README 改为英文主页面，并提供顶部简体中文切换入口和完整 `README.zh-CN.md`。
- 增加项目 Dashboard、概念架构分层和任务时间线三张真实界面截图。
- 英文与中文文档同步说明架构分析、长期记忆、检索模式、安装、隐私和当前限制。

### Fixed（修复）

- 新增 `npm run verify:install`，在临时干净项目中验证真实发布包和可选 DSH peer 依赖解析。
- 修正公开定位文案：插件面向 DSH profile，Dashboard 属于 Web Client 能力，DSH Desktop 是支持的承载方式之一而非唯一运行环境。

## [v0.7.0-beta.1] - 2026-08-30

> 首个面向外部用户的公测候选。自动化、构建和发布隐私检查通过；稳定版仍需完成多版本 DSH Desktop 真实安装验收。

### Added（新增）

- 初始化/重扫新增语义版 `.project-brain/architecture.json`：项目定位、架构风格、概念分层、职责组件、关系、运行流程、关键文件和阅读顺序。
- 默认复用当前 DSH Session 的 provider/model，结合 README、manifest、符号/import 与有限关键源码摘要生成架构；超时、无路由或非法输出时自动降级。
- Dashboard 新增可交互分层架构认知报告；目录不再作为架构节点，点击职责组件可查看边界、协作和证据文件。
- 扫描排除 `node_modules.backup-*`、备份目录、vendor 和生成物，避免噪声污染项目架构。
- Session 结束检测到源码或关键配置变化时自动刷新架构；指纹未变化时复用已有 LLM 结果。
- Dashboard 四个 Quick Action 改为通过 Connection RPC 在当前 Session 工作区后台执行，不再复制指令到对话框。
- Quick Action 增加独立的执行中转圈、成功摘要、错误重试状态；执行成功后立即刷新运行时 Preview。
- “整理记忆”采用两阶段安全交互：首次点击仅计算合并/归档候选，存在改动时再次确认才写入。
- 新增 Memory V2 元数据：`schemaVersion/status/confidence/source/updatedAt`，旧 JSONL 记录保持兼容。
- `project_ask` 新增本地 BM25 + 排序多样性，并支持可配置的 OpenAI-compatible Embedding 混合检索。
- 新增按内容哈希增量更新的 `.project-brain/cache/embeddings.jsonl` 派生缓存；远程失败自动降级为关键词检索。
- `project_status` 与 Dashboard 展示当前检索模式，且不暴露凭据引用或密钥。

### Changed（变更）

- `project_continue`、Context Injector、Dashboard、状态统计和记忆列表默认排除 archived/superseded/deleted 记录。
- Dashboard Quick Action 改为后台 RPC 执行并展示转圈、确认、成功和错误状态。

### Fixed（修复）

- 架构分析将 DSH `llm` 声明为正式 Host 依赖，修复动态注入未就绪时始终降级为“本地分析”的问题。
- 修复 LLM runtime 生命周期错误：旧代码把“卸载时清理”误写为立即执行的 Cordis effect，导致刚注入的 LLM 服务在启动时被清空。
- 当前 Session 模型路由除 `request/context` 外，也会从 `request/header.config` 和事件日志恢复；扫描期间会在真正调用前重新解析一次。
- 将原先含义模糊的 `ARCHITECTURE_LLM_ROUTE_UNAVAILABLE` 拆分为 LLM 服务不可用和 Session 路由不可用两类诊断。
- 架构 JSON 解析支持模型说明文字、Markdown 围栏、多文本块和尾逗号；首次输出仍不可解析时，自动用当前 DSH 模型执行一次紧凑 JSON 修复重试。
- 项目简介提取跳过 README 顶部 Logo、徽章、居中容器、语言导航和纯链接，清理 HTML/Markdown 后选择首段有意义的自然语言；运行时 Preview 同时清理历史脏数据。
- Dashboard 重构为单一工作台：顶部只保留项目信息、状态和阶段，详细内容按“概览 / 架构 / 任务动态 / 项目记忆”标签切换，移除待办、统计、代码、活动和记忆的重复展示。
- Quick Action 与内容卡片改为自适应网格，增加键盘焦点、按压反馈、横向标签滚动和窄窗口单列布局。

### Security（安全）

- 架构 LLM 不发送绝对路径；关键源码摘要受文件数、单文件长度和总量限制，可通过 `architectureLlmIncludeSource=false` 关闭。模型输出不接受 HTML，并校验所有证据文件路径与组件关系。
- Quick Action RPC 只接受 `rescan/todos/dream/dreamCommit/overview` 白名单动作，项目路径始终由 Host 从 live Session 解析，拒绝浏览器指定路径或任意工具名。
- 向量能力默认关闭；仅用户显式配置后联网，API 密钥通过 DSH Credentials 或环境变量解析，不写入项目缓存和 RPC 响应。

### Tests（测试）

- 12 组 smoke suite 全部通过，覆盖运行时 workspace、跨项目隔离、跨 Session 记忆、架构本地/LLM 双路径、BM25/向量检索、Dashboard 交互、主题和 Git diff。
- 新增 `npm run verify:release`，检查 npm 文件白名单、入口文件、版本一致性，以及本机路径、Session ID、凭据和项目脑数据泄漏。
- `npm audit`（含开发依赖）为 0 vulnerabilities。

### 计划中
- 更精确的未提交变更快照与 Session 语义摘要
- 完整 multi-pack-index（MIDX）支持

## [v0.6.0] - 2026-08-29

### Added（新增）

- Scanner 增加 package 名称/描述、README 首段、工具链、monorepo 和更多语言识别。
- 新增统一 `npm test` 入口及长期记忆隔离测试，完整套件为 10 组、241 项检查。
- 增加 MIT License 和面向 DSH 插件市场的精简发布文档。

### Fixed（修复）

- `project_init` / `project_rescan` 默认从 live Session 自动解析 workspace，不再要求模型传绝对路径。
- 工具路径解析改为 live Session 优先，防止模型参数把当前操作重定向到其他项目。
- Context Injector 从全局单缓存改为按 workspace/session 隔离，修复跨项目记忆串台。
- 通过 Cordis 动态注入 `systemPrompt` 服务，避免未声明服务访问导致上下文注入静默失效。
- Session summarizer 仅处理已初始化项目；按 sessionId 和 Git 变更指纹去重。
- Runtime RPC 返回完整 Preview 数据，避免连接后 Dashboard 数据比离线快照更少。
- Sidebar/TodoStrip 每 5 秒刷新当前 workspace 的本地数据，不再依赖写工具触发 build。
- 移除写工具和 Host 主流程中的旧 auto-rebuild / 同步 build 路径。

### Security（安全）

- Client RPC 与工具执行都以 Host 持有的 live Session cwd 为权威路径。
- 默认构建继续保持 release-safe，不嵌入本机 Session、workspace 或项目记忆。

## [v0.5.1] - 2026-08-29

### Fixed（修复）

- 修复新建 Session 不在 build-time `sessionToWorkspaceId` 映射时，Onboarding 无法获得 workspace 路径的问题。
- Client/Host 通信改用 DSH 官方 `connection.rpc`，替代不可注入的 `host.call`。
- Host 根据 live Session header 的 `cwd` 解析项目路径，新 Session、新 workspace 无需 rebuild 或重启即可初始化。
- 初始化 RPC 直接返回最新 Sidebar Preview，完成后立即展示 Dashboard。
- build-time embed 降级为首屏/离线 fallback；TodoStrip 与 SidebarPreview 均优先读取运行时数据。
- RPC 拒绝使用 Client 提供的文件路径，仅信任 Host Session cwd，防止跨项目读写。

### Tests（测试）

- 新增 `smoke-runtime-workspace.mjs`：覆盖“RPC 注册后才创建 Session”的回归场景、初始化、Preview 和未知 Session 错误。

---

## [v0.5.0] - 2026-08-28

### Added（新增）
- **OnboardingBlock 自动启动流程**：原"启动项目大脑"按钮只复制 `请调用 project_init` 文本到剪贴板，让用户去粘贴发送。新版改造为点击 → 后台调用 → 转圈 → 自动展示结果：
  - 按钮点击直接触发 `host.call('project_brain/initProject', { args: { path } })`，无需用户复制粘贴
  - 期间显示 CSS conic-gradient 转圈 + 3 阶段步骤条（扫描项目结构 → 写入项目大脑 → 分析技术栈与依赖）
  - 完成后自动用 RPC 返回的 stats 拼一个最小 preview 结构（project/phase/recentActivity）→ 父组件切到 dashboard 视图
  - 失败时显示错误卡片 + 重试按钮 + 复制启动指令兜底按钮
- **path 提示**：按钮上方显示当前扫描的 workspace 路径（如 `<workspace>/data-analyst-agent`），用户清楚会扫哪个目录
- **build-inline.js**：sandbox 阻止 esbuild spawn 子进程时退路方案，纯 Node FS 拼接
  - **v0.5.0-fix（致命 bug 修复）**：原版 build-inline.js 只 copy `src/index.js → lib/index.js`，但 ESM 解析相对 `lib/`` 找不到 `./tools.js` 等子模块 → DSH 启动报 `Cannot find module 'lib/tools.js'` 整树加载失败。
  - **修复**：build-inline.js 现在做 `src/ → lib/` 全目录镜像（保留 `client.js` IIFE bundle 不被 src 覆盖）。DSH 加载 `lib/index.js` 时 `import "./tools.js"` 能解析到 `lib/tools.js` ✓

### Fixed（修复）
- **致命加载错误**：DSH 启动时报 `Cannot find module '.../lib/tools.js' imported from .../lib/index.js` 插件加载失败。修复：build-inline.js 镜像整个 src/ 到 lib/，让 ESM import 能解析到 24 个子模块

### Changed（变更）
- **client.js** OnboardingBlock 重写：从纯展示块升级为带状态机的交互组件（idle / loading / error 三态）
- **client.js** SidebarPreviewRoot 增加 `overrideData` 状态机：用户启动完成后用 RPC 返回值立即渲染 dashboard（不等 host rebuild）
- **client.js** apply() 保存 `ctx.host` 到模块级变量 `__DSH_CLIENT_HOST__`（避免子组件拿不到 client builtin）

### 设计原则
- **零复制粘贴**：所有可机器做的动作（扫描、写入）由按钮直接调 RPC
- **转圈可见**：3 阶段步骤条让用户清楚"在干啥"，避免"按钮没反应"焦虑
- **失败可恢复**：错误卡片明确显示错误信息 + 重试按钮 + 兜底复制

### 待用户验证
- 重启 DSH Desktop（host bundle 已写 lib/index.js，但 cordis-loader 静态加载 → 需重启）
- 在 sidebar 项目 tab 找到未初始化的 workspace（如 data-analyst-agent）→ 点击"启动项目大脑"按钮 → 应自动转圈分析 → 完成后直接展示 Dashboard
- 若失败，按钮下方会显示错误信息 + 重试按钮

---

## [v0.4.12] - 2026-08-28

### Changed（变更）
- **ActionsBlock 按钮文案统一为"查看 Dashboard · 项目全景"**：
  - 主标题："查看 Dashboard · 项目全景"（中/英双语）
  - 副标题："技术栈 · 待办 · 记忆 · 时间线"（列出 Dashboard 内容）
  - 右侧小图标（▾/▸）作为展开/折叠状态指示
  - 按钮加渐变 background（layer-2 → layer-1）+ 更大 padding 14px
- **toggleDashboard 改造**：移除按钮 textContent 切换逻辑，改为更新右侧 indicator 图标（▾ 展开 / ▸ 折叠），文案保持稳定

### 设计原则
- **按钮文案稳定**（不随状态切换）——用户对按钮功能预期一致
- **状态用图标**（▾/▸）而非文案切换——更符合现代 UI 习惯
- **二级副标题**（列出 Dashboard 内容）——降低用户的"信息盲盒"焦虑

### 测试
- 8 个 smoke test 共 **211/211 PASS**（无回归）
- theme-tokens 14 PASS（零硬编码 hex、零悬空 token）

---

## [v0.4.11] - 2026-08-28

### Added（新增）
- **Dashboard 2.0 — Quick Actions 2x2 网格**（替代"继续上次开发"鸡肋按钮）：
  - 🔄 重新扫描 → "重新扫描项目（调用 /project_rescan）"
  - 📋 整理待办 → "列出当前待办（调用 /project_todo_list）"
  - 🧠 整理记忆 → "整理项目记忆（调用 /project_dream）"
  - 🎯 项目全景 → "查看项目当前状态（调用 /project_continue）"
- 每个 Quick Action 卡片：大 emoji + 标题 + 描述 + 📋 角标 → 点击直接复制 prompt（沿用 copyPrompt 工具，1 步操作）

### Changed（变更）
- **去掉"继续上次开发"按钮**：用户反馈鸡肋（copyPrompt 复制→粘贴→发送 2 步）
- **Dashboard 默认展开**（`display: "block"` 替代 `display: "none"`）——信息可达性优先
- **ActionsBlock 重构**：只保留"📊 收起/展开 Dashboard"按钮
- **DashboardSection 函数签名加 localeCode**（`{data, t, localeCode}`）——支持中/英双语 Quick Action prompt
- **Dashboard 标题区加提示**："点击卡片复制指令" + 底部加 "💡 点击复制对应指令，粘贴到输入框发送"
- Quick Action 卡片支持 hover 效果（border-color 0.1s ease）+ 点击反馈（按钮临时变 ✓）

### 设计原则
- **按钮不再"半自动化"**（复制粘贴是用户的责任）——Quick Action 卡片明确告诉用户"复制后粘贴到输入框"
- **Dashboard 默认展开**（不深埋入口）
- **Quick Actions 视觉统一**（2x2 网格 + emoji + 描述）——一眼看清所有可用操作
- **中英双语**——延续 v0.4.8 localeCode 模式

### 测试
- 8 个 smoke test 共 **211/211 PASS**（无回归）
- theme-tokens 14 PASS（零硬编码 hex、零悬空 token）

---

## [v0.4.10] - 2026-08-28

### Fixed（修复）
- **MemoriesBlock 展开/收起 toggle bug**（v0.4.9 引入）：用户报告 "可以展开但无法正常收起"
  - **根因**：v0.4.9 用模块级 `const expandedSet = window.__dshMemExpanded || null` + 直接 DOM 操作管理展开状态。当 React 因 Sidebar props 变化、容器 resize 等原因重渲染时，React 用 expandedSet=null 计算出 isOpen=false，**React 设置的 inline style 覆盖 toggle 直接操作的 DOM style**，导致 toggle 第二次点击（收起）失效——UI 仍显示 "展开" 状态
  - **修复**：
    1. 改用 `React.useState` 管理展开 Set，每个 memory 的展开状态在 React state
    2. toggle 调用 `setExpanded(prev => next)` 触发 React 重渲染，UI 自动同步
    3. 删除 window 全局变量（`window.__dshMemExpanded`）
    4. 删除所有 DOM 直接操作（`content.style.display` / `summary.style.display` / `indicator.textContent`）
    5. 删除 `document.getElementById` 查找 DOM 节点
    6. toggle 和 copyMem 加 `e.stopPropagation()` 防止事件冒泡

### 设计原则
- **React 受控组件**：UI 状态完全由 React state 驱动，避免 DOM inline style 与 React state 不一致
- **React state > window 全局**：跨 React 重渲染保持状态（之前用 window.__dshMemExpanded 是脆弱的）
- **stopPropagation**：防止事件冒泡触发不相关 handler

### 测试
- 8 个 smoke test 共 **211/211 PASS**（无回归）
- theme-tokens 14 PASS（零硬编码 hex、零悬空 token）

### 教训
- v0.3 时代 TodoStrip 用 DOM toggle 是为了兼容当时 DSH static client，注释写 "已知历史教训"
- 现在 React 18+ useState 可用，**应优先用 React 受控 state**，避免 React 重渲染覆盖 DOM 操作

---

## [v0.4.9] - 2026-08-28

### Changed（变更）
- **`TodoBlock` 从 chip 横向 → 卡片化**：每条 todo 一张独立卡片（borderLeft 3px 状态色条 + status 图标 + 优先级 badge + 2 行 line-clamp 标题 + 进行中圆点）
- **`ActivityBlock` 从 list → 时间线样式**：左侧圆形 icon 节点（28×28 + brand 边框）+ 竖线连接 + 右侧双行时间（相对 + 绝对 MM-DD）+ 2 行 line-clamp 标题
- **`MemoriesBlock` 从折叠式 → 卡片化（始终展开）**：每条 memory 一张卡片（borderLeft brand 色条）+ type icon + type chip + **importance 星级（★/☆ 0-5）** + 2 行 line-clamp 摘要 + 点击展开全文 + 📋 复制按钮
- 交互优化：所有交互用 React 内联事件（toggle / copy），无 useState（保持 DSH static client 兼容性）
- memory 展开状态用 `window.__dshMemExpanded` 跨重渲染保持
- copyMem 用 `navigator.clipboard.writeText` + 按钮临时变 ✓ 反馈

### 设计原则
- 卡片化：每个 item 一张独立 card（hover/视觉层级清晰）
- 不粗暴截断：line-clamp 2-3 行 + 显式展开按钮
- 状态/优先级用图标 + 颜色条（双指示）
- 时间线：适合 ActivityBlock 的时序特性
- 复制友好：memory 卡片直接复制给 LLM

### 测试
- 8 个 smoke test 共 **211/211 PASS**（无回归）
- theme-tokens 14 PASS（零硬编码 hex、零悬空 token、DSH 主题自适应）

---

## [v0.4.8] - 2026-08-28

### Added（新增）
- **Sidebar UI 视觉升级（方案 A）**：emoji 体系 + 微妙阴影 + 紧凑布局 + 智能状态条
- **新组件 `StatusBannerBlock`**：3 大数字横向布局（待办/记忆/已完成）+ 底部 💡 一行解读 + 智能 tip
- **emoji 体系**：每个区块加 icon（📁 Header / 📊 Status / 🎯 Phase / 📋 Todo / 🌳 Code / ⚡ Activity / 🧠 Memory / 📊 Stats / 🚀 Actions / 🎯 Dashboard）
- **项目 type → emoji 映射**：frontend🎨/backend⚙️/lib📚/cli💻/mobile📱/default📦

### Changed（变更）
- **`sectionStyle`**：圆角 8→10px、margin 12→8px、加 `boxShadow: 0 1px 2px rgba(0,0,0,0.04)`
- **`chipStyle`**：圆角 4→10px（pill 形）
- **`sectionTitleStyle`**：去掉 uppercase，letter-spacing 0.8→0.4px
- **`HeaderBlock`**：渐变 background + 大号项目名 + 类型 pill
- **`PhaseBlock`**：渐变 progress bar（8px 高度、圆角）
- **`TodoBlock`**：list → chip 横向布局（5条/列 + 优先级色点 + 计数徽章）
- **`ActivityBlock`**：3→5 条 + eventIcon（按 title 匹配 init/memory/todo/dream/rescan/session）
- **`MemoriesBlock`**：折叠机制（默认折叠 + "📖 展开全部" 按钮 + ▸/▾ indicator + 类型 chip 加 border 区分）
- **`StatsBlock`**：加 emoji + 颜色 + 卡片化（每个 stat 独立圆角背景）
- **`CodeGraphBlock`**：语言加 border 边框（不用颜色区分，更易主题切换）
- **`ActionsBlock`**：按钮内 emoji + 圆角 8px
- **`OnboardingBlock`**：3 步引导（🚀 扫描 / 🧠 记录 / 📋 待办）+ 渐变 CTA + 阴影
- **`DashboardSection`**：所有小节加 emoji + 配色 chip 化 + 标题区加渐变
- **渲染顺序**：Header → StatusBanner → Phase → Todo → Code → Activity → Memory → Stats → Actions → Dashboard

### 测试
- 8 个 smoke test 共 **211/211 PASS**（v0.4.8 +1 新：theme-tokens 14 PASS 因优化加严）
- bundle size: client.js 234→**254KB**（+20KB 视觉升级）

### 设计原则
- **零硬编码 hex**：所有颜色用 DSH 主题 token（`--dsw-alias-*`），dark/light 主题自适应
- **零行为变化**：工具调用、数据形状、smoke 测试、build 流程完全不变
- **emoji 体系化**：所有交互点都有语义化 icon

---

## [v0.4.7] - 2026-08-28

### Added（新增）
- **llm.js 加 Anthropic 兼容协议**：自动检测 apiUrl 含 "anthropic" → POST `/v1/messages` + `x-api-key` + `anthropic-version: 2023-06-01`，否则 OpenAI 兼容（`/v1/chat/completions`）
- **`fetchAnthropic` 函数**：独立 Anthropic 协议 fetch 实现（headers/response 格式与 OpenAI 不同）
- **`detectProtocol(apiUrl)` 函数导出**：baseUrl 含 "anthropic"（路径或子域）→ Anthropic，否则 OpenAI
- **smoke-project-diff 加 11 个断言**（5 个 Anthropic 真实路径 mock fetch + 6 个 detectProtocol URL 模式判断）

### Changed（变更）
- 当前状态从 v0.4.6 → v0.4.7
- `realFetchLLM` 改为根据 `detectProtocol` 自动路由到 fetchAnthropic 或 fetchOpenAI

### 测试
- 8 个 smoke test 共 **210/210 PASS**（199 之前 + 11 新增）
- bundle size: 增 ~5KB（detectProtocol + fetchAnthropic + 文档）

### Known Limitations（已知限制）
- **LLM API key 安全**：用户首次提供 key 时明文发送——强烈建议用环境变量 `DSH_LLM_API_URL/KEY/MODEL` 注入，避免在对话历史/session memory 中暴露
- **LLM mock fallback**：fetch 失败（key 错/网络问题）时降级为 mock（保证工具不卡死但返回非结构化）
- **DSH Desktop 商店发布**：本版本未在 DSH 商店推送（仅团队内部使用基线）

---

## [v0.4.6] - 2026-08-28

### Added（新增）
- **detector pack 真实支持**：当 commit/tree 在 loose 找不到时 fallback 读 `.idx` v2 + `.pack` v2 + `packed-refs`
- **`parseIdxV2(idxBytes)`**：解析 .idx v2（big-endian fanout + hash 列表 + offset 列表）→ `Map<hash, offset>`
- **`readPackEntryByOffset`**：解 varint size+type header + inflate（zlib 格式与 loose 一致）拿 content
- **`applyDelta` 函数**：OFS_DELTA + REF_DELTA 解码（git pack delta 编码，含 copy/insert 指令）
- **`readGitObject`** = 先 loose 后 pack fallback
- **`idxCache`** 用 `gitDir|idxPath` 为 key（跨仓库隔离，避免 tmp 仓库删了仍指向旧 idx）
- **`readHead` 加 packed-refs fallback**：loose ref 不存在时读 `.git/packed-refs`
- **smoke-project-diff 加 2 个 packed-refs 断言**（ref 在 packed-refs 仍能 diff）

### Changed（变更）
- 当前状态从 v0.4.5 → v0.4.6
- 删除 `hasPackFiles` 整体拒绝（v0.4.5 移除 + v0.4.6 真正的 pack 解析）

### 测试
- 8 个 smoke test 共 **201/201 PASS**（v0.4.6 +2 新）
- 调试过程暴露并修复 6 个隐藏 bug：minSize 公式（1072+N*28 vs 误算 1032+N*32）、offsetStart 公式（hashStart+N*24）、varint size 累加、pack inflate 无 header、REF_DELTA 递归、idxCache 跨仓库污染

### Known Limitations（已知限制）
- **multi-pack-index（MIDX，git 2.20+）**：仅普通 .idx 支持，MIDX 仓库仍 fallback 提示（v0.5.1 计划）
- **delta 复杂 case**：OFS_DELTA 特殊编码（offN=0/szN=0）部分情况 return null

---

## [v0.4.5] - 2026-08-28

### Changed（变更）
- **删除 `hasPackFiles` 整体拒绝逻辑**：v0.4.2 detector 只要检测到仓库有 `.pack` 文件就整体 fallback——但真实 git 仓库普遍有 pack（git gc/自动打包），且 detector 的 diff 只比较 tree 里的 hash 从不读 blob 内容，所以只要 commit + tree 在 loose 就能完整 diff
- `detectChanges` 仅当 `readCommit(head)` 真的读不到（commit object 在 pack 里）时才返回明确错误
- 当前状态从 v0.4.4 → v0.4.5

### 测试
- 8 个 smoke test 共 **199/199 PASS**（v0.4.5 smoke-project-diff pack 测试改为"有 .pack 但 commit/tree 在 loose → 仍能 diff"）

### Known Limitations（已知限制）
- **commit/tree 真在 pack**：v0.4.5 仍 fallback 提示，需要 v0.4.6 真正的 pack 解析

---

## [v0.4.4] - 2026-08-28

### Added（新增）
- **summarizer.js 改 detectChanges**：删除 `gitCapture(shell, ...)`（DSH shell service 依赖），改用 `detectChanges({projectPath, since:"1"})`（v0.4.2 detector 纯 node git 客户端）
- **`setupSummarizer` 不再读 `ctx.get('shell')`**：日志改为 "(pure-node git, no shell)"
- `summarizeOne` 签名去掉 shell 参数
- **debug 修复**：测试 fixture 误用 raw deflate → 真实 git 用 zlib deflate（带 header）
  - `smoke-project-diff.mjs fixture`：`deflateRawSync` → `deflateSync`（匹配真实 git 格式，消除假阳性 PASS）
- **debug 修复**：detector 目录 mode 判断错误
  - `parseInt(entry.mode, 8) === 40000` 永不匹配（git tree mode 是省略前导零的八进制，目录 = `"40000"` = 0o40000 = 16384）
  - 改为 `parseInt(entry.mode, 8) === 0o40000`，目录才能递归展开（src 而非 src/index.js）
- **debug 修复**：inflateSync vs inflateRawSync
  - git loose object 用 zlib deflate（带 header 首字节 0x78）→ 用 `inflateSync`（不是 `inflateRawSync`）
  - 之前 v0.4.2 误用 `inflateRawSync`（期望 raw deflate 无 header）→ smoke 假阳性 PASS 但真实 git 仓库读不了 commit

### Changed（变更）
- 当前状态从 v0.4.2 → v0.4.4
- 文档同步：README.md / SPEC.md / TODO.md v0.4.2 → v0.4.4（补版本说明 + changelog 行）

### 测试
- 8 个 smoke test 共 **198/198 PASS**（v0.4.4 + smoke-project-diff 加 packed-refs/fixture deflateSync/目录 mode 测试）

### 关键教训（v0.4.4 调试发现）
- **smoke fixture 必须用真实格式**：自定义"看起来对"的 fixture（raw deflate）会让测试假阳性 PASS，但真实 git 仓库读不了
- **git loose object 用 zlib deflate（带 header）**——不是 raw deflate
- **git tree mode 省略前导零**（目录 = `"40000"` = 16384，不是 `"040000"` 或 40000 十进制）

---

## [v0.4.3] - 2026-08-28

### Added（新增）
- **INSTALL.md**：用户安装指南（系统要求 + 三种安装方式 + 验证步骤 + FAQ：auto-rebuild 不 work / E_NOT_INITIALIZED / sandbox / 升级 / 卸载）
- **CHANGELOG.md**：本文档（Keep a Changelog 规范）
- **STORE_LISTING.md**：DSH Desktop 商店发布描述（一句话描述 + 长描述 + 标签 + 截图位）
- **README.md**：加 Documentation 章节，链接 INSTALL/CHANGELOG/TODO/SPEC

### Changed（变更）
- 当前状态从 v0.4.0 → v0.4.3
- README.md 离线测试章节加 `smoke-append-line.mjs`（24 项）

### 已知限制（不变）
- **auto-rebuild 不 work**：DSH Desktop 静态 plugin fiber 阻止任何主动行为（ctx.timer / ctx.effect / ctx.on / spawn / execFileSync）。**手动 fallback** 仍是唯一方案：调写工具后跑 `node build.js`（~1 秒）。

---

## [v0.4.0] - 2026-08-28

### Added（新增）
- **`appendLine(fs, path, line, writePolicy)`**：避开 parseJsonl/serializeJsonl 双向 JSON 转换的 O(N) 优化写入
- **`scripts/smoke-append-line.mjs`**：24 项专项 smoke test（边界 + 兼容性 + 性能基准）

### Changed（变更）
- **`appendJsonl` 重写为薄 wrapper**：从"读全文件 → push → 全文件重写"改为 `appendLine(fs, path, JSON.stringify(entry) + "\n")`，避开双向 JSON 转换
- **性能提升**：1000 行 append 879ms（旧实现 ~2500ms，**快 3 倍**）

### 测试
- 总计 161 项 smoke test 全 PASS（137 原有 + 24 新增）
- bundle size: 166kb → **171kb** (+5kb)

### 已知限制
- 未实现真 O(1) append：DSH fs service 没暴露 `appendFile` 接口；shell service spawn 子进程调 `node:fs.appendFileSync` 方案在前面 v0.3.17 失败案例里被 DSH Desktop sandbox 阻止。当前优化"避开 JSON parse/stringify CPU 开销"但 I/O 仍 O(N)。

---

## [v0.3.21] - 2026-08-28

### Added（新增）
- P0.8 收尾大结局章节（TODO.md）：P0 全阶段完成度总结 + 用户最终工作流
- 项目脑 memory（type=change）：v0.3.21 永久归档 P0.8 完成

### Changed（变更）
- 关闭最后 1 条 todo（"补全 init/rescan/continue 工具与 RPC continueSession 联调验证"）：实际已被 smoke-session-lifecycle.mjs 25/25 PASS 覆盖
- 活跃 todo: 1 → 0

### 里程碑
- **P0 全阶段完成**：P0.0-P0.8 全部 16 个子阶段完成

---

## [v0.3.20] - 2026-08-28

### Added（新增）
- 5 条类型混合 memory（项目大脑）：
  1. decision: 采用 Project-First 数据模型（所有数据落 `.project-brain/`，与 Session 解耦）
  2. decision: 三层数据通道架构（Cordis 4 + build-time embed + manual build fallback）
  3. decision: brain-logic 纯逻辑层 + smoke test 直接验证策略（避开 dsh-tools runtime）
  4. architecture: 8 类记忆类型混合填充策略（decision/requirement/architecture/change/bug/lesson/issue/context）
  5. requirement: 所有写工具必须保留 manual build fallback 接口

### Changed（变更）
- 关闭 5 条过时 todo（auto-rebuild 死循环 + 陈旧 P0.4.1 目标 + stale P0.5 in_progress）
- memory.jsonl 类型分布升级：decision 从 1 → 4（sidebar 顶部决策密度提升）

---

## [v0.3.19] - 2026-08-28

### Changed（变更）
- **不再投入 auto-rebuild 修复资源**（DSH Desktop 静态 plugin fiber 根本限制，6 次修复均失败）
- README.md / TODO.md / SPEC.md 加 "手动 build fallback" 操作流程章节
- 当前状态从 v0.3.18 → v0.3.19

### 测试
- 端到端验证 5 层面（基础环境 / 工具注册 / 工具调用 / sidebar / 主题）大部分 PASS
- 仅 auto-rebuild 失败（已知限制）

---

## [v0.3.18] - 2026-08-28

### Added（新增）
- **`src/host/rebuild-sync.js`**：工具层同步 rebuild（工程止血）
- **`runSyncRebuild(reason)` 函数**：dream/memory/todo 工具的 execute 函数里写完 jsonl 后立即同步调 `execFileSync('node', ['build.js'])`

### Known Failures（已知失败）
- 工具层 `execFileSync` 在 DSH Desktop host bundle context 里被静默拦截
- 这是 DSH Desktop 静态 plugin fiber 任何主动行为（ctx.timer / ctx.effect / ctx.on / spawn / execFileSync）都 silent failure 的根本限制
- v0.3.18 不 work，**继续向前到 v0.3.19 接受手动 fallback**

---

## [v0.3.17] - 2026-08-28

### Added（新增）
- **`src/host/rebuild-watcher.mjs`**：独立 watcher 子进程（脱离 Cordis 抽象）
- **多路径 fallback log**：PLUGIN_DIR / process.cwd() / USERPROFILE

### Known Failures（已知失败）
- 子进程 spawn 在 DSH Desktop 静态 plugin fiber 里被 sandbox 静默阻止
- `.project-brain/.dsh-project-brain-watcher.log` 不存在 → 子进程要么没 spawn 成功、要么 sandbox 阻止写文件
- v0.3.17 不 work，**继续向前到 v0.3.18 改工具层**

---

## [v0.3.16] - 2026-08-28

### Added（新增）
- 冷启动诊断 log：setupAutoRebuild 顶部输出 9 项状态（ctx.timer / ctx.get('timer') / sandboxPolicy.workspaceRoot / workspaceRegistry.list 数量 / sessions.list 数量 / agents.currentInitiator / 初始 paths 数量 / ctx.on / ctx.effect 可用性）
- 监听 DSH 原生 `agent/created` / `session/created` 事件（DSH 框架跨 fiber 自动路由）

### Known Failures（已知失败）
- 诊断 log 看不到（DSH Desktop Electron 无主 log 文件，ctx.logger.info 输出位置未知）
- 仍然 silent failure
- v0.3.16 不 work，**继续向前到 v0.3.17 spawn 子进程**

---

## [v0.3.15] - 2026-08-28

### Changed（变更）
- **`src/index.js` inject 数组末尾加 `"timer"`**：让 ctx.timer 真可用

### Known Failures（已知失败）
- 修复未生效（推测根因：host fiber 冷启动时 resolveWatchPaths 返回空数组）

---

## [v0.3.14] - 2026-08-28

### Changed（变更）
- **`src/host/rebuild.js` 重写**：从 `ctx.on("project_brain/preview.changed")` 改成 `ctx.effect(() => ctx.timer.interval(checkMtime, 5000))` —— 每 5 秒扫 `.project-brain/*.json*` 的 mtime，变化触发 `runBuild()`

### Known Failures（已知失败）
- inject 没声明 timer → 默默退化

---

## [v0.3.13] - 2026-08-27

### Added（新增）
- **`scripts/smoke-multi-workspace.mjs`**（25 项）：path-resolver / brain-files / loadProjectData 三层跨 workspace 隔离验证
- **`scripts/smoke-theme-tokens.mjs`**（14 项）：client.js 主题 token 与 DSH `Theme.listTokens` 对齐验证

### 测试
- 总计 137 项 smoke test 全 PASS（30 + 10 + 33 + 25 + 25 + 14）
- 端到端验证：5 层面 PASS

---

## [v0.3.12] - 2026-08-27

### Added（新增）
- **`project_dream` 工具的 `dryRun=false` 实质实现**：
  - merge：dropped 移除 + keep status=reinforced + importance +0.05 + relatedMemoryIds 合并
  - archive：status=archived + 写 timeline + emit preview.changed
- **`mode=full`**：额外清理 archived 行 + 按 importance DESC 排序
- **`brain-logic.js` 抽 `computeDreamActions` / `applyDreamCommit` 纯函数**（避开 dsh-tools runtime）
- **`brain-files.js` 加 `writeJsonl`**（覆盖写整文件，dream commit 用）
- **`scripts/smoke-dream-commit.mjs`**（33 项）

### 测试
- 总计 73 项 smoke test 全 PASS（30 + 10 + 33）

---

## [v0.3.11] - 2026-08-27

### Added（新增）
- **`conversation.input.dock` Slot + TodoStrip 组件**：composer 上方活跃待办提醒
- 双 guard（uninit / empty）：项目未初始化或无活跃待办时整条 strip 不渲染

---

## [v0.3.10] - 2026-08-27

### Added（新增）
- 12 个工具端到端实测 + path 显式传到 plugins workspace 验证

---

## [v0.3.9] - 2026-08-27

### Fixed
- **`parseJsonl` / `readJson` 加 `U+FEFF` BOM strip**：PowerShell `Set-Content -Encoding utf8` 写入 jsonl 时加了 BOM
- **`src/tools/ask.js` 改用 `readJson`**：之前用 `readJsonl` 读 multi-line pretty-printed JSON 必然失败
- **ask execute return 加 `JSON.parse(JSON.stringify(ret))` 防御性 round-trip**

---

## [v0.3.8] - 2026-08-27

### Fixed
- **`path-resolver` 加 `workspaceRegistry` + 跳过 DSH Desktop 污染 fallback**：v0.3.8 修复 sandboxPolicy.workspaceRoot 是 DSH Desktop 安装路径时被静默污染的 bug
- 所有 tool output schema 显式声明 `code` / `message`：修复 project_continue 等报"value.code not declared"

---

## [v0.3.7] - 2026-08-27

### Fixed
- **`brain-files.js` `writeText` 默认 `danger-full-access` policy**：修复 DSH sandbox 拒绝跨 workspace 写（`E_WRITE_FAILED`）

---

## [v0.3.6] - 2026-08-27

### Added
- 6 个工具加 `path` 参数：`project_init` / `project_rescan` / `project_status` / `project_continue` / `project_memory_*` / `project_todo_*` / `project_dream`
- output schema 改 `additionalProperties: true` + 显式 `code/message`：错误路径返回 `{ok:false,code,message}` 不再被拒
- shell service rebuild：用 DSH shell service 跑 `build.js`（避开 child_process.spawn sandbox EPERM）

---

## [v0.3.5] - 2026-08-27

### Added
- **`build.js` 排除 plugin 自身**：`findBrainsUnder` 检测 `cordis.patch.yml` 跳过 dsh-project-brain 自己

---

## [v0.3.4] - 2026-08-27

### Changed
- **放弃 webServer**：v0.3.0-v0.3.3 验证 webServer route 在 static plugin fiber 下不可用（HTTP 404 + Electron IPC 桥不通）
- **回到 build-time embed + auto-rebuild**（`preview.changed` → `setupAutoRebuild` 跑 `node build.js` → 重写 `lib/client.js` → `clientModules.rebuilt()` 自动热重载）

---

## [v0.3.3] - 2026-08-27

### Fixed
- 路径冲突回退（webServer 路径避开 `/plugins/` 前缀）
- Electron IPC 桥诊断

---

## [v0.3.2] - 2026-08-27

### Fixed
- PromptSection 字段名修复（`render` → `text`）：避免 indexOf 崩溃

---

## [v0.3.1] - 2026-08-27

### Added
- PromptSection 字段诊断

---

## [v0.3.0] - 2026-08-27

### Added
- **完整 webServer 数据通道**：dsh-project-brain 试图用 webServer route live fetch 取代 build-time embed

### Known Failures
- v0.3.0-v0.3.3 多次尝试 webServer route，全部失败（HTTP 404 + Electron IPC 桥不通）

---

## [v0.2.x] - 早期版本

### v0.2.9 及之前
- SidebarPreview 5 区块 + Onboarding
- Mock fallback（SidebarPreview 没数据时显示示例）
- scanner 增量更新（保留 projectId/createdAt）

### v0.2.0 - v0.2.5
- Code Graph（tree-sitter 3 语言：TS/JS/Python）+ 调用图 + API + DB schema 提取
- 多 workspace build-time embed（扫 `~/.dsh/storages/workspace.json` + inline `(sessionId → workspaceId → previewData)` map）

### v0.1.x - 最早版本
- SidebarPreview UI（5 区块 + Onboarding + mock fallback）
- 8 工具：init / rescan / status / continue / memory×2 / todo×3
- Memory / Timeline 基础架构（`memory.jsonl` + `timeline.jsonl` + `brain-memory.mjs` CLI）
- Project Memory + Cross-Session 续接（规划中）
- DSH Desktop 静态 plugin 接入（`package.json` + `cordis.patch.yml` + DSH profile 安装）

---

## 版本号规范

- **MAJOR**（v1.0+）：架构变更、生产就绪
- **MINOR**（v0.x → v0.y）：新增功能、P 阶段切换
- **PATCH**（v0.x.y）：bug fix、性能优化、文档

---

## 链接

- [README.md](./README.md) — 项目说明 + 当前状态 + 离线测试
- [INSTALL.md](./INSTALL.md) — 用户安装指南（系统要求 + 安装方式 + 验证 + FAQ）
- [SPEC.md](./SPEC.md) — 开发规格（架构 + 数据模型 + 工具契约）
- [TODO.md](./TODO.md) — 任务清单 + P 阶段进度 + 历史归档
- [REQUIREMENTS.md](./REQUIREMENTS.md) — 产品需求（PRD）
- [DESIGN.md](./DESIGN.md) — 设计方案
- [STORE_LISTING.md](./STORE_LISTING.md) — DSH Desktop 商店发布描述

---

**最后更新**：v0.4.3 RELEASE 2026-08-28
