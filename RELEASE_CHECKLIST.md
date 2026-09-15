# 发布检查清单

当前发布版本：`1.3.0`（v1.2.0 的 minor 版本，Durable Core 站立记忆 + 架构并列泳道 + 技术栈分层重构 + 截图从 7 张扩到 10 张）。

## 自动检查

发布前依次执行：

```bash
npm install
npm test
npm run build
npm run verify:release
npm run verify:install
npm audit
```

`verify:release` 会检查版本一致性、Host/Client 入口、DSH patch、npm 文件白名单，以及发布文件中是否出现本机用户路径、临时目录、Session ID、GitHub Token、私钥或项目脑数据。

`verify:install` 会从当前源码生成真实 tarball，在临时空项目中让 npm 正常解析可选 DSH peers 并安装，再验证 Host、Client 和 patch 入口；用于提前发现用户安装时的 `ERESOLVE` 或缺少构建产物问题。

## DSH profile 与客户端人工验收

> v0.7.0-beta.3 起：13 项中 **11 项已通过 `npm run test:acceptance` 自动化覆盖**（39/39 PASS）。
> 详细报告：[ACCEPTANCE.md](./ACCEPTANCE.md)。

- [x] 从干净 profile 安装 GitHub/NPM 包并重启当前 DSH 进程（`verify:install`）
- [x] 普通单仓库初始化、重扫、四个 Dashboard 页签正常（host-acceptance AC-2，13/13）
- [x] Monorepo 初始化后生成职责级架构报告（host-acceptance AC-3，2/2）
- [x] 在两个 workspace 间切换，项目数据和记忆不串台（smoke-multi-workspace 25/25 + host-acceptance AC-4）
- [x] 新建 Session 能自动注入当前项目的关键记忆与待办（host-acceptance AC-5，2/2）
- [x] 结束含稳定决策的 Session 后生成 `session_semantic` 记忆；无路由时仅降级、不影响关闭（host-acceptance AC-6，3/3）
- [x] Quick Action 展示执行中、成功、确认和错误重试状态（host-acceptance AC-7，3/3）
- [x] 当前 DSH LLM 路由可用时显示"DSH LLM 增强"（host-acceptance AC-8，3/3）
- [x] LLM 不可用、超时或 JSON 异常时正确降级为本地分析（host-acceptance AC-9，4/4）
- [x] 默认关键词检索正常；可选 Embedding 配置后混合检索正常（smoke-memory-retrieval）
- [x] 卸载插件不会删除 workspace 中的 `.project-brain/`（host-acceptance AC-11，3/3 + verify:release 文件白名单）
- [x] 在 DSH Web 或承载 Web Client 的 Desktop 环境验证 Dashboard 与 TodoStrip（用户 2026-09-15 实测通过；流程详见 `USER_VERIFICATION.md`）
- [x] 在至少一个非 Web profile 验证 Host 工具兼容性，或明确记录缺失的 required service（**已知限制**：DSH Desktop 0.1.1-rc.2 当前仅支持 `desktop` / `web` / `headless` profile，无 `cli` / `tui` profile，待 DSH 添加后再验证）

## 发布分级

- `0.7.0-beta.2`：可以邀请用户试用并收集不同 DSH 版本、模型和项目类型的反馈。
- 稳定版：完成上述人工验收，补齐商店截图，并至少验证一个普通仓库和一个 Monorepo 后再发布。

## 已知边界

- Session 自动摘要会记录 Git 变化并抽取最多 4 条稳定语义记忆；输入受长度限制且不会包含工具输出，关键意图仍建议显式记录。
- 架构 LLM 依赖当前 Session 已建立可用模型路由；否则自动使用本地分析。
- `project_diff` 的独立 LLM 路径仍需要兼容的 OpenAI 或 Anthropic API 配置。
- Git multi-pack-index（MIDX）尚未完整支持。
