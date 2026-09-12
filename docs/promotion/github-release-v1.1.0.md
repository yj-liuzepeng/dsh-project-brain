# dsh-project-brain v1.1.0 · 双路召回 + RRF 融合

> **次要版本。** 在 v1.0.0 基础上新增双路召回 + Reciprocal Rank Fusion（RRF）融合策略。
> 与 `v1.0.0` 数据完全兼容，工具 API 不变。
> 安装: `dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.1.0`

## 🆕 v1.1.0 是什么

v1.0.0 解决了 7 项 P0 发布阻塞并通过 39 项验收。v1.1.0 在此基础上加入 **双路召回 + RRF 融合** —— 当项目脑配置了 Embedding 服务后，记忆检索会自动从"纯关键词 BM25"升级为"关键词 + 向量"双路融合，融合算法是业界经典的 **Reciprocal Rank Fusion（k=60）**。

**为什么是 RRF**

- 不依赖单一相关性分数（关键词和向量的 score 量纲不同，不能直接相加）
- 双路都命中的文档天然靠前（双路高 rank = 双路高分）
- 算法简单（10 行代码）、无需训练、对参数 k 不敏感（k=60 是经典值）
- 与现有 5 因子加权完美协同：`diverseSelect` 在 RRF 模式下仍生效

**未启用 Embedding 的用户**

行为完全不变，仍是 5 因子加权关键词检索。RRF 是**可选升级路径**。

## ✅ 升级路径

```bash
# 旧（v1.0.0）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.0.0

# 新（v1.1.0）
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.1.0
```

升级后**完全退出 DSH Desktop 并重新打开**。

**数据完全兼容**：`.project-brain/` 所有 JSON / JSONL 与 `v1.0.0` 一致，无需迁移。

## 🌟 v1.1.0 新增能力

### Added

- **双路召回 + RRF 融合**（核心）：`src/host/memory/retrieval.js` 在 `queryVector` 有效时自动启用
- `scripts/smoke-retrieval-rrf.mjs`：15 项 RRF 断言（rrfMerge 边界 / 顺序无关 / 单路缺失 / 加权退回 / diverseSelect / hit 兼容）
- `scripts/embedding-smoke.mjs`：embedding 服务可达性 + 维度一致性
- `scripts/embedding-e2e.mjs`：embedding 端到端验证

### Fixed

- `host-acceptance.mjs` AC-2a 工具数量硬编码 14 → 16（双向同步：本地 + 远程都修了）

### Changed

- smoke suites：16 → 17（新增 RRF）
- acceptance：39 → 39（AC-2a 与 v1.0.0 一致）
- README / README.zh-CN / RELEASE_CHECKLIST / CHANGELOG 同步 v1.1.0

## 🛠 启用双路召回

在 DSH 插件设置（或 `.project-brain/config.json`）中：

```yaml
retrieval:
  mode: hybrid              # keyword | hybrid
  embedding:
    baseURL: https://your-provider.example/v1
    model: your-embedding-model
    apiKeyEnv: PROJECT_BRAIN_EMBEDDING_API_KEY
```

启动后第一次检索会自动用 embedding service 生成 query 向量，第二次起缓存。

## 🧪 验证

```bash
git clone https://github.com/yj-liuzepeng/dsh-project-brain.git
cd dsh-project-brain
git checkout v1.1.0
npm install
npm test                          # 17 / 17 smoke suites
npm run test:acceptance           # 39 / 39 host-acceptance
npm run build                     # runtime-rpc 模式
npm run verify:release            # 14 / 14
npm run verify:install            # CLEAN_TARBALL_INSTALL_PASS
npm audit                         # 0 vulnerabilities
```

## 📚 文档

- [README](./README.md) · [README.zh-CN](./README.zh-CN.md)
- [CHANGELOG](./CHANGELOG.md) 顶部有 v1.1.0 / v1.0.0 完整 migration guide
- [DESIGN](./DESIGN.md) · [SPEC](./SPEC.md)
- [ACCEPTANCE](./ACCEPTANCE.md) · [USER_VERIFICATION](./USER_VERIFICATION.md)

## 💬 反馈

- [Discussions](https://github.com/yj-liuzepeng/dsh-project-brain/discussions) · [DSH 社区展示帖](https://github.com/deepseek-ai/deepseek-harness/discussions/5121)
- [MyDSH 插件市场](https://mydsh.dev/plugin?repo=yj-liuzepeng%2Fdsh-project-brain)
- [Issues](https://github.com/yj-liuzepeng/dsh-project-brain/issues)（请用对应模板：bug / feature / question）

## 🛡 安全

安全问题请走 [GitHub Security Advisories](https://github.com/yj-liuzepeng/dsh-project-brain/security/advisories/new) 私密渠道。

---

构建者：[@yj-liuzepeng](https://github.com/yj-liuzepeng) · 授权：[MIT](./LICENSE)

## 与 v1.0.0 的差异（diff 概要）

```
src/host/memory/retrieval.js    | 144 ++++++++++++++++++++----
scripts/embedding-e2e.mjs       | 109 ++++++++++++++++
scripts/embedding-smoke.mjs     |  50 ++++++++
scripts/run-smoke.mjs           |   1 +
scripts/smoke-retrieval-rrf.mjs | 266 ++++++++++++++++++++++++++++++++++++++
scripts/host-acceptance.mjs     |   2 +- (AC-2a 14→16 双向同步)
6 files changed, 543 insertions(+), 28 deletions(-)
```