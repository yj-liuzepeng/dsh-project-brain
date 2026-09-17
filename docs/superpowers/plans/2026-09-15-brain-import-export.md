# Plan: Project Brain 导入导出 v1.3.1 实施步骤

> 与 SPEC `2026-09-15-brain-import-export.md` 一一对应

---

## 阶段 1：核心模块（host 端，约 400 行）

### 1.1 `src/host/transfer/bundle.js`
- `createBundle({ projectPath, outputPath, fs, includeCache=true })` → 写 zip + manifest
  - 调用 brain-files.js 读取所有 `.project-brain/` 文件
  - 排除项：`.grill/`, `node_modules/`, `.git/`, `tmp-*.txt`, `*.log`
  - sha256 校验每个文件
  - 写 manifest.json
  - 写 zip（用内置 `node:zlib` + 手写 zip central directory，避免引入新依赖）
- `parseBundle({ bundlePath, fs })` → 校验 zip / 读 manifest / 返回文件清单
- `applyBundle({ bundlePath, destProjectPath, fs, sandboxPolicy })` → 备份 → 解压 → 改写 rootPath → 触发 rescan
- `previewBundle({ bundlePath, destProjectPath, fs })` → 返回 impact + confirmToken

**zip 实现策略**：使用 `node:zlib` 压缩每个 entry，手写 EOCD（end of central directory）。无第三方依赖。

### 1.2 `src/host/transfer/backup.js`
- `createBackup({ projectPath, fs, sandboxPolicy })` → 重命名 `.project-brain/` → `.project-brain.backup-<ts>/`
- `listBackups({ projectPath, fs })` → 返回 `[{ ts, path, sizeBytes, memCount, todoCount, timelineCount, createdAt }]`
- `cleanupBackups({ projectPath, keepLast, olderThanMs, fs })` → 删除超限的
- `rollbackBackup({ projectPath, backupTimestamp, fs, sandboxPolicy })` → 把"当前脑"再备份一次 → rename 旧 backup → 当前脑
- `previewRollback({ projectPath, backupTimestamp, fs })` → 返回预览 + confirmToken

### 1.3 工具集中化
- 备份目录命名：`backup-<yyyymmdd-hhmm-sss>`（带毫秒避免冲突）
- confirmToken 由内存 Map 持有，统一在 `src/host/transfer/confirm-tokens.js` 管理（5 分钟 TTL）

---

## 阶段 2：Tool 与 RPC（host 端，约 280 行）

### 2.1 `src/tools/export.js`
```js
buildProjectExportTool({ fs, sandboxPolicy })
  → defineTool({ name: "project_export", ... })
```
- 调 `createBundle`
- 返回 bundle 路径 + manifest 摘要

### 2.2 `src/tools/import.js`
```js
buildProjectImportTool({ fs, sandboxPolicy })
  → defineTool({ name: "project_import", ... })
```
- `dryRun=true` → 调 `previewBundle`，返回 impact + confirmToken
- `dryRun=false` → 校验 confirmToken → 调 `applyBundle`
- confirmToken 由内存级 Map 持有（带过期时间 5 分钟）

### 2.3 `src/tools/cleanup-backups.js`
```js
buildCleanupBackupsTool({ fs, sandboxPolicy })
  → defineTool({ name: "project_cleanup_backups", ... })
```

### 2.4 `src/tools/rollback-backup.js`（新增）
```js
buildRollbackBackupTool({ fs, sandboxPolicy })
  → defineTool({ name: "project_rollback_backup", ... })
```
- `dryRun=true` → 校验 backupTimestamp 对应的目录存在 + 列出元信息 → 返回 preview + confirmToken
- `dryRun=false` → 校验 confirmToken → 把"当前脑"再备份一次 → rename backup → 当前脑 → rescan

### 2.5 `src/host/rpc/sidebar.js` 增加 7 个 handler
- `project_brain/export.run`
- `project_brain/import.preview`
- `project_brain/import.apply`
- `project_brain/backup.list`
- `project_brain/backup.cleanup`
- `project_brain/backup.rollback.preview`
- `project_brain/backup.rollback.apply`

### 2.6 `src/index.js` 串联
- 导入 4 个 Tool 工厂
- 在 applyImpl 内调用 `registerConnectionRpc` 时挂载 7 个 handler

---

## 阶段 3：Client UI（约 200 行）

### 3.1 `src/client.js` HeaderBlock 改造
- 当前结构：图标 + 项目名 + techStack chip 一行；下面 description；再下面「上次更新」
- **改造**：在第一行（图标+项目名+chip）后面追加右侧三个图标按钮（绝对定位右侧）
  - 💾 备份：调 `host.call("project_brain/export.run", {...})`
  - 📥 恢复：调 `host.call("project_brain/import.preview", {...})`
  - ↶ 回滚：调 `host.call("project_brain/backup.list", {...})` → 弹备份列表对话框
- 加 PreviewDialog 组件（fixed 居中弹框，列出 impact，主按钮文案"覆盖并恢复"）
- 加 BackupListDialog 组件（列出 backup，每行显示 ts/记忆数/体积，点击进入回滚预览）
- 加 Toast 组件（fixed 右下角，成功/失败各 1 种）
- 加 state：`previewOpen`, `previewData`, `exporting`, `importing`, `backupListOpen`, `rollbackPreview`

### 3.2 样式
- 复用现有 `var(--dsw-alias-*)` token
- 按钮：`background: var(--dsw-alias-bg-layer-2)`, `borderRadius: 8px`, hover 时 `var(--dsw-alias-brand-primary)` 微染
- 弹框 backdrop：`rgba(0,0,0,0.5)` + 内容卡片
- 主按钮文案统一为「覆盖并恢复」，强调会覆盖当前脑

---

## 阶段 4：测试（约 250 行）

### 4.1 `scripts/smoke-import-export.mjs`
- 用 fixtures 项目（新建 `fixtures-import-export/`）跑 AC-1 ~ AC-8
- 导出 → 解压 → 文件清单校验
- 导入空脑 → 验证
- 导入有脑 → 验证 backup 目录创建 + rescan 触发
- dryRun → 验证不修改文件
- 不匹配的 confirmToken → 验证错误码

### 4.2 `scripts/host-acceptance.mjs` 扩展
- 加 `project_export` happy-path（导出 → 文件存在 → 解压 → manifest 校验）
- 加 `project_import` happy-path（导入 dryRun → apply → rescan → status 正常）

### 4.3 `scripts/cleanup-backups.mjs` 单测（可选，集成到 host-acceptance）

---

## 阶段 5：文档与发布

### 5.1 CHANGELOG.md Unreleased 段
- 写 v1.3.1 bullet：导入导出、备份按钮、清理备份
- 引用 commit SHA

### 5.2 SPEC.md
- §5 加一段（约 15 行）：v1.3.1 导入导出能力
- 更新头部版本号 `v1.3.1`

### 5.3 README.md
- 顶部特性区增加一行："📦 v1.3.1: 导入导出迁移（跨机器同步）"

### 5.4 验收
- `node scripts/run-smoke.mjs` 全过
- `node scripts/host-acceptance.mjs` 全过
- 手测 UI：导出 → 文件 → 恢复 → 预览 → 确认 → 完成 toast

---

## 风险点

| 风险 | 缓解 |
|------|------|
| 手写 zip 兼容性（部分 OS unzip 不认） | 用 zip 标准（store + deflate），不加密；先 unit-test 在 Windows / macOS / Linux unzip |
| 备份目录过大占空间 | 默认永久保留；提供 cleanup tool；CHANGELOG 说明清理策略 |
| 跨机器 rootPath 不一致导致后续 tool 报错 | 强制改写 rootPath + 触发 rescan；rescan 失败不阻断 |
| confirmToken 在内存 Map 中，重启后失效 | 重启后用户必须重新 dryRun；属于可接受行为 |
| cache 内的 embedding 在新机器上语义错 | cache loader 已有自动重建逻辑；不动 |

---

## 排期

| 阶段 | 工时 | 累计 |
|------|------|------|
| 阶段 1（核心模块） | 1.5 天 | 1.5 |
| 阶段 2（Tool + RPC，含 rollback） | 1.5 天 | 3 |
| 阶段 3（Client UI，含回滚弹框） | 1.5 天 | 4.5 |
| 阶段 4（测试） | 0.5 天 | 5 |
| 阶段 5（文档 + 收尾） | 0.5 天 | 5.5 |

总计 ~5.5 工作日。
