# 发布检查清单

当前候选版本：`0.7.0-beta.1`。

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

- [ ] 从干净 profile 安装 GitHub/NPM 包并重启当前 DSH 进程
- [ ] 普通单仓库初始化、重扫、四个 Dashboard 页签正常
- [ ] Monorepo 初始化后生成职责级架构报告
- [ ] 在两个 workspace 间切换，项目数据和记忆不串台
- [ ] 新建 Session 能自动注入当前项目的关键记忆与待办
- [ ] Quick Action 展示执行中、成功、确认和错误重试状态
- [ ] 当前 DSH LLM 路由可用时显示“DSH LLM 增强”
- [ ] LLM 不可用、超时或 JSON 异常时正确降级为本地分析
- [ ] 默认关键词检索正常；可选 Embedding 配置后混合检索正常
- [ ] 卸载插件不会删除 workspace 中的 `.project-brain/`
- [ ] 在 DSH Web 或承载 Web Client 的 Desktop 环境验证 Dashboard 与 TodoStrip
- [ ] 在至少一个非 Web profile 验证 Host 工具兼容性，或明确记录缺失的 required service

## 发布分级

- `0.7.0-beta.1`：可以邀请用户试用并收集不同 DSH 版本、模型和项目类型的反馈。
- 稳定版：完成上述人工验收，补齐商店截图，并至少验证一个普通仓库和一个 Monorepo 后再发布。

## 已知边界

- Session 自动摘要目前根据 Git commit 窗口记录文件变化，不提取完整对话语义。
- 架构 LLM 依赖当前 Session 已建立可用模型路由；否则自动使用本地分析。
- `project_diff` 的独立 LLM 路径仍需要兼容的 OpenAI 或 Anthropic API 配置。
- Git multi-pack-index（MIDX）尚未完整支持。
