# Durable Core Memory 链路图

对应设计：[2026-09-15-durable-core-memory-design.md](./2026-09-15-durable-core-memory-design.md)

一句话：所有写入进同一扇门 `admitMemory()`；能进 prompt 的只有 Core（`active`）加上 timeline 里的上次会话摘要。

---

## 1. 总览

左边写、中间存、右边读。**写 `memory.jsonl` 事实行只有 `admitMemory`。** `project_diff` / 抽取 / 工具 / 记住 全部进这扇门。向量缓存是派生数据，注入不用。

```mermaid
flowchart LR
  subgraph write [写入]
    U[用户说记住]
    A[project_memory_add]
    S[session/disposed]
    F[project_diff]
  end

  ADM[admitMemory]

  subgraph store [存储]
    M[(memory.jsonl)]
    T[(timeline.jsonl)]
    D[(todo.jsonl)]
  end

  subgraph read [读取]
    I[新 session 注入]
    Q[project_ask]
    L[memory_list / Dashboard]
  end

  U --> ADM
  A --> ADM
  S --> ADM
  F --> ADM
  ADM -->|过门| M
  ADM -->|change / 摘要| T
  ADM -->|issue| D
  M -->|active 全量| I
  T -->|最近 session_summary| I
  M -->|active + dormant| Q
  M -->|默认 active| L
```

---

## 2. 四条写入通道

只有用户原话「记住」免 LLM。Agent 工具、会话抽取、`project_diff` 都是自动通道，必须过门。mock 禁止落盘。

```mermaid
flowchart TB
  subgraph ch1 [通道 1 用户显式]
    IN1["agent/inbox/claimed"] --> RX{"强信号？记住 / 记一下 / remember"}
    RX -->|否| DROP1[不写]
    RX -->|是| C1["candidate · user_explicit"]
  end

  subgraph ch2 [通道 2 Agent 工具]
    IN2[project_memory_add] --> C2["candidate · agent · 永远不算显式"]
  end

  subgraph ch3 [通道 3 会话结束]
    IN3["session/disposed"] --> LLM["一次 LLM：summary + durable 标记"]
    LLM --> C3["durable=true 的条目 · session_semantic"]
    LLM --> SUM["summary 写入 timeline"]
  end

  subgraph ch4 [通道 4 project_diff]
    IN4[project_diff] --> DRY{dryRun 默认 true}
    DRY -->|是| SKIPD[不写]
    DRY -->|否且非 mock| C4["candidate · project_diff"]
  end

  C1 --> ADMIT[admitMemory]
  C2 --> ADMIT
  C3 --> ADMIT
  C4 --> ADMIT
```

弱信号（以后都 / 约定）**当场不写**，最多等通道 3 的 LLM 判断是否耐久。

---

## 3. admitMemory 门

所有通道共用。规则一票否决；LLM 不能推翻规则失败。

```mermaid
flowchart TD
  C[candidate] --> INIT{已 project_init?}
  INIT -->|否| R0[拒绝：不建半残目录]
  INIT -->|是| RULE{ruleGate}

  RULE -->|失败| ROUTE{改道}
  ROUTE -->|changelog 或 change| TL[timeline]
  ROUTE -->|issue| TODO[todo]
  ROUTE -->|其它| DROP[丢弃]

  RULE -->|通过| CH{通道}
  CH -->|user_explicit| DEDUPE[去重 / 冲突]
  CH -->|automatic| LLM{llmConfirm}
  LLM -->|admit=false 或 LLM 挂| DROP2[不写 memory]
  LLM -->|admit=true| DEDUPE

  DEDUPE --> FP{fingerprint 已存在?}
  FP -->|是| SKIP[幂等：不插第二条]
  FP -->|否| EXP{显式 supersedes id?}
  EXP -->|是| SUP[旧行改为 superseded]
  EXP -->|否| NEW[新行 status=active · 标题相似只建议]
  SUP --> NEW
  NEW --> CAP[enforceCoreCap]
  CAP --> FILE[(memory.jsonl)]
```

规则门硬拒绝（可单测）：

- type 不在 `decision | requirement | architecture | bug | lesson`（`context` 仅 `user_explicit`）
- 标题/正文像 changelog（版本号、patch、文件清单、「本次改了 N 个文件」）
- 正文过短，或整段只是本次活动报告（不是标题里出现「刚才」就拒绝）

---

## 4. 状态机

写入成功后只有调度，没有「注入时再截断」。

```mermaid
stateDiagram-v2
  [*] --> active: admit 成功

  active --> dormant: Core 超限，先踢更旧的 active
  active --> superseded: 被新决策替换
  active --> archived: 用户 archive 或回扫硬命中

  dormant --> active: 一般不自动升回
  dormant --> superseded: 被新决策替换
  dormant --> archived: 用户 archive

  archived --> [*]
  superseded --> [*]
```

| status | 含义 | 注入 | ask |
| --- | --- | --- | --- |
| `active` | Core | 全部 | 是 |
| `dormant` | 合格但挤出 Core | 否 | 是 |
| `archived` | 不合格 / 否决 | 否 | 默认否 |
| `superseded` | 已被替换 | 否 | 默认否 |

`archived` ≠ `dormant`：changelog 进 archived；旧但仍为真的决策进 dormant。

---

## 5. 会话结束（summarizer）

Git 只当证据，不再生成 `type=change` 记忆。

```mermaid
flowchart TD
  D["session/disposed"] --> INIT{已 init?}
  INIT -->|否| SKIP[跳过]
  INIT -->|是| BF[backfill：changelog 标题改为 archived]
  BF --> GIT[git diff 当证据]
  GIT --> LLM[一次 LLM]
  LLM --> SUM[timeline session_summary]
  LLM --> LOOP[逐条检查抽取结果]
  LOOP --> DUR{durable 且 grounding 过?}
  DUR -->|否| SKIPM[不写 memory]
  DUR -->|是| ADMIT[admitMemory]
  ADMIT --> CAP[enforceCoreCap]
  GIT -.->|无耐久记忆| SUM
```

---

## 6. 新会话注入

`injector` 和 `project_continue` 共用 `buildInjectionContext()`。不走向量、不做空 query 的 Top-K。

```mermaid
flowchart LR
  START["agent/session-start"] --> READ[读 project / memory / todo / timeline]
  READ --> CORE["全部 active，按 updatedAt 新到旧"]
  READ --> LAST["timeline 最近一条 session_summary"]
  READ --> TODO[活跃 TODO]
  CORE --> MD[system prompt]
  LAST --> MD
  TODO --> MD
```

Prompt 结构：

```text
## Project Brain
### 项目概况
### Core 记忆      ← 只 active，全量，写入时已限 15 / 800 token
### 上次会话      ← 只摘要，不进 memory.jsonl；没有则整段省略
### 活跃 TODO
```

---

## 7. 按需检索（ask / list）

```mermaid
flowchart TD
  Q[用户提问 / memory_list] --> KIND{哪个工具}
  KIND -->|list 默认| CORE[只 active]
  KIND -->|list 指定 layer| MIX[dormant 或 active 加 dormant]
  KIND -->|ask 默认| RET[active + dormant]
  RET --> BM25[BM25 + 重要度/时效]
  BM25 --> VEC{配了 embedding?}
  VEC -->|否或失败| OUT[返回 BM25 结果]
  VEC -->|是| MIX2[可选增强 · 失败仍用 BM25]
  MIX2 --> OUT
```

注入 **不** 走这张图。所以不会再出现「list 一套分、prompt 另一套分」。

---

## 8. 模块落点

```mermaid
flowchart TB
  subgraph admit ["src/host/memory/admit.js"]
    G[ruleGate]
    A[admitMemory]
    C[enforceCoreCap]
    B[backfillMemoryStatuses]
  end

  RT["realtime-memory.js"] --> A
  TOOL["tools/memory.js"] --> A
  SUM["summarizer + session-extractor"] --> A
  A --> G
  A --> C
  SUM --> B

  INJ["injector.js"] --> ASM[buildInjectionContext]
  CON["continue.js"] --> ASM
  ASM --> JSONL[(memory.jsonl)]

  ASK["tools/ask.js"] --> RET["retrieval.js 仅 ask"]
```

---

## 9. Dream：只收拾，不删决策

不是睡觉时再抽一层记忆。会话抽取已经是反射。自动路径禁止标题相似就删行。

```mermaid
flowchart TD
  DISP["session/disposed 写完抽取"] --> HK[housekeepMemories]
  HK --> BF[changelog 标 archived · 行保留]
  HK --> CAP[超限 active 改为 dormant]
  HK --> SUG[相似标题只进建议 不提交]
  BF --> CH{有实际变更?}
  CAP --> CH
  CH -->|否| NOOP[不写文件 不写 timeline]
  CH -->|是| WRITE[写 memory.jsonl + timeline]
```

手动 `project_dream` 默认 dry-run，确认后只执行上图的归档 + evict，仍然不 Jaccard 删除。

---

## 10. 读这张图时记住的三句话

1. **能进 `memory.jsonl` 的，必须像半年后仍为真的句子。** 发版说明、文件清单、本次改了什么，只进 timeline。
2. **门在写入时关死，不在注入时碰运气。** Core 超限先踢旧的 active；本轮新写入免驱逐。不合格 → `archived`；只有显式 supersede 才替换。收拾房间不删决策。
3. **新 session 只带 Core + 上次摘要。** 旧决策要回顾，用 `project_ask` 搜 dormant，不要把档案塞进 system prompt。
