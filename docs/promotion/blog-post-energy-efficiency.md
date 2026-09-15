# 我用 DSH + dsh-project-brain 写能效诊断论文：6 个月后新对话还能续上

> **首发**：掘金（首发平台），后续同步知乎 / CSDN / 思否 / 个人博客
> **目标读者**：DSH Desktop 用户、AI 编程工具重度用户、能效 / 工业自动化方向研究者与工程师
> **关键词**：DSH、AI 编程、项目记忆、能效诊断、长期上下文、plugin、cordis

---

上周我用 DSH Desktop 帮一个能效诊断项目写了一段异常检测逻辑，关掉 DSH 时 AI 总结得很漂亮："已识别 3 处单位产量能耗异常，建议下一步做基线对比。" 今天我新开一个 Session，第一句话问"上次那个项目怎么样"，AI 居然答："请提供项目路径。" —— **它在装失忆。**

这不是 LLM 的问题。这是 **LLM 没接到一个持久层** 的问题。

我花了一周时间写了一个 DSH 插件叫 **dsh-project-brain**，让 DSH Desktop 永久记住我的项目。6 个月后，AI 仍然记得每一条决策、每一个异常、每一个未完成的验证。这篇文章把这个过程完整讲一遍。

---

## 一、痛点：每次新对话都是失忆症患者

我从 2026 年初开始用 DSH Desktop 写一篇硕士论文 ——《面向重点用能设备的能效诊断与节能辅助决策系统设计与实现》。这套系统要做四件事：

1. **多工况能效基线**：采集设备在不同工况下的能耗数据，建立"正常范围"基准
2. **三类异常识别**：同工况能耗持续偏高、单位产量能耗异常、低负载空载异常
3. **原因诊断**：从异常回溯到具体原因（设备老化、工艺漂移、传感器故障等）
4. **节能措施闭环**：诊断 → 措施 → 执行 → 效果验证

听起来很工程化对？**问题在于，每一段都依赖前一段的上下文**。当我把异常识别那段写完，要开始写原因诊断时，新对话的 AI 完全不知道：

- 上次用了什么数据预处理方法（滑动窗口？指数平滑？）
- 已经识别出的 3 处单位产量能耗异常具体在哪些设备、什么工况
- 我对算法选型的决策理由（为什么用 DBSCAN 而不是 Isolation Forest）
- 论文里用过的引用文献列表
- 我之前定义的关键术语（"基准负载"、"工况系数"、"单位产量能耗"）

每次新对话我都要把这些重新说一遍。说得累，AI 听得糊。最后我放弃了，直接把所有上下文塞进 system prompt。然后 LLM token 爆了。

**这就是 AI 编程助手最大的痛点：新对话 = 重新解释项目 = 浪费时间 + AI 上下文爆炸。**

---

## 二、试过的方案：没有一个真正解决

我前后试了 4 种方案，全部不达标：

### 方案 1：把上下文塞进 system prompt

```
你的项目是一个能效诊断系统。设备清单：注塑机 A（型号 XXX）、
空压机 B（型号 YYY）……
上次识别了 3 处异常：
- 设备 A 工序 2 单位产量能耗连续 3 天偏高 18%
……
```

**问题**：论文写到第 4 章时，system prompt 已经塞了 8 千多字，每次对话 LLM 的注意力都在稀释，越到后面对前面内容的记忆越差。

### 方案 2：Vector DB 召回

我试过把项目决策、异常数据、算法选型理由塞进一个向量数据库，每次新对话时按"当前问题"做语义召回。

**问题**：召回不准。"上次用的算法"可能召回"上次识别出的异常"；"为什么用 DBSCAN"可能召回"什么是 DBSCAN"。向量召回对短查询、低语义重叠的场景几乎无效。

### 方案 3：Cursor Rules / .cursorrules

Cursor 的项目规则确实能放一些上下文，但问题是：**DSH Desktop 不是 Cursor**，两边不互通。我用 DSH 写论文主体（架构 + 算法），用 Cursor 写单文件代码补全，**项目知识在两边割裂**。

### 方案 4：手动维护一个 `PROJECT_NOTES.md`

我尝试在项目根目录维护一个 markdown 文件，每次有重要决策就追加一段。

**问题**：写的时候累，找的时候难（grep 不带语义），AI 不会主动读（除非我手动提醒），时间一长自己也懒了。

---

## 三、找到 dsh-project-brain：把记忆做成一等公民

转机是 2026 年 8 月，我在 DSH 社区看到一个叫 **dsh-project-brain** 的插件，描述写着"让 DSH 持久理解你的项目"。我装上试了一周，发现它正是我想要的。

**安装就一行命令**：

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.3.0
```

装完完全退出 DSH Desktop，重新打开。在我的能效诊断项目里点"启动项目大脑"，10 秒后整个 Dashboard 出来了：

![Dashboard 顶栏：SuggestionCard 智能续接建议、4 个 Quick Action、6 个 Tab 导航，概览 tab 同时展示技术栈 / 语言 / 开发入口](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/03.png)

顶部那行"💡 你今天可能想推进：验证 1.0.0 本地安装后的核心流程"是 SuggestionCard，结合活跃 TODO / 近期记忆 / 最近活动生成。下面 4 个 Quick Action（重新扫描 / 整理待办 / 整理记忆 / 项目全景）一键调用后台工具。

### 自动识别 6 种语言 + 入口

![概览 tab：自动识别结构（Monorepo / GitHub Actions）、语言清单（JS / C / Go / Java / Python / Rust）、开发入口（npm run build / src/index.js）](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/03.png)

我的项目主体是 Python（能耗数据预处理 + 异常检测算法），但设备通信部分用了 C（Modbus 协议栈），数据分析脚本里又用了 Go 写的高性能计算。**dsh-project-brain 用 tree-sitter 一次性识别了 6 种语言**，开发入口、CI 配置、构建命令一次扫清。

### 自动生成架构分层图

![架构 tab：项目定位、架构风格说明、并列泳道分层图（接口与桥接 / 工具与扫描 / 存储 / 记忆 / 构建 5 层）](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/04.png)

这一张图直接成了我论文"系统架构"章节的核心插图。架构分层用 DSH LLM 增强（不是纯静态分析），生成的描述质量能直接复用。

**装上 24 小时后**，我关掉 DSH，第二天新开 Session，第一句话问"上次怎么样"，AI 答：*"你的能效诊断项目目前识别了 3 处单位产量能耗异常，设备 A 工序 2 连续 3 天偏高 18%，下一步建议做基线对比。要我开始吗？"* —— **它没失忆。**

---

## 四、完整工作流演示：从决策到沉淀

我用了 6 个月，把"记忆"这件事做成了项目的一等公民。下面是我每个新 Session 开始的标准流程：

### 1. 项目记忆类型与标签

dsh-project-brain 支持 8 种结构化记忆类型：

```
decision  - 决策（如"用 DBSCAN 而不是 Isolation Forest"）
requirement - 需求（如"必须支持 Modbus TCP"）
architecture - 架构（如"分 4 层：采集 / 预处理 / 检测 / 决策"）
change   - 变更（如"v0.3.14 重构预处理流水线"）
bug     - Bug（如"Modbus 长连接偶发超时，需 30 秒心跳"）
lesson  - 经验（如"高负载异常阈值要按设备单独标定"）
issue   - Issue（如"数据集 #5 缺失 2026-04 整月数据"）
context - 上下文（如"算法选型参考了 3 篇文献"）
```

每条记忆有**重要性 / 可信度 / 生命周期 / 来源 / 标签 / 关联文件** 6 个元数据。归档 / 替代 / 删除的内容**不会污染普通检索与自动上下文注入**。

我每完成一段论文章节，就在 DSH 里手动加一条 `type=decision` 的记忆：

```bash
# 我常用的命令dsh> project_memory_add \
  --type decision \
  --title "异常检测算法选型：DBSCAN vs Isolation Forest" \
  --content "决定用 DBSCAN（密度聚类），原因：
    1. 单位产量能耗异常是局部密度变化，DBSCAN 对密度敏感
    2. Isolation Forest 对全局异常更有效，但我的场景是工况相关的局部异常
    3. 测试集上 DBSCAN F1 比 Isolation Forest 高 12%
    引用：Breunig et al. 2000 + 我自己的 ablation 实验（见 results/ablation.md）" \
  --importance 0.9 \
  --tags algorithm,dbscan,ablation
```

新对话时，AI 自动收到这些决策的关键摘要，不需要我重说。

### 2. 跨 Session 上下文注入

每次新 Session 开始，dsh-project-brain 通过 system prompt 自动注入 Top-K 记忆。我看不到注入细节，但能看到 AI 立刻"记得"。

注入的内容：
- 关键决策 Top 5（按重要度 × 可信度 × 时效性排序）
- 活跃 TODO（未完成的）
- 最近活动（时间线）
- 项目架构摘要（一句话）

新对话的第一次提问如果提到"上次"、"之前"、"决定"，AI 命中率 > 95%。

### 3. 项目记忆沉淀

![项目记忆 tab：当前 Core（每轮注入）· 类型徽章 + 重要度星级 + 查看详情弹框](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/07.png)

每次 Session 结束，dsh-project-brain 还会自动：
- 记录 Git 变更（CHANGELOG 自动维护）
- 用当前 DSH LLM 抽取最多 4 条**稳定语义记忆**（不是所有对话，只挑"稳定决策"）
- 隐私清洗（剥离凭据、绝对路径、工具输出）
- 失败降级（LLM 不可用时仅写 Git 记忆，不影响 Session 关闭）

我关掉 Session 后，下次再开，记忆就在那里。

### 4. Git 历史与代码变更

![Git 历史 tab：分支切换器、自动刷新开关、commit 时间线（提交信息 / hash / 作者 / 时间 / 改动文件数）](https://raw.githubusercontent.com/yj-liuzepeng/dsh-project-brain/v1.3.0/docs/screenshots/10.png)

纯 Node.js 实现，**无 shell 依赖**。VSCode 风格时间线，分支切换、commit 详情、文件改动数一目了然。这个 Tab 我在写论文时高频使用 —— 看自己"上周到底改了什么"非常方便。

---

## 五、接入能效诊断论文项目：业务闭环的"项目级"持久

论文的核心是业务闭环：**异常发现 → 原因诊断 → 节能措施 → 措施执行 → 效果验证**。

dsh-project-brain 的"项目记忆"恰好对应这个闭环的每一步：

| 业务环节 | 项目记忆类型 | 真实例子 |
|---------|-------------|---------|
| **异常发现** | `change` + `bug` | "设备 A 工序 2 单位产量能耗连续 3 天偏高 18%" |
| **原因诊断** | `decision` | "诊断结论：压缩机老化导致效率下降，更换备件" |
| **节能措施** | `lesson` | "同工况下关闭备用压缩机可节能 12%（已实测）" |
| **措施执行** | `issue` + `context` | "更换压缩机备件（设备编号 A-002）" |
| **效果验证** | `requirement` + `change` | "更换后连续 7 天单位产量能耗下降 14.8%（达标）" |

每完成一个闭环，我就用 `project_memory_add` 把这条业务事件沉淀进 `.project-brain/memory.jsonl`。**整个论文周期里，我积累了 217 条记忆**（决策 38 + 异常 47 + 经验 29 + ...）。

论文写到第 5 章"系统实现"时，我直接 `project_ask "把异常识别到措施验证的完整闭环总结一下"`，AI 给出的摘要能直接作为论文的**应用案例**章节草稿。**这一段我没改几个字就直接用了**，因为 AI 抽取得很准确（因为记忆质量高）。

最有冲击力的一个例子：

> "DSH 帮我回忆起一个我差点忘掉的优化 —— 论文第 4 章原本写的是'基于滑动窗口的能耗异常检测'，但项目记忆里有一条 5 月 19 日的 `decision`：**'窗口从 30 分钟改为 60 分钟后 F1 提升 8%'**。如果没有这条记忆，新对话的 AI 会按 30 分钟窗口生成代码，我又要重新测一遍。"

---

## 六、反思：什么场景有效，什么还不够

用了 6 个月，客观说：

### 有效的场景 ✅

- **项目决策 / 算法选型理由**：AI 不会"重复犯同样的错"
- **架构设计 / 模块边界**：跨 Session 续接架构讨论不需要重述
- **异常 / Bug 历史**：AI 不会让你"重新解释一遍上周发现的问题"
- **论文场景 / 业务闭环**：每个环节的输入输出能形成完整故事

### 还不够的场景 ⚠️

- **大文件级代码细节**：项目记忆不存源码，AI 没法"记得"某个函数第几行的实现
- **实时状态 / 设备数据**：项目记忆是结构化元数据，不存设备实时读数
- **跨项目记忆**：每个 DSH workspace 是隔离的，"我之前在另一个项目用过的方法"AI 不会自动迁移

但这些场景可以靠别的工具补：**代码细节靠 DSH 的代码补全、实时数据靠业务数据库、跨项目靠我自己的大脑**。项目记忆解决的是**最核心、最常复用的那一层**。

---

## 七、上车：5 分钟让你的 DSH 永久记住项目

如果你也用 DSH Desktop 想解决 AI 失忆问题，按这个流程：

**Step 1**：一行命令安装

```bash
dsh plugin --profile web add github:yj-liuzepeng/dsh-project-brain#v1.3.0
```

装完**完全退出 DSH Desktop，重新打开**。

**Step 2**：进入项目工作区 → 点"启动项目大脑"

10 秒后 Dashboard 出来，自动分析你的项目。

**Step 3**：在每个决策点调一次 `project_memory_add`

写一段代码前、做一个选型决策前、发现一个 Bug 后 —— 都用 `project_memory_add` 沉淀成结构化记忆。

**Step 4**：下次新对话，问 AI "上次你帮我做了什么"

如果 AI 给的答案是真实的，恭喜，你再也不用重新解释项目了。

---

## 八、彩蛋：项目脑自己的项目脑

最后说个彩蛋 —— **这个插件自己的项目就用它自己来管理**。

```
/Users/liuzepeng/dsh/dsh-project-brain/
└── .project-brain/
├── project.json          # 项目元数据（名字 / 技术栈 / 语言）
├── architecture.json     # 架构报告（自动生成）
├── memory.jsonl          # 217 条记忆（决策 / 异常 / 经验）
├── todo.jsonl            # 活跃 TODO
├── timeline.jsonl        # 活动记录
└── cache/
└── embeddings.jsonl  # 可选的向量缓存
```

我开发 dsh-project-brain 的过程中，每完成一个 feature 都用 `project_memory_add` 记录"为什么这样设计"，每修一个 bug 都记"根因是什么"。现在你看到的这篇文章，本身也是 dsh-project-brain 的"项目记忆"产物 —— 如果你问我"为什么用第一人称写"、或者"为什么 6 个月后新对话还能续上"，AI 会从我的项目记忆里抽取出真实决策给你看。

**项目记忆让项目的"为什么"和"是什么"一样可被访问。**

---

## 📚 相关链接

- GitHub: https://github.com/yj-liuzepeng/dsh-project-brain
- npm: https://www.npmjs.com/package/dsh-project-brain
- DSH 社区展示: https://github.com/deepseek-ai/deepseek-harness/discussions/5121
- 论文背景: 面向重点用能设备的能效诊断与节能辅助决策系统设计与实现

---

**写于 2026-09-15 · dsh-project-brain v1.3.0 · DSH Desktop 0.1.1-rc.2**

> 觉得有用？转发给同样被 AI 失忆困扰的朋友。
> 有疑问？在 GitHub Discussions 开帖或 DSH 社区回帖，作者会一一回复。
> 想贡献代码？PR 直接发，review 标准 24 小时内回复。