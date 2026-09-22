# Grill: dsh-project-brain 导入导出迁移功能
Date: 2026-09-15

## Intent
为 dsh-project-brain 插件补齐「导入导出迁移」能力，支持单项目跨机器同步：用户在一台机器导出 `.project-brain/` → 手动传文件 → 在另一台机器导入还原。

## 场景约束（已锁定）
- **核心场景**：单项目跨机器同步/迁移（非多项目批量、非纯备份回滚）。
- **传输方式**：导出到本地文件 + 用户自传（USB / Git commit / 网盘 / 微信均可）。不做共享文件夹监听、不做 P2P、不做 Git 集成。
- **使用边界**：跨机器意味着 sourcePath ≠ destPath；同一机器多次导入会触发 conflict。

## Key decisions

- **Decision**：bundle 范围 = 全量（含 timeline + cache）。
  Reason：跨机器后体验一致；体积不是首要问题。
  Alternative：去掉 timeline/cache 压缩体积 → 拒绝，因为跨机器后 timeline 缺失会让用户感觉"记忆丢了"。

- **Decision**：物理格式 = ZIP + manifest.json。
  Reason：跨平台、用户可解压查看、未来加 schema 演进有 manifest 锚点。
  Alternative：单 JSON → 拒绝（丢失 jsonl 行序、无法保留 cache 目录结构）。

- **Decision**：conflict 策略 = 默认覆盖 + 自动备份当前 `.project-brain/` → `.project-brain.backup-<ts>/`。
  Reason：跨机器时本地的脑本身就是旧的；备份提供可逆性。
  Alternative：按 id 去重合并 → 拒绝，v1.x 太复杂且语义模糊；三路合并 → 同理拒绝。

- **Decision**：UI 入口 = Dashboard 顶部两个按钮（备份/恢复）+ 两个 Tool（`project_export` / `project_import`）。
  Reason：手动点 + Agent 脚本化两种使用方式都覆盖。
  Alternative：仅 Tool / 仅 UI → 都太局限。

- **Decision**：rootPath 在导入时自动改写为目的地项目根路径。
  Reason：project.json 的 rootPath 在跨机器后必然不同；不改写会让插件误判"脑不属于这个项目"。
  Alternative：保留原路径 → 拒绝（必然导致后续功能异常）。

- **Decision**：导入走"预览 → 确认 → 执行"两步（Tool 支持 `dryRun=true`）。
  Reason：导入会覆盖现有脑；预览给出影响清单（被覆盖的记忆数/待办数等），用户可二次确认。
  Alternative：直接执行 + 备份可逆 → 拒绝，因为预览是零成本的兜底保护。

## Surfaced assumptions
- bundle 内的 cache/embedding 数据直接信任，跨机器可用；缓存格式若不兼容，由 cache loader 自动重建（已有逻辑）。
- bundle 不包含 `.grill/` / `node_modules` / `.git/` 等无关目录（导出时显式排除）。
- 嵌入模型若 source/dest 不同，导出的 embedding 可能语义不准；首次注入若发现 hash 不匹配会触发重建（已支持）。
- 单次导入只针对单个项目；不提供"批量导入多个 bundle"能力（场景不要求）。
- 用户手动迁移，不假设两台机器有网络连接或时间同步。

## Open questions（留待 SPEC 阶段）
- 备份目录保留策略：默认永久保留？or 7 天清理？→ SPEC 中明确。
- manifest.schemaVersion 起步值（v1）→ SPEC 中明确。
- 导入后是否自动调一次 `project_rescan` 校验完整性？→ SPEC 中明确（建议：自动 rescan 但失败不阻断）。
- bundle 文件名规范：`<pluginName>-<projectName>-<yyyymmdd-hhmm>.zip` → SPEC 中明确。
- 旧版本导出（v0.x）→ v1.x 导入的迁移路径：本期不支持（v1.x 是首发）。

## Out of scope
- 多项目批量导出 / 整个 workspace 备份。
- 共享文件夹监听自动导入。
- 端到端加密 bundle（v1.x 不做；如需可后续加）。
- P2P / 局域网设备发现。
- 跨 dsh-project-brain 大版本（v0.x ↔ v1.x）迁移工具。
- 第三方工具导入（如从 Cursor / Cline / Aider 的 memories 导入本插件）。
- 删除已备份的 `.project-brain.backup-<ts>/` 工具。
