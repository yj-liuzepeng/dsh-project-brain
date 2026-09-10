# Pull Request

感谢你的贡献！请尽量填写以下信息，让我们能快速 review。

## 改动类型

- [ ] Bug fix（修复 issue #___）
- [ ] New feature（添加新工具 / 新 UI / 新能力）
- [ ] Refactor（不改变行为的内部重构）
- [ ] Docs（仅文档）
- [ ] Tests（仅测试 / smoke / acceptance）
- [ ] Build / CI（构建 / 工作流）
- [ ] Other: ___

## 改动说明

<!-- 简述做了什么、为什么这么做 -->

## 关联

- 关联 issue: #___
- 关联 discussion: #___

## 自检清单

- [ ] `npm test` 全过（16 / 16 smoke suites）
- [ ] `npm run test:acceptance` 全过（39 / 39 host-acceptance）
- [ ] `npm run build` 成功（runtime-rpc 模式，bundle mtime 与 src 同步）
- [ ] `npm run verify:release` 14 / 14 PASS（包含本 PR 新增的 allowlist）
- [ ] `npm run verify:install` CLEAN_TARBALL_INSTALL_PASS
- [ ] `npm audit` 0 vulnerabilities
- [ ] 涉及 host / client 入口改动 → 已在 `dsh-project-brain/lib/` 重新 build
- [ ] 涉及 README / CHANGELOG → 已同步更新
- [ ] 涉及新用户可见行为 → 已在 CHANGELOG 写明
- [ ] 无敏感信息（API key / 用户名 / 私人项目路径）

## 截图 / 录屏（如有 UI 改动）

<!-- 拖入图片或贴录屏链接 -->

## 测试场景

<!-- 你是怎么验证的；fixture / 命令 / 期望输出 -->