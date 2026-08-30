# 安装 dsh-project-brain

## 公测试用安装

当前 `0.7.0-beta.1` 已具备公开试用条件，代码维护在 [GitHub](https://github.com/yj-liuzepeng/dsh-project-brain)。在进入 DSH 插件市场前，请从 GitHub 克隆并按“本地开发安装”接入；商店发布后可直接搜索 `dsh-project-brain` 安装。Host bundle 安装或升级后都需要完整重启一次 DSH Desktop。

打开任意项目后进入“项目”页，点击“启动项目大脑”。插件会从当前 Session 自动解析 workspace，不需要填写路径或执行构建命令。

## 本地开发安装

```bash
git clone https://github.com/yj-liuzepeng/dsh-project-brain.git
cd dsh-project-brain
npm install
npm test
npm run build
npm run verify:release
npm run verify:install
```

把仓库加入 DSH profile 的 `pnpm-workspace.yaml`，并确保：

```text
~/.dsh/profiles/<profile>/node_modules/dsh-project-brain
```

链接到这个仓库。随后在 profile 的 bundle 配置中启用 `dsh-project-brain`，重新安装 profile 依赖并完整重启 DSH Desktop。

## 验证

安装成功后应看到：

- 顶部“项目”页面和输入框上方 TodoStrip。
- 13 个 `project_*` 工具。
- 新项目点击启动后立即出现项目概览。
- 初始化后 Dashboard 出现项目定位、架构分层、职责组件、运行流程和关键文件导览；右上角标明“本地分析”或“DSH LLM 增强”。
- 切换到另一个项目后显示另一个 workspace 的数据，不需要重新 build。
- Dashboard 标题默认显示“本地检索”；未配置向量模型也能正常查询和恢复记忆。

架构语义分析默认直接使用当前 DSH Session 的模型，不需要单独配置 API，并发送有限关键源码摘要。若模型不可用会显示本地分析和错误码。设 `architectureLlmIncludeSource: false` 可只发送结构事实；设 `architectureLlmEnabled: false` 可完全本地。

完整公测验收项见 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)。首次试用建议至少验证两个不同 workspace，确认切换项目后名称、架构、记忆和待办均随当前项目变化。

## 可选：向量增强

此步骤不是安装必需项。默认本地检索适合多数项目，也不会产生外部 API 成本。

如需语义召回，在 DSH 的插件设置中为 `dsh-project-brain` 设置：

```yaml
retrievalMode: hybrid
vectorEnabled: true
embeddingBaseURL: https://your-provider.example/v1
embeddingModel: your-embedding-model
embeddingApiKeyEnv: PROJECT_BRAIN_EMBEDDING_API_KEY
```

再在 DSH Credentials 中保存同名 credential ref。也可通过进程环境变量提供，但不建议把密钥写进项目文件。对于无需鉴权的本地 OpenAI-compatible 服务，可将 `embeddingApiKeyEnv` 设为空。

首次执行 `project_ask` 时会懒加载索引；之后只重算内容发生变化的记忆。状态可通过 `project_status` 查看，缓存位于 `.project-brain/cache/embeddings.jsonl`。删除该文件只会触发重建，不会删除原始记忆。

## 升级

```bash
git pull
npm install
npm test
npm run build
```

Host bundle 更新后完整重启一次 DSH Desktop。项目数据更新和切换 Session 不需要重启。

## 卸载

从 DSH Desktop 中卸载插件，或移除 profile 中的 package/bundle 配置。卸载不会删除各项目里的 `.project-brain/`，因此重新安装后记忆仍然存在。

如果确实希望清除某个项目的所有长期记忆，请先备份，再手动删除该项目的 `.project-brain/`。这是不可恢复的数据操作，插件不会自动执行。

## 常见问题

### 项目页面提示找不到 workspace

确认该会话确实从 DSH Desktop 中打开了项目目录，然后完整重启 DSH Desktop 以加载最新 Host bundle。正常情况下路径来自 live Session header。

### 项目尚未初始化

进入“项目”页点击“启动项目大脑”，或调用 `project_init`。在正常 DSH Session 中无需传 `path`。

### Sidebar 暂时显示“快照”

说明运行时 Connection RPC 暂时不可用。连接恢复后角标会变为“实时”；发布包中的快照不包含开发者本机项目数据。

### 是否应该提交 `.project-brain/`

个人项目可以提交以便跨机器同步；团队或私有项目应先评估其中的架构决策、Bug 和内部上下文是否适合进入 Git 历史。

通常不建议提交 `.project-brain/cache/`：它是特定模型生成的派生数据，可以随时重建。更换模型或维度时，插件会按模型键自动忽略旧缓存。
