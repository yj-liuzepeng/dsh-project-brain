# dsh-project-brain v1.0.0 · 首个稳定版本

> **第一个稳定版。** 39/39 端到端验收全过 + 用户实测 DSH Desktop UI 通过。
> npm dist-tag: `latest` (从 `0.7.0-beta.2` 升级)
> 安装: `dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0`

## 🎉 v1.0.0 是首个稳定版本

之前所有发布都是 `0.x` / `beta`，现在通过 39 项端到端验收（16 smoke suite + 23 host-acceptance scenarios），可以放心推荐给所有 DSH 用户使用。

## ✅ 升级路径

- **数据兼容**：`.project-brain/` 全部数据格式与 `0.7.0-beta.2` 完全兼容，无需迁移
- **工具兼容**：16 个 `project_*` 工具的名称、签名与返回值不变
- **配置兼容**：`config.json` 字段兼容，新增字段都有默认值
- **必须重启**：升级后完全退出 DSH Desktop 并重新打开（hot reload 不支持 host bundle 改动）

## 🌟 v1.0.0 与 v0.7.0-beta.2 的差异（仅关键项）

### Fixed（P0 发布阻塞修复）

- `npm install` ERESOLVE 复发（v0.7.0-beta.1 修复过的同类问题）—— 加 `overrides.tree-sitter` 强制统一
- `npm test` 在干净 node 环境 `ERR_MODULE_NOT_FOUND` —— 拆分 `scanAndWrite` 纯逻辑层，去除 `dsh-tools` 对 smoke 的传递依赖
- Windows 下 `execFileSync('npm')` ENOENT —— `npm.cmd + shell: true`，接住 DEP0190
- 单 suite 失败阻断后续 —— `run-smoke.mjs` 改为收集全部失败
- `smoke-append-line` / `smoke-runtime-workspace` / `smoke-theme-tokens` Windows 兼容

### Added

- `@deepseek-ai/dsh-tools` / `@deepseek-ai/schemastery` 加到 devDependencies
- 智能续接 `project_suggest_next`（v0.4.15）—— Session 开始时主动给出"💡 你今天可能想推进 X"+依据
- 技术栈推断大幅扩展（v0.4.14）：JS / Python / Go / Rust 框架与 ORM 补全；techStack 字段支持多值
- 本地 AST 分析支持 6 种语言：JS / Python / Go / Java / Rust / C/C++
- API endpoint + DB schema 跨语言适配
- config.json `languages` 白名单
- `scripts/dev-reload.mjs` 一键开发重载
- `scripts/host-acceptance.mjs` 39 项端到端验收
- `ACCEPTANCE.md` / `USER_VERIFICATION.md` 文档

### Changed

- npm keywords 增加 `dsh-plugin` / `cordis` / `cordis-plugin` / `ai-coding`
- README + README.zh-CN + STORE_LISTING + CHANGELOG 同步 v1.0.0

## 🛠 安装

```bash
# Web / Desktop 通用
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0

# 升级已有用户
dsh plugin --profile web update dsh-project-brain
```

升级后**完全退出 DSH Desktop 并重新打开**。

## 🧪 验证

```bash
git clone https://github.com/yj-liuzepeng/dsh-project-brain.git
cd dsh-project-brain
git checkout v1.0.0
npm install
npm test                    # 16 / 16 smoke suites
npm run test:acceptance     # 39 / 39 host-acceptance
npm run build               # runtime-rpc 模式
npm run verify:release      # 14 / 14
npm run verify:install      # CLEAN_TARBALL_INSTALL_PASS
npm audit                   # 0 vulnerabilities
```

## 📚 文档

- [README](./README.md) · [README.zh-CN](./README.zh-CN.md)
- [INSTALL](./INSTALL.md)
- [CHANGELOG](./CHANGELOG.md)
- [ACCEPTANCE](./ACCEPTANCE.md)
- [USER_VERIFICATION](./USER_VERIFICATION.md)
- [DESIGN](./DESIGN.md) · [SPEC](./SPEC.md)
- [STORE_LISTING](./STORE_LISTING.md)
- [RELEASE_CHECKLIST](./RELEASE_CHECKLIST.md)

## 💬 反馈

- [Discussions](https://github.com/yj-liuzepeng/dsh-project-brain/discussions) · [DSH 社区展示帖](https://github.com/deepseek-ai/deepseek-harness/discussions/5121)
- [MyDSH 插件市场](https://mydsh.dev/plugin?repo=yj-liuzepeng%2Fdsh-project-brain)
- [Issues](https://github.com/yj-liuzepeng/dsh-project-brain/issues)（bug 用 `bug_report.yml` 模板；feature 用 `feature_request.yml`；用法问题用 `question.yml` 或去 Discussions）

## 🛡 安全

发现安全问题请走 [GitHub Security Advisories](https://github.com/yj-liuzepeng/dsh-project-brain/security/advisories/new) 私密渠道，不要在 issue 公开。

---

构建者：[@yj-liuzepeng](https://github.com/yj-liuzepeng) · 授权：[MIT](./LICENSE)