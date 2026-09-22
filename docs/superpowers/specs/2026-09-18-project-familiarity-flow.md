# Project Familiarity 链路图

对应设计：[2026-09-18-project-familiarity-design.md](./2026-09-18-project-familiarity-design.md)

一句话：`.project-brain/` 仍是唯一事实源；人第一屏和 Agent 注入共用 `buildProjectBriefing`；变更史是派生图，不是新库。

---

## 1. 读写总览

```mermaid
flowchart LR
  subgraph write [写入]
    INIT[init / 手动 rescan]
    DISP[session/disposed]
    MEM[admitMemory]
    TODO[todo_*]
  end

  subgraph store [存储]
    P[(project.json)]
    A[(architecture.json)]
    M[(memory.jsonl)]
    TD[(todo.jsonl)]
    T[(timeline.jsonl)]
  end

  subgraph derive [派生 禁止当第二事实源]
    B[buildProjectBriefing]
    G[buildSessionGraph]
  end

  subgraph read [读取]
    UI1[第一屏]
    INJ[system prompt]
    UI2[任务动态图]
    GIT[Git Tab]
    ASK[project_ask]
  end

  INIT --> P
  INIT --> A
  DISP --> T
  DISP -->|light / full| P
  DISP -->|full 才改| A
  MEM --> M
  TODO --> TD
  TODO --> T
  P --> B
  A --> B
  TD --> B
  T --> B
  M --> B
  T --> G
  TD --> G
  M --> G
  B --> UI1
  B --> INJ
  M -->|Core| INJ
  G --> UI2
  GIT --> GIT
  M --> ASK
```

---

## 2. Session 结束

```mermaid
flowchart TB
  D[session/disposed]
  D --> INITD{已 init?}
  INITD -->|否| SKIP[不写]
  INITD -->|是| GIT[detectSessionChanges：工作树 mtime + 窗口内 commit]
  GIT --> EXT[LLM：summary + durable]
  EXT --> ADM[admitMemory]
  ADM --> SUM{summary 过 changelog 闸?}
  SUM -->|否| T0[timeline session_summary summary 空]
  SUM -->|是| T1[timeline 结构化 files + summary]
  T0 --> HK[housekeep]
  T1 --> HK
  HK --> SRC{sourceChangeFiles?}
  SRC -->|是| L[scanAndWrite light]
  SRC -->|否| TRIG
  L --> TRIG{architectureTriggerFiles: manifest/入口/增删?}
  TRIG -->|是| F[scanAndWrite full]
  TRIG -->|否| KEEP[不动 stale 标记]
  F -->|失败| LOG[日志 + markArchitectureStale true]
  F -->|成功| CLEAR[scanAndWrite 写 stale=false]
  L -->|失败| LOG
```

---

## 3. 注入组装

```mermaid
flowchart TB
  R[读 brain] --> HK[ensureHousekeepOnRead]
  HK --> BR[buildProjectBriefing]
  BR --> STALE{architectureStale?}
  STALE -->|是| SH[startHere = entrypoints only]
  STALE -->|否| KF[entrypoints + keyFiles ≤ 5]
  SH --> MD[briefing markdown]
  KF --> MD
  MD --> TODO[活跃待办段，空则跳过]
  TODO --> CORE[拼接 Core 全量]
  CORE --> OUT[injector / continue.injection]
```

---

## 4. 主干图派生

```mermaid
flowchart TB
  IN[timeline + todos + memories] --> GRP[按 sessionId；否则按日桶]
  GRP --> GATE{非空摘要 或 files 或 todo/非changelog memory?}
  GATE -->|否| C[collapsedEmptyCount++]
  GATE -->|是| N[trunk 节点]
  N --> LAB{有合格 summary?}
  LAB -->|是| L1[label = 第一句]
  LAB -->|否 有非changelog标题| L2[label = memory/todo title]
  LAB -->|否 有 files| L3[label = 代码有变更（无摘要）]
  N --> TIME[按时间连 time 边]
  N --> EV[todo 闭环 / supersede / rescan∩files]
  EV --> E2[evidence 边]
```
