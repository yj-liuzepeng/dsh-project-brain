# 中文技术博客 4 个选题 + 完整大纲

> **目标平台**：掘金（首选，AI/工具圈流量大）、知乎（长文 SEO）、思否、CSDN
> **推荐字数**：3000-5000 字
> **结构模板**：痛点 → 设计 → 实战 → 反思 → 代码片段

---

## 选题 1（首选）：Host/Client 双层架构

**标题候选**：

1. 「我为什么给 DSH 插件设计 Host/Client 双层架构（v1.0.0 实战）」
2. 「从 0 到 v1.0.0：一个 DSH 插件的架构演进之路」
3. 「DSH 插件开发实战：如何用 Host/Client 分层让文件操作与 UI 解耦」

**大纲**：

```
1. 背景：DSH 插件的特殊性
   - DSH 是 Cordis 框架的桌面应用
   - 插件需要同时操作文件（Node.js）和渲染 UI（浏览器）
   - 不能让 UI 直接调 Node API，也不能让 Node 直接渲染 React

2. 痛点：单层架构的失败尝试
   - 第一版：所有逻辑都在 Host，Client 通过 RPC 调用 → UI 响应延迟
   - 第二版：所有逻辑都在 Client → Node API 调用受限于浏览器安全
   - 第三版（v1.0.0）：Host/Client 严格分工 + Package-private JSON RPC

3. Host/Client 分层原则（附图）
   - Host：所有 Node.js 操作（fs / sandboxPolicy / runtime / llm）
   - Client：所有 React UI（slots / locale / connection）
   - 通信：harness.handle() ↔ host.call()，JSON-only
   - 数据流：Session 事件 → Host 监听 → 写 memory.jsonl → Client RPC 读预览

4. 关键设计决策
   - 把 scanAndWrite 拆到 src/host/scan-and-write.js（纯逻辑，无 dsh-tools）
   - 路径解析强制走 sandboxPolicy，禁止 Client 传路径
   - 持久层路径强制限制在 .project-brain/

5. 代码片段：harness.handle() 实现
   ```js
   harness.handle('project-brain/preview', async (args, ctx) => {
     const workspace = await pathResolver.resolve(args.path ?? ctx.liveCwd)
     return buildWorkspacePreview(workspace)
   })
   ```

6. 验证：39/39 host-acceptance 自动化覆盖
   - AC-2 验证 init / rescan / 4 Dashboard 页签
   - AC-7 验证 Quick Action 4 状态
   - AC-9 验证 LLM 不可用降级

7. 反思：什么能做对 vs 什么还能更好
   - 做对：明确分层让 host/client bundle 互不污染
   - 还能更好：跨 session 的 memory 索引性能还需优化

8. 参考
   - GitHub: github.com/yj-liuzepeng/dsh-project-brain
   - SPEC.md §6（完整接口契约）
   - DESIGN.md §3（架构图）
```

**钩子（开头 200 字）**：

> 你有没有遇到过这种插件：UI 改了要重启整个桌面应用，文件操作要穿透浏览器安全模型，不同 profile 之间行为不一致？我做 dsh-project-brain v1.0.0 时也踩了这些坑，最终找到的答案是 Host/Client 双层架构 + Package-private JSON RPC。这篇文章从失败尝试开始，讲清楚这个架构为什么是 DSH 插件的最优解。

---

## 选题 2：双通道记忆机制

**标题候选**：

1. 「如何让 AI 编程助手记住你的项目：dsh-project-brain 双通道记忆设计」
2. 「Context 持久化的 5 个层次：从 Chat History 到 Project Brain」
3. 「不再重复解释项目：我做了一个让 DSH 永久记住项目上下文的插件」

**大纲**：

```
1. 痛点：每次新对话都要重新介绍项目
2. 5 层记忆模型（业界对比）
   - L1 Chat History：当前 Session 对话历史（Claude / Cursor 内置）
   - L2 Vector Store：长期语义召回（Cursor Rules、Copilot Memories）
   - L3 Project File：项目级元数据（README、CHANGELOG）
   - L4 Project Memory：结构化长期记忆（dsh-project-brain）
   - L5 Tool Logs：工具调用历史（DevTools / OpenTelemetry）
3. dsh-project-brain 双通道设计
   - Channel 1：本地 BM25（零配置默认）
   - Channel 2：可选 Embedding 混合检索（OpenAI / 自建）
4. 记忆类型 8 种（decision / requirement / architecture / change / bug / lesson / issue / context）
5. 生命周期：active / archived / superseded
6. 自动写入路径
   - 用户调 project_memory_add
   - Session 结束自动抽取语义记忆（用当前 DSH LLM）
   - Git 变化自动写 change memory
7. 跨 Session 注入：新 Session system prompt 自动收到 Top-K memories
8. 实战：如何为你的项目搭建记忆
9. 反思：记忆的"遗忘"机制比"记忆"更重要
```

---

## 选题 3：对比评测 Cursor / Copilot / dsh-project-brain

**标题候选**：

1. 「我试了 3 个 AI 编程助手：Cursor / Copilot / dsh-project-brain 哪个最懂你的代码库？」
2. 「AI 编程工具横评：上下文管理能力对比」
3. 「Cursor vs Copilot vs dsh-project-brain：长任务理解能力实测」

**大纲**：

```
1. 评测场景
   - 新加入一个 100k 行 monorepo，让 AI 帮我找到「支付链路」
   - 一周后回来，问 AI「上周的支付改造方案现在到哪一步了」
   - 切换到另一个项目，问 AI「这个项目用了什么架构」
2. Cursor：项目级索引 + Composer，但跨 Session 记忆有限
3. GitHub Copilot：代码补全强，工作区理解弱
4. dsh-project-brain：纯项目记忆，依赖 DSH 框架，但语义+结构化最强
5. 实测：哪个最快、哪个最准、哪个最便宜
6. 结论：组合使用建议
7. 截图对比
```

---

## 选题 4：架构分析算法深度

**标题候选**：

1. 「如何用 DSH LLM 给一个 100k 行的 monorepo 生成架构报告（带代码）」
2. 「6 语言 AST 分析实战：从 tree-sitter 到架构分层图」
3. 「不靠 LLM 也能分析项目架构：本地静态分析降级路径」

**大纲**：

```
1. 背景：DSH LLM 不可用怎么办？
2. 本地降级 3 层
   - L1：manifest 解析（package.json / go.mod / Cargo.toml / requirements.txt）
   - L2：tree-sitter AST 分析（6 语言：JS / TS / Python / Go / Java / Rust / C/C++）
   - L3：import / API endpoint / DB schema 抽取
3. DSH LLM 增强路径
   - 准备：README + manifest + 相对路径 + 受长度限制的源码摘要
   - 提示工程：few-shot + 结构化输出
   - 验证：JSON schema 校验 + 路径安全检查
4. 架构指纹：避免无意义的重复分析
5. 失败兜底：超时 / JSON 异常 / 路径穿越 → 本地降级
6. 实战：分析一个真实 monorepo
7. 代码片段：buildLocalFallback(workspace)
8. 反思：纯 LLM 路线 vs 纯静态分析路线的对比
```

---

## 推荐发布顺序

| 周 | 选题 | 平台 |
|----|------|------|
| W1 | 选题 1（Host/Client 架构） | 掘金 + 知乎 |
| W2 | 选题 2（双通道记忆） | 掘金 + 思否 |
| W3 | 选题 4（架构分析算法） | 知乎 + CSDN |
| W4 | 选题 3（对比评测） | 掘金 + 知乎 |

每篇同步发布到 2 个平台，最大化曝光。

---

## SEO 关键词清单（每篇都要出现）

- dsh-project-brain
- DSH 插件
- Cordis
- AI 编程助手
- 项目记忆 / Project Memory
- AI 编程工具
- Cursor 对比 / Copilot 对比
- DSH Desktop
- 架构分析
- 本地优先 / Local-first