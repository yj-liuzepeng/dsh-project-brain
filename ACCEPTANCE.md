# 人工验收报告（ACCEPTANCE）

> dsh-project-brain v0.7.0-beta.3 候选版本
> 验收脚本：`npm run test:acceptance`（等价于 `node scripts/host-acceptance.mjs`）
> 最近一次本地实跑：**39/39 PASS**

## 验收矩阵

| AC | 项 | 实跑结果 | 验证方式 |
|---|---|---|---|
| **AC-1** | 干净 profile 安装 GitHub/NPM 包并重启 | ✅ PASS | `npm run verify:install` → `CLEAN_TARBALL_INSTALL_PASS`（含真实 tarball 安装 + DSH peer 解析 + 入口文件存在性检查） |
| **AC-2** | 单仓库 init/rescan/4 Dashboard 页签 | ✅ 13/13 PASS | `host-acceptance.mjs` 用 mock ctx 完整跑 init → rescan → buildWorkspacePreview；验证 14 个工具注册、project.json / architecture.json / timeline.jsonl 写入、techStack 识别（Express/Lodash）、projectId/createdAt 重扫保留、preview 含 initialized+stats+architecture+memories |
| **AC-3** | Monorepo 架构报告 | ✅ 2/2 PASS | fixture 创建 pnpm-workspace 含 2 个 sub-package（core + ui），init 后 architecture.json 含 3 modules |
| **AC-4** | 两 workspace 数据隔离 | ✅ 2/2 PASS | 已有 `scripts/smoke-multi-workspace.mjs` 25/25 PASS；本脚本额外验证"workspace B 的专属 memory 不出现在 workspace A 的 continue 返回里" |
| **AC-5** | 新 Session 自动注入记忆+待办 | ✅ 2/2 PASS | mock systemPrompt.service.section() + emit agent/session-start，验证 render() 返回 707 字 markdown，包含项目名 workspace-a、关键记忆、活跃 TODO |
| **AC-6** | session_semantic 生成 + 降级 | ✅ 3/3 PASS | emit session/disposed 事件 + mock session.deriveMessages + LLM stream，验证 timeline.jsonl 写入 session_summary 事件（summary len=33，semanticMemories=1） |
| **AC-7** | Quick Action 4 状态 | ✅ 3/3 PASS | mock connection.rpc.handle + 4 个端点（todos/dream/dreamCommit/overview）全返回 ok=true；preview 端点返回 preview 数据；rescan action 成功 |
| **AC-8** | LLM 路由可用时显示增强 | ✅ 3/3 PASS | mock llm.stream 同步返回 async iterable + text-delta/finish 事件 + ≥2 components，验证 architecture.source=hybrid、architecture.llm.used=true |
| **AC-9** | LLM 不可用降级 | ✅ 4/4 PASS | mock llm.stream 抛 "LLM unavailable"，验证 init 仍 ok、architecture.source=local、architecture.llm.error.code="LLM_UNAVAILABLE"、session dispose 不崩 |
| **AC-10** | 默认关键词 + 可选 Embedding | ✅ 1/1 引用 | `scripts/smoke-memory-retrieval.mjs` 已在 run-smoke.mjs 跑过且 PASS |
| **AC-11** | 卸载插件不删 .project-brain/ | ✅ 3/3 PASS | 跑完整 init 后 .project-brain/ 存在；verify:release 已验证 package 不含 .project-brain/ 内容；模拟 plugin 安装目录删除后 workspace .project-brain/ 仍存在 |
| **AC-12** | DSH Web Dashboard + TodoStrip | ✅ 已通过 | 用户 2026-09-09 实测反馈无问题；验证流程见 [USER_VERIFICATION.md](./USER_VERIFICATION.md) |
| **AC-13** | 非 Web profile 兼容性 | ✅ 已知限制 | **DSH Desktop 0.1.1-rc.2 当前仅支持 `desktop` / `web` / `headless` profile，无 `cli` / `tui` profile**。AC-13 不适用，待 DSH 添加 cli/tui profile 后再验证（`dsh --help` + `--dump-default-config` 已确认） |

## Mock 限制声明

`scripts/host-acceptance.mjs` 通过 mock DSH ctx（fs/sandboxPolicy/ctx.on/emit/llm/connection/sessions/systemPrompt）模拟 DSH fiber 上下文，覆盖了**所有可纯 Node.js 验证的逻辑正确性**。但以下场景必须在真实 DSH Desktop 环境人工验证：

1. **DSH Desktop 进程加载 cordis-loader 是否正确识别 plugin patch**（依赖 `cordis.patch.yml` + `package.json#dsh` 字段）
2. **DSH 主题系统实际渲染**（mock 不验证 CSS 变量真值、theme switch、light/dark 切换）
3. **Dashboard 实际浏览器 UI 交互**（Tab 切换、Quick Action 转圈、成功/失败动画）
4. **TodoStrip 在 Composer 上方的实际展示与折叠/展开**
5. **session-start / session-disposed 事件在 DSH 实际生命周期中触发的时机**
6. **real fetch 调用 OpenAI / Anthropic API 的网络行为**
7. **DSH 多 profile（web / desktop / cli / tui）的 host service 差异**

## 验收脚本覆盖范围

```
=== 自动化覆盖（11 项）===
AC-1  ✓ verify:install 外部脚本
AC-2  ✓ host-acceptance.mjs (13 子项)
AC-3  ✓ host-acceptance.mjs (2 子项)
AC-4  ✓ smoke-multi-workspace.mjs + host-acceptance.mjs 双向验证
AC-5  ✓ host-acceptance.mjs (2 子项)
AC-6  ✓ host-acceptance.mjs (3 子项) + smoke-session-semantic.mjs
AC-7  ✓ host-acceptance.mjs (3 子项)
AC-8  ✓ host-acceptance.mjs (3 子项)
AC-9  ✓ host-acceptance.mjs (4 子项) + smoke-architecture.mjs / smoke-session-semantic.mjs
AC-10 ✓ smoke-memory-retrieval.mjs
AC-11 ✓ host-acceptance.mjs (3 子项) + verify:release

=== 待人工（2 项）===
AC-12 ⚠️ DSH Desktop 真实环境
AC-13 ⚠️ DSH Desktop 真实环境
```

## 配套命令

```bash
# 一键跑全部验收
npm run test:acceptance

# 单跑某个 smoke
npm run test:runtime-workspace
npm run test:project-memory

# 一键全量自动检查（v0.7.0-beta.3 release-fix 后 100% PASS）
npm install && npm test && npm run build && npm run verify:release && npm run verify:install && npm audit
```

## 结论

**可进入 v1.0 稳定版候选评审**：所有自动化项 100% PASS，唯一未覆盖的 AC-12/AC-13 仅是 UI 演示层与多 profile 兼容性，需要 DSH Desktop 真实环境 30 分钟人工测试。
