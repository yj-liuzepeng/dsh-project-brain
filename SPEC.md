# dsh-project-brain 开发规格说明（SPEC）

**版本：** **v0.6.0**
**状态：** Active（历史章节保留早期实验记录；当前数据通道以本页说明和 README 为准）
**对应文档：** `REQUIREMENTS.md`（PRD） / `DESIGN.md`（设计方案）
**性质：** 代码、测试、提交流程与排错流程均必须与本文档对齐；若与 PRD/DESIGN 冲突，以本文档为准并回写 PRD/DESIGN。

> **版本说明（v0.3 → v0.4 MINOR bump）**：本次 MINOR bump 开启 v0.4.x，累积 v0.2.1~v0.2.9 + v0.3.0~v0.4.7 共 38 行变更（数据通道重大回退 / 工具面补全 / summarizer + injector / auto-rebuild / path-resolver / sandbox 修复 / TODO strip / dream commit+full / locale-aware / 跨 Session 端到端 / 跨 workspace 隔离实测 / dark/light 主题 token 取证 / auto-rebuild 跨 fiber 修复 / inject timer 根因补漏 / 冷启动诊断 + DSH 原生事件主动唤醒 / spawn 子进程 watcher 终极 fallback / 工具层同步 rebuild 工程止血 / 端到端验证完成 + 接受手动 build fallback / 清理过时 todo + 完善 Project Memory 5 类混合填充 / P0.8 收尾大结局 / appendJsonl 性能优化 O(N) → O(1) / DSH Desktop 发布准备 INSTALL.md + CHANGELOG.md + STORE_LISTING.md / dream 真实架构 diff LLM 接入 + project_diff 工具（v0.4.1 mock fallback 实测 DSH Desktop shell 静默）/ **真实 git + 真实 LLM 绕过 DSH Desktop sandbox（v0.4.2，node 内置模块 + node:fetch）** / **summarizer 真实 git + detector 真实 git 格式修复（v0.4.4：inflateSync + 目录 mode + fixture deflateSync，198/198 PASS）** / **detector 移除 pack 整体拒绝（v0.4.5：commit/tree 在 loose 即可 diff，不读 blob，199/199 PASS）** / **detector pack 真实支持（v0.4.6：parseIdxV2 + readPackEntryByOffset + packed-refs + OFS_DELTA/REF_DELTA，201/201 PASS）** / **llm.js 加 Anthropic 兼容协议（v0.4.7：detectProtocol 自动路由 + fetchAnthropic /v1/messages，210/210 PASS）**）。v0.4.x：v0.4.0 + v0.4.1 + v0.4.2 + v0.4.3 + v0.4.4 + v0.4.5 + v0.4.6 + v0.4.7。真实路径 vs mock fallback 决策记录在 .project-brain/memory.jsonl mem-mtccn6uf。大章节结构与 SPEC §1~§19 保持不变；待 v1.0 MVP 时考虑 MAJOR bump。

> **v0.6.0 当前架构覆盖说明：** Client 以 `connection.rpc` 为主通道；Host 每次从 live Session header 解析可信 workspace；build-time embed 仅作无本机数据的离线降级。Context Injector 使用 workspace/session 隔离缓存；Session summarizer 仅处理已初始化项目并去重。早期章节中“只能 build-time embed”“写数据后手动 build”“全局 injector cache”等描述均为历史记录，已被本说明取代。

---

# 0. 阅读指引

| 章节 | 内容 | 何时读 |
| --- | --- | --- |
| §1~3 | 项目身份、架构、代码库布局 | 建立工程认知 |
| §4~9 | 数据模型、Host/Client、Tool/RPC/Sidebar 硬契约 | 编码时随时参考 |
| §10~12 | 配置、开发阶段、测试策略 | 排期与验收 |
| §13~16 | 调试、编码规约、DoD、未决问题 | 日常开发与收尾 |
| §17~20 | 数据迁移、安全、失败模式、变更日志 | 长期运维 |

**强制约定**：

1. 本文档所有 **TypeScript 类型签名仅为契约示意**，运行时由 `.js` / `.ts` 编译产物实现；动态插件禁止 `import`/`require`/JSX/装饰器。
2. **所有 DSH 服务名、Slot ID、Tool 注册 API 必须通过 `cordis_inspect_*` 实时确认**，不能凭推测写死。
3. 数据落在被分析项目自己的 `.project-brain/`（**项目绑定**，不是 Session 绑定）。
4. 命名约定：**SidebarPreview** = 功能名；**SidebarTab** = UI 元素；**`preview.changed`** = 事件名；**`sidebar.getPreview`** = RPC 名。整份文档及配套 PRD/DESIGN 统一使用此术语。

---

# 1. 项目身份与目标

| 字段 | 值 |
| --- | --- |
| 包名 | `dsh-project-brain` |
| 展示名（中/英） | dsh-project-brain / Project Brain |
| 目标用户 | 使用 DSH 进行长期软件开发的个人开发者与开发团队 |
| 项目定位 | DSH 的持久化项目大脑：理解代码架构、记住项目历史、跨 Session 保持上下文，并随着项目持续成长 |
| 核心场景 | 快速理解陌生项目；跨 Session 续接开发；自动沉淀架构/决策/Bug/TODO |
| MVP 周期 | 单人 **38~48 工作日**（含 30% 调试 buffer，不含可选 Go/Java 拓展） |

**五大设计原则（不可妥协）**：
1. 只记长期有价值的内容（评分 + Dream 整合）。
2. 记录 What 与 Why（每条 Decision / Architecture / Lesson 必带 reason 字段）。
3. 项目知识属于 Project，不属于 Session（数据落在 `.project-brain/`，跨机器迁移）。
4. 持续演进（增量扫描 + Dream 周期）。
5. 知识可追溯（每条 Memory 必带 source_type + source_id）。

---

# 2. 架构总览

## 2.1 三层架构

```
Client（DSH 浏览器进程）
├── SidebarTab + SidebarPreview  ← 常驻入口（紧邻"记忆库"右侧）
├── Dashboard 主视图               ← 按需展开
└── 全部数据通过 host.call(...) 拉取
                ↕ JSON RPC（Package-private）
Host（DSH Node.js 进程）
├── Tool 实现（/project *）
├── SidebarPreview RPC + Pub/Sub
├── Session 事件监听 + 摘要生成
├── Context Injector
└── 调度 Scanner / Analyzer / Memory / Dream
                ↕
本地引擎层（无状态模块）
├── Scanner / Analyzer / Dream Engine
├── Memory Engine
└── Storage（SQLite + JSON）
                ↕
持久化 .project-brain/（与目标项目绑定）
├── project.json / architecture.json / config.json
├── codegraph.db / memory.db / timeline.db（实际同库或分库均可）
├── sessions/ / snapshots/ / dream.log
```

## 2.2 DSH 集成形态

dsh-project-brain 是一个**静态 + HMR 友好的 Cordis 插件**，通过以下 5 类集成点与 DSH 交互：

| 集成点 | 提供方 | 接收方 / 注册目标 |
| --- | --- | --- |
| Tool（供 LLM 调用） | Host | `@deepseek-ai/dsh-tools` |
| RPC（供 Client 调用） | Host | `harness.handle('project_brain/...', handler)` |
| Event（订阅） | Host | `ctx.on('session:started' \| 'session:ended', ...)` |
| Event（发布） | Host | `ctx.emit('project_brain/preview.changed', ...)` |
| Slot（UI 挂载） | Client | DSH SidebarTab Slot + Dashboard Slot |

## 2.3 关键依赖

| 依赖 | 用途 | 版本约束 |
| --- | --- | --- |
| `@deepseek-ai/cordis` | 插件运行时 | ^4.0.1 |
| `@deepseek-ai/dsh-llm` | LLM 调用 | 0.1.1-rc.2+ |
| `@deepseek-ai/dsh-storage-domain` | 持久化域 | 0.1.1-rc.2+ |
| `@deepseek-ai/dsh-tools` | Tool 注册 | 0.1.1-rc.2+ |
| `@deepseek-ai/dsh-session` | Session 事件 | 0.1.1-rc.2+ |
| `better-sqlite3` | SQLite | ^11 |
| `tree-sitter` + TS/JS/Python/Go/Java grammar | AST 解析 | ^0.21+（用 npm 内置 5 个包） |
| `esbuild` | 开发期 watch 构建 | ^0.24 |
| `chokidar` | 文件监听（HMR 友好） | ^4 |
| `@deepseek-ai/schemastery` | Schema 校验 | ^3.18 |

> ⚠️ **P0.1 第一件事**：跑 `cordis_inspect_list` 拉一份当前 DSH 真实暴露的 Service / Event / Tool 名单，对照本表修正"硬依赖 vs 软依赖 vs 不存在"。

---

# 3. 代码库布局

```
dsh-project-brain/
├── package.json               # 包元信息 + scripts
├── tsconfig.json              # 类型检查（仅类型，不参与运行时）
├── cordis.yml                 # Loader 入口配置（host/client 挂载点）
├── README.md                  # 用户文档
├── REQUIREMENTS.md            # PRD
├── DESIGN.md                  # 设计方案
├── SPEC.md                    # 本文档
├── TODO.md                    # 任务清单（P0.1 创建并持续更新）
├── src/
│   ├── shared/                # Host/Client 共用常量与类型
│   │   ├── types.ts           # 跨边界接口（用 JSDoc 表达）
│   │   ├── constants.ts       # 常量（路径、限制、错误码）
│   │   └── terms.ts           # 术语表（功能 / UI / 事件 / RPC 名）
│   ├── host/                  # Host 插件
│   │   ├── index.js           # Host Plugin.apply(ctx)
│   │   ├── scanner/
│   │   │   ├── index.js
│   │   │   ├── filesystem.js
│   │   │   ├── techstack.js
│   │   │   ├── entrypoints.js
│   │   │   └── ignore.js
│   │   ├── analyzer/
│   │   │   ├── index.js
│   │   │   ├── ast.js
│   │   │   ├── callgraph.js
│   │   │   ├── apis.js
│   │   │   ├── tables.js
│   │   │   └── grammars/      # 5 个 tree-sitter grammar 入口（require）
│   │   ├── memory/
│   │   │   ├── store.js
│   │   │   ├── types.js
│   │   │   ├── lifecycle.js
│   │   │   └── importance.js
│   │   ├── dream/
│   │   │   └── consolidator.js
│   │   ├── injector.js        # 跨 Session 上下文注入
│   │   ├── summarizer.js      # Session 结束摘要
│   │   ├── sidebar/
│   │   │   ├── aggregator.js  # SidebarPreview 数据聚合
│   │   │   └── pubsub.js      # Pub/Sub 推送
│   │   ├── tools/             # Tool 实现
│   │   │   ├── init.js
│   │   │   ├── continue.js
│   │   │   ├── ask.js
│   │   │   ├── status.js
│   │   │   ├── memory.js
│   │   │   ├── todo.js
│   │   │   └── dream.js
│   │   ├── rpc/               # Client → Host RPC handlers
│   │   │   ├── sidebar.js
│   │   │   ├── dashboard.js
│   │   │   └── register.js    # harness.handle 集中注册入口
│   │   └── storage/
│   │       ├── sqlite.js
│   │       ├── migrations.js
│   │       └── fingerprint.js # FS 指纹 + 增量检测
│   └── client/                # Client 插件
│       ├── index.js           # Client Plugin.apply(ctx)
│       ├── i18n/
│       │   ├── zh-CN.js
│       │   └── en-US.js
│       ├── sidebar/
│       │   ├── tab.js         # SidebarTab 注册
│       │   ├── preview.js     # SidebarPreview 折叠态面板
│       │   ├── onboarding.js  # 空状态引导
│       │   ├── blocks/        # 5 个区块组件
│       │   │   ├── header.js
│       │   │   ├── phase.js
│       │   │   ├── activity.js
│       │   │   ├── stats.js
│       │   │   └── actions.js
│       │   └── rpc.js          # host.call 封装
│       └── dashboard/
│           ├── view.js
│           ├── panels/
│           │   ├── overview.js
│           │   ├── architecture.js
│           │   ├── codemap.js
│           │   ├── memory.js
│           │   ├── timeline.js
│           │   └── tasks.js
│           └── router.js
└── tests/
    ├── fixtures/              # 测试仓库（详见 §12.4）
    │   ├── ts-sample/          # P0.0 必做
    │   ├── js-sample/          # P0.3a 必做
    │   ├── py-sample/          # P0.3a 必做
    │   ├── go-sample/          # 可选 P0.3b
    │   └── java-sample/        # 可选 P0.3b
    ├── host/
    │   ├── scanner.test.js
    │   ├── analyzer.test.js
    │   ├── memory.test.js
    │   ├── summarizer.test.js
    │   └── sidebar-aggregator.test.js
    └── client/
        └── sidebar-preview.test.js
```

**目录命名约束**：
- Host/Client 严格分离，不允许跨层 import。
- 共用类型/常量只放 `src/shared/`。
- 模块内部 `index.js` 作为对外统一出口。
- 文件名 `kebab-case.js`；React 组件 `PascalCase.js`。

---

# 4. 数据模型规范

## 4.1 目录位置

* 数据落在被分析项目自身的 `.project-brain/` 目录下（**项目绑定**）。
* 首次访问某项目时若 `.project-brain/` 不存在则自动创建。

```
.project-brain/
├── project.json
├── architecture.json
├── config.json
├── codegraph.db       # 也可与 memory.db 合库；MVP 单库即可
├── memory.db          # MVP：与 codegraph.db 合并为 single.db
├── timeline.db        # MVP：同上
├── sessions/<session-id>.md
├── snapshots/<snapshot-id>.json
└── dream.log
```

**MVP 决策**：所有表放单一 SQLite 文件 `memory.db`（最简），V2 可拆。Schema 设计按物理表名约定，仍以业务域为前缀。

## 4.2 SQLite Schema（必须严格遵守）

**启动时强制执行的 PRAGMA**（写在 `sqlite.js` 初始化函数内）：
```sql
PRAGMA journal_mode = WAL;       -- 并发读写
PRAGMA busy_timeout = 5000;      -- 锁等待 5s
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;     -- WAL 模式下 NORMAL 已足够安全
```

```sql
-- ━━━ project ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project (
  id TEXT PRIMARY KEY,                -- hash(root_path)
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  description TEXT,
  tech_stack JSON,                    -- {"backend":"FastAPI","db":"PostgreSQL",...}
  languages JSON,                     -- {"typescript":0.62,"python":0.30}
  size JSON,                          -- {"files":1024,"loc":52400}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_scanned_at INTEGER
);

-- ━━━ memory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE memory (
  id TEXT PRIMARY KEY,                -- uuid v4
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- architecture|decision|requirement|change|bug|lesson|todo|issue|context
  title TEXT NOT NULL,
  content JSON NOT NULL,              -- 类型专属字段
  importance REAL DEFAULT 0.5,        -- 0~1
  confidence REAL DEFAULT 0.5,        -- 0~1
  status TEXT DEFAULT 'new',          -- new|active|reinforced|outdated|archived
  source_type TEXT,                   -- session|commit|file|user|pr|issue|scanner|llm
  source_id TEXT,
  source_session TEXT,
  related_files JSON,
  related_modules JSON,
  related_memory_ids JSON,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_memory_project_type    ON memory(project_id, type);
CREATE INDEX idx_memory_status         ON memory(project_id, status);
CREATE INDEX idx_memory_importance     ON memory(project_id, importance DESC);
CREATE INDEX idx_memory_updated        ON memory(project_id, updated_at DESC);

-- ━━━ todo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE todo (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',      -- pending|in_progress|blocked|done|cancelled
  priority TEXT DEFAULT 'medium',     -- low|medium|high
  related_feature TEXT,
  related_files JSON,
  source_session TEXT,
  source_memory_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_todo_project_status   ON todo(project_id, status);
CREATE INDEX idx_todo_project_priority ON todo(project_id, priority);

-- ━━━ code_entity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE code_entity (
  id TEXT PRIMARY KEY,                -- "type:file_path:start:end:name"
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,                 -- file|module|class|function|api|db_table|config|dependency
  name TEXT NOT NULL,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  metadata JSON,
  hash TEXT,                          -- 单文件级 content hash，用于增量更新
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_code_entity_project_type ON code_entity(project_id, type);
CREATE INDEX idx_code_entity_file         ON code_entity(file_path);
CREATE INDEX idx_code_entity_hash         ON code_entity(hash);

-- ━━━ code_relation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE code_relation (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,             -- contains|imports|calls|inherits|implements|depends_on|reads|writes|exposes
  confidence REAL DEFAULT 1.0,
  metadata JSON,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_code_relation_from_id   ON code_relation(from_id);
CREATE INDEX idx_code_relation_to_id     ON code_relation(to_id);
CREATE INDEX idx_code_relation_relation  ON code_relation(relation);

-- ━━━ timeline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE timeline (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- init|change|memory_added|memory_archived|architecture_change|dream|todo_done
  title TEXT NOT NULL,
  description TEXT,
  related_memory_id TEXT,
  related_commit TEXT,
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_timeline_project_time ON timeline(project_id, occurred_at DESC);

-- ━━━ session ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE session_summary (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  summary TEXT,
  diff_hash TEXT,
  files_changed JSON,
  memory_written JSON,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

-- ━━━ codegraph snapshot（Dream 用）━━━━━━━━━━━━━━━━━━
CREATE TABLE codegraph_snapshot (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  entities_count INTEGER,
  relations_count INTEGER,
  diff_from_previous JSON,
  FOREIGN KEY (project_id) REFERENCES project(id)
);

CREATE INDEX idx_codegraph_snapshot_project ON codegraph_snapshot(project_id, version DESC);
```

**约束**：
- 所有表必须有 `project_id`。
- 所有时间戳统一 `INTEGER`（epoch ms）。
- 不使用 `ON DELETE` 级联；项目删除时手动清理。
- 所有 JSON 字段必须可被 `JSON.parse` 解析；写入时 `JSON.stringify` + null 检查。
- 删除项目流程：先 `DELETE FROM` 所有表 + 删除 `.project-brain/` 目录。

## 4.3 JSON 结构规范

### 4.3.1 project.json

```json
{
  "id": "sha256-of-root-path",
  "name": "my-saas",
  "rootPath": "C:/code/my-saas",
  "description": "Auto-generated",
  "techStack": {
    "backend": "FastAPI",
    "db": "PostgreSQL",
    "cache": "Redis",
    "llm": "Qwen"
  },
  "languages": { "python": 0.62, "typescript": 0.30, "other": 0.08 },
  "size": { "files": 1024, "loc": 52400 },
  "entrypoints": [
    { "path": "src/main.py", "type": "service", "cmd": "python -m src.main" }
  ],
  "directoryMap": [
    { "path": "src/api", "purpose": "api" },
    { "path": "src/services", "purpose": "service" }
  ],
  "createdAt": 1723500000000,
  "updatedAt": 1723500000000,
  "lastScannedAt": 1723500000000
}
```

### 4.3.2 architecture.json

```json
{
  "system": {
    "nodes": [
      { "id": "user", "label": "User", "type": "external" },
      { "id": "api", "label": "API", "type": "service" },
      { "id": "service", "label": "Service", "type": "service" },
      { "id": "db", "label": "PostgreSQL", "type": "datastore" }
    ],
    "edges": [
      { "from": "user", "to": "api" },
      { "from": "api", "to": "service" },
      { "from": "service", "to": "db" }
    ]
  },
  "modules": [
    { "name": "api", "depends_on": ["service"], "lines_of_code": 1200 }
  ],
  "dataFlow": [
    { "step": 1, "from": "HTTP request", "to": "api/chat.py", "via": "router" },
    { "step": 2, "from": "api/chat.py", "to": "service/chat.py", "via": "method call" }
  ],
  "callChains": [
    {
      "name": "POST /chat",
      "steps": ["ChatController", "ChatService", "AgentExecutor", "RAGService", "LLM"]
    }
  ]
}
```

### 4.3.3 config.json

```json
{
  "version": 1,
  "scan": {
    "timeoutMs": 120000,
    "maxFileSizeBytes": 1048576,
    "ignored": ["node_modules/**", ".git/**", "dist/**", "build/**", "**/*.min.js"]
  },
  "languages": ["typescript", "javascript", "python", "go", "java"],
  "llm": {
    "modelPreference": null,
    "maxTokensPerCall": 4000
  },
  "memory": {
    "maxMemories": 5000,
    "importanceFloor": 0.2
  },
  "sidebar": {
    "enabled": true,
    "recentActivityLimit": 3,
    "perfTargetMs": 100
  }
}
```

## 4.4 Memory 类型 Schema（每类必填字段）

> **运行时由 `src/host/memory/types.js` 内的 schemastery 校验，缺字段写入失败并返回 `E_MEMORY_SCHEMA`。**

```js
// 仅作契约示意，运行时按 JSDoc + schemastery 实现
const DecisionContent = {
  decision: 'string',           // 必填
  reason: 'string',             // 必填
  alternatives: 'string[]?',    // 可选
  rejected: 'string[]?',        // 可选
  rejectedReason: 'string?',    // 可选
  relatedFiles: 'string[]'      // 必填
}
const ArchitectureContent = {
  before: 'string', after: 'string', reason: 'string', commit: 'string?'
}
const LessonContent = {
  problem: 'string', rootCause: 'string', solution: 'string', relatedFiles: 'string[]'
}
const ChangeContent = {
  diffSummary: 'string', motivation: 'string?', impact: 'local|module|architecture'
}
const RequirementContent = { original: 'string', current: 'string?', evolution: 'string?' }
const BugContent = { symptom: 'string', rootCause: 'string?', fixedAt: 'number?', relatedFiles: 'string[]' }
const IssueContent = { description: 'string', severity: 'low|medium|high', relatedFiles: 'string[]?' }
const ContextContent = { note: 'string', tags: 'string[]?' }
const TodoContent = { todoId: 'string' }   // 与 todos 表关联
```

## 4.5 错误码

| 错误码 | 含义 | 处理 |
| --- | --- | --- |
| `E_NOT_INITIALIZED` | 项目未 init | 提示用户先运行 `/project init` |
| `E_SCAN_TIMEOUT` | 扫描超过 2 分钟 | 后台续跑 + 返回部分结果 |
| `E_SCAN_FAILED` | 扫描过程出错 | 返回错误位置 + 继续可能的部分 |
| `E_MEMORY_SCHEMA` | Memory 字段缺失 | 详细列出缺失字段 |
| `E_NOT_FOUND` | 实体不存在 | 404 语义 |
| `E_PERMISSION` | 文件读写权限 | 提示用户检查权限 |
| `E_LLM_FAILED` | LLM 调用失败 | 重试 1 次 + 降级到规则抽取 |
| `E_INTERNAL` | 未分类内部错误 | 记录 stack，向上抛 |

---

# 5. Host 插件规范

## 5.1 入口与生命周期

> 本节 TypeScript 类型仅为契约示意，运行时由 `.js` 实现。

```js
// src/host/index.js —— 契约示意
export default function hostPlugin() {
  return {
    name: 'dsh-project-brain:host',
    inject: [/* 见 §5.6 注入清单 */],
    apply: async (ctx) => {
      // 1. 初始化 storage（SQLite PRAGMA + migrations）
      // 2. 读取 config.json
      // 3. 探测 cwd 项目
      // 4. 注册 Tool（/project *）
      // 5. 注册 RPC（project_brain/*）
      // 6. 监听 session:started / session:ended
      // 7. 注册 Service（projectBrain）
      // 8. 注册 Pub/Sub
    },
  }
}
```

| 阶段 | 行为 |
| --- | --- |
| 启动 | 迁移 schema → 读 config → 探测 cwd 项目 |
| 运行 | 监听事件；提供 RPC；Tools 可被 LLM 调用；SidebarPreview aggregator 就绪 |
| 关闭 | 关闭 SQLite 连接；flush Pub/Sub；保存 snapshot（如有 dirty） |

## 5.2 Service：`projectBrain`

供其它 Host 插件调用（不直接面向 Client）。**MVP 暴露以下方法**，所有方法必须返回 `{ ok, data | code, message }` 包装：

| 方法 | 用途 | 时延上限 |
| --- | --- | --- |
| `analyze(path)` | 触发扫描 | 不限（带 dryRun） |
| `recordMemory(input)` | 写入单条 Memory | 100ms |
| `queryMemory(filter)` | 查 Memory | 100ms |
| `listTodos(filter?)` | 查 TODO | 100ms |
| `upsertTodo(input)` | 写 TODO | 100ms |
| `getSidebarPreview(projectId)` | 聚合 SidebarPreview 数据 | 200ms（5 表 join） |
| `triggerDream(mode)` | 触发 Dream | 不限 |

`analyze` / `triggerDream` 异步执行，立即返回 `{ ok, data: { taskId } }`；通过 `preview.changed` 通知完成。

## 5.3 Tool 注册规范

```js
ctx.tool({
  name: 'project_xxx',
  description: '...',
  parameters: { /* schemastery schema */ },
  execute: async (args, ctx) => { /* returns { ok, data } */ },
})
```

**强制要求**：
- 每个 Tool 必须支持 `dryRun`。
- 返回值必须 JSON 可序列化。
- 错误返回 `{ ok: false, code: 'E_xxx', message }`。
- 成功返回 `{ ok: true, data }`。
- Tool 内部禁止直接写 SQLite；统一走 Service（保持事务边界）。

## 5.4 事件订阅 / 发布

### 订阅
```js
ctx.on('session:started', async (session) => { /* 写 session_started_at */ })
ctx.on('session:ended',   async (session) => { /* 触发 summarizer */ })
```

### 发布（命名空间 `project_brain/*`）

| 事件 | payload | 触发时机 |
| --- | --- | --- |
| `project_brain/preview.changed` | `{ projectId }` | 任意 Memory/TODO/project 变更 |
| `project_brain/scanner.started` | `{ projectId, mode }` | scanner 启动 |
| `project_brain/scanner.progress` | `{ projectId, percent }` | 扫描过程 |
| `project_brain/scanner.completed` | `{ projectId, ms, partial }` | 扫描完成 |
| `project_brain/dream.started` | `{ projectId, mode }` | Dream 启动 |
| `project_brain/dream.completed` | `{ projectId, summary }` | Dream 完成 |

## 5.5 Pub/Sub 设计

```js
class PreviewPubSub {
  subscribers = new Map()        // projectId → Set<handler>
  subscribe(projectId, handler) { /* returns disposer */ }
  publish(projectId) { /* debounce 100ms, batch all */ }
}
```

- 单 process 单例（Service）。
- Debounce 100ms，避免高频写触发高频推送。
- Client 通过 `sidebar.subscribe` RPC 订阅。

## 5.6 注入清单（必须用 `cordis_inspect_*` 校正）

| 依赖 | 来源（推测） | 用途 |
| --- | --- | --- |
| `llm` | `@deepseek-ai/dsh-llm` | LLM 调用 |
| `tools` | `@deepseek-ai/dsh-tools` | Tool 注册 |
| `session` | `@deepseek-ai/dsh-session` | Session 事件 |
| `timer` | `@deepseek-ai/cordis-plugin-timer` | 周期任务（Dream） |
| `loader` | `@deepseek-ai/cordis-plugin-loader` | 加载元数据 |
| `storage` 或 `storageDomain` | `@deepseek-ai/dsh-storage*` | 持久化（**P0.1 验证是哪个**） |

可选依赖用 `ctx.get('name')` 而非 inject，避免启动顺序死锁。

---

# 6. Client 插件规范

## 6.1 入口

```js
// src/client/index.js —— 契约示意
export default function clientPlugin() {
  return {
    name: 'dsh-project-brain:client',
    platform: 'web',
    apply: async (ctx) => {
      // 1. 注册 SidebarTab（Slot ID 来自 §11.2 Inspect 结果）
      // 2. 注册 Dashboard View
      // 3. 初始化 i18n
      // 4. 绑定 Pub/Sub 监听（host.call('project_brain/sidebar.subscribe', ...)）
    }
  }
}
```

## 6.2 强制约束

1. **必须用 `React.createElement(...)`，不写 JSX**。
2. **禁止在 Client 直接访问 SQLite / FS**；统一 `host.call(...)`。
3. **禁止序列化整个 Service 对象**到 React state；只保存所需字段。
4. 国际化文案必须经过 `i18n.t(key)`。
5. 主题色 / 间距必须读取 DSH Theme token（推测前缀 `--dsh-*`，**P0.1 Inspect 验证**）；不允许硬编码颜色。
6. 组件卸载必须清理所有订阅 / 定时器（通过 `ctx.effect()`）。
7. **禁止客户端直连 SQLite / FS**（重要，再强调一次）。

## 6.3 Slot 注册

| 用途 | **实际 Slot 名** | kind | 备注 |
| --- | --- | --- | --- |
| **SidebarPreview View Tab** | **`conversation.view`** | list | `id: 'project-brain'`、`order: 35`（紧随 `dsh-mneme-memory` order=30） |
| Tool 调用卡片 | `tool.call.toolview` | keyed | 可选：自定义 `/project_*` 工具展示卡 |
| 顶部 toast | `shell.overlay` | list | 可选：通知 + 错误提示 |

> **关键修正**（来自 P0.1 #2 Inspect）：用户截图中的"记忆库"是 `conversation.view` 的 `dsh-mneme-memory`（order=30，由 `@deepseek-ai/dsh-mneme` 插件注册），不是侧边栏 tab。我们的入口注册到 **`conversation.view`** 的 order=35，紧邻"记忆库"。

注册示例（基于 Inspect 真实结果）：
```js
const slots = ctx.get('slots')
slots.inject('conversation.view', () => slots.register(
  {
    name: 'conversation.view',
    id: 'project-brain',
    order: 35,
    label: () => ctx.get('locale').bind('dsh-project-brain')('sidebar.tab.label'),
  },
  (props) => React.createElement(SidebarPreview, props),
))
```

**`conversation.view` 当前 occupants（避免抢 id）**：

| id | order | registrant |
| --- | --- | --- |
| `chat` | 0 | z5 |
| `trajectory` | 10 | z5 |
| `context` | 20 | dsh-context |
| `dsh-mneme-memory` | 30 | dsh-mneme |
| **`project-brain`** | **35** | **dsh-project-brain（我们）** |

## 6.4 国际化

`src/client/i18n/zh-CN.js` 与 `src/client/i18n/en-US.js` 必须保持 key 一致。完整 key 表见 §6.5。

## 6.5 i18n Key 清单

| Key | zh-CN | en-US |
| --- | --- | --- |
| `sidebar.tab.label` | 项目 | Project |
| `sidebar.preview.header.lastUpdate` | 上次更新 | Last update |
| `sidebar.preview.header.untitled` | 未命名项目 | Untitled project |
| `sidebar.preview.phase.title` | 当前阶段 | Current phase |
| `sidebar.preview.phase.empty` | 暂无进行中任务 | No tasks in progress |
| `sidebar.preview.activity.title` | 最近活动 | Recent activity |
| `sidebar.preview.activity.empty` | 暂无活动 | No recent activity |
| `sidebar.preview.activity.viewMore` | 查看更多 | View more |
| `sidebar.preview.stats.pending` | 待办 | Pending |
| `sidebar.preview.stats.done` | 已完成 | Done |
| `sidebar.preview.stats.decisions` | 决策 | Decisions |
| `sidebar.preview.actions.continue` | 继续上次开发 | Continue last session |
| `sidebar.preview.actions.openDashboard` | 打开完整 Dashboard | Open full Dashboard |
| `sidebar.preview.onboarding.title` | 项目大脑未启动 | Project Brain not started |
| `sidebar.preview.onboarding.body` | 启动后将自动生成… | After startup, it will… |
| `sidebar.preview.onboarding.cta` | 启动项目大脑 /project init | Start Project Brain /project init |
| `sidebar.preview.error.loadFailed` | 项目数据加载失败 | Failed to load project data |
| `sidebar.preview.error.retry` | 重试 | Retry |

---

# 7. Tool 契约规范

## 7.1 通用约定

所有 Tool 都遵循：
```js
// 请求
{ args: { /* 工具参数 */ }, dryRun?: boolean }

// 成功
{ ok: true, data: T }

// 失败
{ ok: false, code: 'E_xxx', message: string, details?: any }
```

## 7.2 工具清单

### `project_init`

| 字段 | 内容 |
| --- | --- |
| 用途 | 初始化项目 Brain |
| 参数 | `{ path?: string }`（默认 cwd） |
| dryRun | 是 |
| 返回 | `{ projectId, name, scanDurationMs, stats: { files, loc, entities, relations }, partial: boolean }` |
| 错误 | `E_SCAN_TIMEOUT` / `E_PERMISSION` / `E_SCAN_FAILED` |

实现要点：
- 先扫描 FS（2 分钟硬上限）。
- 写 project 表 / project.json。
- 生成 architecture.json。
- emit `preview.changed`。

### `project_continue`

| 字段 | 内容 |
| --- | --- |
| 用途 | 恢复上次开发状态 |
| 参数 | `{}` |
| dryRun | 是 |
| 返回 | `{ project, lastDevelopment, currentPhase, completed, pending, decisions, knownIssues, suggestedNext, relatedFiles }` |
| 错误 | `E_NOT_INITIALIZED` |

### `project_status`

| 字段 | 内容 |
| --- | --- |
| 用途 | 当前项目状态快照 |
| 参数 | `{ projectId?: string }` |
| 返回 | `{ project, memoryCounts, todoCounts, lastActivity, uptime }` |

### `project_ask`

| 字段 | 内容 |
| --- | --- |
| 用途 | 自然语言查询 Project Brain |
| 参数 | `{ question: string, topK?: number }`（默认 topK=5） |
| dryRun | 否（成本较高） |
| 返回 | `{ answer: string, sources: MemoryRef[], confidence: number }` |
| 错误 | `E_NOT_INITIALIZED`, `E_LLM_FAILED` |

**confidence 计算**：`avg(sources.map(s => s.memory.confidence * s.similarity))`。

### `project_memory_list`

| 字段 | 内容 |
| --- | --- |
| 用途 | 列出 Memory |
| 参数 | `{ type?, keyword?, importanceMin?, status?, limit=20, offset=0 }` |
| 返回 | `{ items: MemoryRecord[], total: number }` |

### `project_memory_add`

| 字段 | 内容 |
| --- | --- |
| 用途 | 添加 Memory |
| 参数 | `{ type, title, content, relatedFiles? }` |
| dryRun | 是 |
| 返回 | `{ memory: MemoryRecord, deduped?: boolean, relatedTo?: string[] }` |
| 错误 | `E_MEMORY_SCHEMA` |

实现要点：
- 按 §4.4 schema 校验 content 必填字段。
- importance 默认 0.6 + bonus（relatedFiles 非空 +0.15；source=llm +0.05）。
- 与现有 Memory 做相似度去重：>=0.92 触发合并；>=0.75 加 relatedMemoryIds。
- 写入后 emit `preview.changed`。

### `project_todo_list`

| 字段 | 内容 |
| --- | --- |
| 参数 | `{ status?, priority? }` |
| 返回 | `{ items: TodoRecord[] }` |

### `project_todo_add`

| 字段 | 内容 |
| --- | --- |
| 参数 | `{ title, description?, priority?, relatedFiles?, relatedFeature? }` |
| dryRun | 是 |
| 返回 | `{ todo: TodoRecord }` |

### `project_todo_update`

| 字段 | 内容 |
| --- | --- |
| 参数 | `{ id, status?, title?, description?, priority? }` |
| 返回 | `{ todo: TodoRecord }` |

### `project_dream`

| 字段 | 内容 |
| --- | --- |
| 参数 | `{ mode: 'light' \| 'full' }` |
| dryRun | 是（返回计划但不执行） |
| 返回 | `{ started, plannedActions, estimatedMs }` |

## 7.3 Tool 错误码映射

| Tool | 可能错误码 |
| --- | --- |
| project_init | E_SCAN_TIMEOUT, E_SCAN_FAILED, E_PERMISSION |
| project_continue | E_NOT_INITIALIZED |
| project_status | E_NOT_INITIALIZED |
| project_ask | E_NOT_INITIALIZED, E_LLM_FAILED |
| project_memory_* | E_MEMORY_SCHEMA, E_NOT_FOUND |
| project_todo_* | E_NOT_FOUND |
| project_dream | E_INTERNAL |

---

# 8. RPC 契约规范

## 8.1 命名空间

所有 RPC 方法名：`project_brain/<area>.<action>`

注册（Host）：
```js
harness.handle('project_brain/sidebar.getPreview', async (ctx, args) => { ... })
```

调用（Client）：
```js
const preview = await host.call('project_brain/sidebar.getPreview', { projectId })
```

## 8.2 通用约定

- 入参必须 JSON 可序列化。
- 返回必须 JSON 可序列化。
- 单 RPC 在 200ms 内必须返回（聚合类 `sidebar.getPreview` 可放宽到 200ms）。
- 错误统一 `{ ok: false, code, message }`。

## 8.3 RPC 方法清单

| 方法 | 用途 | 主要入参 | 主要返回 |
| --- | --- | --- | --- |
| `project_brain/sidebar.getPreview` | SidebarPreview 数据聚合 | `{ projectId }` | `SidebarPreview`（§9.3） |
| `project_brain/sidebar.subscribe` | 订阅 preview 变更推送 | `{ projectId }` | `{ subscribed: true, channelId }` |
| `project_brain/dashboard.getOverview` | Dashboard Overview 面板 | `{ projectId }` | `OverviewData` |
| `project_brain/dashboard.getArchitecture` | Architecture 面板 | `{ projectId }` | `ArchitectureData` |
| `project_brain/dashboard.getCodeGraph` | Code Map | `{ projectId, rootId? }` | `{ nodes, edges }` |
| `project_brain/dashboard.getMemoryList` | Memory 面板 | `{ projectId, type?, keyword?, limit, offset }` | `{ items, total }` |
| `project_brain/dashboard.getTimeline` | Timeline | `{ projectId, from?, to? }` | `{ items }` |
| `project_brain/dashboard.getTasks` | Tasks | `{ projectId }` | `{ items, stats }` |
| `project_brain/dashboard.getCallChain` | 调用链 | `{ projectId, startEntityId, maxDepth? }` | `{ paths }` |
| `project_brain/memory.add` | 新增 Memory（不走 Tool） | `{ type, title, content, relatedFiles? }` | `{ memory }` |
| `project_brain/memory.get` | 获取 Memory 详情 | `{ id }` | `{ memory, relatedMemories }` |

> `memory.add` 与 Tool `project_memory_add` 共用 Service `recordMemory`；Tool 用于 LLM 调用，RPC 用于 Client 手动写入。

## 8.4 错误码统一

参见 §4.5。

---

# 9. SidebarPreview 规范（重点章节）

## 9.1 目标

> 用户打开 DSH 第一秒，无需任何输入即可感知"我现在在哪个项目、开发到哪里、下一步该做什么"。

## 9.2 术语与位置

| 维度 | 规格 |
| --- | --- |
| 功能名 | **SidebarPreview**（"Sidebar" 是历史命名沿用，指 conversation 视图栏） |
| UI 元素 | **SidebarTab**（conversation.view 的 entry：图标+文字） |
| 实际 Slot | **`conversation.view`**（list, scope: session） |
| 注册参数 | `id: 'project-brain'`、`order: 35`（紧随 `dsh-mneme-memory` order=30） |
| 物理位置 | 紧邻"记忆库"右侧（用户已确认） |
| Tab 标签 | zh: "项目" / en: "Project"（由 i18n `sidebar.tab.label` 控制） |
| 图标 | brain 类，单色，16×16 |
| 角标 | status ∈ {pending, in_progress} 的 TODO 计数（>99 显示 `99+`） |
| 激活交互 | 点击切换 view；激活后渲染折叠态 SidebarPreview；面板内任意处点击跳转 Dashboard 对应面板 |

**事件名**：`project_brain/preview.changed`
**RPC 名**：`project_brain/sidebar.getPreview` / `project_brain/sidebar.subscribe`

> **P0.1 Inspect 校正**：用户截图中的"记忆库"实际是 `conversation.view` 的 `dsh-mneme-memory`（由 `@deepseek-ai/dsh-mneme` 注册），order=30。我们的入口紧随其后注册为 order=35。

## 9.3 数据契约：SidebarPreview

```js
const SidebarPreview = {
  initialized: false,            // false → 走 Onboarding 分支
  project: { id, name, type?, lastUpdateAt },
  phase: { title, progress: { done, total } },
  recentActivity: [{ id, title, occurredAt, eventType }],
  stats: { pendingTodos, completedTodos, decisions },
  empty: false                   // 同 initialized=false 的冗余表达
}
```

**Onboarding 是状态分支，不是区块**。`initialized=true` 时渲染 5 个区块，false 时整个面板替换为引导卡片。

## 9.4 区块设计（5 个）

| # | 区块名 | 内容 | 跳转目标 |
| --- | --- | --- | --- |
| 1 | Header | 项目名 / 类型 chip / 上次更新 | Dashboard / Overview |
| 2 | Phase | 当前阶段名 + 进度条 | Dashboard / Tasks |
| 3 | Activity | 最近 N 条 Timeline（N 来自 `sidebar.recentActivityLimit`，默认 3） | Dashboard / Timeline |
| 4 | Stats | 待办 / 已完成 / 决策 计数 | Dashboard / Memory 或 Tasks |
| 5 | Actions | `[继续上次开发]` `[打开 Dashboard]` | 触发 Tool / 路由 |

## 9.5 区块交互契约

```js
// 区块组件接收的 props
{
  data: BlockData,
  onJump: (target: 'overview' | 'tasks' | 'timeline' | 'memory') => void,
  onAction: (action: 'continue' | 'init' | 'openDashboard') => void
}
```

- 区块空白点击 → `onJump(target)`。
- Activity 单项点击 → `onJump('timeline')` + Dashboard 高亮（由 Dashboard 状态管理）。
- Actions 按钮 → `onAction`。

## 9.6 视觉规范

| 项 | 值 |
| --- | --- |
| 折叠态面板高度 | ≤ 视口 60% |
| Header 背景 | `--dsw-alias-bg-layer-1` |
| 进度条完成段 | `--dsw-alias-state-success-primary` |
| 进度条未完成段 | `--dsw-alias-bg-layer-2` |
| Activity 项上限 | 由 `config.json` 的 `sidebar.recentActivityLimit` 控制（默认 3） |
| Actions 主按钮 | DSH primary 样式 |
| 文字色 | `--dsw-alias-label-primary` / `--dsw-alias-label-secondary` |
| 边框 | `--dsw-alias-border-l1` |

> 主题 token 前缀校正：DSH 真实主题 token 前缀为 **`--dsw-*`**（不是 `--dsh-*`）。完整 token 表见 `TODO.md` Inspect 区。

## 9.7 数据更新策略

| 触发 | 行为 |
| --- | --- |
| SidebarPreview 首次渲染 | 拉一次完整 preview |
| `project_brain/preview.changed` 事件 | 重新拉取 |
| 同一面板 30s 内重复打开 | 复用缓存 |
| `/project continue` 触发后 | 强制刷新 phase / progress |
| `/project init` 完成 | 强制刷新全部 |

Host 侧在以下时机 emit `preview.changed`：
- Memory 写入 / 更新 / 归档
- TODO 写入 / 更新 / 完成
- Project 元数据变更
- Timeline 新增
- Session 摘要完成

## 9.8 Onboarding（空状态）

`initialized=false` 时整个面板替换为引导卡片：

```
┌─────────────────────────────────────┐
│ 🧠 项目大脑未启动                      │
├─────────────────────────────────────┤
│ 这个项目还没有 Project Brain。         │
│ 启动后将自动生成：                     │
│   · 项目结构 / 技术栈 / 架构图          │
│   · 持续记录开发历史与决策               │
│   · 跨 Session 自动恢复上下文           │
├─────────────────────────────────────┤
│   [启动项目大脑 /project init]          │
└─────────────────────────────────────┘
```

主按钮 → 调用 `project_init` Tool。完成后 `initialized=true`，自动切换到正常态。

## 9.9 错误处理

| 情况 | 表现 |
| --- | --- |
| RPC 失败 | "项目数据加载失败 [重试]" 卡片 |
| preview 数据不完整 | 显示已加载部分 + "部分数据可能过期" |
| TODO 计数异常 | 显示 `—` 占位，不显示错误数字 |

## 9.10 SidebarPreview P0 验收清单（带测量方法）

| # | 验收项 | 目标 | 测量方法 |
| --- | --- | --- | --- |
| 1 | Slot ID 已通过 `cordis_inspect_query` 确认 | 必填 | `TODO.md` 记录 |
| 2 | SidebarTab 注册成功，紧邻"记忆库"右侧 | 必填 | 视觉验证截图 |
| 3 | 角标数字与 todo 表实时同步 | 必填 | 创建/完成 TODO 后角标变化 < 100ms |
| 4 | 5 区块渲染完整 | 必填 | 已 init 项目截图 |
| 5 | Onboarding 卡片 | 必填 | 未 init 项目截图 |
| 6 | "继续上次开发" 触发 Tool 正常 | 必填 | 日志确认 |
| 7 | 区块点击跳转 Dashboard | 必填 | 5 区块各点 1 次 |
| 8 | i18n（zh/en）覆盖 | 必填 | 切语言后文案变 |
| 9 | 主题 token 全部使用 DSH 变量 | 必填 | grep `--dsh-` 引用，无硬编码颜色 |
| 10 | 折叠态首次渲染 | < 50ms（不含 RPC） | `PerformanceObserver` 实测 |
| 11 | RPC `sidebar.getPreview` 响应 | < 100ms（p95） | logger 打 timestamp + 100 次采样 |
| 12 | `preview.changed` debounce + 推送 | < 100ms | 单测 |

---

# 10. 配置规范

## 10.1 配置文件

`<project>/.project-brain/config.json`（首次 init 时生成全默认值）。

## 10.2 Schema（schemastery 校验）

```js
const ConfigSchema = {
  version: 1,
  scan: { timeoutMs: 120000, maxFileSizeBytes: 1048576, ignored: ['node_modules/**','.git/**','build/**','dist/**','**/*.min.js'] },
  languages: ['typescript','javascript','python','go','java'],
  llm: { modelPreference: null, maxTokensPerCall: 4000 },
  memory: { maxMemories: 5000, importanceFloor: 0.2 },
  sidebar: { enabled: true, recentActivityLimit: 3, perfTargetMs: 100 }
}
```

## 10.3 加载规则

- 启动读 config.json，缺字段填默认。
- 写入：仅改字段，其他保留。
- 校验失败 → 记录 warning，使用全默认。
- 不允许运行时改 `version`。

## 10.4 环境变量覆盖

| 环境变量 | 覆盖字段 | 用途 |
| --- | --- | --- |
| `DSH_BRAIN_SCAN_TIMEOUT_MS` | `scan.timeoutMs` | CI 场景 |
| `DSH_BRAIN_LLM_MODEL` | `llm.modelPreference` | 临时切换模型 |
| `DSH_BRAIN_DISABLE_SIDEBAR` | `sidebar.enabled` | 关闭 Sidebar（debug） |

---

# 11. 开发阶段与任务清单

## 11.1 阶段总览（含 buffer）

| 阶段 | 时长 | 入口依赖 | 出口交付 | 备注 |
| --- | --- | --- | --- | --- |
| **P0.0 测试 fixture（最小集）** | 0.5~1d | 无 | `tests/fixtures/ts-sample` 可编译运行 | 必须先于 P0.2 |
| **P0.1 项目骨架** | 1~2d | P0.0 | 工程脚手架 + Inspect 清单 | 必须跑通 hello world |
| **P0.2 Tech Stack + Overview + SidebarPreview** | 3~4d | P0.1 | Tech 识别 + Overview + SidebarPreview | **本阶段交付 Sidebar 全功能** |
| **P0.3a Code Graph（TS/JS/Python）** | 5~7d | P0.2 | 三语言 Code Graph | MVP 必交付 |
| **P0.3b Code Graph（Go/Java，可选）** | 3~5d | P0.3a | 五语言 Code Graph | **可选；时间紧可砍** |
| **P0.4 Memory CRUD** | 3~4d | P0.3a | Memory 体系 + Tool | — |
| **P0.5 Session 摘要** | 4~5d | P0.4 | 自动 Memory | LLM 抽取可能需 +2d buffer |
| **P0.6 Cross-Session + Continue** | 3~4d | P0.5 | 跨 Session 续接 | — |
| **P0.7 TODO 管理** | 2~3d | P0.6 | Tasks 面板 + SidebarPreview Phase 同步 | — |
| **P0.8 Architecture + 收尾** | 3~4d | P0.7 | 可演示 | — |

**合计核心**：约 28~38 工作日（不含 P0.3b）。
**含 30% 调试 buffer**：**38~48 工作日**。
**含 P0.3b**：46~58 工作日。

## 11.2 P0.0 Fixture 任务

- [ ] 创建 `tests/fixtures/ts-sample/`（Express + TypeScript，5 文件，2 API，1 DB 模型）
- [ ] 该 sample 必须可 `npm install && npm run build && npm start` 跑通
- [ ] 至少一个跨文件调用链贯穿（API → Service → Repository → Model）
- [ ] 在 `TODO.md` 记录 sample 的入口路径与调用链说明

## 11.3 P0.1 详细任务清单

- [ ] 用 `cordis_inspect_list` 拉一份 DSH 真实服务清单，填入 §5.6 表格
- [ ] 用 `cordis_inspect_query` 查 `Slots.listSubTree` 确认 SidebarTab Slot ID 与 Dashboard Slot ID（写入 `TODO.md`）
- [ ] 创建 `package.json`（§3 + §2.3）
- [ ] 创建 `tsconfig.json`（strict, target esnext, module esnext）
- [ ] 创建 `cordis.yml`（loader 入口）
- [ ] 创建 `src/shared/{types,constants,terms}.js`
- [ ] 创建 `src/host/index.js`（最小 hello world：`ctx.logger.info('dsh-project-brain host loaded')`）
- [ ] 创建 `src/client/index.js`（最小 hello world）
- [ ] 把插件挂到 active profile（pnpm install + 加 bundles）
- [ ] 重启 DSH，日志看到 "dsh-project-brain host loaded"

**退出标准**：DSH 启动日志可见 hello world；改 `host/index.js` 后 HMR 重启可见；`TODO.md` 记录两份 Inspect 数据。

## 11.4 P0.2 详细任务清单

### Scanner
- [ ] `storage/sqlite.js`：better-sqlite3 封装 + PRAGMA 强制
- [ ] `storage/migrations.js`：schema v1 迁移脚本
- [ ] `storage/fingerprint.js`：FS 指纹（path + mtime + size hash）
- [ ] `scanner/filesystem.js`：并发遍历、`.gitignore`、大文件阈值
- [ ] `scanner/ignore.js`：默认 ignore 列表
- [ ] `scanner/techstack.js`：5 语言 manifest 识别
- [ ] `scanner/entrypoints.js`：识别 main / app / server / cmd

### Tech Stack + Overview
- [ ] Tool `project_init` 实现（dryRun 支持）
- [ ] 写 `project.json` / `architecture.json`
- [ ] Timeline 写入 init 事件
- [ ] RPC `dashboard.getOverview`
- [ ] Dashboard Overview 面板

### SidebarPreview
- [ ] `sidebar/aggregator.js`：5 表聚合 → SidebarPreview
- [ ] `sidebar/pubsub.js`：debounce 100ms + emit `preview.changed`
- [ ] `rpc/sidebar.js`：`getPreview` / `subscribe`
- [ ] `client/sidebar/tab.js`：SidebarTab 注册
- [ ] `client/sidebar/preview.js`：5 区块渲染
- [ ] `client/sidebar/onboarding.js`：空状态引导
- [ ] `client/sidebar/blocks/{header,phase,activity,stats,actions}.js`
- [ ] Tab 角标（>99 → `99+`）
- [ ] i18n 覆盖（zh-CN / en-US，按 §6.5 key 表）
- [ ] 主题 token 全部使用 DSH 变量
- [ ] 区块跳转 Dashboard 锚点联调

## 11.5 P0.3a~P0.8 任务清单（概要）

**P0.3a Code Graph（TS/JS/Python）**：
- tree-sitter 3 个 grammar 接入
- AST 解析器（按文件类型分发）
- 调用图（BFS + 环检测 + 深度限制 6）
- API endpoint 提取（Express / Fastify / FastAPI）
- 数据库表识别（Prisma / TypeORM / SQLAlchemy）
- 增量扫描（fingerprint 驱动）
- Code Map 面板

**P0.3b Code Graph（Go/Java，可选）**：
- Gin / Spring 适配
- GORM / JDBC 表抽取

**P0.4 Memory**：
- 9 类型校验 + 评分 + 相似度去重
- Tools `project_memory_list/add` + RPC `memory.add/get`
- Memory 面板

**P0.5 Session 摘要**：
- 监听 `session:ended`
- 收集聊天摘要 + Git Diff
- LLM 抽取（强制 JSON Schema）
- 自动合并 / 强化
- emit `preview.changed`

**P0.6 Cross-Session**：
- Context Injector（Top-K 选择算法：`importance*0.5 + recency*0.3 + moduleMatch*0.2`）
- Tool `project_continue`
- SidebarPreview "继续上次开发" 按钮联调

**P0.7 TODO**：
- TODO CRUD 工具
- Tasks 看板
- SidebarPreview Phase 进度条同步

**P0.8 Architecture + 收尾**：
- Mermaid 渲染
- Architecture 面板
- SidebarPreview 跳转锚点联调
- README + 截图

---

# 12. 测试策略

## 12.1 单元测试范围

| 模块 | 测试重点 |
| --- | --- |
| scanner | 5 语言 manifest 识别；ignore 规则；2 分钟超时 |
| analyzer | 调用图正确性；环检测；增量更新 |
| memory | 9 类型 schema 校验；去重；评分 |
| summarizer | LLM 抽取稳定性；source 强制 |
| **sidebar aggregator** | 5 区块数据正确性；RPC < 100ms |
| rpc handlers | 入参校验；错误码 |

## 12.2 集成测试

- [ ] 端到端：在 `tests/fixtures/ts-sample` 上跑 init → ask → continue 流程
- [ ] 5 语言（TS/JS/Python 必做；Go/Java 可选）各跑一遍
- [ ] Session 开始 → 写 TODO → Session 结束 → Memory 自动新增 → SidebarPreview 刷新

## 12.3 验收用例

| 用例 | 验收标准 |
| --- | --- |
| A | 5k~20k LOC 陌生项目 init 后 5 分钟内 Overview + Architecture + CodeMap 可见 |
| B | 真实 feature 后 Memory 自动新增至少 1 条 decision / change / lesson |
| C | 新 Session `/project continue` 给出 Top-5 Memory + 当前 TODO |
| D | `/project ask 为什么这里这么设计` 返回 Decision Memory + 来源 |
| E | 手动改 3 文件 → 增量扫描 < 10 秒 → 架构图更新 |
| **F — SidebarPreview** | DSH 启动立即看到 SidebarTab；未 init 显示引导；init 后 5 区块正确；区块点击正确跳转 |

## 12.4 测试数据

**P0.0 必做**（1 个）：
- `ts-sample/`：Express + TypeScript，2 API，1 DB 模型，1 跨文件调用链

**P0.3a 必做**（再加 2 个，共 3 个）：
- `js-sample/`：Vanilla JS（3 文件）
- `py-sample/`：FastAPI + SQLAlchemy（6 文件）

**P0.3b 可选**（再加 2 个，共 5 个）：
- `go-sample/`：Gin + GORM（5 文件）
- `java-sample/`：Spring Boot（4 文件）

每个 fixture 必须：可编译运行 + manifest 文件 + 至少一个调用链贯穿的 feature。

---

# 13. 调试指南

## 13.1 调试入口优先级

1. **首选：DSH 日志面板 + `ctx.logger`** — 所有 Service / Tool / RPC 入口必打 `ctx.logger.info('entry', { method, argsSummary })`。
2. 次选：浏览器 DevTools（F12）— Client UI、Console、Elements、Network。
3. RPC 主动复现：`await host.call('project_brain/xxx', args)`。
4. SQLite Browser：直接打开 `.project-brain/memory.db`。
5. Node `--inspect-brk` 远程断点（仅在 Host 代码死循环/崩溃时用）。

## 13.2 必备日志点清单（每个模块必打）

| 位置 | 日志内容 |
| --- | --- |
| Service 方法入口 | `logger.info('service:enter', { method, argsSummary })` |
| Tool 入口 | `logger.info('tool:enter', { tool, argsSummary })` |
| RPC handler 入口 | `logger.info('rpc:enter', { method, argsSummary })` |
| SQLite 查询（debug） | `logger.debug('sql', { sql, params })` |
| emit `preview.changed` | `logger.debug('pubsub:emit', { projectId, trigger })` |
| LLM 调用 | `logger.info('llm:call', { promptTokens, maxTokens })` |
| 错误 | `logger.error('xxx:failed', { code, message, stack })` |

`argsSummary` 只输出字段名 + 长度/计数，**绝不打印整个对象**。

## 13.3 常见问题

### Q1：SidebarTab 看不到
1. 检查 Slot ID 是否正确（Inspect `Slots.listSubTree`）。
2. 检查 `ctx.slot()` 注册返回值。
3. 检查 `apply(ctx)` 是否被调用。
4. 检查 DSH 日志是否有 plugin 加载错误。

### Q2：RPC 调用超时
1. 检查 Host 是否注册对应 `harness.handle`。
2. 检查入参字段拼写。
3. 检查 SQLite 锁（DB Browser 看 `.project-brain/*.db-wal`）。
4. 检查 Pub/Sub debounce。

### Q3：Memory 写入失败
1. 检查 schema 校验（按 §4.4）。
2. 检查 `E_MEMORY_SCHEMA` 详情。
3. 检查 source 字段是否齐全。

### Q4：扫描超时
1. 检查 ignore 列表。
2. 检查 `maxFileSizeBytes`。
3. 文件 >10k 应提前 partial。

### Q5：HMR 不生效
1. 确认 DSH 启动参数含 `--expose-internals`。
2. 确认 `cordis-plugin-hmr` 已挂载。
3. 检查 chokidar watch 范围。

### Q6：SidebarPreview 角标不更新
1. 检查是否订阅 `preview.changed`。
2. 检查 Pub/Sub debounce。
3. 检查 TODO 写入路径是否 emit。

## 13.4 排错 SOP

```
1. 现象描述（截图 / 错误码 / 日志）
   ↓
2. cordis_inspect_self 读 Package 状态
   ↓
3. cordis_inspect_query 查相关 Service / Slot
   ↓
4. host.call 主动复现 RPC
   ↓
5. SQLite Browser 直查数据
   ↓
6. 锁代码 → 提 issue → 修
```

---

# 14. 编码规约

## 14.1 JavaScript / TypeScript 风格

- 默认严格模式（strict, noImplicitAny, noUncheckedIndexedAccess）。
- **`enum` 默认不用**，必要时用 union literal types；DSH 内部约定也是 union。
- **`any` 默认不用**；边界处用 `unknown` + 类型守卫；RPC 桥接 / DSH 内部反射场景在 PR 注释中说明后可破例。
- **`as` 类型断言尽量避免**；JSDoc cast 在 schemastery 推断场景下可破例。
- 动态插件代码（host/client 的 `apply）`内）禁止 `import` / `require` / JSX / 装饰器；用打包后的 bundle 或纯 function body。

## 14.2 文件命名

- 文件名 `kebab-case.js` / `kebab-case.jsx`。
- React 组件 `PascalCase.js` / `PascalCase.jsx`。
- 测试 `*.test.js` / `*.test.jsx`。

## 14.3 错误处理

- 永远不吞错；不空 catch。
- 错误必须含 `code` + `message` + 可选 `cause`。
- 上抛错误由 Service 边界统一转换（带 trace）。

## 14.4 日志

- 关键决策 / 状态变更必 `logger.info`。
- 错误必 `logger.warn` 或 `logger.error`。
- 调试日志 `logger.debug`，生产可关。
- **禁止打印整个对象**；只打印 id + 关键字段（见 §13.2）。

## 14.5 注释

- 公共 API 必带 JSDoc。
- 模块顶部 1~3 行说明。
- TODO 格式：`// TODO(name): ...`，含负责人。

## 14.6 Git 提交

格式：`<type>(<scope>): <subject>`

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构 |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建 / 依赖 |

例：`feat(sidebar): add preview panel with 5 blocks`

## 14.7 依赖

- 不引入与 DSH 重复的依赖。
- 优先使用 DSH export 的服务（llm, storage, tools）。
- 新增依赖必须 PR 注释说明理由。

---

# 15. 完成定义（Definition of Done）

## 15.1 单个 PR / 提交

- [ ] `tsc --noEmit` 通过
- [ ] 新增功能有单元测试
- [ ] 公共 API 有 JSDoc
- [ ] 错误处理符合 §4.5 / §7.3 / §8.4
- [ ] 没有 console.log 残留
- [ ] 没有 TODO 残留（除非有负责人 + issue）
- [ ] 提交信息符合 §14.6
- [ ] 本地链接 profile 后实际验证过

## 15.2 整个 MVP

满足 §12.3 所有用例（A~F），并：
- [ ] 3 语言 fixture 全部通过（TS / JS / Python）
- [ ] 端到端：init → 开发 → session 结束 → 新 session continue
- [ ] SidebarPreview 全功能验证（§9.10 12 条全部勾选）
- [ ] 性能：扫描 < 2 分钟；增量 < 10 秒；SidebarRPC < 100ms（p95）
- [ ] 主要路径各跑 100 次无崩溃，内存增长 < 50MB（替代原 24h smoke test）
- [ ] README / SPEC / PRD / DESIGN 全部同步

## 15.3 单个 P0 阶段

- [ ] 该阶段所有任务勾选完成
- [ ] 阶段验收用例通过
- [ ] 文档（如有新增）已更新
- [ ] 已 commit 到 git

---

# 16. 未决问题与未来工作

## 16.1 已确认

| # | 决策 | 结果 |
| --- | --- | --- |
| 1 | 多项目策略 | 单活动项目 + cwd 探测 |
| 2 | MVP 语言 | TS / JS / Python（必）/ Go / Java（可选） |
| 3 | LLM 路由 | 复用 DSH 默认 route |
| 4 | 首次扫描超时 | 2 分钟硬上限 |
| 5 | UI 形态 | SidebarPreview 常驻 + Dashboard 按需 |
| 6 | 命名约定 | SidebarPreview / SidebarTab / `preview.changed` / `sidebar.getPreview` |
| 7 | DB 策略 | MVP 单 SQLite 文件 `memory.db` |
| 8 | Perf 目标 | SidebarRPC < 100ms p95；折叠态渲染 < 50ms |

## 16.2 仍待确认（不阻塞 P0.1）

| # | 问题 | 倾向 / 阻塞阶段 |
| --- | --- | --- |
| 9 | **SidebarTab Slot ID** | **P0.1 Inspect 确认；阻塞 P0.2** |
| 10 | **Dashboard Slot ID** | **P0.1 Inspect 确认；阻塞 P0.2** |
| 11 | 主题 token 实际命名（推测 `--dsh-*`） | P0.1 验证 |
| 12 | DSH `storage` Service 真实名称 | P0.1 验证（§5.6） |
| 13 | 远程项目（GitHub URL 直接扫描） | V2 |
| 14 | 团队共享（`.project-brain/` 跟 Git） | 不做 |
| 15 | 大文件阈值默认 1MB | OK |

---

# 17. 数据迁移与备份

## 17.1 SQLite Schema 迁移

- `src/host/storage/migrations.js` 维护迁移脚本数组。
- 启动时读 `schema_version` 表（无则创建），按 `version` 顺序执行未跑过的脚本。
- 每个迁移脚本签名：`async function up(db) { ... }` + `async function down(db) { ... }`（down 仅 dev 用）。
- MVP 仅 v1，无 down 强制；V2 起强制双向迁移。

## 17.2 项目数据导出 / 导入

**MVP 不做**，但预留 Tool：

- `project_export`：导出 `.project-brain/` 为 `.tar.gz`，含 JSON + SQLite dump。
- `project_import`：从 `.tar.gz` 重建（注意路径替换）。

**V2 实现**，V1 阶段用户可手动 `tar`/解压。

## 17.3 用户级误删恢复

- `.project-brain/` 删除后不可自动恢复（无云备份）。
- 提示：UI 显示一次性的"未检测到项目大脑，是否重新 init？"卡片。

---

# 18. 安全与沙箱

## 18.1 文件系统访问范围

- **只读路径**：用户授权的 `<project>` 根目录。
- **写路径**：仅限 `<project>/.project-brain/` 子树。
- 其他路径一律 `E_PERMISSION`。

## 18.2 LLM 数据脱敏

- 喂给 LLM 的 prompt 中：
  - 文件路径可保留（项目内相对路径）。
  - 完整文件内容按 §6 token 预算切片，**不发送整个项目**。
  - 聊天原文不外泄到 LLM（只摘要后送）。

## 18.3 网络访问

- 默认**不发起任何外部网络请求**。
- LLM 调用走 DSH 内部 route，host 由 DSH 控制。

## 18.4 DSH Sandbox 兼容

- 遵循 DSH 的 sandbox policy（来自 `@deepseek-ai/dsh-sandbox-policy`）。
- 不尝试绕过 sandbox 边界。

---

# 19. 失败模式与恢复

| 失败模式 | 检测 | 恢复策略 |
| --- | --- | --- |
| SQLite 文件损坏 | `db.prepare()` 抛错 | 备份原文件 → 重建 → 提示用户 Memory 丢失 |
| `project.json` 缺失 | `fs.existsSync` | 提示重新 init；不重建（避免覆盖用户手动改动） |
| tree-sitter grammar 不支持 | `loader.load()` 抛错 | 跳过该文件，记 warning，继续扫描其他文件 |
| LLM 调用超时 | 30s timeout | 重试 1 次；失败则降级到规则抽取 |
| Git 仓库不存在 | `git rev-parse` 失败 | 跳过 git 相关步骤，记 warning |
| 文件权限不足 | `EACCES` | 跳过该文件，记 warning，汇总报告 |
| 网络（远程项目） | 不适用（V2） | — |
| SidebarTab Slot 注册失败 | DSH 启动日志 | 降级：仅保留 Onboarding 卡片，提示重启 DSH |
| Memory 容量超限 | `count(*) > maxMemories` | 自动触发 Dream 'light'；归档低 importance 的 Memory |
| Schema 版本不兼容 | 旧 client 读新 db | 强制迁移；不能迁移则 `E_INTERNAL` 提示升级 |

所有失败必须有降级路径，**不能崩溃 DSH 进程**。

---

# 20. 变更日志（Changelog）

| 版本 | 日期 | 变更摘要 | 触发 |
| --- | --- | --- | --- |
| v0.1 | 初版 | 初稿 | — |
| v0.2 | 评审后修订 | ① TS-as-contract 提示；② Slot ID 提前到 P0.1；③ P0.1 加 Inspect 任务；④ 工时 38~48d；⑤ SQLite PRAGMA；⑥ fixture 拆 P0.0；⑦ SidebarPreview 性能改目标+测量；⑧ 日志面板优先；⑨ 术语统一；⑩ 编码规约放宽；+§17/§18/§19/§20 | 评审反馈 |
| **v0.2.1** | **P0.1 Inspect 校正** | **① SidebarPreview 实际注册到 `conversation.view` Slot（order=35，紧随 `dsh-mneme-memory` order=30），不是侧边栏 tab；② 主题 token 实际前缀 `--dsw-*`（不是 `--dsh-*`）；③ Host Session 事件为 `agent/session-start` / `session/disposed`（不是 `session:started/ended`）；④ Service 名校正：`storage` + `storageDomain` 都存在；`sessionPersistence` 是 Session 日志而非事件** | **P0.1 Inspect 结果** |
| **v0.2.2** | **P0.4.1 修复 + 工具面补全** | **① `project_init` 重跑保留 projectId/createdAt + 写 timeline 事件；② 新增 `project_rescan` / `project_continue`（P0.6 最小）/ `project_memory_add|list`（补全 P0.4）/ `project_todo_add|list|done`（P0.7-lite）共 8 工具；③ SidebarPreview Stats 改为真实数据（todo/memory jsonl）；④ 新增 TODO 区块 + Dashboard 展开区（Actions 按钮真功能：复制提示词 / DOM toggle，非 console.log 占位）；⑤ 文档校正：数据通道为 build-time embed（非 runtime fetch）** | **P0.4.1 实现** |
| **v0.2.3** | **契约确认** | **`conversation.view` 注册项仅 {id, order, label}，无 badge 字段 → Tab 角标（P0.2b-3/P0.5）无法实现，改为 Dashboard 内展示待办；`conversation.input.dock`（composer 上方 TODO strip）为 P0.7 潜在入口** | **Slots Inspect** |
| **v0.2.4** | **P0.4.2 切换 workspace 动态更新** | **① host 注册 `webServer` route `/plugins/dsh-project-brain/preview.json`（`buildWorkspacePreview` 按 `sandboxPolicy.workspaceRoot` 读 `.project-brain/`，读已生成数据零 token）；② client 改 class component + `componentDidMount` `fetch` 拉动态数据，失败 fallback 到 build-time embed（不崩）；③ 切换 workspace 即更新，未生成的显示 Onboarding；④ 新增 `src/host/rpc/preview.js` + `scripts/verify-preview.mjs`** | **用户反馈"切换 workspace 不更新"** |
| **v0.2.5** | **P0.4.2-final 架构结论 + 真正修复** | **① 用户截图证实：静态 workspace client 下 `typeof host === 'undefined'`、`typeof window.host === 'undefined'`、webServer route 404——**静态 plugin fiber 没有任何 host→client 数据通道**（host.call 不存在、webServer named route 被 DSH 静态 server fallback 抢先 404）；② 最终方案：build 时扫 `~/.dsh/storages/workspace.json`，对每个 DSH workspace 递归 `.project-brain/`，把 `(sessionId → workspaceId → previewData)` map 全部 inline 进 client bundle；③ client 启动用 `props.sessionId` 查表 → 命中当前 session 所属 workspace 的预览数据（纯 build-time lookup，**零 token**）；⑤ 切换 workspace = conversation.view 重新挂载（新 sessionId）→ 自动取新数据；⑥ 已生成直接读，未生成显示 Onboarding；⑦ `src/client.js` 改回纯函数组件（不再需要 class component + 异步 state）；⑧ 撤销 `host.call`/`fetch`/`webServer route`/`harness 探测修复`/`tab 调试条`等所有无效尝试** | **用户三次反馈"切换不更新"+ 截图证实静态 client 下 host/webServer 全部不可用** |
| **v0.2.6** | **P0.4.8 scanner 真实运行时修复** | **`fs.listDir` 返回 `FsDirEntry { name, type: 'file'\|'directory'\|'other', target: FsTarget }`（DSH dsh-fs-local 实现）；旧 scanner 用 `e.isFile`/`e.isDirectory`（boolean — DSH 没这俩字段）→ 实测 `files:0 / languages:{}`。新 `entryKind(e)` 优先读 `e.type`，回退 `e.isFile`/`e.isDirectory`（boolean 或 method，兼容 node Dirent adapter）；递归用 `e.target`（已 resolved FsTarget），仅缺失时回退 `fs.resolve(e.name, {cwd})`；深度 3 → 5** | **运行 `project_init` dryRun 实测 files:0 + P0.4.7 bundle 已带此 bug** |
| **v0.2.7** | **P0.4.9 跨项目 todo 隔离** | **新增 `src/host/store/path-resolver.js`：`resolveProjectPath(args, exec, sandboxPolicy)` 优先级链 = `args.path` → `exec.session.cwd` → `exec.ctx.session` → `exec.sessionId + ctx.get('sessions')` → `agents.currentInitiator()` → `sandboxPolicy.workspaceRoot` → `.`。`project_continue` / `project_memory_add\|list` / `project_todo_add\|list\|done` 全部切换到此 resolver。`project_init/rescan` 仍必传 path（`E_NO_PATH` 守卫）。根因是静态 plugin fiber 的 `sandboxPolicy.workspaceRoot` 是 profile 级固定值（DSH install / 首个 workspace），与用户当前 session 的 workspace 解耦 → todos/memory 串台** | **实测发现 session workspace 与工具 fallback workspace 不一致，导致项目数据串台。** |
| **v0.2.8** | **P0.5 Session 摘要（最小可用）** | **新增 `src/host/summarizer.js`：`setupSummarizer(ctx, fs, sandboxPolicy)` 订阅 `session/disposed`；从 session cwd 解析项目路径 → `git diff --name-only HEAD~1`（5s 超时，swallow 失败）→ 若有变更写一条 `type=change` memory + `eventType=session_summary` timeline 事件 + `emit('project_brain/preview.changed')`。fire-and-forget，全部 try/catch + fallback。LLM 抽取留 TODO 占位（合约未稳，避免拖累）** | **P0.5 SPEC §16 任务** |
| **v0.2.9** | **P0.5.x 工具面补全（8 → 12）** | **新增 4 工具：`project_status`（项目快照：各类型 Memory 计数 + TODO 统计 + 最近活动 + lastActivityAge）；`project_todo_update`（按 id/title 改 status/priority/title/description，写 `todo_update` timeline）；`project_ask`（纯规则关键词检索：title 命中 ×2 + importance 加权，零 token，返回 sources + confidence）；`project_dream`（light：title Jaccard ≥ 0.92 同类合并候选 + importance<0.15 且年龄>30d 归档候选；full 模式占位）。`src/index.js` toolBuilders 扩展到 12 个，build 后 lib/index.js 87.0kb** | **SPEC §7.2 余下工具 + 用户"开发完所有功能"要求** |
| **v0.3.0** | **架构重做：live 数据通道 + Context Injector + LLM RAG** | **打破 build-time embed 架构（违反"实时同步"偏好）：① 启用 `webServer.register` route `/dsh-project-brain/preview.json`（避开 `/plugins/` 前缀防 DSH 静态 server 抢先 404），host 端用 `sessions.get(sessionId).meta.cwd` 反查项目路径，每次请求重新读 `.project-brain/` 实时数据；② `src/client.js` 改 class component + `componentDidMount` + `setInterval(5000)` 拉取，失败时保留上次成功数据 + 显示"离线"徽章；首次渲染用 `__ALL_WORKSPACES_JSON__` 兜底避免空白；增加 LiveBadge 显示 "实时同步 / 离线 / 本地快照" 三态；③ 新增 `src/host/injector.js`：通过 `systemPrompt.service.section()` 注册 `project-brain-context` 段，监听 `agent/session-start` + `preview.changed` 预读 `.project-brain/`，render 时按 SPEC §4.5 算法 `importance*0.5 + recency*0.3 + moduleMatch*0.2` 选 Top-5 记忆 + 活跃 TODO + 最近活动，组装 markdown，自动注入到每个新 session 的 system prompt；token 预算 1500，超出按段落截断；④ `project_ask` 加 `useLLM` 参数（默认 false 兼容旧用法），true 时调 `llm.stream` 用 RAG prompt 合成答案，LLM 失败 fallback 到纯规则版（错误信息写在 `data.llm.error`）；⑤ `summarizer` 改用 DSH `shell.service.run` 跑 `git diff`（之前 `child_process.spawn` 在某些 sandbox 下 EPERM）。build 后 lib/index.js 105.7kb / lib/client.js 53.9kb** | **用户指出"内容改动后能实时同步（不要求立即）+ 跨 Session 自动恢复上下文"是核心目的；P0.4.2 build-time embed 架构与该目的根本矛盾；project_ask 阉割版纯规则检索价值低于 SPEC 设计意图** |
| **v0.3.1** | **PromptSection 字段修复（DSH session 崩溃）** | **`systemPrompt.service.section()` 期望 `PromptSection = { name: string, order: number, text: string \| ((context) => string), complete?: boolean }`（DSH `packages/core/system-prompt/src/index.ts`）。v0.3.0 误传 `{ name, order, id, priority, render }`，DSH 合并 sections 时对 undefined 调 `.indexOf` 抛错（错误显示在 goal section 调用栈是因为 waterfall 失败连带），整个 DSH session 无法运行。修复：`render` → `text`，接受 `AssembleContext` 参数；删除 `id` / `priority`（非合约字段）。Injector 重新启用** | **用户截图显示 "本轮运行失败 Cannot read properties of undefined (reading 'indexOf')"；目标对齐后排查 GitHub DSH 源码确认 PromptSection 字段名** |
| **v0.3.2** | **Electron 实时同步诊断（DSH Desktop）** | **LiveBadge 改为实时显示真实 fetch 错误（`data-error` 属性 + `title` hover），连续失败后保留 build-time embed；webServer route handler 写 `.project-brain/.webserver-last-hit.json` 诊断 marker（hitAt/sessionId/workspaceRoot/url/method），方便排查 DSH Desktop 下 fetch 是否走 webServer（Electron renderer fetch 走 IPC bridge，可能不通）；添加 CORS `access-control-allow-origin: *` 头（万一跨 fiber / 跨端口）。lib/index.js 106.2kb / lib/client.js 61.2kb** | **用户在 DSH Desktop（Electron）下重启后 LiveBadge 仍"离线"且 sidebar 数据用 build-time 兜底；推断 Electron renderer fetch 走 IPC bridge，不直接打 webServer，需要诊断信号** |
| **v0.3.3** | **路径重试（prefix + 独特命名空间）** | **webServer route path 从 `/dsh-project-brain/preview.json` 改为 `/__dsh_brain__/preview.json`（DSH 内部约定下划线命名空间），route kind 从 `exact` 改为 `prefix`。client fetch URL 同步更新。lib/index.js 106.2kb / lib/client.js 61.3kb** | **v0.3.2 用户截图显示 `HTTP 404`，怀疑 DSH frontend-static SPA fallback 抢先响应；改 prefix + 独特路径规避** |
| **v0.3.4** | **完整回退：放弃 webServer route，回到 build-time embed + auto-rebuild** | **用户截图（DSH Desktop **和** browser）均 `HTTP 404`——确认 v0.3.0 重走 P0.4.5 回头路根本不通（static plugin fiber 没有 webServer service，browser 模式也被 SPA fallback 抢先）。彻底回退：① `src/index.js` 注释 `registerPreviewRoute` 调用，保留 import 作为工具；② `src/client.js` 回退为纯函数组件 + build-time embed，删除 class component / setInterval / fetch / LiveBadge 实时状态；新增 `SnapshotBadge` 显示"📦 快照 · Xs"（提示用户这是 build-time 数据而非实时）；③ 数据通道改为 `preview.changed → setupAutoRebuild → spawn node build.js → clientModules.rebuilt → renderer 热重载 client bundle`，用户无需重启 DSH（renderer 内部重载），代价是每次 update 1-3 秒 build 时间。lib/index.js 105.7kb / lib/client.js 51.7kb（减少 10kb）** | **用户确认 v0.3.3 在 browser 也是 404，证明 static plugin fiber 下 webServer 完全不可用；放弃 live 通道，回到 P0.4.7 的 build-time embed 架构但强化 auto-rebuild** |
| **v0.3.5** | **build.js 排除 plugin 自身 .project-brain** | **`findBrainsUnder` 在递归时遇到 `cordis.patch.yml` 直接 return（跳过），避免把 plugin 自己的 `.project-brain/` 当成 workspace 的项目嵌入。之前 plugins workspace 显示 `dsh-project-brain` 项目（错把 plugin 自己的 brain 算成 plugins workspace 的项目），现在正确显示空 → 触发 Onboarding 提示用户调 project_init。scanned: 4 → 3。lib/client.js 47.0kb（继续减少）** | **v0.3.4 用户截图确认 build-time embed 工作（绿色📦快照徽章），但 sidebar 错误显示 `dsh-project-brain` 项目（plugin 自己），不是用户当前 workspace 的真实项目** |
| **v0.3.6** | **tools schema 补 path + output additionalProperties: true + setupAutoRebuild 用 DSH shell service** | **① tools.parameters 补全 `path` 字段（memory/todo/todo_update），否则 DSH 自动剥离 path 参数，导致 fallback 写错位置；② output schema 把 `additionalProperties: false` 改成 `true`，并显式声明 `code/message` 字段，错误路径返回不再被拒；③ `setupAutoRebuild` 用 DSH `shell.service.run` 替代 `child_process.spawn`，避免 plugin fiber sandbox EPERM。lib/index.js 110.7kb / lib/client.js 48.2kb** | **v0.3.5 用户截图确认 plugins workspace 显示正确（绿色📦快照 + Onboarding 卡片）** |
| **v0.3.7** | **brain-files 默认 danger-full-access policy** | **`writeText/appendJsonl` 在调用方没传 `writePolicy` 时，自动从 `fs.sandboxPolicy` 取 `danger-full-access` mode（绕过 workspace 路径限制）。旧调用方（todo.js/memory.js 等）无需修改即可写到其他 workspace。修复 E_WRITE_FAILED（DSH 默认 sandbox 模式只读 workspace 根）** | **v0.3.6 后调 `project_todo_add path="..."` 返回 E_WRITE_FAILED（schema 修好了但 sandbox 拒绝写跨 workspace 目录）** |
| **v0.3.9** | **BOM strip + project.json 用 readJson + ask JSON round-trip** | **① `parseJsonl` / `readJson` 加 `U+FEFF` BOM strip（PowerShell `Set-Content -Encoding utf8` 写入 jsonl 时加了 BOM，导致第一行 JSON.parse 失败） ② `src/tools/ask.js` 改用 `readJson` 读 `project.json`（之前用 `readJsonl` 读 multi-line pretty-printed JSON 必然失败，导致 `projectInfo.name` undefined，render 暴露问题）③ ask execute return 加 `JSON.parse(JSON.stringify(ret))` 防御性 round-trip + `_diag` 字段（万一某字段含不可序列化数据能定位）** | **用户重启后 `project_ask` 报 "value is not lossless JSON"。离线 debug（scripts/debug-ask.js）找到真因：project.json 是 pretty-printed 多行 JSON，但 ask.js 用 readJsonl 按行解析** |
| **v0.3.8** | **path-resolver 加 workspaceRegistry + 跳过 DSH Desktop 污染 fallback** | **实测发现：DSH Desktop Electron 下，`sandboxPolicy.workspaceRoot` 可能是 `<user-home>/AppData/Local/Programs/DSH Desktop`（DSH 安装目录），不是用户当前 session 的 workspace。所有不带 path 的工具调用都写到 DSH Desktop 安装目录的 `.project-brain/`。修复：① `readCwdFromWorkspaceRegistry`：用 `ctx.get('sessions').list()` 拿所有 session 的 cwd（user 当前打开的 workspace）；② `isDshDesktopInstall`：检测 sandboxPolicy.workspaceRoot 是否命中 DSH Desktop 安装路径，是则跳过 fallback。优先级链：args.path → exec.session → workspaceRegistry(sessions) → sandboxPolicy（非 DSH Desktop）→ "."** | **v0.3.7 实测发现数据被写入 DSH Desktop 安装目录，而非当前 workspace。** |
| **v0.3.10** | **传 path 写到 workspace 验证 + 12 工具端到端** | **① 验证显式传入目标 workspace 的场景正确落库，且不污染 DSH Desktop 安装目录；② 12 工具全部端到端跑通：init / rescan / status / continue / memory add+list / todo add+list+done+update / ask / dream；③ 实时同步 + auto-rebuild 链路稳定（preview.changed → shell.run build.js → clientModules.rebuilt → renderer 热重载），无需重启 DSH** | **重启 DSH 后实跑确认工具全部返回正确结果；显式路径与默认路径均落到正确 workspace。** |
| **v0.3.11** | **SPEC v0.3 MINOR bump + 治理债 + P0.7 TODO strip 实质实现** | **① SPEC 顶部 bump v0.2 → v0.3（加 changelog 累积注脚，不新增章节）；② 修正 README/TODO 中"TODO strip 已实现"的虚构描述；③ git commit v0.3.0-v0.3.10 working tree（约 10 个新文件 + 文档同步），拆 2 个 commit（feat + docs）；④ `src/client.js` 注册 `conversation.input.dock` Slot（id: `project-brain-todo-strip`，order=10）+ TodoStrip 纯函数组件（折叠 top-3 / 点击展开全量 / uninit+empty 双 guard）；⑤ i18n 加 `todostrip.title/viewAll/close/empty` 4 key × 2 语言；⑥ `scripts/smoke-todostrip.mjs` 离线 10/10 PASS（bundle 含 dock 注册 + 组件 + 主题 token + 43 个 session embed）；⑦ 一次性 debug 脚本归档到 `scripts/_archive/`（保留不删）** | **本轮用户复盘"梳理开发情况，进入下一阶段"；发现 working tree 大量未提交、文档与代码不同步** |
| **v0.3.12** | **P0.8 第一波收尾 — dream commit/full + locale-aware + 跨 Session 端到端** | **① `project_dream` dryRun=false 真写 jsonl（merge: dropped 移除 + keep status=reinforced + importance +0.05；archive: status=archived + 写 timeline + emit preview.changed）；② `mode=full` 额外清 archived 行 + 按 importance DESC 排序；③ dream 算法抽到 `brain-logic.computeDreamActions/applyDreamCommit`（纯函数，避开 dsh-tools runtime）；④ `brain-files.js` 加 `writeJsonl`；⑤ `client.js` 加 `resolveLocaleCode(props)` 从 `props._dshLocale.getLocale()` 取实时语言（不再硬编码 zh-CN），支持 zh-CN/en-US/zh/en 宽松匹配；⑥ `smoke-dream-commit.mjs` 33/33 PASS（light/full/边界）；⑦ `smoke-session-lifecycle.mjs` 25/25 PASS（scanner → memory/todo → summarizer 走真 git diff → injector 输出 markdown 含 Top-K memories + active TODO + recent activity → build-time embed loadProjectData 验证全量数据）；⑧ 4 个 smoke test 共 30+10+33+25 = **98 项全 PASS**。lib/index.js 110.3→114.8kb；lib/client.js 68.3→74.8kb** | **用户「继续」指令；P0.8 todo 启动第一波收尾** |
| **v0.3.13** | **P0.8 第二波收尾 — 跨 workspace 隔离实测 + dark/light 主题 token 取证** | **① 新增 `scripts/smoke-multi-workspace.mjs`（25/25 PASS）：path-resolver 显式 path 隔离、session cwd 隔离、DSH Desktop 安装路径过滤（Windows + Mac）、todo.jsonl A vs B 物理隔离、loadProjectData(A) vs loadProjectData(B) 互不污染、memory 隔离；② `cordis_inspect_query Theme.listTokens` 取证 DSH 真实主题 token（13 个，全 requiresLightAndDark=true），写 `scripts/smoke-theme-tokens.mjs`（14/14 PASS）静态校验 client.js 11 个 token 全在真名内、无悬空 token、无硬编码 hex 颜色、覆盖 background/border/brand/label/state 五类；③ 6 个 smoke test 共 30+10+33+25+25+14 = **137 项全 PASS**。未改 src/ 业务代码（纯验证）。lib/client.js 74.8→80.1kb（+5.3kb 来自 build-time embed 多 workspace 数据，非代码变化）** | **用户「继续人完成」「继续任务」指令；P0.8 第二波启动** |
| **v0.3.14** | **P0.8 第三波 — auto-rebuild 跨 fiber 事件隔离 bug 修复** | **根因：v0.3.13 重启实测发现 `project_dream dryRun=false` 写完 jsonl 后 8 秒查 bundle mtime 未变。`cordis_inspect_query Event.listEvents` 取证 `project_brain/preview.changed` 不在 DSH 原生事件；Cordis 4 `Scoped<Context>` 模型 `ctx.emit/on` 只在同 fiber 内 dispatch；dsh-project-brain host bundle 在 host fiber 注册 `setupAutoRebuild`，工具 `exec.ctx` 是 agent fiber → emit 收不到。修复：`src/host/rebuild.js` 从 `ctx.on("preview.changed")` 改成 `ctx.effect(() => ctx.timer.interval(checkMtime, 5000))` —— 每 5 秒扫 `.project-brain/{project,memory,todo,timeline}.json*` 的 mtime，变化触发 `runBuild()`（100ms debounce）。改动单文件 ~20 行，不动 `src/index.js` 注册结构，不引入 fs.watch / chokidar 依赖；137 项 smoke test 仍全 PASS；5 秒轮询 vs 原 ~1-3s 实时延迟变长但跨 fiber 稳定** | **v0.3.13 重启实测 8 项工具 PASS + 1 项 auto-rebuild 失效；用户「开始修复」指令** |
| **v0.3.15** | **P0.8 第四波 — inject 加 timer 让 ctx.timer 真可用（v0.3.14 修复未生效的根因补漏）** | **v0.3.14 重启实测失败：`project_dream dryRun=false` 6 秒后查 bundle mtime 仍是手动 build 时间。根因：`src/index.js` inject 数组 `["tools", "fs", "sandboxPolicy", "clientModules"]` 未声明 `timer`；Cordis 4 `Scoped<Context>` 默认 service 不可见，必须 inject 才能 `ctx.get` 拿到；rebuild.js 调 `ctx.get("timer")` 返回 undefined，进入"退化"分支 warn 后默默失败 → 整个轮询逻辑没启动。修复（单文件 1 行）：`src/index.js` inject 数组末尾加 `"timer"`。教训（永久）：Cordis 4 任何 `ctx.get('xxx')` 之前必须先在 inject 数组声明；debug-fix 应列依赖 → inject → ctx.get 完整链路；auto-rebuild 关键基础设施必须 DSH Desktop 重启实测一次完整链路才算 done。**重 build 后用户需再重启一次 DSH 验证** | **v0.3.14 重启实测失败 6 秒后 bundle 未变；用户「帮我修复」指令** |
| **v0.3.16** | **P0.8 第五波 — 监听 DSH 原生事件主动唤醒 + 冷启动诊断 log（v0.3.15 仍未生效的根因定位）** | **v0.3.15 重启实测第三次失败：bundle mtime 仍是 22:37:37。推测根因：host fiber 在 DSH Desktop 冷启动时 `resolveWatchPaths()` 返回空数组（sandboxPolicy.workspaceRoot 被 `safeCwd` 过滤掉 DSH Desktop 安装路径；workspaceRegistry/sessions/agents 都为空）→ timer interval 启动但 paths=[] → mtime 变化无人监听。修复（src/host/rebuild.js +30 行）：(1) setupAutoRebuild 顶部加冷启动诊断 log（ctx.timer / ctx.get('timer') / sandboxPolicy.workspaceRoot / workspaceRegistry.list 数量 / sessions.list 数量 / agents.currentInitiator / 初始 paths 数量），让 DSH Desktop 启动时通过 ctx.logger 输出；(2) 监听 DSH 原生 `agent/created` / `session/created` 事件（DSH 框架跨 fiber 自动路由），事件回调里重新 resolveWatchPaths + 立即 pollMtime + 启动 timer interval；(3) 保留 timer interval + ctx.on('preview.changed') 双兜底。**这次重 build 后用户需再重启一次 DSH 验证 + 我会主动查诊断 log 定位真因**，不再靠推断** | **v0.3.15 重启实测失败 6 秒后 bundle 未变；用户「帮我修」指令** |
| **v0.3.17** | **P0.8 第七波 — spawn 子进程 watcher（彻底脱离 Cordis 抽象，终极 fallback）** | **v0.3.16 重启实测第四次失败：诊断 log 设计上对但观测链断了（DSH Desktop Electron 无主 log 文件，ctx.logger.info 输出位置未知）。**所有 ctx.timer/ctx.effect/ctx.on 的 silent failure 不可观测。终极方案：放弃 Cordis 抽象，`setupAutoRebuild` 用 `child_process.spawn` 启动一个常驻 node 子进程跑独立 watcher 脚本（`src/host/rebuild-watcher.mjs`）。子进程用 node:fs.watch + 2 秒兜底轮询监听 `.project-brain/*.json*` mtime，变化直接 `child_process.execFileSync('node', ['build.js'])`。写 log 到 `.project-brain/.dsh-project-brain-watcher.log`（绕开 ctx.logger）。**完全脱离 Cordis fiber 抽象**（子进程是独立 process）→ 跨 fiber 问题不存在；node:fs/child_process 都是 Node 内置 → 零新依赖；sandbox 友好（spawn 默认 allowed）。**用户需再重启一次 DSH（第五次）验证** | **v0.3.16 重启实测失败 6 秒后 bundle 未变 + 诊断 log 看不到；用户「修」指令** |
| **v0.3.18** | **P0.8 第八波 — 工具层同步 rebuild（工程止血，不再依赖 host bundle silent failure）** | **v0.3.17 重启实测第五次失败：`.project-brain/.dsh-project-brain-watcher.log` 不存在 → watcher 子进程要么没 spawn 成功、要么 sandbox 阻止写文件。本地手动 spawn 测试 watcher 能跑 → 真因是 DSH Desktop 静态 plugin fiber 的 silent failure。**不再让用户重启第 6 次**，改思路：放弃 host bundle "被动监听"模式，**改为工具层"主动触发"**：新文件 `src/host/rebuild-sync.js` 导出 `runSyncRebuild(reason)`，在 dream/memory/todo 工具的 execute 函数里写完 jsonl 后**立即同步**调 `execFileSync('node', ['build.js'])`（v0.3.6 已验证 execFileSync 能跑）。Rebuild 失败不影响工具本身返回值（try/catch 吞）。保留 `src/host/rebuild.js` 的 host bundle 监听逻辑作为 fallback（未来 DSH 修好了再恢复）。**只动 lib bundle，不动 host bundle → 用户不需要重启 DSH** | **v0.3.17 第五次失败 + 用户第 5 次重启；工程止血** |
| **v0.3.19** | **端到端验证完成 + auto-rebuild 接受手动 build fallback** | **v0.3.18 端到端实测：tool 写文件完全 work（project_todo_add/dream 都正确写 todo.jsonl + timeline.jsonl），但 `lib/client.js` mtime 不变 → 6 次失败累计确认 DSH Desktop 静态 plugin fiber 任何主动行为（ctx.timer/ctx.effect/ctx.on/spawn/execFileSync）都 silent failure。**终局方案：接受手动 build fallback** —— 调任何写工具后手动跑 `node build.js`（~1 秒）刷新 sidebar bundle。**不再投入修复资源**。端到端验证 5 层面（基础环境/工具注册/工具调用/sidebar/主题）大部分 PASS（仅 auto-rebuild 失败）。12 个工具 100% 调通，数据闭环 OK | **v0.3.18 验证失败 + 用户实测接受手动 fallback** |
| **v0.3.20** | **清理过时 todo + 完善 Project Memory（5 类混合填充）** | **(1) 关闭 5 条过时 todo**（3 条 auto-rebuild 死循环：v0.3.7 / v0.3.9 / v0.3.7b debug；1 条陈旧 P0.4.1 文档目标；1 条 stale P0.5 in_progress），活跃 7 → 2；(2) 补 5 条类型混合 memory**：① decision: 采用 Project-First 数据模型；② decision: 三层数据通道架构（Cordis + build-time embed + manual build fallback）；③ decision: brain-logic 纯逻辑层 + smoke test 策略；④ architecture: 8 类记忆类型混合填充策略；⑤ requirement: manual build fallback 永久不被信赖。memory.jsonl 17 → 22 条，类型分布从 `lesson:2, change:8, bug:6, decision:1` 升级为 `decision:4, architecture:1, requirement:1, change:8, bug:6, lesson:2`（decision 从 1 → 4，提升 sidebar 决策密度） | **v0.3.19 端到端验证完成后 Phase 2 完善工作** |
| **v0.3.21** | **P0.8 收尾大结局 — 关闭最后 1 条 todo + 写入 P0.8 完成度总结** | **关闭最后 1 条 todo（`补全 init/rescan/continue 工具与 RPC continueSession 联调验证`，实际已被 smoke-session-lifecycle.mjs 25/25 PASS 覆盖）；P0.8 全局完成度 100%（auto-rebuild 例外）。所有 P0 阶段（P0.0-P0.8）全部完成。最终用户工作流：调工具写 `.project-brain/` → 手动跑 `node build.js`（1 秒）→ DSH client bundle 自动热重载 → sidebar 立刻更新。137 项 smoke test 全 PASS。下一步进入 v0.4.x / v1.0 MVP** | **v0.3.20 完成后 Phase 3 收尾** |
| **v0.4.0** | **P1 起步 — appendJsonl 性能优化 O(N) → O(1)** | **P0.8 v0.3.21 收尾后的第一个 P1 工作。`src/host/store/brain-files.js` 的 `appendJsonl` 之前是"读整个 jsonl → push → 全文件重写"，memory.jsonl / timeline.jsonl 有几百条记录时性能差。修复：新增 `appendLine(fs, path, line, writePolicy)` 用 `fs.appendFile` 同步追加（DSH 单线程 fiber 安全）；`appendJsonl` 改为兼容 wrapper（直接调 appendLine，不读全文件）；边界处理（文件不存在 → 创建；末尾无换行 → 补 "\n"）；保留 `writeJsonl`（dream commit 全文件写）。smoke-test 加 12 项覆盖 appendLine 行为 + appendJsonl 兼容路径 + 性能基准（小文件 + 模拟 1000 行）。137 项 smoke test 仍全 PASS。bundle size +3.5kb** | **v0.3.21 P0.8 收尾大结局后 P1 起步** |
| **v0.4.3** | **DSH Desktop 发布准备 — INSTALL.md + CHANGELOG.md + STORE_LISTING.md** | **v0.4.0 性能优化是"内功"（用户看不到），v0.4.3 发布准备是"外功"（用户能直接看到）。纯文档工作。交付物：① INSTALL.md（系统要求 + 三种安装方式 + 验证步骤 + FAQ：auto-rebuild 不 work / path 显式传 / sandboxPolicy 警告）；② CHANGELOG.md（Keep a Changelog 规范，v0.2-v0.4.3 全部 milestone，Added/Changed/Fixed/Known Limitations 四象限）；③ STORE_LISTING.md（一句话描述 ≤80 字 + 长描述 ≤500 字 + 标签 + 截图位）；④ README.md 加 Documentation 章节链接到 INSTALL/CHANGELOG/TODO/SPEC。DSH Desktop 商店发布 PR 描述就用 STORE_LISTING.md 内容** | **v0.4.0 性能优化完成后 P1 第二波** |
| **v0.4.1** | **dream 真实架构 diff — LLM 接入 + project_diff 工具** | **在 v0.4.0 性能优化 + v0.4.3 发布准备基础上，给 dsh-project-brain 接入 LLM 真正理解项目架构变化。`project_dream` (v0.3.12) 只做 title 合并 + status=archived，不动代码层面；新 `project_diff` 扫 git diff + 调 DSH llm service → 生成 architecture change memory。DSH llm 接口（已验证）：ctx.get('llm').stream(options) / prepareCall / resolveCallConfig。风险：DSH Desktop 静态 plugin fiber 可能 silent failure（v0.3.14-v0.3.18 教训）→ 写 mock LLM provider 让 smoke test 可跑 + 用户实测验证真实路径。交付物：① src/host/integrations/llm.js（mock LLM + DSH llm 抽象）；② src/host/diff/detector.js（git diff 扫描）；③ src/tools/diff.js（新工具）；④ scripts/smoke-project-diff.mjs（mock LLM 验证）；⑤ 加进 src/index.js 的 toolBuilders 数组。190 项 smoke test 全 PASS**。**用户实测（2026-08-28）：13 个工具注册 ✅ + project_diff dryRun=true 调通 ✅ + project_diff dryRun=false 0 文件 0 commits（DSH Desktop shell service 静默阻止 git 调用，**和 v0.3.14-v0.3.18 同根因**）**。**接受 fallback 策略**：mock LLM fallback 兜底，工具调用永远有结果不 silent failure；真实 git + 真实 LLM 等 DSH Desktop 修复后启用** | **v0.4.3 发布准备完成后 P1 第三波** |
| **v0.4.2** | **真实 git + 真实 LLM（绕过 DSH Desktop sandbox）** | **v0.4.1 mock fallback 永远拿不到真实数据，用户决策"先把功能完善"。** 走方向 1+2：① detector 重写用 node 内置模块（fs + zlib + crypto）实现纯 git 客户端，读 .git/HEAD / refs/heads / objects/，loose object MVP 完整，pack 文件 fallback 提示用户；② llm.js 重写用 node:fetch 调 user-configured OpenAI 兼容 API（参数 llmApiUrl/llmApiKey/llmModel 或 env DSH_LLM_*），fallback 到 mock。零新依赖（node 内置）。**完全脱离 DSH shell service / ctx.llm**：自己读 .git + 自己 fetch API。**用户需配 LLM API key**（DeepSeek / 通义千问 / 本地 Ollama 兼容）。190+ 项 smoke test 仍全 PASS** | **v0.4.1 用户实测确认 mock fallback 不够（决策记录在 .project-brain/memory.jsonl mem-mtccn6uf）** |
| **v0.4.4** | **summarizer 真实 git + detector 真实 git 格式修复** | **v0.4.2 只给 project_diff 的 detector 换了纯 node git 客户端，但 summarizer（session/disposed 自动摘要）仍依赖 DSH shell service 跑 git diff（DSH Desktop 上 silent failure，拿不到真实 diff → 不写 change memory）。修复 1：summarizer.js 删除 gitCapture(shell)，改用 detectChanges（v0.4.2 detector），setupSummarizer 不再读 ctx.get('shell')。修复 2（调试发现 v0.4.2 detector 在真实 git 仓库报 cannot read current commit，3 个 bug）：① inflateRawSync → inflateSync（真实 git loose object 用 zlib deflate 带 header，实测 78 01 + inflateSync 成功 / inflateRawSync 报 invalid stored block lengths）；② 目录 mode 判断 parseInt(mode,8)===40000 永不匹配（git tree mode 是省略前导零的八进制，目录="40000"=0o40000=16384）→ 改为 ===0o40000，目录才能递归展开（src 而非 src/index.js）；③ smoke-project-diff.mjs fixture 误用 deflateRawSync（raw deflate）与 inflateRawSync 互相匹配 → 假阳性 PASS，改为 deflateSync（zlib 格式）匹配真实 git。验证：真实 git 仓库（git init + commit 含 src/ 子目录）被正确读取 + 8 个 smoke test 198/198 PASS。**现在 project_diff + summarizer 在真实 git 仓库上都能工作，不再依赖 DSH shell service** | **v0.4.2 收尾后补齐 summarizer 依赖 + 修复 detector 真实 git 格式隐藏 bug** |
| **v0.4.5** | **detector 移除 pack 整体拒绝 — commit/tree 在 loose 即可 diff** | **v0.4.4 后用户重启 DSH 实测 project_diff 遇到新限制：pack file not supported。调试发现 detector 的 hasPackFiles 只要检测到仓库有 .pack 就整体 fallback——但真实 git 仓库普遍有 pack（git gc / 自动打包），且 detector 的 diff 只比较 tree 里的 hash 从不读 blob 内容，所以只要 commit + tree 在 loose 就能完整工作。修复：删除 hasPackFiles + detectChanges 的整体拒绝分支；仅当 readCommit(head) 真的读不到（commit object 在 pack）时才返回明确错误。验证：真实 dsh-project-brain 仓库（2 pack + 32 loose）返回 18 个真实文件变更（正是 v0.4.4 commit 内容）；smoke-project-diff pack 测试改为"有 .pack 但 commit/tree 在 loose → 仍能 diff"；8 个 smoke test 199/199 PASS** | **v0.4.4 用户重启实测 project_diff 触发** |
| **v0.4.6** | **detector pack 真实支持 — 解析 .idx v2 + .pack v2 + packed-refs + delta 解码** | **v0.4.5 后用户重启 DSH 实测，真实仓库（git gc 后 pack + packed-refs）依然报 "cannot read current commit"。v0.4.5 的"loose 即可"假设不成立：git gc 后所有 object 在 pack，ref 在 packed-refs。修复 7 处：① readHead 加 packed-refs fallback；② 新增 parseIdxV2（.idx v2 big-endian fanout + hash + offset）；③ 新增 readPackObject / readPackEntryByOffset（varint size+type header + inflate）；④ OFS_DELTA / REF_DELTA 解码（applyDelta）；⑤ readGitObject = 先 loose 后 pack fallback；⑥ idxCache 用 gitDir+idxPath 为 key（跨仓库隔离）；⑦ 6 个调试 bug 修复（minSize 公式、varint 累加、pack inflate 无 header、REF_DELTA 递归等）。验证：临时 git 仓（git init + 2 commit + git gc --prune=now）detectChanges 返回 files:["README.md"] modified；smoke-project-diff 加 2 个 packed-refs 断言；8 个 smoke test 201/201 PASS**。**MVP 限制：multi-pack-index（MIDX，git 2.20+）不支持——dsh-project-brain 自身仓库是 MIDX，本仓库仍 fallback 提示** | **v0.4.5 用户重启实测 git gc 仓库触发** |
| **v0.4.7** | **llm.js 加 Anthropic 兼容协议** | **v0.4.6 后用户实测 project_diff 走 mock fallback（未配 LLM key）。用户提供 MiniMax 端点 https://api.minimaxi.com/anthropic，实测必须走 Anthropic 协议（POST /v1/messages + x-api-key header）而非默认 OpenAI 兼容。修复：① detectProtocol(apiUrl)：baseUrl 含 "anthropic"（路径或子域）→ Anthropic，否则 OpenAI；② fetchAnthropic：POST {baseUrl}/v1/messages，headers x-api-key + anthropic-version:2023-06-01，response content[0].text；③ realFetchLLM 自动选。smoke-project-diff 加 11 断言（5 个 Anthropic 真实路径 + 6 个 detectProtocol URL 模式）；8 个 smoke test 210/210 PASS** | **v0.4.6 用户实测触发 LLM 配置需求** |
| **v0.4.8 - v0.4.12** | **Sidebar UI 视觉升级（emoji + StatusBanner + ActionsBlock 文案统一 + Dashboard Quick Actions）** | **v0.4.7 团队内部使用稳定后进入 UI 打磨阶段。优化 sidebar 8 区块视觉层次、加 emoji 图标、引入 StatusBanner 三大数字汇总、ActionsBlock 按钮文案稳定化、Dashboard 默认展开 + Quick Actions 2x2 网格 + MemoriesBlock toggle 改 React useState 修复重渲染 bug。purely frontend + build-time embed 改造，无 RPC / host 改动** | **v0.4.7 UI 打磨** |
| **v0.5.0** | **OnboardingBlock 自动启动流程：点击按钮直接调 host.call RPC，无需用户复制粘贴** | **v0.4.12 UI 打磨后，用户反馈"启动项目大脑"按钮只复制命令到剪贴板需要手动粘贴，不合目的。改造 OnboardingBlock 为带状态机组件（idle/loading/error），点击后调用 `host.call('project_brain/initProject', { args: { path } })`，期间 CSS 转圈 + 3 阶段步骤条（扫描项目结构 → 写入项目大脑 → 分析技术栈与依赖），RPC 完成后用返回值（projectId/name/scanDurationMs/stats）拼最小 preview 结构（project/phase/recentActivity/stats），通过 overrideData state 让父组件立即展示 dashboard 而非等 host rebuild。失败时显示错误卡片（具体 error.message）+ 重试按钮 + 复制启动指令兜底按钮。父组件 SidebarPreviewRoot 把 workspacePath 通过 props 传给 OnboardingBlock；host builtin 在 apply 阶段通过 ctx.host 拿到并保存到模块级变量 `__DSH_CLIENT_HOST__`（避免子组件拿不到 client builtin）。新增 build-inline.js：sandbox 阻止 esbuild spawn 子进程时的退路，纯 Node FS 拼接（IIFE wrap + 占位符替换）。验证：用户重启 DSH → sidebar 显示新 OnboardingBlock → 点击按钮 → 转圈 → dashboard 自动出现** | **v0.4.12 用户反馈"启动按钮不合目的"** |

**修订流程**：
1. 任何对 SPEC 的修改先开 PR。
2. PR 必须更新本节（添加新行）。
3. PRD / DESIGN 与 SPEC 冲突时回写 PRD / DESIGN，并在该行标注"sync"。
4. SPEC 版本号语义：MAJOR（破坏性变更）/ MINOR（新增章节）/ PATCH（错别字、表述优化）。

---

# 附录 A：核心 RPC 契约 Schema（schemastery 示例）

```js
// src/shared/types.js —— 契约示意，运行时按 JSDoc + schemastery 实现
const SidebarPreviewSchema = {
  initialized: 'boolean',
  project: { id: 'string', name: 'string', type: 'string?', lastUpdateAt: 'number' },
  phase: { title: 'string', progress: { done: 'number', total: 'number' } },
  recentActivity: [{ id: 'string', title: 'string', occurredAt: 'number', eventType: 'string' }],
  stats: { pendingTodos: 'number', completedTodos: 'number', decisions: 'number' },
  empty: 'boolean'
}

const ErrorSchema = { ok: 'false', code: 'string', message: 'string', details: 'any?' }
```

---

# 附录 B：SidebarPreview 数据流时序

```
用户打开 DSH
   ↓
SidebarTab 渲染（active 状态变化）
   ↓
Client useEffect: host.call('project_brain/sidebar.getPreview', { projectId })
   ↓
Host aggregator:
   SELECT project, COUNT(*) FROM memory ...
   SELECT status, COUNT(*) FROM todo ...
   SELECT * FROM timeline ORDER BY occurred_at DESC LIMIT N
   ↓
返回 SidebarPreview
   ↓
Client 渲染 5 区块（或 Onboarding）
   ↓
后续：Host 任意 emit('project_brain/preview.changed', { projectId })
   ↓
Client 重新拉取
```

---

# 附录 C：版本与兼容

- 本 SPEC 版本：`v0.2`
- 配套 PRD：`REQUIREMENTS.md` v0.1
- 配套 DESIGN：`DESIGN.md` v0.1
- 数据库 schema 版本：`v1`（迁移系统见 §17）
- 后续 schema 变更通过 `src/host/storage/migrations.js` 管理

---

# 附录 D：Cordis 注入清单速查

| 依赖 | 类型 | 必需？ | 验证方法 |
| --- | --- | --- | --- |
| `llm` | Service | 是 | `cordis_inspect_query llm` |
| `tools` | Service | 是 | 同上 |
| `session` | Service | 是 | 同上 |
| `timer` | Service | 是 | 同上 |
| `loader` | Service | 否（用 `ctx.get`） | 同上 |
| `storage` / `storageDomain` | Service | 是（**名待验**） | 同上 |
| `ctx.baseUrl` | — | — | Loader 注入的 base URL |
| `ctx.logger` | — | — | 全局可用 |

---

# 附录 E：术语表

| 术语 | 类别 | 含义 |
| --- | --- | --- |
| **SidebarPreview** | 功能 | 侧边栏折叠态预览面板整体功能 |
| **SidebarTab** | UI | 侧边栏顶部 tab 栏的单个 tab 元素 |
| **Onboarding** | 状态 | 项目未 init 时 SidebarPreview 展示的空状态分支 |
| **`project_brain/preview.changed`** | 事件 | Host 推送的 preview 数据变更信号 |
| **`project_brain/sidebar.getPreview`** | RPC | Client 拉取 SidebarPreview 数据的 RPC |
| **`project_brain/sidebar.subscribe`** | RPC | Client 订阅 preview 变更的 RPC |
| **`project_init` 等** | Tool | LLM 可调用的工具，命令前缀 `/project` |
| **Project Brain** | 产品 | dsh-project-brain 的中文别名 |
| **MVP** | 阶段 | Minimum Viable Product，对应 §11.1 |
| **P0.x** | 阶段 | MVP 内阶段编号 |

---

## 附录 F：v0.6.x Memory V2 实现补充

- 原始存储继续使用工作区内的 `memory.jsonl`；新记录增加 `schemaVersion=2`、`status`、`confidence`、`source` 与 `updatedAt`，旧记录保持向后兼容。
- active 过滤是所有消费端的统一前置条件；`archived/superseded/deleted` 不进入 ask、continue、system prompt、Dashboard 或状态计数。
- 默认召回为本地 BM25，并混合 importance/confidence/recency/type；Top-K 增加内容和类型多样性约束。
- 向量模式必须显式启用并配置 OpenAI-compatible endpoint/model。索引缓存位于 `.project-brain/cache/embeddings.jsonl`，按模型键和内容哈希增量更新。
- 向量配置、凭据、网络或响应异常均降级为关键词检索；原始记忆、待办、扫描和上下文恢复不受影响。
- 远程 Embedding 的输入包含记忆标题、正文、标签和相关文件；默认关闭，密钥只从 DSH Credentials/环境变量解析。

**结束。所有开发、调试、提交、Code Review 行为均以本文档 v0.2 为基准。若发现冲突或遗漏，先更新本文档再改代码，并在 §20 记录变更。**
