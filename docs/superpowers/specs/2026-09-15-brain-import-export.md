# SPEC: Project Brain 导入导出（v1.3.1）

> 状态：Draft → Active（user approval pending）
> 日期：2026-09-15
> 关联：v1.3.0 Durable Core 站立记忆 + 用户跨机器同步场景的真实痛点

---

## 1. 目标

为 dsh-project-brain 补齐「导出 bundle → 文件传递 → 导入 bundle」的能力。**核心场景是单项目跨机器同步**（公司/家里两台机器开发同一项目），不解决多项目批量、团队共享、P2P、加密传输等需求。

**为什么是 v1.3.1 (patch)**：纯加法功能，不破坏 v1.3.0 数据格式与工具 API，向后兼容。

---

## 2. 范围与非目标

### 范围内
- 单项目的 `.project-brain/` → zip bundle → 还原到另一台机器
- 导出时全量（含 `timeline.jsonl` + `cache/`）
- 导入时自动备份当前脑 → 改写 `rootPath` → 触发 rescan
- Dashboard 顶部"备份 / 恢复"按钮
- 两个新 Tool：`project_export`、`project_import`
- 导入预览（dry-run）返回影响清单，用户确认后才实际写入
- 新 Tool：`project_cleanup_backups`（按需清理历史备份）

### 不做
- 多项目批量导出（out of scope）
- 共享文件夹监听 / 自动同步（out of scope）
- 端到端加密 bundle（v1.x 不做）
- 跨大版本迁移（v0.x ↔ v1.x）
- 第三方工具导入（Cursor/Cline/Aider）
- 删除脑数据工具（独立需求，本次不做）

---

## 3. bundle 格式

**文件命名**：`dsh-brain-<sanitizedProjectName>-<yyyymmdd-hhmm>.zip`

例：`dsh-brain-my-app-20260915-1430.zip`

**ZIP 内结构**：

```
dsh-brain-my-app-20260915-1430.zip
├── manifest.json
└── .project-brain/
    ├── project.json
    ├── memory.jsonl
    ├── todo.jsonl
    ├── timeline.jsonl
    ├── architecture.json
    └── cache/
        └── ...
```

**`manifest.json` 契约**：

```json
{
  "schemaVersion": 1,
  "pluginVersion": "1.3.1",
  "exportedAt": 1757928600000,
  "sourceProject": {
    "id": "brain-xxx",
    "name": "my-app",
    "rootPath": "C:\\work\\my-app",
    "lastScannedAt": 1757928000000
  },
  "checksum": {
    "algorithm": "sha256",
    "files": {
      "project.json": "abc123...",
      "memory.jsonl": "def456...",
      "todo.jsonl": "...",
      "timeline.jsonl": "...",
      "architecture.json": "...",
      "cache/embedding.json": "..."
    }
  },
  "options": {
    "includeCache": true
  }
}
```

**排除项**（打包时不进入 zip）：`.grill/`、`node_modules/`、`.git/`、`tmp-*.txt`、`*.log`、`debug.log`。

---

## 4. 行为契约

### 4.1 导出 `project_export`

**输入**：
- `path?: string`（项目根路径；默认从 session cwd 推断）
- `outputPath?: string`（目标 zip 路径；默认用户选择或 `<projectRoot>/dist-backups/...`）
- `includeCache?: boolean`（默认 true）

**输出**（`ok: true`）：
```ts
{
  ok: true,
  data: {
    bundlePath: string,
    bundleSize: number,
    manifest: { ... },        // 完整 manifest
    fileCount: number,
    durationMs: number
  }
}
```

**错误码**：
- `E_BRAIN_NOT_FOUND`：项目未初始化
- `E_BUNDLE_WRITE_FAILED`：zip 写入失败
- `E_PERMISSION_DENIED`：目标路径无写权限

### 4.2 导入 `project_import`

**输入**：
- `path?: string`（目的地项目根路径）
- `bundlePath: string`（bundle zip 路径）
- `dryRun?: boolean`（默认 false）
- `confirmToken?: string`（与 dryRun 配套，第二次调用时必须与第一次 dryRun 返回的 token 一致）

**输出**（`dryRun=true`）：
```ts
{
  ok: true,
  data: {
    mode: "preview",
    manifest: { ... },
    impact: {
      currentBrainExists: boolean,
      currentProjectId: string | null,
      currentMemories: number,
      currentTodos: number,
      currentTimeline: number,
      currentArchitecture: boolean,
      incomingMemories: number,
      incomingTodos: number,
      incomingTimeline: number,
      backupPath: string | null,  // 若 currentBrainExists，将要备份到的路径
      rootPathRewrite: { from: string, to: string },
      confirmToken: string          // 调用方下次传回
    }
  }
}
```

**输出**（`dryRun=false`，confirmToken 校验通过）：
```ts
{
  ok: true,
  data: {
    mode: "applied",
    backupPath: string | null,
    rescanTriggered: boolean,
    durationMs: number
  }
}
```

**错误码**：
- `E_BUNDLE_NOT_FOUND`：bundle 文件不存在
- `E_BUNDLE_INVALID`：zip 损坏 / manifest 缺失 / schemaVersion > 当前支持版本
- `E_BUNDLE_CHECKSUM_MISMATCH`：解压后文件 sha256 与 manifest 不一致
- `E_CONFIRM_TOKEN_REQUIRED`：dryRun=false 但未传 confirmToken
- `E_CONFIRM_TOKEN_MISMATCH`：confirmToken 与最近一次 dryRun 不一致

### 4.3 清理备份 `project_cleanup_backups`

**输入**：
- `path?: string`
- `keepLast?: number`（保留最近 N 个；默认 3）
- `olderThanMs?: number`（删除超过 X 毫秒的；默认 30 天）

**输出**：
```ts
{
  ok: true,
  data: {
    candidates: string[],
    deleted: string[],
    kept: string[]
  }
}
```

### 4.4 回滚到本地备份 `project_rollback_backup`

**目的**：从 `.project-brain.backup-<ts>/` 还原成 `.project-brain/`。与导入 bundle 不同，**回滚是项目本地操作**（不读取外部文件）。

**输入**：
- `path?: string`（项目根路径）
- `backupTimestamp: string`（必填；形如 `20260915-143022-345`，对应目录名 `.project-brain.backup-20260915-143022-345/`）
- `dryRun?: boolean`（默认 false）
- `confirmToken?: string`（与 import 一致的两步机制）

**前置条件**：
- `.project-brain.backup-<backupTimestamp>/` 存在
- 当前 `.project-brain/`（若有）先备份到新的 `.project-brain.backup-<now>/`（**回滚前再备份一次**，形成完整历史链）

**输出**（`dryRun=true`）：
```ts
{
  ok: true,
  data: {
    mode: "preview",
    sourceBackup: { ts, path, createdAt, sizeBytes, memCount, todoCount, timelineCount },
    currentBrain: { exists, lastUpdateAt, memCount, todoCount } | null,
    willBackupCurrentTo: string | null,  // 回滚前会再备份一次
    confirmToken: string
  }
}
```

**输出**（`dryRun=false`，confirmToken 校验通过）：
```ts
{
  ok: true,
  data: {
    mode: "applied",
    restoredFrom: string,
    preRollbackBackupPath: string | null,
    rescanTriggered: boolean
  }
}
```

**错误码**：
- `E_BACKUP_NOT_FOUND`：指定 timestamp 的备份不存在
- `E_BACKUP_INVALID`：备份目录缺少必要文件（project.json 等）
- `E_CONFIRM_TOKEN_REQUIRED` / `E_CONFIRM_TOKEN_MISMATCH`：同 import

---

## 5. Host RPC 与 Client UI

### 5.1 Host RPC（`harness.handle`）

- `project_brain/export.run({path, outputPath?, includeCache?})` → 同 `project_export`
- `project_brain/import.preview({path, bundlePath})` → 同 `project_import(dryRun=true)`
- `project_brain/import.apply({path, bundlePath, confirmToken})` → 同 `project_import(dryRun=false)`
- `project_brain/backup.list({path})` → 列出所有 `.project-brain.backup-<ts>/`
- `project_brain/backup.cleanup({path, keepLast?, olderThanMs?})` → 同 `project_cleanup_backups`
- `project_brain/backup.rollback.preview({path, backupTimestamp})` → 同 `project_rollback_backup(dryRun=true)`
- `project_brain/backup.rollback.apply({path, backupTimestamp, confirmToken})` → 同 `project_rollback_backup(dryRun=false)`

### 5.2 Client UI

**位置**：`HeaderBlock` 内（Dashboard 顶部），与项目名 / 技术栈 chip 同行，靠右（在红框位置）。

**组件**：三个图标按钮（从左到右）
- 💾 「备份」 → 调 `export.run` → 进度条 → 完成 toast（带 bundle 路径）
- 📥 「恢复」 → 调 `import.preview` → 弹预览对话框（显示 impact）→ 用户点「覆盖并恢复」→ 调 `import.apply` → 进度条 → 完成 toast
- ↶ 「回滚」 → 调 `backup.list` → 弹备份列表对话框（按时间倒序）→ 用户选一个 → 调 `backup.rollback.preview` → 弹回滚预览（**再次点「覆盖并恢复」**）→ 调 `backup.rollback.apply` → 完成 toast

**按钮文案统一使用「覆盖并恢复」**（不用「确认恢复」），强调会覆盖当前脑，避免用户误点。

**预览对话框内容**（人话化，符合用户偏好）：
- "将覆盖当前脑（X 条记忆 / Y 个待办 / Z 条 timeline）"
- "旧脑已自动备份到 `<路径>`，随时可手动回滚"
- "bundle 来自 `<sourceProject.rootPath>`，本次将改写到 `<currentProject.rootPath>`"
- "完成后会自动重新扫描项目，失败不阻断"

**样式**：与现有 chip 一致（`var(--dsw-alias-*)` 主题 token），圆角 8px，hover 时显示 tooltip。

---

## 6. 失败模式与兜底

按用户偏好「任何兜底/降级必须附原因+操作建议」：

| 场景 | 兜底行为 | 提示文案 |
|------|---------|---------|
| bundle schemaVersion > 当前支持版本 | 拒绝导入 | "bundle 由更新版本 dsh-project-brain v1.5.x 导出，当前插件 v1.3.1 不支持。请先升级插件再导入。" |
| bundle checksum 不匹配 | 拒绝导入 | "bundle 文件损坏或传输不完整，请重新导出再传。" |
| 目的地脑不存在（首次导入） | 直接写入 | "这是该项目首次导入，旧脑无备份可建。" |
| 导入后 `project_rescan` 失败 | 不回滚脑，写入 timeline 事件 `import:success-with-rescan-failed` | "脑数据已写入，但自动重扫失败，原因：<err>。建议：手动调 /project_rescan。" |
| ZIP 内 cache/embedding 不兼容 | cache loader 自动重建（已有逻辑） | 不提示（透明降级） |
| 用户在导入中途取消对话框 | 状态保留（dryRun 已返回，未 apply） | 再次点"恢复"仍可继续 |

---

## 7. 验收清单（DoD）

- [ ] AC-1 导出 → bundle 文件存在 → 解压 → 文件清单与 `.project-brain/` 完全一致（sha256 一致）
- [ ] AC-2 导入空项目（无脑）→ 直接生效，无 backup 目录，timeline 写入 `import:first-time` 事件
- [ ] AC-3 导入有脑项目 → 旧目录被备份成 `.project-brain.backup-<ts>/` → 新目录正确写入 → `project_status` 正常读取
- [ ] AC-4 `dryRun=true` 不修改任何文件，返回完整 impact + confirmToken
- [ ] AC-5 `dryRun=false` 但未传 confirmToken → `E_CONFIRM_TOKEN_REQUIRED`
- [ ] AC-6 confirmToken 与最近 dryRun 不匹配 → `E_CONFIRM_TOKEN_MISMATCH`
- [ ] AC-7 manifest.schemaVersion > 当前支持版本 → `E_BUNDLE_INVALID`，错误码区分原因
- [ ] AC-8 rootPath 自动改写为目的地路径，bundle 内的 sourcePath 不影响新脑
- [ ] AC-9 Dashboard 顶部红框位置显示「备份」「恢复」「回滚」三个按钮，与 chip 同行不换行
- [ ] AC-10 导入预览对话框与回滚预览对话框，主按钮文案统一为「覆盖并恢复」
- [ ] AC-11 导入预览对话框显示「将被覆盖的记忆/待办/timeline 数」+ 「旧脑备份路径」+ 「路径改写」三项
- [ ] AC-12 「回滚」按钮 → 弹备份列表（按 ts 倒序，含每条记录的 ts / 记忆数 / 体积）→ 选一个进入回滚预览
- [ ] AC-13 回滚预览显示「旧脑将被再备份一次到新 backup」+ 「旧 backup 将被还原成当前脑」
- [ ] AC-14 回滚完成 → 当前脑 = 旧 backup 内容；旧的"当前脑"在新的 backup 目录里可继续回滚
- [ ] AC-15 smoke 测试：新建脚本 `scripts/smoke-import-export.mjs`，覆盖 AC-1 ~ AC-8 + rollback
- [ ] AC-16 host-acceptance.mjs 增加 3 个工具的 happy-path 测试（export / import / rollback）
- [ ] AC-17 CHANGELOG.md Unreleased 段写完 v1.3.1 说明
- [ ] AC-18 SPEC.md §5 章节加一段 v1.3.1 导入导出能力描述（最小变更）
- [ ] AC-19 README.md 顶部增加一行 v1.3.1 新特性 bullet

---

## 8. 实现路径（高层）

1. **新文件 `src/host/transfer/bundle.js`**：导出打包 / 导入解压 / manifest 读写 / sha256 校验
2. **新文件 `src/host/transfer/backup.js`**：备份目录创建 / 列举 / 清理
3. **新文件 `src/tools/export.js` + `src/tools/import.js` + `src/tools/cleanup-backups.js`**：三个 Tool 工厂
4. **`src/host/rpc/sidebar.js`** 增加 5 个 RPC handler
5. **`src/index.js`** 注册 3 个 Tool + 5 个 RPC
6. **`src/client.js` `HeaderBlock`**：加两个图标按钮 + 预览对话框 + toast
7. **`scripts/smoke-import-export.mjs`**：端到端 smoke
8. **`scripts/host-acceptance.mjs`**：扩 2 条用例
9. **CHANGELOG.md / SPEC.md / README.md** 同步

预计 ~600 行新代码（含 smoke 测试 + 文档）。
