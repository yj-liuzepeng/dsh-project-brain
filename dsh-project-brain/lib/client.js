(() => {
  // src/stack-taxonomy.js
  var RUNTIME_STACK_FIELDS = [
    "framework-frontend",
    "framework-backend",
    "framework-fullstack",
    "webserver",
    "database",
    "cache",
    "queue",
    "search",
    "container",
    "mobile",
    "desktop",
    "auth",
    "api",
    "payment",
    "ai",
    "orm"
  ];
  var DEVOPS_STACK_FIELDS = ["iac", "ci", "observability"];
  var LANGUAGE_NAMES = /* @__PURE__ */ new Set([
    "JavaScript",
    "TypeScript",
    "Python",
    "Go",
    "Rust",
    "Java",
    "C",
    "C++",
    "Kotlin",
    "Scala",
    "Swift",
    "Dart",
    "C#",
    ".NET",
    "PHP",
    "Ruby"
  ]);
  var TECHSTACK_TO_STACK_FIELD = {
    frontend: "framework-frontend",
    backend: "framework-backend",
    fullstack: "framework-fullstack",
    webserver: "webserver",
    database: "database",
    cache: "cache",
    queue: "queue",
    search: "search",
    container: "container",
    mobile: "mobile",
    desktop: "desktop",
    auth: "auth",
    api: "api",
    payment: "payment",
    ai: "ai",
    orm: "orm",
    iac: "iac",
    ci: "ci",
    observability: "observability"
  };
  function isLanguageTech(name) {
    return LANGUAGE_NAMES.has(name);
  }
  function itemsOf(map, field) {
    const value = map && map[field];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return value ? [String(value)] : [];
  }
  function pushUnique(target, field, item) {
    if (!item) return;
    if (!Array.isArray(target[field])) target[field] = [];
    if (!target[field].includes(item)) target[field].push(item);
  }
  function extraOf(map) {
    return itemsOf(map, "_extra").filter((item) => !isLanguageTech(item));
  }
  function partitionStack(stack) {
    const runtime = {};
    const devops = {};
    for (const field of RUNTIME_STACK_FIELDS) {
      const items = itemsOf(stack, field);
      if (items.length) runtime[field] = items;
    }
    for (const field of DEVOPS_STACK_FIELDS) {
      const items = itemsOf(stack, field);
      if (items.length) devops[field] = items;
    }
    return { runtime, devops, extra: extraOf(stack) };
  }
  function fallbackFromTechStack(techStack, existingStructure) {
    const runtime = {};
    const devops = {};
    const structure = Array.isArray(existingStructure) ? existingStructure.slice() : [];
    for (const [key, raw] of Object.entries(techStack || {})) {
      if (key === "_extra") continue;
      const values = Array.isArray(raw) ? raw.filter(Boolean).map(String) : raw ? [String(raw)] : [];
      if (key === "structure") {
        for (const item of values) {
          if (!structure.includes(item)) structure.push(item);
        }
        continue;
      }
      const field = TECHSTACK_TO_STACK_FIELD[key];
      if (!field) continue;
      const target = DEVOPS_STACK_FIELDS.includes(field) ? devops : runtime;
      for (const item of values) {
        if (isLanguageTech(item)) continue;
        pushUnique(target, field, item);
      }
    }
    return { runtime, devops, extra: extraOf(techStack), structure };
  }
  function mergeStructure(structure, techStack) {
    const out = [];
    for (const item of [...Array.isArray(structure) ? structure : [], ...itemsOf(techStack, "structure")]) {
      if (!out.includes(item)) out.push(item);
    }
    return out;
  }
  function previewStackLayers({ stack, techStack, structure }) {
    const partitioned = partitionStack(stack || {});
    const hasRuntime = Object.keys(partitioned.runtime).length > 0;
    const hasDevops = Object.keys(partitioned.devops).length > 0;
    const hasExtra = partitioned.extra.length > 0;
    const mergedStructure = mergeStructure(structure, techStack);
    if (hasRuntime || hasDevops || hasExtra) {
      return {
        runtime: partitioned.runtime,
        devops: partitioned.devops,
        extra: partitioned.extra,
        structure: mergedStructure,
        usedFallback: false
      };
    }
    const fallback = fallbackFromTechStack(techStack || {}, mergedStructure);
    return Object.assign({ usedFallback: true }, fallback);
  }
  var STACK_FIELD_TO_TECHSTACK = Object.fromEntries(
    Object.entries(TECHSTACK_TO_STACK_FIELD).map(([legacy, field]) => [field, legacy])
  );

  // src/client.js
  window.__ModuleLoader__.load({
    id: "dsh-project-brain",
    factory: (require2) => {
      const React = require2("react");
      const NS = "dsh-project-brain";
      const dicts = {
        "zh-CN": {
          "tab.label": "\u9879\u76EE",
          "header.section": "\u9879\u76EE",
          "header.untitled": "\u672A\u547D\u540D\u9879\u76EE",
          "header.lastUpdate": "\u4E0A\u6B21\u66F4\u65B0",
          "phase.title": "\u5F53\u524D\u9636\u6BB5",
          "phase.empty": "\u6682\u65E0\u8FDB\u884C\u4E2D\u4EFB\u52A1",
          "todo.title": "\u5F85\u529E",
          "todo.empty": "\u6682\u65E0\u5F85\u529E",
          "activity.title": "\u6700\u8FD1\u6D3B\u52A8",
          "activity.empty": "\u6682\u65E0\u6D3B\u52A8",
          "memories.title": "\u9879\u76EE\u8BB0\u5FC6",
          "stats.title": "\u6982\u89C8",
          "stats.pending": "\u5F85\u529E",
          "stats.done": "\u5DF2\u5B8C\u6210",
          "stats.decisions": "\u51B3\u7B56",
          "codegraph.title": "\u4EE3\u7801\u7ED3\u6784",
          "codegraph.files": "\u6587\u4EF6",
          "codegraph.edges": "\u4F9D\u8D56\u8FB9",
          "codegraph.langs": "\u8BED\u8A00",
          "codegraph.noLang": "\u6682\u65E0\u8BED\u8A00\u6570\u636E",
          "arch.title": "\u9879\u76EE\u67B6\u6784\u56FE",
          "arch.modules": "\u6A21\u5757",
          "arch.edges": "\u4F9D\u8D56",
          "arch.local": "\u672C\u5730\u5206\u6790",
          "arch.hybrid": "DSH LLM \u589E\u5F3A",
          "arch.select": "\u70B9\u4E00\u5C42\u770B\u540C\u5C42\u6A21\u5757\uFF0C\u70B9\u6A21\u5757\u770B\u804C\u8D23",
          "arch.flows": "\u8FD0\u884C\u8DEF\u5F84",
          "arch.flowEmpty": "\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u8FD0\u884C\u8DEF\u5F84",
          "arch.peersHint": "\u540C\u5C42\u6A21\u5757\u662F\u5E76\u5217\u5173\u7CFB\uFF0C\u6CA1\u6709\u56FA\u5B9A\u5148\u540E\u987A\u5E8F",
          "arch.inspectLayer": "\u5C42\u8BE6\u60C5",
          "arch.inspectModule": "\u6A21\u5757\u8BE6\u60C5",
          "arch.related": "\u534F\u4F5C",
          "arch.runtime": "\u8FD0\u884C\u8DEF\u5F84",
          "arch.empty": "\u8FD8\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u5206\u5C42",
          "arch.purpose": "\u9879\u76EE\u5B9A\u4F4D",
          "arch.risks": "\u67B6\u6784\u63D0\u793A",
          "arch.style": "\u67B6\u6784\u98CE\u683C",
          "arch.layers": "\u67B6\u6784\u5206\u5C42",
          "arch.components": "\u6838\u5FC3\u7EC4\u4EF6",
          "arch.keyFiles": "\u5173\u952E\u6587\u4EF6\u5BFC\u89C8",
          "arch.start": "\u5FEB\u901F\u719F\u6089\u8DEF\u5F84",
          "arch.highlights": "\u8BBE\u8BA1\u8981\u70B9",
          "arch.trigger": "\u89E6\u53D1",
          "arch.outcome": "\u7ED3\u679C",
          "arch.llmFallback": "DSH LLM \u672A\u5B8C\u6210\uFF0C\u5F53\u524D\u5C55\u793A\u672C\u5730\u63A8\u65AD",
          "arch.actionRetry": "\u91CD\u65B0\u626B\u63CF",
          "arch.actionChat": "\u5148\u53D1\u4E00\u6761\u6D88\u606F",
          "arch.actionSettings": "\u68C0\u67E5 DSH \u6A21\u578B\u8DEF\u7531",
          "arch.retrying": "\u91CD\u65B0\u626B\u63CF\u4E2D\u2026",
          "arch.retryDone": "\u5DF2\u91CD\u65B0\u751F\u6210",
          "arch.retryFailed": "\u91CD\u65B0\u626B\u63CF\u5931\u8D25",
          "actions.continue": "\u7EE7\u7EED\u4E0A\u6B21\u5F00\u53D1",
          "actions.openDashboard": "\u6253\u5F00 Dashboard",
          "actions.closeDashboard": "\u6536\u8D77 Dashboard",
          "actions.copied": "\u5DF2\u590D\u5236\uFF0C\u7C98\u8D34\u5230\u8F93\u5165\u6846\u53D1\u9001",
          "actions.copyFail": "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u8F93\u5165",
          "todostrip.title": "\u6D3B\u8DC3\u5F85\u529E",
          "todostrip.viewAll": "\u67E5\u770B\u5168\u90E8",
          "todostrip.close": "\u6536\u8D77",
          "todostrip.empty": "\u{1F389} \u6682\u65E0\u6D3B\u8DC3\u5F85\u529E",
          "onboarding.title": "\u9879\u76EE\u5927\u8111\u672A\u542F\u52A8",
          "onboarding.body": "\u542F\u52A8\u540E\u4F1A\u626B\u63CF\u9879\u76EE\u3001\u751F\u6210\u67B6\u6784\uFF0C\u5E76\u5728\u4E4B\u540E\u7684\u5BF9\u8BDD\u91CC\u81EA\u52A8\u5E26\u4E0A\u8BB0\u5FC6\u548C\u5F85\u529E\u3002\u5FEB\u901F\u4E0A\u624B\uFF0C\u8D8A\u7528\u8D8A\u61C2\uFF0C\u957F\u671F\u628A\u9879\u76EE\u505A\u4E0B\u53BB\u3002",
          "onboarding.cta": "\u542F\u52A8\u9879\u76EE\u5927\u8111",
          "onboarding.f1.title": "\u8BFB\u61C2\u9879\u76EE",
          "onboarding.f1.desc": "\u8BC6\u522B\u6280\u672F\u6808\u4E0E\u5165\u53E3\uFF0C\u751F\u6210\u5206\u5C42\u67B6\u6784",
          "onboarding.f2.title": "\u8DE8\u4F1A\u8BDD\u8BB0\u4F4F",
          "onboarding.f2.desc": "\u65B0\u5BF9\u8BDD\u81EA\u52A8\u5E26\u4E0A\u9879\u76EE\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u7528\u91CD\u590D\u4ECB\u7ECD",
          "onboarding.f3.title": "\u63A5\u7740\u5F80\u4E0B\u505A",
          "onboarding.f3.desc": "\u5F85\u529E\u548C\u8BB0\u5FC6\u7559\u5728\u9879\u76EE\u91CC\uFF0C\u56DE\u6765\u5C31\u80FD\u7EED\u4E0A",
          "onboarding.more": "\u8BB0\u5FC6\u6C89\u6DC0\u3001Git \u5386\u53F2\u53EF\u5728\u542F\u52A8\u540E\u4F7F\u7528",
          "onboarding.copyPrompt": "\u8BF7\u626B\u63CF\u672C\u9879\u76EE\uFF1A\u8C03\u7528 project_init \u5DE5\u5177\u751F\u6210\u9879\u76EE\u5927\u8111",
          "onboarding.copied": "\u5DF2\u590D\u5236\u542F\u52A8\u6307\u4EE4\uFF0C\u7C98\u8D34\u53D1\u9001\u5373\u53EF",
          "loading": "\u52A0\u8F7D\u4E2D\u2026",
          "snapshot.label": "\u5FEB\u7167",
          "snapshot.autoSync": "\u79BB\u7EBF\u5FEB\u7167\uFF1B\u8FDE\u63A5\u6062\u590D\u540E\u81EA\u52A8\u5207\u6362\u5B9E\u65F6\u6570\u636E",
          "runtime.label": "\u5B9E\u65F6",
          "runtime.synced": "\u6570\u636E\u6765\u81EA\u5F53\u524D Session workspace",
          "time.justNow": "\u521A\u521A",
          "time.minutesAgo": "{n} \u5206\u949F\u524D",
          "time.hoursAgo": "{n} \u5C0F\u65F6\u524D",
          "time.daysAgo": "{n} \u5929\u524D",
          "prio.urgent": "\u7D27\u6025",
          "prio.high": "\u9AD8",
          "prio.medium": "\u4E2D",
          "prio.low": "\u4F4E",
          "st.pending": "\u5F85\u529E",
          "st.in_progress": "\u8FDB\u884C\u4E2D",
          "st.blocked": "\u963B\u585E",
          "st.done": "\u5DF2\u5B8C\u6210",
          "st.cancelled": "\u5DF2\u53D6\u6D88",
          "dash.title": "Dashboard \xB7 \u9879\u76EE\u5168\u666F",
          "dash.tech": "\u6280\u672F\u6808",
          "dash.devops": "\u4EA4\u4ED8",
          "dash.entry": "\u5F00\u53D1\u5165\u53E3",
          "dash.todo": "\u5F85\u529E\uFF08\u5168\u90E8\uFF09",
          "dash.timeline": "\u65F6\u95F4\u7EBF",
          "dash.memory": "\u9879\u76EE\u8BB0\u5FC6",
          "dash.memory.core": "\u5F53\u524D Core\uFF08\u6BCF\u8F6E\u6CE8\u5165\uFF09",
          "dash.memory.dormant": "\u4F11\u7720\uFF08\u4E0D\u6CE8\u5165\uFF0C\u53EF\u7528 project_ask\uFF09",
          "dash.memory.dormantShow": "\u5C55\u5F00\u4F11\u7720\u8BB0\u5FC6",
          "dash.memory.dormantHide": "\u6536\u8D77\u4F11\u7720\u8BB0\u5FC6",
          "dash.tab.overview": "\u6982\u89C8",
          "dash.tab.architecture": "\u67B6\u6784",
          "dash.tab.work": "\u4EFB\u52A1\u52A8\u6001",
          "dash.tab.knowledge": "\u9879\u76EE\u8BB0\u5FC6",
          "dash.tab.git": "Git \u5386\u53F2",
          "dash.tab.settings": "\u8BBE\u7F6E",
          "settings.probe.embedding": "\u6D4B\u8BD5\u5411\u91CF\u8FDE\u901A",
          "settings.probe.llm": "\u6D4B\u8BD5\u4F1A\u8BDD LLM",
          "settings.probe.embeddingHint": "\u7528\u5F53\u524D\u8868\u5355\u503C\u8BF7\u6C42\u4E00\u6B21 embeddings\uFF0C\u4E0D\u5199 cache\u3002\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\u4E5F\u4F1A\u7528\u4E8E\u672C\u6B21\u6D4B\u8BD5\u3002",
          "settings.probe.llmHint": "\u63A2\u6D4B\u5F53\u524D DSH \u4F1A\u8BDD\u7684\u6A21\u578B\u8DEF\u7531\uFF0C\u4F1A\u8BDD\u6458\u8981\u548C\u67B6\u6784\u589E\u5F3A\u7528\u7684\u662F\u540C\u4E00\u6761 LLM\u3002",
          "settings.probe.running": "\u6D4B\u8BD5\u4E2D\u2026",
          "dash.snapshot": "\u6570\u636E\u5FEB\u7167 \xB7 {time}",
          "dash.none": "\uFF08\u7A7A\uFF09",
          "suggest.title": "\u{1F4A1} \u4F60\u4ECA\u5929\u53EF\u80FD\u60F3\u63A8\u8FDB",
          "suggest.llmTag": "AI \u63A8\u8350",
          "suggest.localTag": "\u672C\u5730\u63A8\u8350",
          "suggest.fallbackTag": "AI \u6682\u4E0D\u53EF\u7528",
          "suggest.loading": "\u5206\u6790\u4ECA\u5929\u7684\u7EED\u63A5\u5EFA\u8BAE\u2026",
          "suggest.confidence": "\u7F6E\u4FE1\u5EA6 {pct}%",
          "suggest.refresh": "\u91CD\u65B0\u751F\u6210",
          "suggest.dismiss": "\u6536\u8D77",
          "suggest.empty": "\u6682\u65E0\u6D3B\u8DC3\u4EFB\u52A1\u548C\u8FD1\u671F\u8BB0\u5FC6\uFF0C\u53EF\u7528 project_todo_add \u89C4\u5212\u4E0B\u4E00\u6B65",
          "suggest.reasonLabel": "\u4F9D\u636E",
          "mem.type.decision": "\u51B3\u7B56",
          "mem.type.bug": "Bug",
          "mem.type.lesson": "\u6559\u8BAD",
          "mem.type.requirement": "\u9700\u6C42",
          "mem.type.architecture": "\u67B6\u6784",
          "mem.type.change": "\u53D8\u66F4",
          "mem.type.context": "\u5907\u6CE8",
          "mem.type.issue": "\u95EE\u9898"
        },
        "en-US": {
          "tab.label": "Project",
          "header.section": "Project",
          "header.untitled": "Untitled project",
          "header.lastUpdate": "Last update",
          "phase.title": "Current phase",
          "phase.empty": "No tasks in progress",
          "todo.title": "TODO",
          "todo.empty": "No pending todos",
          "activity.title": "Recent activity",
          "activity.empty": "No recent activity",
          "memories.title": "Memories",
          "stats.title": "Stats",
          "stats.pending": "Pending",
          "stats.done": "Done",
          "stats.decisions": "Decisions",
          "codegraph.title": "Code",
          "codegraph.files": "files",
          "codegraph.edges": "edges",
          "codegraph.langs": "langs",
          "codegraph.noLang": "No language data",
          "arch.title": "Project architecture",
          "arch.modules": "modules",
          "arch.edges": "edges",
          "arch.local": "Local analysis",
          "arch.hybrid": "DSH LLM enriched",
          "arch.select": "Click a layer for peer modules, or a module for its duty",
          "arch.flows": "Runtime path",
          "arch.flowEmpty": "No runtime path to show yet",
          "arch.peersHint": "Modules in a layer are peers, not a sequence",
          "arch.inspectLayer": "Layer",
          "arch.inspectModule": "Module",
          "arch.related": "Collaborates with",
          "arch.runtime": "Runtime path",
          "arch.empty": "No layers to show yet",
          "arch.purpose": "Project purpose",
          "arch.risks": "Architecture notes",
          "arch.style": "Architecture style",
          "arch.layers": "Architecture layers",
          "arch.components": "Core components",
          "arch.keyFiles": "Key file guide",
          "arch.start": "Getting started",
          "arch.highlights": "Design highlights",
          "arch.trigger": "Trigger",
          "arch.outcome": "Outcome",
          "arch.llmFallback": "DSH LLM was unavailable; showing local inference",
          "arch.actionRetry": "Rescan",
          "arch.actionChat": "Send a message first",
          "arch.actionSettings": "Check DSH model route",
          "arch.retrying": "Rescanning\u2026",
          "arch.retryDone": "Regenerated",
          "arch.retryFailed": "Rescan failed",
          "actions.continue": "Continue last session",
          "actions.openDashboard": "Open full Dashboard",
          "actions.closeDashboard": "Close Dashboard",
          "actions.copied": "Copied! Paste into input",
          "actions.copyFail": "Copy failed, type it manually",
          "todostrip.title": "Active TODOs",
          "todostrip.viewAll": "View all",
          "todostrip.close": "Collapse",
          "todostrip.empty": "\u{1F389} No active TODOs",
          "onboarding.title": "Project Brain not started",
          "onboarding.body": "Scan the project, map the architecture, and carry memory and todos into later chats. Get up to speed fast, understand more as you go, and keep the project moving long-term.",
          "onboarding.cta": "Start Project Brain",
          "onboarding.f1.title": "Understand the project",
          "onboarding.f1.desc": "Detect stack and entry points, then map layers",
          "onboarding.f2.title": "Remember across sessions",
          "onboarding.f2.desc": "New chats pick up project context automatically",
          "onboarding.f3.title": "Pick up where you left off",
          "onboarding.f3.desc": "Todos and memories stay with the project",
          "onboarding.more": "Memory capture and Git history are available after start",
          "onboarding.copyPrompt": "Please scan this project: call the project_init tool to build the project brain",
          "onboarding.copied": "Command copied, paste & send",
          "loading": "Loading\u2026",
          "snapshot.label": "snapshot",
          "snapshot.autoSync": "Offline snapshot; switches to live data when connected",
          "runtime.label": "live",
          "runtime.synced": "Data resolved from the current Session workspace",
          "time.justNow": "just now",
          "time.minutesAgo": "{n} min ago",
          "time.hoursAgo": "{n}h ago",
          "time.daysAgo": "{n}d ago",
          "prio.urgent": "urgent",
          "prio.high": "high",
          "prio.medium": "medium",
          "prio.low": "low",
          "st.pending": "pending",
          "st.in_progress": "in progress",
          "st.blocked": "blocked",
          "st.done": "done",
          "st.cancelled": "cancelled",
          "dash.title": "Dashboard \xB7 Full view",
          "dash.tech": "Tech stack",
          "dash.devops": "Delivery",
          "dash.entry": "Entrypoints",
          "dash.todo": "TODO (all)",
          "dash.timeline": "Timeline",
          "dash.memory": "Memories",
          "dash.memory.core": "Core (injected every session)",
          "dash.memory.dormant": "Dormant (askable, not injected)",
          "dash.memory.dormantShow": "Show dormant memories",
          "dash.memory.dormantHide": "Hide dormant memories",
          "dash.tab.overview": "Overview",
          "dash.tab.architecture": "Architecture",
          "dash.tab.work": "Work & activity",
          "dash.tab.knowledge": "Knowledge",
          "dash.tab.git": "Git history",
          "dash.tab.settings": "Settings",
          "settings.probe.embedding": "Test embedding",
          "settings.probe.llm": "Test session LLM",
          "settings.probe.embeddingHint": "Sends one embeddings request with the form values. Does not write cache. Unsaved edits are included.",
          "settings.probe.llmHint": "Pings the current DSH session model used by session summary and architecture enrichment.",
          "settings.probe.running": "Testing\u2026",
          "dash.snapshot": "Data snapshot \xB7 {time}",
          "dash.none": "(empty)",
          "suggest.title": "\u{1F4A1} Today you may want to continue",
          "suggest.llmTag": "AI",
          "suggest.localTag": "Local",
          "suggest.fallbackTag": "AI unavailable",
          "suggest.loading": "Analyzing today\u2019s continuation\u2026",
          "suggest.confidence": "confidence {pct}%",
          "suggest.refresh": "Refresh",
          "suggest.dismiss": "Dismiss",
          "suggest.empty": "No active tasks or recent memories. Try project_todo_add to plan next steps.",
          "suggest.reasonLabel": "Why",
          "mem.type.decision": "Decision",
          "mem.type.bug": "Bug",
          "mem.type.lesson": "Lesson",
          "mem.type.requirement": "Requirement",
          "mem.type.architecture": "Architecture",
          "mem.type.change": "Change",
          "mem.type.context": "Note",
          "mem.type.issue": "Issue"
        }
      };
      function interpolate(template, vars) {
        if (!template || !vars) return template || "";
        return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? String(vars[k]) : "");
      }
      function makeT(localeCode) {
        const d = dicts[localeCode] || dicts["zh-CN"];
        return (key, vars) => interpolate(d[key] || dicts["zh-CN"][key] || key, vars);
      }
      function formatRelativeTime(ts, now, localeCode) {
        const diff = now - ts;
        const t = makeT(localeCode);
        if (diff < 6e4) return t("time.justNow");
        const minutes = Math.floor(diff / 6e4);
        if (minutes < 60) return t("time.minutesAgo", { n: minutes });
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return t("time.hoursAgo", { n: hours });
        const days = Math.floor(hours / 24);
        return t("time.daysAgo", { n: days });
      }
      function formatDate(ts) {
        try {
          const d = new Date(ts);
          const p = (n) => n < 10 ? "0" + n : "" + n;
          return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
        } catch (e) {
          return "";
        }
      }
      function formatLanguagesUsage(languages, opts) {
        const obj = languages && typeof languages === "object" ? languages : {};
        const entries = Object.entries(obj).filter(([, c]) => Number(c) > 0).map(([lang, count]) => ({ lang: String(lang), count: Number(count) || 0 })).sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
        const total = entries.reduce((s, e) => s + e.count, 0);
        const topN = opts && Number.isFinite(opts.topN) ? Math.max(1, opts.topN | 0) : 8;
        const mergeTail = opts && opts.mergeTail === false ? false : true;
        const head = entries.slice(0, topN);
        const tailList = entries.slice(topN);
        const withPct = (e) => Object.assign({}, e, { percent: total > 0 ? e.count / total * 100 : 0 });
        const top = head.map(withPct);
        let tail = null;
        if (mergeTail && tailList.length > 0) {
          const tailCount = tailList.reduce((s, e) => s + e.count, 0);
          tail = { count: tailCount, percent: total > 0 ? tailCount / total * 100 : 0, languages: tailList.length };
        } else if (!mergeTail && tailList.length > 0) {
          for (const e of tailList) top.push(withPct(e));
        }
        return { top, tail, total, distinctCount: entries.length };
      }
      function copyPrompt(text, ev, okLabel, failLabel) {
        let ok = false;
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text);
            ok = true;
          }
        } catch (e) {
        }
        if (!ok) {
          try {
            if (typeof document !== "undefined" && typeof document.createElement === "function") {
              const ta = document.createElement("textarea");
              ta.value = text;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              document.body.appendChild(ta);
              ta.select();
              ok = document.execCommand("copy");
              document.body.removeChild(ta);
            }
          } catch (e) {
          }
        }
        const btn = ev && (ev.currentTarget || ev.target);
        if (btn && (okLabel || failLabel)) {
          try {
            btn.textContent = ok ? okLabel || "OK" : failLabel || "FAIL";
          } catch (e) {
          }
        }
      }
      function toggleDashboard(ev, t) {
        const el = typeof document !== "undefined" && typeof document.getElementById === "function" ? document.getElementById("dsh-brain-dashboard") : null;
        const btn = ev && (ev.currentTarget || ev.target);
        if (!el) return;
        const open = el.style.display === "none";
        el.style.display = open ? "block" : "none";
        const indicator = btn && btn.querySelector("[data-dashboard-indicator]");
        if (indicator) indicator.textContent = open ? "\u25BE" : "\u25B8";
        if (open && el.scrollIntoView) {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (e) {
          }
        }
      }
      const sectionStyle = {
        padding: "14px 16px",
        background: "var(--dsw-alias-bg-layer-1)",
        color: "var(--dsw-alias-label-primary)",
        borderRadius: "10px",
        margin: "8px 12px",
        border: "1px solid var(--dsw-alias-border-l1)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
      };
      const sectionTitleStyle = {
        margin: "0 0 10px",
        fontSize: "12px",
        fontWeight: "600",
        letterSpacing: "0.4px",
        color: "var(--dsw-alias-label-secondary)",
        display: "flex",
        alignItems: "center",
        gap: "6px"
      };
      const chipStyle = {
        padding: "2px 8px",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        fontSize: "11px",
        borderRadius: "10px",
        fontWeight: "500",
        marginRight: "4px",
        display: "inline-block"
      };
      const __PROJECT_DATA__ = /* @__PURE__ */ JSON.parse('{"initialized":false,"project":null,"phase":null,"recentActivity":[],"memories":[],"memoriesAll":[],"todos":[],"timelineAll":[],"stats":{"pendingTodos":0,"completedTodos":0,"decisions":0},"_embedMode":"runtime-rpc"}');
      const __CODEGRAPH_EMBED__ = false ? JSON.parse("null") : null;
      const __ALL_WORKSPACES__ = true ? JSON.parse('{"sessionToWorkspaceId":{},"workspaceProjects":{},"workspacePaths":{},"dshRoot":null}') : null;
      const DEMO_ONBOARDING = typeof location !== "undefined" ? location.search.indexOf("dsh_brain_demo=onboarding") >= 0 : false;
      function resolvePreview(props) {
        const sid = props && props.sessionId || null;
        const wsMap = __ALL_WORKSPACES__ || {};
        const sessionToWsId = wsMap.sessionToWorkspaceId || {};
        let wsId = sid ? sessionToWsId[sid] : null;
        let projects = wsId && wsMap.workspaceProjects && wsMap.workspaceProjects[wsId] || [];
        let wsPath = wsId && wsMap.workspacePaths && wsMap.workspacePaths[wsId] || null;
        const picked = projects.length > 0 ? projects[0] : null;
        if (!picked) {
          return {
            data: {
              initialized: false,
              project: null,
              phase: null,
              recentActivity: [],
              memories: [],
              memoriesAll: [],
              todos: [],
              timelineAll: [],
              stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 },
              _workspaceId: wsId,
              _workspacePath: wsPath,
              _sessionId: sid
            },
            workspaceId: wsId,
            workspacePath: wsPath,
            sessionId: sid,
            hint: "",
            source: "snapshot"
          };
        }
        const merged = Object.assign({}, picked, {
          codegraph: picked && picked.codegraph || __CODEGRAPH_EMBED__
        });
        merged._workspaceId = wsId;
        merged._workspacePath = wsPath;
        merged._sessionId = sid;
        return { data: merged, workspaceId: wsId, workspacePath: wsPath, sessionId: sid, hint: "", source: "snapshot" };
      }
      const projectIcon = (type) => {
        const t = (type || "").toLowerCase();
        if (t.includes("frontend") || t.includes("web") || t.includes("ui")) return "\u{1F3A8}";
        if (t.includes("backend") || t.includes("api") || t.includes("server")) return "\u2699\uFE0F";
        if (t.includes("lib") || t.includes("tool") || t.includes("util")) return "\u{1F4DA}";
        if (t.includes("cli")) return "\u{1F4BB}";
        if (t.includes("mobile") || t.includes("app")) return "\u{1F4F1}";
        return "\u{1F4E6}";
      };
      function HeaderBlock({ data, t }) {
        if (!data.project) return null;
        const p = data.project;
        const icon = projectIcon(p.type);
        return React.createElement(
          "section",
          { style: Object.assign({}, sectionStyle, { padding: "16px 18px", background: "linear-gradient(135deg, var(--dsw-alias-bg-layer-1) 0%, var(--dsw-alias-bg-layer-2) 100%)" }), "data-block": "header" },
          React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { fontSize: "11px" }) }, "\u{1F4C1} " + t("header.section")),
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" } },
            React.createElement("span", { style: { fontSize: "22px" } }, icon),
            React.createElement("span", { style: { fontSize: "18px", fontWeight: "600", letterSpacing: "0.2px" } }, p.name || t("header.untitled")),
            p.type ? React.createElement("span", { style: { padding: "2px 10px", background: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-bg-base)", fontSize: "11px", borderRadius: "10px", fontWeight: "600" } }, p.type) : null
          ),
          p.description && p.description !== "Auto-generated by dsh-project-brain" ? React.createElement("p", { style: { margin: "8px 0 0", fontSize: "12px", lineHeight: "1.55", color: "var(--dsw-alias-label-secondary)" } }, String(p.description).slice(0, 280)) : null,
          p.lastUpdateAt ? React.createElement(
            "div",
            { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" } },
            React.createElement("span", null, "\u{1F552}"),
            React.createElement("span", null, `${t("header.lastUpdate")} \xB7 ${formatRelativeTime(p.lastUpdateAt, Date.now(), data._localeCode)}`)
          ) : null
        );
      }
      function StatusBannerBlock({ data, t, compact }) {
        const s = data.stats || {};
        const todos = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
        const memories = data.memories || [];
        const lastAct = (data.recentActivity || [])[0];
        const statBox = (icon, value, label, color) => React.createElement(
          "div",
          { style: { flex: "1 1 0", textAlign: "center", padding: "10px 6px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)" } },
          React.createElement("div", { style: { fontSize: "20px", lineHeight: "1", marginBottom: "4px" } }, icon),
          React.createElement("div", { style: { fontSize: "20px", fontWeight: "700", lineHeight: "1.1", color: color || "var(--dsw-alias-label-primary)", fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "4px", letterSpacing: "0.3px" } }, label)
        );
        const tips = [];
        if (todos.length > 5) tips.push(`${todos.length} \u4E2A\u5F85\u529E\u8F83\u5BC6\u96C6`);
        if (memories.length > 30) tips.push("\u8BB0\u5FC6\u8F83\u591A\uFF0C\u53EF\u6574\u7406");
        const insight = lastAct ? `\u6700\u8FD1 ${formatRelativeTime(lastAct.occurredAt, Date.now(), data._localeCode)}` : "\u6682\u65E0\u6D3B\u52A8";
        return React.createElement(
          "section",
          { style: Object.assign({}, sectionStyle, { padding: "12px 14px", margin: compact ? 0 : sectionStyle.margin }), "data-block": "status-banner" },
          React.createElement(
            "div",
            { style: { display: "flex", gap: "6px" } },
            statBox("\u{1F4CB}", todos.length, t("stats.pending"), todos.length > 0 ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)"),
            statBox("\u{1F9E0}", memories.length, t("memories.title"), memories.length > 0 ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)"),
            statBox("\u26A1", s.completedTodos || 0, t("stats.done"), "var(--dsw-alias-state-success-primary)")
          ),
          React.createElement(
            "div",
            { style: { marginTop: "8px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", display: "flex", alignItems: "center", gap: "4px" } },
            React.createElement("span", null, "\u{1F4A1}"),
            React.createElement("span", null, insight + (tips.length > 0 ? " \xB7 " + tips.join("\uFF0C") : ""))
          )
        );
      }
      function PhaseBlock({ data, t, compact }) {
        const phaseSectionStyle = Object.assign({}, sectionStyle, { margin: compact ? 0 : sectionStyle.margin, height: compact ? "100%" : void 0, boxSizing: "border-box" });
        const phase = data.phase;
        if (!phase || !phase.progress) {
          return React.createElement(
            "section",
            { style: phaseSectionStyle, "data-block": "phase" },
            React.createElement("h3", { style: sectionTitleStyle }, "\u{1F3AF} " + t("phase.title")),
            React.createElement("p", { style: { margin: 0, opacity: 0.6, fontSize: "13px" } }, t("phase.empty"))
          );
        }
        const { done, total } = phase.progress;
        const percent = total > 0 ? Math.round(done / total * 100) : 0;
        return React.createElement(
          "section",
          { style: phaseSectionStyle, "data-block": "phase" },
          React.createElement("h3", { style: sectionTitleStyle }, "\u{1F3AF} " + t("phase.title")),
          React.createElement("p", { style: { margin: "0 0 8px", fontSize: "14px", fontWeight: "500" } }, phase.title),
          React.createElement(
            "div",
            { style: { height: "8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "4px", overflow: "hidden", position: "relative" } },
            React.createElement("div", { style: { width: percent + "%", height: "100%", background: "var(--dsw-alias-state-success-primary)", transition: "width 0.4s ease", borderRadius: "4px" } })
          ),
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
            React.createElement("span", null, `${done} / ${total}`),
            React.createElement("span", { style: { fontWeight: "600", color: "var(--dsw-alias-state-success-primary)" } }, percent + "%")
          )
        );
      }
      function TodoBlock({ data, t }) {
        const todos = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
        if (todos.length === 0) return null;
        const items = todos.slice(0, 5);
        const overflow = todos.length - items.length;
        const statusBorder = (s) => ({ in_progress: "var(--dsw-alias-state-success-primary)", blocked: "var(--dsw-alias-state-error-primary)" })[s] || "var(--dsw-alias-border-l1)";
        const prioIcon = (p) => ({ urgent: "\u{1F534}", high: "\u{1F7E0}", medium: "\u{1F7E1}", low: "\u{1F7E2}" })[p] || "\u26AA";
        const statusIcon = (s) => ({ in_progress: "\u25B6\uFE0F", blocked: "\u26D4" })[s] || "\u{1F4CB}";
        const todoCard = (x) => {
          const isActive = x.status === "in_progress";
          return React.createElement(
            "div",
            {
              key: x.id,
              "data-todo-card": "1",
              style: {
                padding: "8px 10px 8px 12px",
                marginBottom: "6px",
                background: "var(--dsw-alias-bg-layer-2)",
                borderRadius: "8px",
                borderLeft: "3px solid " + statusBorder(x.status),
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                transition: "transform 0.1s ease"
              }
            },
            React.createElement("div", { style: { fontSize: "13px", flex: "0 0 auto", lineHeight: "1.4" } }, statusIcon(x.status)),
            React.createElement(
              "div",
              { style: { flex: "1 1 auto", minWidth: 0 } },
              React.createElement("div", { style: { fontSize: "13px", fontWeight: "500", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", marginBottom: "3px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, x.title),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                React.createElement(
                  "span",
                  { title: t("prio." + (x.priority || "medium")), style: { fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "6px", background: "var(--dsw-alias-bg-base)", border: "1px solid var(--dsw-alias-border-l1)" } },
                  React.createElement("span", null, prioIcon(x.priority)),
                  React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "600" } }, t("prio." + (x.priority || "medium")))
                ),
                isActive ? React.createElement(
                  "span",
                  { style: { fontSize: "10px", color: "var(--dsw-alias-state-success-primary)", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "3px" } },
                  React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dsw-alias-state-success-primary)" } }),
                  React.createElement("span", null, t("st.in_progress"))
                ) : null
              )
            )
          );
        };
        return React.createElement(
          "section",
          { style: sectionStyle, "data-block": "todo" },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, "\u{1F4CB} " + t("todo.title") + " \xB7 " + todos.length),
            overflow > 0 ? React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-2)", padding: "2px 8px", borderRadius: "10px", fontWeight: "600" } }, "+" + overflow) : null
          ),
          React.createElement("div", null, items.map(todoCard))
        );
      }
      function ActivityBlock({ data, t }) {
        const items = (data.recentActivity || []).slice(0, 6);
        if (items.length === 0) {
          return React.createElement(
            "section",
            { style: sectionStyle, "data-block": "activity" },
            React.createElement("h3", { style: sectionTitleStyle }, "\u26A1 " + t("activity.title")),
            React.createElement("p", { style: { margin: 0, opacity: 0.6, fontSize: "13px" } }, t("activity.empty"))
          );
        }
        const eventIcon = (title) => {
          const t0 = (title || "").toLowerCase();
          if (t0.includes("init") || t0.includes("\u626B\u63CF") || t0.includes("scan")) return "\u{1F680}";
          if (t0.includes("memory") || t0.includes("\u8BB0\u5FC6")) return "\u{1F9E0}";
          if (t0.includes("todo") || t0.includes("\u5F85\u529E")) return "\u{1F4CB}";
          if (t0.includes("dream") || t0.includes("\u6574\u7406")) return "\u2728";
          if (t0.includes("rescan")) return "\u{1F504}";
          if (t0.includes("session") || t0.includes("\u6458\u8981")) return "\u{1F4DD}";
          if (t0.includes("diff") || t0.includes("\u67B6\u6784")) return "\u{1F333}";
          return "\u2022";
        };
        const timelineItem = (it, isLast) => {
          const icon = eventIcon(it.title);
          return React.createElement(
            "div",
            { key: it.id, style: { display: "flex", gap: "10px", position: "relative", paddingBottom: isLast ? 0 : "10px" } },
            React.createElement(
              "div",
              { style: { flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", width: "36px" } },
              React.createElement("div", { style: { width: "28px", height: "28px", borderRadius: "50%", background: "var(--dsw-alias-bg-layer-2)", border: "2px solid var(--dsw-alias-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", lineHeight: "1" } }, icon),
              !isLast ? React.createElement("div", { style: { flex: "1 1 auto", width: "2px", background: "var(--dsw-alias-border-l1)", marginTop: "4px", minHeight: "12px" } }) : null
            ),
            React.createElement(
              "div",
              { style: { flex: "1 1 auto", minWidth: 0, paddingBottom: isLast ? 0 : "2px" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px", marginBottom: "2px" } },
                React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontWeight: "600", fontVariantNumeric: "tabular-nums" } }, formatRelativeTime(it.occurredAt, Date.now(), data._localeCode)),
                React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontVariantNumeric: "tabular-nums" }, title: formatDate(it.occurredAt) }, formatDate(it.occurredAt).slice(5))
              ),
              React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, it.title)
            )
          );
        };
        return React.createElement(
          "section",
          { style: sectionStyle, "data-block": "activity" },
          React.createElement("h3", { style: sectionTitleStyle }, "\u26A1 " + t("activity.title")),
          React.createElement("div", null, items.map((it, idx) => timelineItem(it, idx === items.length - 1)))
        );
      }
      function MemoriesBlock({ data, t }) {
        const memories = data.memories || [];
        if (memories.length === 0) return null;
        const typeLabel = (type) => t("mem.type." + type) !== "mem.type." + type ? t("mem.type." + type) : type;
        const typeIcon = (type) => ({ decision: "\u{1F4A1}", bug: "\u{1F41B}", lesson: "\u{1F4D6}", requirement: "\u{1F4CC}", architecture: "\u{1F3DB}\uFE0F", change: "\u{1F504}", context: "\u{1F4AC}", issue: "\u2753" })[type] || "\u{1F4DD}";
        const importanceStars = (imp) => {
          const stars = Math.max(0, Math.min(5, Math.round((imp || 0) * 5)));
          return "\u2605".repeat(stars) + "\u2606".repeat(5 - stars);
        };
        const [expanded, setExpanded] = React.useState(/* @__PURE__ */ new Set());
        const toggle = (m, e) => {
          if (e) e.stopPropagation();
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(m.id)) next.delete(m.id);
            else next.add(m.id);
            return next;
          });
        };
        const copyMem = (m, e) => {
          try {
            e.stopPropagation();
            const text = "[" + typeLabel(m.type) + "] " + m.title + "\n\n" + (m.content || "");
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text);
            }
            const btn = e && (e.currentTarget || e.target);
            if (btn) {
              const orig = btn.textContent;
              btn.textContent = "\u2713";
              setTimeout(() => {
                btn.textContent = orig;
              }, 1200);
            }
          } catch (e2) {
          }
        };
        const memCard = (m) => {
          const isOpen = expanded.has(m.id);
          const summary = String(m.content || "").slice(0, 100);
          const hasMore = (m.content || "").length > 100;
          return React.createElement(
            "div",
            {
              key: m.id,
              "data-mem-card": "1",
              "data-mem-open": isOpen ? "1" : "0",
              style: {
                padding: "10px 12px",
                marginBottom: "6px",
                background: "var(--dsw-alias-bg-layer-2)",
                borderRadius: "8px",
                borderLeft: "3px solid var(--dsw-alias-brand-primary)"
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
              React.createElement("span", { style: { fontSize: "13px" } }, typeIcon(m.type)),
              React.createElement("span", { style: { fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-base)", color: "var(--dsw-alias-label-primary)", fontWeight: "600", border: "1px solid var(--dsw-alias-border-l1)" } }, typeLabel(m.type)),
              React.createElement("span", { title: "importance " + (m.importance || 0), style: { fontSize: "10px", color: "var(--dsw-alias-brand-primary)", letterSpacing: "1px" } }, importanceStars(m.importance)),
              React.createElement("div", { style: { flex: "1 1 auto" } }),
              React.createElement("button", {
                "data-mem-copy": "1",
                title: "\u590D\u5236\u5230 LLM \u5E2E\u4F60\u6574\u7406",
                style: { background: "transparent", border: "none", cursor: "pointer", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", padding: "0 4px", borderRadius: "4px" },
                onClick: (e) => copyMem(m, e)
              }, "\u{1F4CB}"),
              React.createElement("span", {
                "data-mem-indicator": "1",
                style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", padding: "0 4px", userSelect: "none" },
                onClick: (e) => toggle(m, e),
                title: "\u5C55\u5F00/\u6536\u8D77"
              }, isOpen ? "\u25BE" : "\u25B8")
            ),
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, m.title),
            m.content ? React.createElement("div", {
              "data-mem-summary": "1",
              style: { display: isOpen ? "none" : "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5", marginBottom: hasMore ? "4px" : "0", cursor: "pointer" },
              onClick: (e) => toggle(m, e)
            }, summary + (hasMore ? "..." : "")) : null,
            m.content ? React.createElement("div", {
              "data-mem-content": "1",
              style: { display: isOpen ? "block" : "none", fontSize: "12px", color: "var(--dsw-alias-label-primary)", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "4px", padding: "8px 10px", background: "var(--dsw-alias-bg-base)", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l1)", cursor: "pointer" },
              onClick: (e) => toggle(m, e)
            }, m.content) : null
          );
        };
        return React.createElement(
          "section",
          { style: sectionStyle, "data-block": "memories" },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, "\u{1F9E0} " + t("memories.title") + " \xB7 " + memories.length),
            React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "\u{1F4CB} \u70B9\u51FB \u{1F4CB} \u590D\u5236\u7ED9 LLM")
          ),
          React.createElement("div", null, memories.slice(0, 8).map(memCard)),
          memories.length > 8 ? React.createElement("div", { style: { textAlign: "center", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "6px" } }, "+" + (memories.length - 8) + " \u66F4\u591A \u2192 Dashboard") : null
        );
      }
      function StatsBlock({ data, t }) {
        const s = data.stats || { pendingTodos: 0, completedTodos: 0, decisions: 0 };
        const statItem = (icon, value, label, color) => React.createElement(
          "div",
          { style: { textAlign: "center", padding: "8px 4px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", marginBottom: "2px" } }, icon),
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", lineHeight: "1.1", color, fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", letterSpacing: "0.3px" } }, label)
        );
        return React.createElement(
          "section",
          { style: sectionStyle, "data-block": "stats" },
          React.createElement("h3", { style: sectionTitleStyle }, "\u{1F4CA} " + t("stats.title")),
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "4px" } },
            statItem("\u{1F4CB}", s.pendingTodos, t("stats.pending"), s.pendingTodos > 0 ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-primary)"),
            statItem("\u2705", s.completedTodos, t("stats.done"), "var(--dsw-alias-state-success-primary)"),
            statItem("\u{1F4A1}", s.decisions, t("stats.decisions"), "var(--dsw-alias-brand-primary)")
          )
        );
      }
      function CodeGraphBlock({ data, t }) {
        const architecture = data && data.architecture;
        const cg = data && data.codegraph ? data.codegraph : architecture ? {
          stats: {
            files: architecture.stats && architecture.stats.files || 0,
            edges: architecture.stats && architecture.stats.edges || 0,
            languages: data.project && data.project.languages || {}
          }
        } : null;
        if (!cg) return null;
        const stat = (icon, value, label) => React.createElement(
          "div",
          { style: { textAlign: "center", padding: "8px 4px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", marginBottom: "2px" } }, icon),
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", letterSpacing: "0.3px" } }, label)
        );
        const langUsage = formatLanguagesUsage(cg.stats.languages);
        const langItems = [];
        for (const item of langUsage.top) {
          const pctLabel = langUsage.total > 0 ? Math.round(item.percent) + "%" : "";
          langItems.push(React.createElement(
            "span",
            {
              key: "lang-" + item.lang,
              title: item.lang + " \xB7 " + item.count + " \u4E2A\u6587\u4EF6",
              style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" }
            },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
            React.createElement("span", null, item.lang),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, pctLabel ? " \xB7 " + pctLabel : "")
          ));
        }
        if (langUsage.tail) {
          langItems.push(React.createElement(
            "span",
            {
              key: "lang-tail",
              title: langUsage.tail.languages + " \u79CD\u8BED\u8A00\u5171 " + langUsage.tail.count + " \u4E2A\u6587\u4EF6",
              style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)", color: "var(--dsw-alias-label-secondary)" }
            },
            React.createElement("span", null, "\u5176\u5B83 " + langUsage.tail.languages + " \u79CD"),
            React.createElement("span", null, " \xB7 " + Math.round(langUsage.tail.percent) + "%")
          ));
        }
        return React.createElement(
          "section",
          { style: sectionStyle, "data-block": "codegraph" },
          React.createElement("h3", { style: sectionTitleStyle }, "\u{1F333} " + t("codegraph.title")),
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "4px" } },
            stat("\u{1F4C1}", cg.stats.files, t("codegraph.files")),
            stat("\u{1F517}", cg.stats.edges, t("codegraph.edges")),
            stat("\u{1F5C2}\uFE0F", Object.keys(cg.stats.languages || {}).length, t("codegraph.langs"))
          ),
          React.createElement(
            "div",
            { style: { marginTop: "10px" } },
            langItems.length > 0 ? langItems : React.createElement("span", { style: { opacity: 0.6, fontSize: "12px" } }, t("codegraph.noLang"))
          )
        );
      }
      function clipPurpose(text) {
        const raw = String(text || "").replace(/\s+/g, " ").trim();
        if (!raw) return "";
        const parts = [];
        let buf = "";
        for (let i = 0; i < raw.length; i++) {
          buf += raw[i];
          if (/[。！？.!?]/.test(raw[i])) {
            parts.push(buf);
            buf = "";
            if (parts.length >= 2) break;
          }
        }
        const out = (parts.length ? parts.join("") : raw).trim();
        return out.length > 160 ? out.slice(0, 159) + "\u2026" : out;
      }
      function clipStyleTag(text) {
        const raw = String(text || "").replace(/\s+/g, " ").trim();
        if (!raw) return "";
        const clause = raw.split(/[（(，,。；;]/)[0].trim();
        return clause.length > 18 ? clause.slice(0, 17) + "\u2026" : clause;
      }
      function oneLine(text, max) {
        const raw = String(text || "").replace(/\s+/g, " ").trim();
        if (!raw) return "";
        const cut = raw.split(/[。！？.!\n]/)[0].trim() || raw;
        return cut.length > max ? cut.slice(0, max - 1) + "\u2026" : cut;
      }
      function stepComponentId(step) {
        if (!step) return null;
        return typeof step === "string" ? step : step.componentId || step.component || null;
      }
      const ARCH_DIAGRAM_CSS = [
        ".dsh-arch-head{display:flex;align-items:center;gap:8px;margin:0 0 8px}",
        ".dsh-arch-head h3{margin:0}",
        ".dsh-arch-pills{margin-left:auto;display:flex;gap:6px;flex:0 0 auto;align-items:center}",
        ".dsh-arch-pill,.dsh-arch-chip{font-size:10px;line-height:1.2;padding:3px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:transparent;font:inherit;cursor:default}",
        ".dsh-arch-chip{cursor:pointer}",
        ".dsh-arch-pill.is-brand,.dsh-arch-chip.is-active{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-purpose{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);margin:0 0 12px}",
        ".dsh-arch-llm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-state-warn-primary);margin:0 0 10px}",
        ".dsh-arch-board{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}",
        ".dsh-arch-lane{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:start;width:100%;margin:0;padding:0;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);border-left:3px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}",
        ".dsh-arch-lane:last-child{border-bottom:0}",
        ".dsh-arch-lane:hover{background:var(--dsw-alias-bg-layer-2)}",
        ".dsh-arch-lane.is-active{background:var(--dsw-alias-bg-layer-2);border-left-color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-lane.is-active .dsh-arch-rail{color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-rail{display:flex;align-items:flex-start;padding:14px 10px 12px;font-size:11px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-secondary);border-right:1px dashed var(--dsw-alias-border-l1)}",
        ".dsh-arch-nodes{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:8px;padding:10px 12px;align-items:stretch}",
        ".dsh-arch-node{display:flex;flex-direction:column;box-sizing:border-box;height:100%;min-height:72px;margin:0;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:inherit;font:inherit;text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none}",
        ".dsh-arch-lane.is-active .dsh-arch-node{background:var(--dsw-alias-bg-layer-1)}",
        ".dsh-arch-node:hover,.dsh-arch-node.is-picked{border-color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-node.is-picked{background:var(--dsw-alias-bg-layer-2)}",
        ".dsh-arch-board.is-flowing .dsh-arch-node{opacity:.42}",
        ".dsh-arch-board.is-flowing .dsh-arch-node.is-in-flow{opacity:1;border-color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-node-name{display:block;height:16px;line-height:16px;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsh-arch-node-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:28px;margin-top:6px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary)}",
        ".dsh-arch-step-card{display:flex;flex-direction:column;box-sizing:border-box;width:156px;min-height:72px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}",
        ".dsh-arch-step-name{height:16px;line-height:16px;font-size:12px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".dsh-arch-step-action{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:28px;margin-top:4px;font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary)}",
        ".dsh-arch-inspect{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
        ".dsh-arch-inspect-kicker{font-size:10px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-secondary);margin:0 0 6px}",
        ".dsh-arch-inspect-title{font-size:13px;font-weight:600;margin:0 0 4px}",
        ".dsh-arch-inspect-body{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:0}",
        ".dsh-arch-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
        ".dsh-arch-link{font-size:10px;line-height:1.4;padding:4px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}",
        ".dsh-arch-file{display:block;font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:6px;word-break:break-all}",
        ".dsh-arch-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}",
        ".dsh-arch-steps{display:flex;flex-wrap:nowrap;overflow-x:auto;align-items:stretch;gap:0;padding:8px 0 4px}",
        ".dsh-arch-step{display:flex;align-items:stretch;flex:0 0 auto}",
        ".dsh-arch-step-num{font-size:9px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-brand-primary)}",
        ".dsh-arch-arrow{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);padding:0 6px;font-size:12px;line-height:1}",
        ".dsh-arch-hint{margin-top:10px;font-size:11px;color:var(--dsw-alias-label-secondary)}",
        "@media(max-width:760px){.dsh-arch-head{align-items:flex-start;flex-wrap:wrap}.dsh-arch-pills{margin-left:0}.dsh-arch-lane{grid-template-columns:1fr}.dsh-arch-rail{border-right:0;border-bottom:1px dashed var(--dsw-alias-border-l1);padding:8px 12px 0}}"
      ].join("");
      function ArchitectureGraphBlock({ data, t, embedded, onRescan }) {
        const architecture = data && data.architecture;
        const [selectedLayerId, setSelectedLayerId] = React.useState(null);
        const [selectedComponentId, setSelectedComponentId] = React.useState(null);
        const [selectedFlowId, setSelectedFlowId] = React.useState(null);
        const [retryState, setRetryState] = React.useState({ status: "idle", message: null });
        const components = (architecture && (architecture.components || architecture.nodes) || []).slice(0, 24);
        const layers = (architecture && architecture.layers || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const flows = (architecture && (architecture.runtimeFlows || architecture.flows) || []).slice(0, 8);
        const relationships = (architecture && (architecture.relationships || architecture.edges) || []).slice(0, 36);
        const keyFiles = architecture && architecture.keyFiles || [];
        const risks = architecture && architecture.risks || [];
        const overview = architecture && architecture.overview || {};
        const purpose = clipPurpose(overview.purpose || architecture && architecture.summary || "");
        const styleLabel = clipStyleTag(overview.architectureStyle || "");
        const sourceLabel = architecture && architecture.source === "hybrid" ? t("arch.hybrid") : t("arch.local");
        const layerRows = layers.length ? layers : components.length ? [{ id: "all", name: t("arch.components"), responsibility: "", order: 0 }] : [];
        const componentsForLayer = (layer) => layer.id === "all" || !layers.length ? components : components.filter((item) => item.layerId === layer.id);
        const selectedLayer = layerRows.find((layer) => layer.id === selectedLayerId) || null;
        const selectedComponent = components.find((item) => item.id === selectedComponentId) || null;
        const byId = new Map(components.map((item) => [item.id, item]));
        function isGenuineRuntimeFlow(flow) {
          const steps = flow && flow.steps || [];
          if (steps.length < 2) return false;
          const name = String(flow.name || "");
          if (/本地推断|local inference/i.test(name)) return false;
          const ids = steps.map(stepComponentId);
          if (ids.length === components.length && ids.every((id, index) => id === components[index].id)) return false;
          const actions = steps.map((step) => typeof step === "object" && step && step.action || "");
          const generic = actions.length > 0 && actions.every((action) => action === "\u63A5\u6536\u8BF7\u6C42" || action === "\u5B8C\u6210\u5904\u7406" || action === "\u5904\u7406\u5E76\u4F20\u9012");
          return !generic;
        }
        const genuineFlows = flows.filter(isGenuineRuntimeFlow);
        const selectedFlow = genuineFlows.find((flow) => flow.id === selectedFlowId) || null;
        const flowIds = selectedFlow ? new Set((selectedFlow.steps || []).map(stepComponentId).filter(Boolean)) : null;
        function componentFile(component) {
          if (!component) return "";
          return (component.importantFiles || component.files || [])[0] || (keyFiles.find((item) => (component.importantFiles || []).indexOf(item.path) >= 0) || {}).path || "";
        }
        function componentRisk(component) {
          if (!component) return "";
          const hit = risks.find((item) => String(item).indexOf(component.name || component.label || "") >= 0);
          return hit ? oneLine(hit, 72) : "";
        }
        function relatedOf(component) {
          if (!component) return [];
          return relationships.map((rel) => {
            const from = rel.from || rel.source;
            const to = rel.to || rel.target;
            if (from === component.id && byId.get(to)) return { id: to, name: byId.get(to).name || byId.get(to).label, label: rel.label || t("arch.related") };
            if (to === component.id && byId.get(from)) return { id: from, name: byId.get(from).name || byId.get(from).label, label: rel.label || t("arch.related") };
            return null;
          }).filter(Boolean).slice(0, 6);
        }
        function relatedInLayer(layer) {
          const ids = new Set(componentsForLayer(layer).map((item) => item.id));
          return relationships.map((rel) => {
            const from = rel.from || rel.source;
            const to = rel.to || rel.target;
            if (!ids.has(from) || !ids.has(to) || from === to) return null;
            const left = byId.get(from);
            const right = byId.get(to);
            if (!left || !right) return null;
            return (left.name || left.label) + " \xB7 " + (rel.label || t("arch.related")) + " \xB7 " + (right.name || right.label);
          }).filter(Boolean).slice(0, 6);
        }
        function stepMeta(step) {
          const id = stepComponentId(step);
          const component = byId.get(id);
          const name = component ? component.name || component.label : id;
          const action = typeof step === "object" && step && step.action ? oneLine(step.action, 48) : "";
          return { id, name, action };
        }
        const sectionProps = { style: embedded ? { color: "var(--dsw-alias-label-primary)" } : sectionStyle, "data-block": "architecture-graph", "data-architecture-schema": architecture && architecture.schemaVersion || 1 };
        if (!architecture || !components.length) {
          return React.createElement(
            "section",
            sectionProps,
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, t("arch.title")),
            React.createElement("div", { style: { marginTop: "10px", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, t("arch.empty"))
          );
        }
        const llmBar = architecture.llm && architecture.llm.requested && !architecture.llm.used && architecture.llm.error ? (function() {
          const err = architecture.llm.error || {};
          const actionKey = err.actionKey || "retry_scan";
          const busy = retryState.status === "loading";
          let actionNode = null;
          if (actionKey === "retry_scan") {
            actionNode = React.createElement("button", {
              type: "button",
              disabled: busy || typeof onRescan !== "function",
              onClick: async () => {
                if (typeof onRescan !== "function") return;
                setRetryState({ status: "loading", message: null });
                try {
                  const out = await onRescan();
                  setRetryState({ status: "success", message: out && out.message ? out.message : t("arch.retryDone") });
                } catch (e) {
                  setRetryState({ status: "error", message: String(e && e.message || e) });
                }
              },
              style: { fontSize: "10px", padding: "2px 7px", borderRadius: "6px", background: "transparent", border: "1px solid var(--dsw-alias-state-warn-primary)", color: "var(--dsw-alias-state-warn-primary)", cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }
            }, busy ? t("arch.retrying") : t("arch.actionRetry"));
          } else if (actionKey === "send_message") {
            actionNode = React.createElement("span", { style: { fontSize: "10px" } }, t("arch.actionChat"));
          } else if (actionKey === "check_settings") {
            actionNode = React.createElement("span", { style: { fontSize: "10px" } }, t("arch.actionSettings"));
          }
          return React.createElement(
            "div",
            {
              title: err.message || err.code || "",
              className: "dsh-arch-llm"
            },
            React.createElement("span", null, t("arch.llmFallback")),
            actionNode,
            retryState.status === "success" ? React.createElement("span", { style: { color: "var(--dsw-alias-state-success-primary)" } }, retryState.message) : null,
            retryState.status === "error" ? React.createElement("span", null, retryState.message) : null
          );
        })() : null;
        let inspect = null;
        if (selectedFlow) {
          const flowSteps = (selectedFlow.steps || []).slice(0, 7);
          inspect = React.createElement(
            "div",
            { className: "dsh-arch-inspect", "data-architecture-flow": selectedFlow.id },
            React.createElement("div", { className: "dsh-arch-inspect-kicker" }, t("arch.runtime")),
            React.createElement("div", { className: "dsh-arch-inspect-title" }, selectedFlow.name || t("arch.flows")),
            selectedFlow.trigger ? React.createElement("p", { className: "dsh-arch-inspect-body" }, selectedFlow.trigger) : null,
            React.createElement(
              "div",
              { className: "dsh-arch-steps" },
              flowSteps.map((step, index) => {
                const meta = stepMeta(step);
                return React.createElement(
                  "div",
                  { key: (meta.id || "step") + "-" + index, className: "dsh-arch-step" },
                  React.createElement(
                    "div",
                    { className: "dsh-arch-step-card" },
                    React.createElement("div", { className: "dsh-arch-step-num" }, String(index + 1).padStart(2, "0")),
                    React.createElement("div", { className: "dsh-arch-step-name" }, meta.name),
                    meta.action ? React.createElement("div", { className: "dsh-arch-step-action" }, meta.action) : null
                  ),
                  index < flowSteps.length - 1 ? React.createElement("span", { className: "dsh-arch-arrow", "aria-hidden": "true" }, "\u2192") : null
                );
              })
            )
          );
        } else if (selectedComponent) {
          const desc = oneLine(selectedComponent.responsibility || selectedComponent.description || selectedComponent.details, 120);
          const file = componentFile(selectedComponent);
          const risk = componentRisk(selectedComponent);
          const related = relatedOf(selectedComponent);
          inspect = React.createElement(
            "div",
            { className: "dsh-arch-inspect", "data-architecture-inspect": selectedComponent.id },
            React.createElement("div", { className: "dsh-arch-inspect-kicker" }, t("arch.inspectModule")),
            React.createElement("div", { className: "dsh-arch-inspect-title" }, selectedComponent.name || selectedComponent.label),
            desc ? React.createElement("p", { className: "dsh-arch-inspect-body" }, desc) : null,
            file ? React.createElement("code", { className: "dsh-arch-file" }, file) : null,
            risk ? React.createElement("p", { className: "dsh-arch-inspect-body", style: { marginTop: "6px" } }, risk) : null,
            related.length ? React.createElement(
              "div",
              { className: "dsh-arch-links" },
              related.map((item) => React.createElement("span", { key: item.id, className: "dsh-arch-link" }, item.label + " \xB7 " + item.name))
            ) : null
          );
        } else if (selectedLayer) {
          const layerDesc = oneLine(selectedLayer.responsibility || selectedLayer.description, 120);
          const related = relatedInLayer(selectedLayer);
          inspect = React.createElement(
            "div",
            { className: "dsh-arch-inspect", "data-architecture-flow": selectedLayer.id },
            React.createElement("div", { className: "dsh-arch-inspect-kicker" }, t("arch.inspectLayer")),
            React.createElement("div", { className: "dsh-arch-inspect-title" }, selectedLayer.name),
            React.createElement("p", { className: "dsh-arch-inspect-body" }, layerDesc || t("arch.peersHint")),
            related.length ? React.createElement(
              "div",
              { className: "dsh-arch-links" },
              related.map((text, index) => React.createElement("span", { key: String(index), className: "dsh-arch-link" }, text))
            ) : null
          );
        }
        return React.createElement(
          "section",
          sectionProps,
          React.createElement("style", null, ARCH_DIAGRAM_CSS),
          React.createElement(
            "div",
            { className: "dsh-arch-head" },
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, t("arch.title")),
            React.createElement(
              "div",
              { className: "dsh-arch-pills" },
              styleLabel ? React.createElement("span", { className: "dsh-arch-pill", title: overview.architectureStyle || styleLabel }, styleLabel) : null,
              React.createElement("span", { className: "dsh-arch-pill" + (architecture.source === "hybrid" ? " is-brand" : "") }, sourceLabel)
            )
          ),
          purpose ? React.createElement("p", { className: "dsh-arch-purpose" }, purpose) : null,
          llmBar,
          React.createElement(
            "div",
            {
              className: "dsh-arch-board" + (selectedFlow ? " is-flowing" : ""),
              "data-architecture-diagram": "semantic-layers"
            },
            layerRows.map((layer) => {
              const items = componentsForLayer(layer);
              if (!items.length) return null;
              const active = selectedLayerId === layer.id;
              return React.createElement(
                "div",
                {
                  key: layer.id,
                  role: "button",
                  tabIndex: 0,
                  className: "dsh-arch-lane" + (active ? " is-active" : ""),
                  "data-architecture-layer": layer.id,
                  onClick: () => {
                    setSelectedFlowId(null);
                    if (selectedLayerId === layer.id && !selectedComponentId) setSelectedLayerId(null);
                    else {
                      setSelectedLayerId(layer.id);
                      setSelectedComponentId(null);
                    }
                  },
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.click();
                    }
                  }
                },
                React.createElement("div", { className: "dsh-arch-rail" }, layer.name),
                React.createElement(
                  "div",
                  { className: "dsh-arch-nodes" },
                  items.map((component) => {
                    const desc = oneLine(component.responsibility || component.description, 80);
                    const picked = selectedComponentId === component.id;
                    const inFlow = flowIds ? flowIds.has(component.id) : false;
                    return React.createElement(
                      "button",
                      {
                        key: component.id,
                        type: "button",
                        className: "dsh-arch-node" + (picked ? " is-picked" : "") + (inFlow ? " is-in-flow" : ""),
                        "data-architecture-component": component.id,
                        onClick: (event) => {
                          event.stopPropagation();
                          setSelectedFlowId(null);
                          setSelectedLayerId(layer.id);
                          setSelectedComponentId(picked ? null : component.id);
                        }
                      },
                      React.createElement("span", { className: "dsh-arch-node-name", title: component.name || component.label }, component.name || component.label),
                      React.createElement("span", { className: "dsh-arch-node-desc", title: desc || "" }, desc || "\xA0")
                    );
                  })
                )
              );
            })
          ),
          genuineFlows.length ? React.createElement(
            "div",
            { className: "dsh-arch-chips" },
            genuineFlows.map((flow) => React.createElement("button", {
              key: flow.id,
              type: "button",
              className: "dsh-arch-chip" + (selectedFlowId === flow.id ? " is-active" : ""),
              onClick: () => {
                setSelectedComponentId(null);
                setSelectedLayerId(null);
                setSelectedFlowId(selectedFlowId === flow.id ? null : flow.id);
              }
            }, flow.name || t("arch.flows")))
          ) : null,
          inspect,
          !inspect ? React.createElement("div", { className: "dsh-arch-hint" }, genuineFlows.length ? t("arch.select") : t("arch.select") + " \xB7 " + t("arch.peersHint")) : null
        );
      }
      function ActionsBlock({ t, localeCode }) {
        const buttonStyle = () => ({
          flex: "1 1 0",
          padding: "9px 14px",
          background: "linear-gradient(135deg, var(--dsw-alias-bg-layer-2) 0%, var(--dsw-alias-bg-layer-1) 100%)",
          color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "500",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "transform 0.1s ease, opacity 0.1s ease, background 0.15s ease"
        });
        return React.createElement(
          "section",
          { style: Object.assign({}, sectionStyle, { padding: "10px 14px" }), "data-block": "actions" },
          React.createElement(
            "div",
            { style: { display: "flex", gap: "8px" } },
            React.createElement(
              "button",
              {
                "data-action": "toggle-dashboard",
                style: buttonStyle(),
                onClick: (e) => toggleDashboard(e, t),
                title: localeCode === "en-US" ? "View full project dashboard" : "\u67E5\u770B\u9879\u76EE\u5B8C\u6574\u6570\u636E\u5FEB\u7167"
              },
              React.createElement("span", { style: { fontSize: "16px" } }, "\u{1F4CA}"),
              React.createElement(
                "span",
                { style: { flex: "1 1 auto", textAlign: "left" } },
                React.createElement(
                  "div",
                  { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.2" } },
                  React.createElement("span", null, localeCode === "en-US" ? "View Dashboard" : "\u67E5\u770B Dashboard"),
                  React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "400", margin: "0 4px" } }, "\xB7"),
                  React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "400" } }, localeCode === "en-US" ? "Project Overview" : "\u9879\u76EE\u5168\u666F")
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "1px" } },
                  localeCode === "en-US" ? "Tech stack \xB7 todos \xB7 memories \xB7 timeline" : "\u6280\u672F\u6808 \xB7 \u5F85\u529E \xB7 \u8BB0\u5FC6 \xB7 \u65F6\u95F4\u7EBF"
                )
              ),
              React.createElement("span", { "data-dashboard-indicator": "1", style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "\u25BE")
            )
          )
        );
      }
      const ONBOARDING_PHASES = [
        { key: "scanning", icon: "\u{1F50D}", label: "\u626B\u63CF\u9879\u76EE\u7ED3\u6784\u2026" },
        { key: "graph", icon: "\u{1F3DB}\uFE0F", label: "\u6784\u5EFA\u67B6\u6784\u5173\u7CFB\u2026" },
        { key: "analyzing", icon: "\u{1F9E0}", label: "DSH LLM \u8BED\u4E49\u5206\u6790\u2026" },
        { key: "done", icon: "\u2705", label: "\u67B6\u6784\u4E0E\u9879\u76EE\u8111\u5DF2\u751F\u6210" }
      ];
      const ONBOARDING_FEATURES = [
        { icon: "\u2318", titleKey: "onboarding.f1.title", descKey: "onboarding.f1.desc" },
        { icon: "\u25C7", titleKey: "onboarding.f2.title", descKey: "onboarding.f2.desc" },
        { icon: "\u2713", titleKey: "onboarding.f3.title", descKey: "onboarding.f3.desc" }
      ];
      function OnboardingBlock({ t, path, sessionId, onComplete, connection }) {
        const [phase, setPhase] = React.useState("idle");
        const [phaseStep, setPhaseStep] = React.useState(0);
        const [errMsg, setErrMsg] = React.useState("");
        const [result, setResult] = React.useState(null);
        const rpc = connection && connection.rpc;
        const ctaBase = {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          width: "100%",
          padding: "12px 16px",
          background: "linear-gradient(135deg, var(--dsw-alias-brand-primary) 0%, var(--dsw-alias-brand-secondary, var(--dsw-alias-brand-primary)) 100%)",
          color: "var(--dsw-alias-bg-base)",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
          fontFamily: "inherit",
          marginTop: "16px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          transition: "transform 0.1s ease, box-shadow 0.15s ease, opacity 0.2s ease"
        };
        const ctaLoading = Object.assign({}, ctaBase, {
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          cursor: "wait",
          opacity: 0.85,
          boxShadow: "none"
        });
        const ctaError = Object.assign({}, ctaBase, {
          background: "var(--dsw-alias-state-error-primary)"
        });
        const stepStyle = (num, label, desc) => React.createElement(
          "div",
          { style: { display: "flex", gap: "10px", padding: "8px 0", alignItems: "flex-start" } },
          React.createElement("div", { style: { flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-bg-base)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700" } }, num),
          React.createElement(
            "div",
            null,
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", marginBottom: "2px" } }, label),
            React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.4" } }, desc)
          )
        );
        function advancePhase(stepIdx) {
          setPhaseStep(stepIdx);
        }
        async function startScan() {
          if (phase === "loading") return;
          setErrMsg("");
          setResult(null);
          setPhase("loading");
          advancePhase(0);
          if (!sessionId) {
            setPhase("error");
            setErrMsg("\u672A\u627E\u5230\u5F53\u524D Session\uFF0C\u8BF7\u5148\u5728 DSH \u4E2D\u6253\u5F00\u8BE5\u9879\u76EE");
            return;
          }
          if (!rpc || typeof rpc.call !== "function") {
            setPhase("error");
            setErrMsg("DSH Connection RPC \u4E0D\u53EF\u7528\uFF0C\u8BF7\u786E\u8BA4\u63D2\u4EF6\u4F9D\u8D56\u5DF2\u6B63\u786E\u5B89\u88C5");
            return;
          }
          const timers = [];
          timers.push(setTimeout(() => advancePhase(1), 700));
          timers.push(setTimeout(() => advancePhase(2), 1500));
          let resp;
          try {
            resp = await rpc.call(
              "/project-brain",
              "init",
              { sessionId: sessionId || void 0 }
            );
          } catch (e) {
            timers.forEach((id) => clearTimeout(id));
            setPhase("error");
            setErrMsg(String(e && e.message || e));
            return;
          }
          timers.forEach((id) => clearTimeout(id));
          const okFlag = resp && resp.ok;
          const dataObj = resp && resp.value || {};
          if (okFlag) {
            advancePhase(3);
            setResult(dataObj);
            if (typeof onComplete === "function") {
              try {
                onComplete(dataObj);
              } catch (e) {
              }
            }
          } else {
            const errStr = resp && resp.error && resp.error.message || "\u672A\u77E5\u9519\u8BEF";
            setPhase("error");
            setErrMsg(errStr);
          }
        }
        function retry() {
          setPhase("idle");
          setErrMsg("");
          setResult(null);
        }
        let ctaNode;
        if (phase === "loading") {
          ctaNode = React.createElement(
            "div",
            { style: { marginTop: "16px" }, "data-block": "onboarding-loading" },
            // 转圈圈：CSS conic-gradient 实现（不依赖 framer-motion / 第三方）
            React.createElement(
              "div",
              {
                style: Object.assign({}, ctaLoading),
                "data-loading-state": "scanning"
              },
              React.createElement("span", {
                "data-spinner": "1",
                style: {
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  border: "2px solid var(--dsw-alias-border-l2)",
                  borderTopColor: "var(--dsw-alias-brand-primary)",
                  animation: "dsh-brain-spin 0.9s linear infinite",
                  display: "inline-block"
                }
              }),
              React.createElement("span", null, ONBOARDING_PHASES[phaseStep] ? ONBOARDING_PHASES[phaseStep].label : "\u5206\u6790\u4E2D\u2026")
            ),
            // 进度指示（4 步）
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "6px",
                  justifyContent: "center",
                  marginTop: "10px",
                  fontSize: "10px",
                  color: "var(--dsw-alias-label-secondary)"
                }
              },
              ONBOARDING_PHASES.map(
                (p, i) => React.createElement(
                  "span",
                  {
                    key: p.key,
                    style: {
                      padding: "2px 8px",
                      borderRadius: "8px",
                      background: i <= phaseStep ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
                      color: i <= phaseStep ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)",
                      fontWeight: "600"
                    }
                  },
                  p.icon + " " + p.label
                )
              )
            )
          );
        } else if (phase === "error") {
          ctaNode = React.createElement(
            "div",
            { style: { marginTop: "16px" }, "data-block": "onboarding-error" },
            React.createElement(
              "div",
              {
                style: {
                  padding: "10px 12px",
                  background: "rgba(220,38,38,0.08)",
                  color: "var(--dsw-alias-state-error-primary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  marginBottom: "10px",
                  border: "1px solid rgba(220,38,38,0.25)"
                }
              },
              React.createElement("div", { style: { fontWeight: "600", marginBottom: "4px" } }, "\u274C \u542F\u52A8\u5931\u8D25"),
              React.createElement("div", null, errMsg || "\u672A\u77E5\u9519\u8BEF")
            ),
            React.createElement(
              "button",
              {
                style: ctaBase,
                onClick: retry,
                "data-action": "retry"
              },
              React.createElement("span", { style: { fontSize: "16px" } }, "\u{1F501}"),
              React.createElement("span", null, "\u91CD\u8BD5")
            ),
            React.createElement(
              "button",
              {
                style: {
                  background: "transparent",
                  border: "none",
                  color: "var(--dsw-alias-label-secondary)",
                  cursor: "pointer",
                  fontSize: "11px",
                  marginTop: "8px",
                  padding: "4px 8px",
                  width: "100%",
                  fontFamily: "inherit"
                },
                onClick: () => copyPrompt(t("onboarding.copyPrompt"), null, "\u5DF2\u590D\u5236", "\u590D\u5236\u5931\u8D25")
              },
              "\u{1F4CB} \u590D\u5236\u542F\u52A8\u6307\u4EE4\uFF08\u515C\u5E95\uFF09"
            )
          );
        } else {
          ctaNode = React.createElement(
            "button",
            {
              style: ctaBase,
              onClick: startScan,
              "data-action": "start-brain"
            },
            React.createElement("span", { style: { fontSize: "16px" } }, "\u25B6\uFE0F"),
            React.createElement("span", null, t("onboarding.cta"))
          );
        }
        return React.createElement(
          "section",
          { style: Object.assign({}, sectionStyle, { padding: "24px", background: "linear-gradient(180deg, var(--dsw-alias-bg-layer-1) 0%, var(--dsw-alias-bg-layer-2) 100%)" }), "data-block": "onboarding" },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
            React.createElement("span", { style: { fontSize: "28px" } }, "\u{1F9E0}"),
            React.createElement(
              "div",
              null,
              React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0, fontSize: "15px" }) }, t("onboarding.title")),
              React.createElement("p", { style: { margin: "2px 0 0", fontSize: "12px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5" } }, t("onboarding.body"))
            )
          ),
          React.createElement(
            "div",
            {
              "data-block": "onboarding-features",
              style: { margin: "12px 0 4px", padding: "10px 14px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" }
            },
            ...ONBOARDING_FEATURES.map((f, idx) => React.createElement(
              "div",
              { key: f.titleKey, style: { display: "flex", gap: "10px", padding: idx === 0 ? "2px 0 6px" : "6px 0", alignItems: "flex-start" } },
              React.createElement("span", { style: { fontSize: "14px", flex: "0 0 auto", lineHeight: "1.35", width: "18px", textAlign: "center" } }, f.icon),
              React.createElement(
                "div",
                null,
                React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4" } }, t(f.titleKey)),
                React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.45", marginTop: "1px" } }, t(f.descKey))
              )
            )),
            React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "6px", paddingTop: "8px", borderTop: "1px dashed var(--dsw-alias-border-l1)" } }, t("onboarding.more"))
          ),
          // path 提示（让用户知道会扫哪个目录）
          // v0.5.1：即使 build-time map miss，只要 sessionId 存在，host 端 initProject RPC
          //   会用 getCwdBySession 兜底解析 cwd，所以这里不应该再显示"未检测到 workspace 路径"
          //   警告；改为显示"等待从 sessionId 解析"提示，让用户知道会自动兜底。
          path ? React.createElement(
            "div",
            {
              style: {
                marginTop: "12px",
                fontSize: "10px",
                color: "var(--dsw-alias-label-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                wordBreak: "break-all"
              },
              "data-workspace-path": path
            },
            React.createElement("span", null, "\u{1F4C2}"),
            React.createElement("span", { style: { fontFamily: "monospace" } }, path)
          ) : sessionId ? React.createElement(
            "div",
            {
              style: {
                marginTop: "12px",
                fontSize: "10px",
                color: "var(--dsw-alias-label-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              },
              "data-workspace-session-id": String(sessionId).slice(0, 12) + "\u2026"
            },
            React.createElement("span", null, "\u{1F50C}"),
            React.createElement("span", null, "build \u672A\u7EB3\u5165\u6B64 session\uFF0C\u70B9\u51FB\u542F\u52A8\u5C06\u7531 host \u81EA\u52A8\u89E3\u6790\u8DEF\u5F84")
          ) : React.createElement(
            "div",
            {
              style: {
                marginTop: "12px",
                fontSize: "11px",
                color: "var(--dsw-alias-state-warn-primary)",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }
            },
            React.createElement("span", null, "\u26A0\uFE0F"),
            React.createElement("span", null, "\u672A\u68C0\u6D4B\u5230 workspace \u8DEF\u5F84")
          ),
          ctaNode,
          // 注入转圈动画 keyframes（一次性）
          React.createElement("style", null, "@keyframes dsh-brain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }")
        );
      }
      const SUGGESTION_TTL_MS = 5 * 60 * 1e3;
      const suggestionCache = /* @__PURE__ */ new Map();
      function SuggestionCard({ t, localeCode, sessionId, connection, projectInitialized, embeddedSuggestion, workspacePath }) {
        const cacheKey = workspacePath ? String(workspacePath) : null;
        const cached = cacheKey ? suggestionCache.get(cacheKey) : null;
        const initialState = cached ? { status: cached.status, data: cached.data, error: cached.error } : workspacePath ? { status: embeddedSuggestion ? "ready" : "idle", data: embeddedSuggestion || null, error: null } : { status: "loading", data: null, error: null };
        const [state, setState] = React.useState(initialState);
        const [dismissed, setDismissed] = React.useState(Boolean(cached && cached.dismissed));
        const fetchSuggestion = React.useCallback(async (force) => {
          const rpc = connection && connection.rpc;
          if (!sessionId || !rpc || typeof rpc.call !== "function") return;
          const cur = suggestionCache.get(cacheKey);
          if (!force && cur && cur.status === "ready" && cur.data && Date.now() - (cur.fetchedAt || 0) < SUGGESTION_TTL_MS) {
            setState({ status: cur.status, data: cur.data, error: cur.error });
            return;
          }
          setState({ status: "loading", data: cur && cur.data || state.data || null, error: null });
          try {
            const payload = { sessionId };
            if (cacheKey) payload.workspacePath = cacheKey;
            const res = await rpc.call("/project-brain", "suggest", payload);
            if (!res) {
              setState({ status: "error", data: null, error: "RPC \u8FD4\u56DE undefined" });
              return;
            }
            if (res.ok === false) {
              const ec = res.error && res.error.code || "?";
              const em = res.error && res.error.message || "(no message)";
              setState({ status: "error", data: null, error: "RPC ok=false \xB7 " + ec + " \xB7 " + em });
              return;
            }
            if (res.ok && res.value && res.value.suggestion && res.value.suggestion.suggestion) {
              suggestionCache.set(cacheKey, {
                fetchedAt: Date.now(),
                status: "ready",
                data: res.value.suggestion,
                error: null,
                dismissed: false
              });
              setState({ status: "ready", data: res.value.suggestion, error: null });
              return;
            }
            let errMsg = "\u667A\u80FD\u7EED\u63A5\u5931\u8D25";
            if (res.error && res.error.message) errMsg = res.error.message + " (" + (res.error.code || "?") + ")";
            else if (!res.value) errMsg = "RPC value \u4E3A\u7A7A";
            else if (!res.value.suggestion) errMsg = "value.suggestion \u4E3A\u7A7A";
            else errMsg = "\u672A\u77E5\u72B6\u6001\uFF1A" + JSON.stringify(res).slice(0, 200);
            setState({ status: "error", data: null, error: errMsg });
          } catch (error) {
            setState({ status: "error", data: null, error: "throw: " + String(error && error.message || error) });
          }
        }, [sessionId, connection, cacheKey, state.data]);
        React.useEffect(() => {
          if (!projectInitialized) {
            setState({ status: "uninitialized", data: null, error: null });
            return;
          }
          if (dismissed) return;
          const rpc = connection && connection.rpc;
          if (!rpc || !sessionId) return;
          if (!cacheKey) {
            setState({ status: "loading", data: null, error: null });
            return;
          }
          const cur = suggestionCache.get(cacheKey);
          if (cur && cur.status === "ready" && cur.data && Date.now() - (cur.fetchedAt || 0) < SUGGESTION_TTL_MS) {
            return;
          }
          fetchSuggestion(false);
        }, [projectInitialized, dismissed, fetchSuggestion, sessionId, connection, cacheKey]);
        React.useEffect(() => {
          if (typeof window === "undefined" || !window.addEventListener) return void 0;
          const handler = (event) => {
            const ev = event && event.detail;
            const changedPath = ev && typeof ev.projectPath === "string" ? ev.projectPath : null;
            if (changedPath && cacheKey && changedPath !== cacheKey) return;
            const c = suggestionCache.get(cacheKey);
            if (c) {
              c.fetchedAt = 0;
              suggestionCache.set(cacheKey, c);
            }
          };
          window.addEventListener("project_brain/preview.changed", handler);
          return () => window.removeEventListener("project_brain/preview.changed", handler);
        }, [cacheKey]);
        if (!projectInitialized) {
          return React.createElement(
            "div",
            {
              style: {
                margin: "0 12px 8px",
                padding: "8px 12px",
                background: "var(--dsw-alias-bg-layer-2)",
                border: "1px dashed var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                color: "var(--dsw-alias-label-secondary)",
                fontSize: "11px"
              },
              "data-block": "suggestion-uninit",
              "data-suggest-status": "uninit"
            },
            React.createElement("span", null, "\u{1F4A1} "),
            React.createElement("span", null, localeCode === "en-US" ? "Init project brain to see today's continuation." : "\u521D\u59CB\u5316\u9879\u76EE\u8111\u540E\u67E5\u770B\u4ECA\u5929\u53EF\u80FD\u63A8\u8FDB\u7684\u5185\u5BB9\u3002")
          );
        }
        if (dismissed) {
          return React.createElement(
            "div",
            { style: { padding: "0 12px 8px" }, "data-block": "suggestion-dismissed" },
            React.createElement(
              "button",
              {
                type: "button",
                onClick: () => {
                  setDismissed(false);
                  const c = suggestionCache.get(cacheKey);
                  if (c) c.dismissed = false;
                  fetchSuggestion(true);
                },
                style: {
                  padding: "4px 10px",
                  background: "transparent",
                  border: "1px dashed var(--dsw-alias-border-l1)",
                  borderRadius: "8px",
                  color: "var(--dsw-alias-label-secondary)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "inherit"
                },
                "data-action": "suggest-show"
              },
              "\u{1F4A1} " + (localeCode === "en-US" ? "Show suggestion" : "\u67E5\u770B\u7EED\u63A5\u5EFA\u8BAE")
            )
          );
        }
        const data = state.data || {};
        const suggestion = data.suggestion || null;
        const source = data.source || (state.status === "loading" ? "loading" : null);
        let tag;
        if (source === "llm") tag = t("suggest.llmTag");
        else if (source === "llm_failed" || source === "local") tag = t("suggest.localTag");
        else if (source === "local_no_route") tag = t("suggest.localTag");
        else tag = null;
        const confidencePct = suggestion && Number.isFinite(suggestion.confidence) ? Math.round(suggestion.confidence * 100) : null;
        const cardStyle = {
          margin: "0 12px 8px",
          padding: "10px 12px",
          background: "linear-gradient(135deg, var(--dsw-alias-bg-layer-2) 0%, var(--dsw-alias-bg-layer-1) 100%)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderLeft: "3px solid var(--dsw-alias-brand-primary)",
          borderRadius: "10px",
          color: "var(--dsw-alias-label-primary)"
        };
        const titleRow = React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          React.createElement("span", { style: { fontSize: "13px", fontWeight: "700" } }, t("suggest.title")),
          tag ? React.createElement("span", {
            style: {
              fontSize: "10px",
              padding: "1px 7px",
              borderRadius: "8px",
              background: source === "llm" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
              color: source === "llm" ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)",
              fontWeight: "600"
            },
            "data-suggest-source": source
          }, tag) : null,
          confidencePct != null && source === "llm" ? React.createElement("span", {
            style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" }
          }, t("suggest.confidence", { pct: confidencePct })) : null,
          React.createElement("span", { style: { flex: "1 1 auto" } }),
          state.status === "ready" ? React.createElement("button", {
            type: "button",
            onClick: () => {
              setDismissed(true);
              const c = suggestionCache.get(cacheKey);
              if (c) c.dismissed = true;
            },
            title: t("suggest.dismiss"),
            "data-action": "suggest-dismiss",
            style: { padding: "2px 8px", background: "transparent", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10px", fontFamily: "inherit" }
          }, t("suggest.dismiss")) : null,
          state.status !== "loading" ? React.createElement("button", {
            type: "button",
            onClick: () => fetchSuggestion(true),
            title: t("suggest.refresh"),
            "data-action": "suggest-refresh",
            style: { padding: "2px 8px", background: "transparent", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10px", fontFamily: "inherit" }
          }, "\u21BB " + t("suggest.refresh")) : null
        );
        let bodyContent;
        if (state.status === "loading") {
          bodyContent = React.createElement(
            "div",
            { style: { marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
            React.createElement("span", { "data-spinner": "1", style: { width: "12px", height: "12px", borderRadius: "50%", border: "2px solid var(--dsw-alias-border-l2)", borderTopColor: "var(--dsw-alias-brand-primary)", animation: "dsh-brain-spin 0.9s linear infinite", display: "inline-block" } }),
            t("suggest.loading")
          );
        } else if (state.status === "error") {
          bodyContent = React.createElement(
            "div",
            { style: { marginTop: "8px", fontSize: "12px", color: "var(--dsw-alias-state-error-primary)" } },
            "\u274C " + (state.error || t("suggest.empty"))
          );
        } else if (!suggestion) {
          bodyContent = React.createElement(
            "div",
            { style: { marginTop: "8px", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
            t("suggest.empty")
          );
        } else {
          bodyContent = React.createElement(
            "div",
            { style: { marginTop: "8px" }, "data-suggestion": "ready" },
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.5" }, "data-suggestion-title": "1" }, suggestion.title || ""),
            suggestion.reason ? React.createElement(
              "div",
              { style: { marginTop: "6px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5" }, "data-suggestion-reason": "1" },
              React.createElement("span", { style: { fontWeight: "600" } }, t("suggest.reasonLabel") + "\uFF1A"),
              " " + suggestion.reason
            ) : null,
            data.llmError ? React.createElement(
              "div",
              { style: { marginTop: "6px", fontSize: "10px", color: "var(--dsw-alias-state-warn-primary)" }, "data-suggestion-llm-error": "1" },
              t("suggest.fallbackTag") + "\uFF1A" + (data.llmError.message || data.llmError.code || "")
            ) : null
          );
        }
        return React.createElement(
          "div",
          { style: cardStyle, "data-block": "suggestion", "data-source": source || "unknown" },
          titleRow,
          bodyContent
        );
      }
      function GitTab({ gitInfo, t, onRefresh, autoRefresh, onToggleAutoRefresh }) {
        if (!gitInfo) {
          return React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "git-loading" }, "\u23F3 \u52A0\u8F7D git \u5386\u53F2...");
        }
        if (gitInfo.available !== true) {
          return React.createElement(
            "div",
            { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "git-empty" },
            "\u{1F4C2} \u5F53\u524D\u9879\u76EE\u4E0D\u662F git \u4ED3\u5E93",
            gitInfo.error ? React.createElement("div", { style: { marginTop: "6px", fontSize: "10px", opacity: 0.7 } }, gitInfo.error) : null
          );
        }
        const commits = gitInfo.commits || [];
        const branches = gitInfo.branches || [];
        const currentBranch = gitInfo.currentBranch;
        const [expanded, setExpanded] = React.useState(null);
        const relTime = (ts) => {
          if (!ts) return "";
          const diff = Date.now() / 1e3 - ts;
          if (diff < 60) return Math.round(diff) + "\u79D2\u524D";
          if (diff < 3600) return Math.round(diff / 60) + "\u5206\u949F\u524D";
          if (diff < 86400) return Math.round(diff / 3600) + "\u5C0F\u65F6\u524D";
          if (diff < 30 * 86400) return Math.round(diff / 86400) + "\u5929\u524D";
          if (diff < 365 * 86400) return Math.round(diff / 2592e3) + "\u4E2A\u6708\u524D";
          return Math.round(diff / 31536e3) + "\u5E74\u524D";
        };
        const fmtDate = (ts) => {
          if (!ts) return "";
          const d = new Date(ts * 1e3);
          return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        };
        const refsByHash = /* @__PURE__ */ new Map();
        for (const b of branches) {
          if (!refsByHash.has(b.commit)) refsByHash.set(b.commit, []);
          refsByHash.get(b.commit).push({ kind: "branch", name: b.name, isCurrent: b.name === currentBranch });
        }
        const palette = [
          { fg: "#1f6feb", bg: "#ddf4ff" },
          // 蓝
          { fg: "#1a7f37", bg: "#dafbe1" },
          // 绿
          { fg: "#8250df", bg: "#fbefff" },
          // 紫
          { fg: "#cf222e", bg: "#ffebe9" },
          // 红
          { fg: "#9a6700", bg: "#fff8c5" },
          // 黄
          { fg: "#0a3069", bg: "#dbeafe" }
          // 深蓝
        ];
        const colorByBranch = /* @__PURE__ */ new Map();
        let colorIdx = 0;
        for (const b of branches) {
          if (!colorByBranch.has(b.name)) {
            colorByBranch.set(b.name, palette[colorIdx % palette.length]);
            colorIdx += 1;
          }
        }
        const cardStyle = {
          background: "var(--dsw-alias-bg-layer-2)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "10px",
          padding: "12px 14px",
          marginBottom: "10px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap"
        };
        const branchChipStyle = (isCurrent) => ({
          fontSize: "11px",
          padding: "3px 10px",
          borderRadius: "11px",
          background: isCurrent ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-base)",
          color: isCurrent ? "var(--dsh-brain-bg-base, var(--dsw-alias-bg-base))" : "var(--dsw-alias-label-primary)",
          border: isCurrent ? "none" : "1px solid var(--dsw-alias-border-l1)",
          fontWeight: "600",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px"
        });
        const listStyle = { listStyle: "none", padding: "0", margin: 0 };
        const rowStyle = (expanded2) => ({
          display: "grid",
          gridTemplateColumns: "56px minmax(0, 1fr) 130px",
          gap: "10px",
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: "8px",
          marginBottom: "2px",
          cursor: "pointer",
          background: expanded2 ? "var(--dsw-alias-bg-layer-1)" : "transparent",
          transition: "background-color 0.12s"
        });
        const graphCellStyle = {
          position: "relative",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        const dotStyle = (idx, isMerge) => ({
          width: "11px",
          height: "11px",
          borderRadius: isMerge ? "2px" : "50%",
          transform: isMerge ? "rotate(45deg)" : "none",
          background: idx === 0 ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-base)",
          border: idx === 0 ? "2px solid var(--dsw-alias-brand-primary)" : "2px solid var(--dsw-alias-label-secondary)",
          zIndex: 2,
          boxShadow: idx === 0 ? "0 0 0 3px var(--dsw-alias-bg-layer-1)" : "none"
        });
        const lineStyle = (idx, total2) => ({
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--dsw-alias-border-l2)",
          zIndex: 1,
          ...idx === 0 ? { top: "calc(50% + 6px)", height: "calc(50% - 6px)" } : idx === total2 - 1 ? { top: 0, height: "calc(50% - 6px)" } : { top: 0, bottom: 0 },
          width: "2px"
        });
        const subjectStyle = {
          fontSize: "13px",
          color: "var(--dsw-alias-label-primary)",
          fontWeight: "600",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: "1.4"
        };
        const metaStyle = {
          fontSize: "10.5px",
          color: "var(--dsw-alias-label-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "3px",
          flexWrap: "wrap"
        };
        const hashChipStyle = {
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: "10px",
          padding: "1px 6px",
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-secondary)",
          borderRadius: "4px",
          border: "1px solid var(--dsw-alias-border-l1)"
        };
        const refsCellStyle = {
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          justifyContent: "flex-end",
          alignItems: "center"
        };
        const refChipStyle = (isCurrent, color) => ({
          fontSize: "10px",
          padding: "1px 7px",
          borderRadius: "9px",
          background: isCurrent ? color.fg : color.bg,
          color: isCurrent ? "var(--dsw-alias-bg-base)" : color.fg,
          border: "1px solid " + (isCurrent ? color.fg : color.bg),
          fontWeight: isCurrent ? "700" : "500",
          whiteSpace: "nowrap"
        });
        const expandedPanelStyle = {
          gridColumn: "2 / -1",
          marginTop: "8px",
          padding: "12px 14px",
          background: "var(--dsw-alias-bg-layer-2)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          fontSize: "11.5px",
          color: "var(--dsw-alias-label-primary)"
        };
        const detailRowStyle = {
          display: "grid",
          gridTemplateColumns: "70px minmax(0, 1fr)",
          gap: "8px",
          padding: "3px 0",
          fontSize: "11px"
        };
        const detailLabelStyle = {
          color: "var(--dsw-alias-label-secondary)",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.4px"
        };
        const monospaceStyle = {
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: "10.5px"
        };
        const bodyTextStyle = {
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "1.55",
          color: "var(--dsw-alias-label-primary)",
          padding: "8px 10px",
          background: "var(--dsw-alias-bg-base)",
          borderRadius: "6px",
          marginBottom: "10px",
          fontSize: "11.5px"
        };
        const total = commits.length;
        const renderRow = (c, idx) => {
          const isExpanded = expanded === c.hash;
          const refs = refsByHash.get(c.hash) || [];
          return React.createElement(
            "div",
            {
              key: c.hash,
              style: rowStyle(isExpanded),
              "data-commit": c.hash,
              "data-expanded": isExpanded ? "1" : "0",
              onClick: (ev) => {
                const tag = ev && ev.target && ev.target.tagName;
                if (tag === "A" || tag === "BUTTON") return;
                setExpanded(isExpanded ? null : c.hash);
              }
            },
            // graph column
            React.createElement(
              "div",
              { style: graphCellStyle },
              React.createElement("div", { style: lineStyle(idx, total) }),
              React.createElement("div", { style: dotStyle(idx, c.isMerge) })
            ),
            // info column
            React.createElement(
              "div",
              { style: { minWidth: 0 } },
              React.createElement("div", { style: subjectStyle, title: c.subject }, c.subject || "(\u65E0\u6807\u9898)"),
              React.createElement(
                "div",
                { style: metaStyle },
                React.createElement("span", { style: hashChipStyle }, c.shortHash),
                React.createElement("span", { style: { fontWeight: "500" } }, c.author || "?"),
                React.createElement("span", null, "\xB7"),
                React.createElement("span", { title: c.isoTime || "" }, relTime(c.timestamp)),
                c.isMerge ? React.createElement("span", { style: { color: "var(--dsw-alias-state-warn-primary)", fontSize: "10px" } }, "\u2387 merge") : null,
                // v0.4.x: 变更文件摘要（来自 history.js 的 tree diff；pack 不可读时为 0）
                typeof c.filesChangedTotal === "number" && c.filesChangedTotal > 0 ? (() => {
                  const fileStatText = "\u{1F4C1} " + (c.filesAdded ? "+" + c.filesAdded + " " : "") + (c.filesModified ? "~" + c.filesModified + " " : "") + (c.filesRemoved ? "-" + c.filesRemoved + " " : "") + "(" + c.filesChangedTotal + " \u6587\u4EF6)";
                  return React.createElement("span", {
                    style: { fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }
                  }, fileStatText);
                })() : null
              ),
              // 展开后的详情
              isExpanded ? React.createElement(
                "div",
                { style: expandedPanelStyle },
                c.body ? React.createElement("div", { style: bodyTextStyle }, c.body) : React.createElement("div", { style: Object.assign({}, bodyTextStyle, { opacity: 0.6, fontStyle: "italic" }) }, "\uFF08\u65E0\u8BE6\u7EC6\u63CF\u8FF0\uFF09"),
                React.createElement(
                  "div",
                  { style: detailRowStyle },
                  React.createElement("div", { style: detailLabelStyle }, "Hash"),
                  React.createElement("div", { style: monospaceStyle }, c.hash)
                ),
                c.authorEmail ? React.createElement(
                  "div",
                  { style: detailRowStyle },
                  React.createElement("div", { style: detailLabelStyle }, "Author"),
                  React.createElement("div", null, c.author + " <" + c.authorEmail + ">")
                ) : null,
                React.createElement(
                  "div",
                  { style: detailRowStyle },
                  React.createElement("div", { style: detailLabelStyle }, "Date"),
                  React.createElement("div", null, fmtDate(c.timestamp) + " " + (c.isoTime || "").slice(11, 19) + " UTC")
                ),
                c.firstParent ? React.createElement(
                  "div",
                  { style: detailRowStyle },
                  React.createElement("div", { style: detailLabelStyle }, "Parent"),
                  React.createElement("div", { style: monospaceStyle }, c.firstParent)
                ) : null,
                c.extraParents && c.extraParents.length > 0 ? React.createElement(
                  "div",
                  { style: detailRowStyle },
                  React.createElement("div", { style: detailLabelStyle }, "Merged"),
                  React.createElement("div", { style: monospaceStyle, color: "var(--dsw-alias-state-warn-primary)" }, c.extraParents.join(", "))
                ) : null,
                // v0.4.x: Changed Files 列表（tree diff 失败时不显示）
                Array.isArray(c.filesChanged) && c.filesChanged.length > 0 ? React.createElement(
                  "div",
                  { style: Object.assign({}, detailRowStyle, { alignItems: "flex-start" }) },
                  React.createElement("div", { style: detailLabelStyle }, "Files"),
                  React.createElement(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                    c.filesChanged.map(
                      (f) => React.createElement("span", {
                        key: f,
                        style: { fontSize: "10px", fontFamily: "ui-monospace, monospace", padding: "1px 6px", background: "var(--dsw-alias-bg-base)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "3px", color: "var(--dsw-alias-label-primary)", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                        title: f
                      }, f)
                    ),
                    c.filesTruncated ? React.createElement("span", {
                      style: { fontSize: "10px", padding: "1px 6px", color: "var(--dsw-alias-label-secondary)", fontStyle: "italic" }
                    }, "\u2026 +" + (c.filesChangedTotal - c.filesChanged.length) + " more") : null
                  )
                ) : null
              ) : null
            ),
            // refs column
            React.createElement(
              "div",
              { style: refsCellStyle },
              refs.map((r) => {
                const color = colorByBranch.get(r.name) || palette[0];
                return React.createElement("span", {
                  key: r.name,
                  style: refChipStyle(r.isCurrent, color),
                  title: "refs/heads/" + r.name + (r.isCurrent ? " (current)" : "")
                }, r.name);
              })
            )
          );
        };
        const otherBranches = branches.filter((b) => b.name !== currentBranch);
        const wt = gitInfo && gitInfo.workTree;
        const [wtExpanded, setwtExpanded] = React.useState(false);
        const renderWorkTreeSection = (workTree) => {
          if (!workTree || workTree.available !== true) return null;
          const untrackedTotal = workTree.untrackedTotal || 0;
          const deletedTotal = workTree.deletedTotal || 0;
          if (untrackedTotal === 0 && deletedTotal === 0) return null;
          const wtCardStyle = {
            margin: "12px 0 4px",
            padding: "12px 14px",
            background: "var(--dsw-alias-bg-layer-2)",
            border: "1px solid var(--dsw-alias-border-l1)",
            borderRadius: "10px",
            fontSize: "12px"
          };
          const wtHeaderStyle = {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: untrackedTotal + deletedTotal > 0 && wtExpanded ? "10px" : 0,
            cursor: "pointer",
            userSelect: "none"
          };
          const fileRowStyle = {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "3px 0",
            fontFamily: "ui-monospace, monospace",
            fontSize: "10.5px",
            color: "var(--dsw-alias-label-primary)"
          };
          const filePathStyle = {
            padding: "1px 6px",
            background: "var(--dsw-alias-bg-base)",
            border: "1px solid var(--dsw-alias-border-l1)",
            borderRadius: "3px",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          };
          const statusBadgeStyle = (kind) => ({
            fontSize: "10px",
            padding: "1px 7px",
            borderRadius: "9px",
            fontWeight: "600",
            flex: "0 0 auto",
            background: kind === "untracked" ? "var(--dsw-alias-state-warn-bg, var(--dsw-alias-bg-layer-2))" : "var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2))",
            color: kind === "untracked" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-state-error-primary)"
          });
          const renderFileGroup = (label, kind, sample, total2, truncated) => {
            if (total2 === 0) return null;
            const visible = wtExpanded ? sample : sample.slice(0, 8);
            return React.createElement(
              "div",
              { style: { marginBottom: "8px" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
                React.createElement("span", { style: statusBadgeStyle(kind) }, label),
                React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, total2 + " \u6587\u4EF6" + (truncated ? "\uFF08\u5DF2\u622A\u65AD\uFF09" : ""))
              ),
              visible.length > 0 ? React.createElement(
                "div",
                { style: { paddingLeft: "8px" } },
                visible.map(
                  (f) => React.createElement(
                    "div",
                    { key: f, style: fileRowStyle, title: f },
                    React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", flex: "0 0 auto" } }, "\u2022"),
                    React.createElement("span", { style: filePathStyle }, f)
                  )
                ),
                !wtExpanded && sample.length > 8 ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", paddingLeft: "16px" } }, "+ " + (sample.length - 8) + " \u66F4\u591A\uFF08\u70B9\u51FB\u5C55\u5F00\u67E5\u770B\u5168\u90E8\uFF09") : null,
                wtExpanded && truncated ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", paddingLeft: "16px" } }, "\uFF08\u540E\u7AEF\u5DF2\u622A\u65AD\uFF0C\u5168\u90E8 " + total2 + " \u4E2A\uFF09") : null
              ) : null
            );
          };
          return React.createElement(
            "div",
            { style: wtCardStyle, "data-block": "work-tree" },
            React.createElement(
              "div",
              { style: wtHeaderStyle, onClick: () => setwtExpanded(!wtExpanded) },
              React.createElement("span", { style: { fontSize: "14px" } }, "\u{1F538}"),
              React.createElement("span", { style: { fontWeight: "600", fontSize: "12.5px" } }, "Working Tree"),
              React.createElement(
                "span",
                { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
                untrackedTotal + " untracked" + (deletedTotal > 0 ? " \xB7 " + deletedTotal + " deleted" : "")
              ),
              workTree.reference === "fallback" ? React.createElement("span", {
                style: { fontSize: "10px", padding: "1px 7px", borderRadius: "9px", background: "var(--dsw-alias-state-warn-bg, var(--dsw-alias-bg-layer-1))", border: "1px solid var(--dsw-alias-state-warn-primary)", color: "var(--dsw-alias-state-warn-primary)", fontWeight: "600" },
                title: "HEAD tree \u4E0D\u53EF\u8BFB\uFF08pack \u89E3\u6790\u9650\u5236\uFF09\uFF0C\u5DF2\u6CBF first-parent \u94FE\u56DE\u9000\u5230 " + (workTree.referenceCommitShort || "?") + " \u4F5C\u4E3A\u53C2\u8003\uFF0C\u7ED3\u679C\u53EF\u80FD\u7565\u6709\u8FC7\u671F"
              }, "vs " + (workTree.referenceCommitShort || "fallback")) : null,
              React.createElement("span", { style: { marginLeft: "auto", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, wtExpanded ? "\u25B4" : "\u25BE")
            ),
            wtExpanded ? React.createElement(
              "div",
              null,
              renderFileGroup("Untracked", "untracked", workTree.untrackedSample || [], untrackedTotal, workTree.truncatedUntracked),
              renderFileGroup("Deleted", "deleted", workTree.deletedSample || [], deletedTotal, workTree.truncatedDeleted)
            ) : null
          );
        };
        return React.createElement(
          "div",
          { style: { padding: "0 4px 16px" }, "data-block": "git-tab" },
          // header card
          React.createElement(
            "div",
            { style: cardStyle },
            React.createElement("span", { style: branchChipStyle(true) }, "\u2387 " + (currentBranch || "detached HEAD")),
            React.createElement(
              "span",
              { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
              commits.length + " \u4E2A\u63D0\u4EA4" + (gitInfo.truncated ? "\uFF08\u5DF2\u622A\u65AD\uFF09" : "")
            ),
            otherBranches.length > 0 ? React.createElement(
              "span",
              { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
              "\xB7 " + otherBranches.length + " \u4E2A\u5176\u4ED6\u5206\u652F"
            ) : null,
            gitInfo.head ? React.createElement("span", { style: { marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "HEAD " + gitInfo.head.substring(0, 7)) : null,
            // v0.4.x: 自动刷新开关 + 手动刷新按钮
            typeof onRefresh === "function" ? React.createElement(
              "span",
              { style: { display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "8px" } },
              typeof onToggleAutoRefresh === "function" ? React.createElement("button", {
                key: "auto",
                type: "button",
                title: autoRefresh ? "\u81EA\u52A8\u5237\u65B0\u5DF2\u5F00\u542F\uFF0830s \u95F4\u9694\uFF09\uFF0C\u70B9\u51FB\u5173\u95ED" : "\u81EA\u52A8\u5237\u65B0\u5DF2\u5173\u95ED\uFF0C\u70B9\u51FB\u5F00\u542F",
                onClick: () => onToggleAutoRefresh(!autoRefresh),
                "data-git-auto": autoRefresh ? "1" : "0",
                style: {
                  fontSize: "10px",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  border: "1px solid " + (autoRefresh ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-border-l1)"),
                  background: autoRefresh ? "var(--dsw-alias-state-success-bg, var(--dsw-alias-bg-layer-2))" : "transparent",
                  color: autoRefresh ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-secondary)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }
              }, React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: autoRefresh ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-secondary)" } }), autoRefresh ? "\u81EA\u52A8 30s" : "\u81EA\u52A8\u5173") : null,
              React.createElement("button", {
                key: "refresh",
                type: "button",
                title: "\u5237\u65B0 Git \u6570\u636E",
                onClick: onRefresh,
                "data-git-refresh": "1",
                style: {
                  fontSize: "14px",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--dsw-alias-border-l1)",
                  background: "transparent",
                  color: "var(--dsw-alias-label-primary)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  lineHeight: "1"
                }
              }, "\u21BB")
            ) : null
          ),
          // commits 列表
          commits.length === 0 ? React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "\uFF08\u65E0\u63D0\u4EA4\u5386\u53F2\uFF09") : React.createElement(
            "div",
            { style: listStyle },
            commits.map((c, idx) => renderRow(c, idx))
          ),
          // v0.4.x: Working Tree 区块 — HEAD tree vs 工作树对比，不依赖 git binary
          renderWorkTreeSection(gitInfo.workTree)
        );
      }
      const BRAIN_SETTINGS_META = [
        {
          group: "retrieval",
          icon: "\u{1F50E}",
          title: { "zh-CN": "\u68C0\u7D22\u4E0E\u5411\u91CF", "en-US": "Retrieval & vectors" },
          fields: [
            {
              key: "retrievalMode",
              label: { "zh-CN": "\u68C0\u7D22\u6A21\u5F0F", "en-US": "Retrieval mode" },
              type: "enum",
              options: [{ v: "keyword", l: { "zh-CN": "\u5173\u952E\u8BCD (BM25)", "en-US": "Keyword (BM25)" } }, { v: "hybrid", l: { "zh-CN": "\u6DF7\u5408 (\u5173\u952E\u8BCD + \u5411\u91CF)", "en-US": "Hybrid (keyword + vector)" } }],
              hint: { "zh-CN": "hybrid \u9700\u8981\u5148\u914D\u7F6E\u4E0B\u65B9 Embedding", "en-US": "hybrid requires Embedding configured below" }
            },
            {
              key: "vectorEnabled",
              label: { "zh-CN": "\u542F\u7528\u5411\u91CF\u68C0\u7D22", "en-US": "Vector retrieval" },
              type: "boolean",
              hint: { "zh-CN": "\u5173\u95ED\u65F6\u5373\u4F7F\u914D\u4E86 embedding \u4E5F\u53EA\u7528\u5173\u952E\u8BCD", "en-US": "When off, retrieval is keyword-only even if embedding is configured" }
            },
            {
              key: "embeddingBaseURL",
              label: { "zh-CN": "Embedding \u5730\u5740", "en-US": "Embedding base URL" },
              type: "string",
              placeholder: "https://api.openai.com/v1",
              hint: { "zh-CN": "OpenAI \u517C\u5BB9 /v1/embeddings \u7AEF\u70B9\uFF1B\u7559\u7A7A = \u7981\u7528\u5411\u91CF", "en-US": "OpenAI-compatible /v1/embeddings endpoint; empty = no vectors" }
            },
            {
              key: "embeddingModel",
              label: { "zh-CN": "Embedding \u6A21\u578B", "en-US": "Embedding model" },
              type: "string",
              placeholder: "text-embedding-3-small"
            },
            {
              key: "embeddingApiKeyEnv",
              label: { "zh-CN": "API Key", "en-US": "API Key" },
              type: "password",
              placeholder: "sk-\u2026 \u6216 PROJECT_BRAIN_EMBEDDING_API_KEY",
              hint: { "zh-CN": "\u4F18\u5148\u76F4\u63A5\u586B\u5199 API Key\u3002\u5982\u679C\u586B\u7684\u662F PROJECT_BRAIN_EMBEDDING_API_KEY \u8FD9\u7C7B\u5168\u5927\u5199\u540D\u5B57\uFF0C\u5219\u4E0D\u4F1A\u628A\u5B83\u5F53\u4F5C\u5BC6\u94A5\uFF0C\u800C\u662F\u8BFB\u53D6\u672C\u673A\u540C\u540D\u73AF\u5883\u53D8\u91CF\u7684\u503C\uFF1B\u8BF7\u5148\u5728\u7CFB\u7EDF\u6216\u7528\u6237\u73AF\u5883\u53D8\u91CF\u91CC\u914D\u597D\u8BE5\u9879\uFF0C\u5E76\u5B8C\u5168\u9000\u51FA\u518D\u6253\u5F00 DSH Desktop\u3002", "en-US": "Paste the API key to use it directly. An ALL_CAPS name like PROJECT_BRAIN_EMBEDDING_API_KEY is not the secret: the plugin reads the local environment variable of the same name. Set that env var on this machine, then fully quit and reopen DSH Desktop." }
            },
            {
              key: "embeddingDimensions",
              label: { "zh-CN": "\u5411\u91CF\u7EF4\u5EA6", "en-US": "Vector dimensions" },
              type: "number",
              hint: { "zh-CN": "0 = \u7531\u670D\u52A1\u81EA\u52A8\u63A8\u65AD", "en-US": "0 = auto from service" }
            },
            { key: "embeddingBatchSize", label: { "zh-CN": "Embedding \u6279\u5927\u5C0F", "en-US": "Embedding batch size" }, type: "number", min: 1, max: 128 },
            { key: "embeddingMaxIndexPerRun", label: { "zh-CN": "\u5355\u6B21\u6700\u5927\u7D22\u5F15\u6761\u76EE", "en-US": "Max items per indexing run" }, type: "number", min: 1, max: 500 },
            { key: "embeddingTimeoutMs", label: { "zh-CN": "Embedding \u8D85\u65F6 (ms)", "en-US": "Embedding timeout (ms)" }, type: "number", min: 1e3, max: 12e4, step: 1e3 }
          ]
        },
        {
          group: "weights",
          icon: "\u2696\uFE0F",
          title: { "zh-CN": "\u68C0\u7D22\u6743\u91CD", "en-US": "Retrieval weights" },
          hint: { "zh-CN": "\u53EA\u4F5C\u7528\u4E8E project_ask \u7684\u8BB0\u5FC6\u6392\u5E8F\uFF08\u4E0D\u7BA1\u5217\u8868\u548C\u4F1A\u8BDD\u6CE8\u5165\uFF09\u3002\u54EA\u9879\u66F4\u5927\u54EA\u9879\u66F4\u4F18\u5148\uFF0C\u4E94\u9879\u76F8\u5BF9\u5927\u5C0F\u5373\u53EF\uFF0C\u4E0D\u5FC5\u51D1\u6210 1\u3002\u4FDD\u5B58\u540E\u4E0B\u6B21\u63D0\u95EE\u751F\u6548\u3002", "en-US": "Applies only to project_ask memory ranking, not list or session inject. Higher = more influence; need not sum to 1. Takes effect on the next ask after save." },
          fields: [
            {
              key: "keywordWeight",
              label: { "zh-CN": "\u5173\u952E\u8BCD\u6743\u91CD", "en-US": "Keyword" },
              type: "number",
              min: 0,
              max: 1,
              step: 0.05,
              hint: { "zh-CN": "\u5B57\u9762\u5339\u914D\uFF08BM25\uFF09\u3002\u95EE\u9898\u91CC\u6709\u4E13\u6709\u540D\u8BCD\u3001\u6587\u4EF6\u540D\u3001\u672F\u8BED\u65F6\u8C03\u9AD8\u3002", "en-US": "Lexical BM25. Raise when the question contains names, files, or exact terms." }
            },
            {
              key: "vectorWeight",
              label: { "zh-CN": "\u5411\u91CF\u6743\u91CD", "en-US": "Vector" },
              type: "number",
              min: 0,
              max: 1,
              step: 0.05,
              hint: { "zh-CN": "\u8BED\u4E49\u76F8\u8FD1\u3002\u540C\u4E49\u6539\u5199\u3001\u8BCD\u5BF9\u4E0D\u4E0A\u65F6\u9760\u8FD9\u9879\u3002\u672A\u5EFA\u5411\u91CF\u6216\u672A\u5F00 hybrid \u65F6\u6B64\u9879\u4E3A 0\u3002", "en-US": "Semantic similarity. Helps paraphrases. Stays 0 until vectors are indexed in hybrid mode." }
            },
            {
              key: "importanceWeight",
              label: { "zh-CN": "\u91CD\u8981\u6027\u6743\u91CD", "en-US": "Importance" },
              type: "number",
              min: 0,
              max: 1,
              step: 0.05,
              hint: { "zh-CN": "\u8BB0\u5FC6\u81EA\u5E26\u7684\u91CD\u8981\u6027\u3002\u9ED8\u8BA4\u6700\u5927\uFF0C\u8BA9\u6807\u8FC7\u91CD\u8981\u7684\u51B3\u7B56\u6392\u524D\u9762\u3002", "en-US": "Memory importance. Highest by default so marked decisions rank first." }
            },
            {
              key: "confidenceWeight",
              label: { "zh-CN": "\u53EF\u4FE1\u5EA6\u6743\u91CD", "en-US": "Confidence" },
              type: "number",
              min: 0,
              max: 1,
              step: 0.05,
              hint: { "zh-CN": "\u62BD\u53D6\u53EF\u4FE1\u5EA6\u3002\u4E00\u822C\u4FDD\u6301\u8F83\u4F4E\uFF0C\u907F\u514D\u6A21\u578B\u81EA\u8BC4\u6324\u6389\u4E8B\u5B9E\u3002", "en-US": "Extraction confidence. Keep low so model self-scores do not dominate." }
            },
            {
              key: "recencyWeight",
              label: { "zh-CN": "\u65F6\u65B0\u6027\u6743\u91CD", "en-US": "Recency" },
              type: "number",
              min: 0,
              max: 1,
              step: 0.05,
              hint: { "zh-CN": "\u8D8A\u65B0\u8D8A\u9AD8\uFF1A\u7EA6 7 \u5929\u5185\u6EE1\u5206\uFF0C\u7EA6 180 \u5929\u964D\u5230 0\u3002", "en-US": "Newer ranks higher: full score within ~7 days, near 0 by ~180 days." }
            }
          ]
        },
        {
          group: "summary",
          icon: "\u{1F4DD}",
          title: { "zh-CN": "\u4F1A\u8BDD\u6458\u8981 (LLM)", "en-US": "Session summary (LLM)" },
          fields: [
            {
              key: "sessionSemanticMemoryEnabled",
              label: { "zh-CN": "\u542F\u7528\u4F1A\u8BDD\u6458\u8981", "en-US": "Enable session summary" },
              type: "boolean",
              hint: { "zh-CN": "session \u7ED3\u675F\u81EA\u52A8\u8C03 LLM \u62BD\u53D6\u8BED\u4E49\u8BB0\u5FC6 + \u8BC1\u636E\u6821\u9A8C", "en-US": "Auto-extract semantic memories with grounding check on session end" }
            },
            { key: "sessionSemanticMaxChars", label: { "zh-CN": "Transcript \u622A\u65AD (chars)", "en-US": "Transcript truncate (chars)" }, type: "number", min: 2e3, max: 4e4, step: 1e3 },
            { key: "sessionSemanticMaxItems", label: { "zh-CN": "\u6BCF\u6B21\u6700\u591A\u62BD\u53D6", "en-US": "Max items per extraction" }, type: "number", min: 1, max: 8 },
            { key: "sessionSemanticTimeoutMs", label: { "zh-CN": "LLM \u8D85\u65F6 (ms)", "en-US": "LLM timeout (ms)" }, type: "number", min: 5e3, max: 12e4, step: 1e3 }
          ]
        },
        {
          group: "arch",
          icon: "\u{1F3D7}\uFE0F",
          title: { "zh-CN": "\u67B6\u6784\u5206\u6790", "en-US": "Architecture analysis" },
          fields: [
            { key: "architectureEnabled", label: { "zh-CN": "\u542F\u7528\u67B6\u6784\u5206\u6790", "en-US": "Enable" }, type: "boolean" },
            { key: "architectureLlmEnabled", label: { "zh-CN": "LLM \u589E\u5F3A", "en-US": "LLM enrichment" }, type: "boolean" },
            { key: "architectureLlmIncludeSource", label: { "zh-CN": "\u5411 LLM \u6CE8\u5165\u6E90\u7801\u7247\u6BB5", "en-US": "Inject source snippets into LLM" }, type: "boolean" },
            { key: "architectureMaxFiles", label: { "zh-CN": "\u6700\u5927\u626B\u63CF\u6587\u4EF6\u6570", "en-US": "Max files scanned" }, type: "number", min: 20, max: 1e3 },
            { key: "architectureMaxNodes", label: { "zh-CN": "\u6700\u5927\u67B6\u6784\u8282\u70B9", "en-US": "Max architecture nodes" }, type: "number", min: 6, max: 60 },
            { key: "architectureLlmTimeoutMs", label: { "zh-CN": "LLM \u8D85\u65F6 (ms)", "en-US": "LLM timeout (ms)" }, type: "number", min: 5e3, max: 12e4, step: 1e3 }
          ]
        }
      ];
      function settingsFieldLabel(field, localeCode) {
        const label = field.label && typeof field.label === "object" ? field.label[localeCode] || field.label["zh-CN"] : field.label;
        return label || field.key;
      }
      function settingsFieldHint(field, localeCode) {
        if (!field.hint) return null;
        return field.hint && typeof field.hint === "object" ? field.hint[localeCode] || field.hint["zh-CN"] : field.hint;
      }
      function settingsGroupTitle(group, localeCode) {
        return group.title && typeof group.title === "object" ? group.title[localeCode] || group.title["zh-CN"] : group.title;
      }
      function settingsOptionLabel(opt, localeCode) {
        return opt.l && typeof opt.l === "object" ? opt.l[localeCode] || opt.l["zh-CN"] : opt.l;
      }
      function SettingsTab({ rpc, sessionId, t, localeCode }) {
        const locale = localeCode === "en-US" ? "en-US" : "zh-CN";
        const initial = { loaded: false, writable: false, config: {}, dirty: {}, saving: false, error: null, info: null };
        const [state, setState] = React.useState(initial);
        const [probes, setProbes] = React.useState({
          embedding: { status: "idle", message: "" },
          llm: { status: "idle", message: "" }
        });
        const [revealSecrets, setRevealSecrets] = React.useState({});
        const loadSettings = React.useCallback(async () => {
          if (!rpc || typeof rpc.call !== "function") {
            setState(Object.assign({}, initial, { loaded: true, error: "DSH Runtime RPC unavailable" }));
            return;
          }
          setState((s) => Object.assign({}, s, { error: null, info: null }));
          try {
            const res = await rpc.call("/project-brain", "settings", { sessionId, action: "get" });
            if (res && res.ok && res.value) {
              setState({ loaded: true, writable: !!res.value.writable, config: res.value.config || {}, dirty: {}, saving: false, error: null, info: null });
            } else {
              const code = res && res.error && res.error.code || "E_RPC";
              const msg = res && res.error && res.error.message || "\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u8BBE\u7F6E";
              setState((s) => Object.assign({}, s, { loaded: true, error: msg + (code !== "E_RPC" ? " [" + code + "]" : "") }));
            }
          } catch (e) {
            setState((s) => Object.assign({}, s, { loaded: true, error: String(e && e.message || e) }));
          }
        }, [rpc, sessionId]);
        React.useEffect(() => {
          loadSettings();
        }, [loadSettings]);
        function updateField(key, value) {
          setState((s) => ({
            loaded: s.loaded,
            writable: s.writable,
            config: Object.assign({}, s.config, { [key]: value }),
            dirty: Object.assign({}, s.dirty, { [key]: value }),
            saving: false,
            error: null,
            info: null
          }));
        }
        async function save() {
          const dirtyKeys = Object.keys(state.dirty);
          if (dirtyKeys.length === 0 || state.saving) return;
          const patch = {};
          for (const key of dirtyKeys) patch[key] = state.dirty[key];
          setState((s) => Object.assign({}, s, { saving: true, error: null, info: null }));
          try {
            const res = await rpc.call("/project-brain", "settings", { sessionId, action: "update", patch });
            if (res && res.ok && res.value) {
              setState({ loaded: true, writable: !!res.value.writable, config: res.value.config || {}, dirty: {}, saving: false, error: null, info: "\u2713 \u5DF2\u4FDD\u5B58" });
            } else {
              const code = res && res.error && res.error.code || "E_RPC";
              const msg = res && res.error && res.error.message || "\u4FDD\u5B58\u5931\u8D25";
              setState((s) => Object.assign({}, s, { saving: false, error: msg + (code !== "E_RPC" ? " [" + code + "]" : "") }));
            }
          } catch (e) {
            setState((s) => Object.assign({}, s, { saving: false, error: String(e && e.message || e) }));
          }
        }
        function discard() {
          setState((s) => Object.assign({}, s, { dirty: {}, error: null, info: "\u5DF2\u4E22\u5F03\u672C\u5730\u4FEE\u6539\uFF08\u70B9\u51FB\u300C\u91CD\u65B0\u8BFB\u53D6\u300D\u4F1A\u5237\u65B0\u670D\u52A1\u5668\u503C\uFF09" }));
        }
        async function runProbe(target) {
          if (!rpc || typeof rpc.call !== "function" || probes[target] && probes[target].status === "running") return;
          setProbes((s) => Object.assign({}, s, { [target]: { status: "running", message: t("settings.probe.running") } }));
          try {
            const res = await rpc.call("/project-brain", "settings", {
              sessionId,
              action: "probe",
              target,
              config: state.config
            });
            const probe = res && res.ok && res.value && res.value.probe;
            if (!probe) {
              const msg = res && res.error && res.error.message || "RPC failed";
              setProbes((s) => Object.assign({}, s, { [target]: { status: "fail", message: msg } }));
              return;
            }
            const latency = probe.details && probe.details.latencyMs != null ? " \xB7 " + probe.details.latencyMs + "ms" : "";
            setProbes((s) => Object.assign({}, s, {
              [target]: { status: probe.ok ? "ok" : "fail", message: String(probe.message || probe.code || "") + latency }
            }));
          } catch (e) {
            setProbes((s) => Object.assign({}, s, { [target]: { status: "fail", message: String(e && e.message || e) } }));
          }
        }
        function renderProbe(target) {
          const probe = probes[target] || { status: "idle", message: "" };
          const running = probe.status === "running";
          const color = probe.status === "ok" ? "var(--dsw-alias-state-success-primary)" : probe.status === "fail" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-secondary)";
          const label = target === "embedding" ? t("settings.probe.embedding") : t("settings.probe.llm");
          const hint = target === "embedding" ? t("settings.probe.embeddingHint") : t("settings.probe.llmHint");
          return React.createElement(
            "div",
            { style: { marginTop: "8px", paddingTop: "10px", borderTop: "1px dashed var(--dsw-alias-border-l1)" } },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              React.createElement("button", {
                type: "button",
                "data-action": "probe-" + target,
                "data-probe-btn": "compact",
                disabled: running || !state.loaded,
                onClick: () => runProbe(target),
                style: {
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "500",
                  fontFamily: "inherit",
                  border: "1px solid rgb(186, 216, 238)",
                  background: "rgb(236, 245, 252)",
                  color: "rgb(56, 112, 168)",
                  cursor: running ? "not-allowed" : "pointer",
                  opacity: running ? 0.6 : 1
                }
              }, running ? t("settings.probe.running") : label),
              probe.message ? React.createElement(
                "span",
                { "data-probe-status": probe.status, style: { fontSize: "11px", color } },
                (probe.status === "ok" ? "\u2713 " : probe.status === "fail" ? "\u2717 " : "") + probe.message
              ) : null
            ),
            React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "4px" } }, hint)
          );
        }
        function renderField(field, value) {
          const fieldLabel = settingsFieldLabel(field, locale);
          const hint = settingsFieldHint(field, locale);
          const inputId = "brain-set-" + field.key;
          const labelStyle = { display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "var(--dsw-alias-label-primary)" };
          const inputBase = {
            width: "100%",
            boxSizing: "border-box",
            padding: "6px 9px",
            background: "var(--dsw-alias-bg-layer-1)",
            color: "var(--dsw-alias-label-primary)",
            border: "1px solid var(--dsw-alias-border-l1)",
            borderRadius: "6px",
            fontFamily: "inherit",
            fontSize: "12px"
          };
          if (field.type === "boolean") {
            const checked = value === true;
            return React.createElement(
              "div",
              { key: field.key, style: { marginBottom: "10px" } },
              React.createElement(
                "label",
                { htmlFor: inputId, style: { display: "flex", alignItems: "center", gap: "8px", cursor: state.writable ? "pointer" : "not-allowed" } },
                React.createElement("input", {
                  id: inputId,
                  type: "checkbox",
                  checked,
                  disabled: !state.writable || state.saving,
                  onChange: (e) => updateField(field.key, e.target.checked === true),
                  style: { cursor: state.writable ? "pointer" : "not-allowed" }
                }),
                React.createElement("span", { style: labelStyle }, fieldLabel)
              ),
              hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", marginLeft: "24px" } }, hint) : null
            );
          }
          if (field.type === "enum") {
            return React.createElement(
              "div",
              { key: field.key, style: { marginBottom: "10px" } },
              React.createElement("label", { htmlFor: inputId, style: labelStyle }, fieldLabel),
              React.createElement("select", {
                id: inputId,
                disabled: !state.writable || state.saving,
                value: value == null ? "" : String(value),
                onChange: (e) => updateField(field.key, e.target.value),
                style: Object.assign({}, inputBase)
              }, (field.options || []).map(
                (opt) => React.createElement("option", { key: opt.v, value: opt.v }, settingsOptionLabel(opt, locale))
              )),
              hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px" } }, hint) : null
            );
          }
          if (field.type === "password") {
            const revealed = !!revealSecrets[field.key];
            return React.createElement(
              "div",
              { key: field.key, style: { marginBottom: "10px" } },
              React.createElement("label", { htmlFor: inputId, style: labelStyle }, fieldLabel),
              React.createElement(
                "div",
                { style: { position: "relative" } },
                React.createElement("input", {
                  id: inputId,
                  type: revealed ? "text" : "password",
                  autoComplete: "off",
                  disabled: !state.writable || state.saving,
                  value: value == null ? "" : String(value),
                  placeholder: field.placeholder || "",
                  onChange: (e) => updateField(field.key, e.target.value),
                  style: Object.assign({}, inputBase, { paddingRight: "36px", fontFamily: "ui-monospace, monospace" })
                }),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    "data-action": "toggle-secret",
                    "aria-label": revealed ? locale === "en-US" ? "Hide API key" : "\u9690\u85CF\u5BC6\u94A5" : locale === "en-US" ? "Show API key" : "\u663E\u793A\u5BC6\u94A5",
                    title: revealed ? locale === "en-US" ? "Hide" : "\u9690\u85CF" : locale === "en-US" ? "Show" : "\u663E\u793A",
                    onClick: () => setRevealSecrets((s) => Object.assign({}, s, { [field.key]: !s[field.key] })),
                    style: {
                      position: "absolute",
                      right: "6px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "24px",
                      height: "24px",
                      padding: 0,
                      border: "none",
                      borderRadius: "4px",
                      background: "transparent",
                      color: "var(--dsw-alias-label-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }
                  },
                  React.createElement(
                    "svg",
                    {
                      width: 16,
                      height: 16,
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      "aria-hidden": "true"
                    },
                    React.createElement("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" }),
                    React.createElement("circle", { cx: 12, cy: 12, r: 3 }),
                    revealed ? React.createElement("line", { x1: 3, y1: 3, x2: 21, y2: 21 }) : null
                  )
                )
              ),
              hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px" } }, hint) : null
            );
          }
          const isNumber = field.type === "number";
          const inputProps = {
            id: inputId,
            disabled: !state.writable || state.saving,
            onChange: (e) => {
              const raw = e.target.value;
              if (isNumber) {
                if (raw === "" || raw === "-") {
                  updateField(field.key, raw);
                  return;
                }
                const num = Number(raw);
                updateField(field.key, Number.isFinite(num) ? num : raw);
              } else {
                updateField(field.key, raw);
              }
            },
            style: Object.assign({}, inputBase, isNumber ? { fontFamily: "ui-monospace, monospace" } : {}),
            placeholder: field.placeholder || ""
          };
          if (isNumber) {
            if (typeof field.min === "number") inputProps.min = field.min;
            if (typeof field.max === "number") inputProps.max = field.max;
            if (typeof field.step === "number") inputProps.step = field.step;
            inputProps.type = "number";
            inputProps.value = value == null ? "" : String(value);
          } else {
            inputProps.type = "text";
            inputProps.value = value == null ? "" : String(value);
          }
          return React.createElement(
            "div",
            { key: field.key, style: { marginBottom: "10px" } },
            React.createElement("label", { htmlFor: inputId, style: labelStyle }, fieldLabel),
            React.createElement("input", inputProps),
            hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px" } }, hint) : null
          );
        }
        if (!state.loaded) {
          return React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "\u52A0\u8F7D\u8BBE\u7F6E\u4E2D\u2026");
        }
        const dirtyCount = Object.keys(state.dirty).length;
        return React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "14px" } },
          React.createElement(
            "div",
            { style: {
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid " + (state.writable ? "var(--dsw-alias-state-success-primary, var(--dsw-alias-border-l1))" : "var(--dsw-alias-state-warn-primary)"),
              background: "var(--dsw-alias-bg-layer-1)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: state.writable ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-warn-primary)"
            } },
            React.createElement("span", null, state.writable ? "\u2705" : "\u26A0\uFE0F"),
            React.createElement("span", { style: { flex: "1 1 auto", lineHeight: "1.45" } }, state.writable ? locale === "en-US" ? "Settings are writable. After editing, scroll to the bottom of this page and click Save \u2014 unsaved changes do not take effect." : "\u914D\u7F6E\u53EF\u5199\u3002\u6539\u5B8C\u540E\u8BF7\u6EDA\u5230\u672C\u9875\u6700\u5E95\u90E8\u70B9\u300C\u4FDD\u5B58\u300D\uFF1B\u672A\u70B9\u4FDD\u5B58\u4E0D\u4F1A\u751F\u6548\u3002" : locale === "en-US" ? "Settings read-only in this runtime (DSH settings service unavailable). Configure via DSH settings panel or env vars." : "\u5F53\u524D\u8FD0\u884C\u65F6\u914D\u7F6E\u4E3A\u53EA\u8BFB\uFF08DSH settings \u670D\u52A1\u4E0D\u53EF\u7528\uFF09\u3002\u8BF7\u901A\u8FC7 DSH \u8BBE\u7F6E\u9762\u677F\u6216\u73AF\u5883\u53D8\u91CF\u914D\u7F6E\u3002"),
            React.createElement(
              "span",
              { style: { marginLeft: "auto", cursor: "pointer", opacity: 0.85 }, onClick: loadSettings, title: locale === "en-US" ? "Reload" : "\u91CD\u65B0\u8BFB\u53D6" },
              "\u27F3"
            )
          ),
          BRAIN_SETTINGS_META.map(
            (group) => React.createElement(
              "section",
              {
                key: group.group,
                style: {
                  padding: "12px 14px",
                  background: "var(--dsw-alias-bg-layer-2)",
                  borderRadius: "10px",
                  border: "1px solid var(--dsw-alias-border-l1)"
                }
              },
              React.createElement(
                "h3",
                { style: { fontSize: "13px", fontWeight: "700", margin: "0 0 4px", display: "flex", alignItems: "center", gap: "6px", color: "var(--dsw-alias-label-primary)" } },
                React.createElement("span", null, group.icon),
                React.createElement("span", null, settingsGroupTitle(group, locale))
              ),
              group.hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginBottom: "10px" } }, settingsFieldHint(group, locale)) : null,
              group.fields.map((field) => renderField(field, state.config[field.key])),
              group.group === "retrieval" ? renderProbe("embedding") : null,
              group.group === "summary" ? renderProbe("llm") : null
            )
          ),
          React.createElement(
            "div",
            { style: {
              position: "sticky",
              bottom: "0",
              marginTop: "6px",
              padding: "10px 12px",
              background: "var(--dsw-alias-bg-layer-2)",
              borderRadius: "10px",
              border: "1px solid var(--dsw-alias-border-l1)",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            } },
            state.error ? React.createElement("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: "11px", flex: "1 1 auto" } }, "\u274C " + state.error) : null,
            !state.error && state.info ? React.createElement("span", { style: { color: "var(--dsw-alias-state-success-primary)", fontSize: "11px", flex: "1 1 auto" } }, state.info) : null,
            !state.error && !state.info ? React.createElement(
              "span",
              { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", flex: "1 1 auto" } },
              dirtyCount > 0 ? dirtyCount + (locale === "en-US" ? " unsaved field(s)" : " \u9879\u672A\u4FDD\u5B58") : locale === "en-US" ? "No changes" : "\u65E0\u4FEE\u6539"
            ) : null,
            React.createElement("button", {
              type: "button",
              onClick: discard,
              disabled: dirtyCount === 0 || state.saving,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--dsw-alias-border-l1)",
                background: "transparent",
                color: "var(--dsw-alias-label-primary)",
                cursor: dirtyCount === 0 ? "not-allowed" : "pointer",
                fontSize: "11px",
                opacity: dirtyCount === 0 ? 0.5 : 1,
                fontFamily: "inherit"
              }
            }, locale === "en-US" ? "Discard" : "\u653E\u5F03\u4FEE\u6539"),
            React.createElement("button", {
              type: "button",
              onClick: save,
              disabled: dirtyCount === 0 || state.saving || !state.writable,
              "data-settings-save": "1",
              style: {
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: dirtyCount === 0 || !state.writable ? "var(--dsw-alias-bg-layer-1)" : "var(--dsw-alias-brand-primary)",
                color: dirtyCount === 0 || !state.writable ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-label-on-brand, var(--dsw-alias-bg-base))",
                cursor: dirtyCount === 0 || !state.writable || state.saving ? "not-allowed" : "pointer",
                fontSize: "12px",
                fontWeight: "600",
                fontFamily: "inherit"
              }
            }, state.saving ? "\u4FDD\u5B58\u4E2D\u2026" : locale === "en-US" ? "Save" : "\u4FDD\u5B58")
          )
        );
      }
      function DashboardSection({ data, t, localeCode, sessionId, connection, onPreviewUpdate }) {
        const p = data.project || {};
        const todos = data.todos || [];
        const timelineAll = data.timelineAll || [];
        const memoriesAll = data.memoriesAll || [];
        const retrieval = data.retrieval || {};
        const [quickActionState, setQuickActionState] = React.useState({});
        const [activeTab, setActiveTab] = React.useState("overview");
        const [memoryModal, setMemoryModal] = React.useState(null);
        const [dormantOpen, setDormantOpen] = React.useState(false);
        const openMemoryModal = React.useCallback((m) => {
          setMemoryModal(m);
        }, []);
        const closeMemoryModal = React.useCallback(() => {
          setMemoryModal(null);
        }, []);
        const rpc = connection && connection.rpc;
        const runArchRescan = React.useCallback(async () => {
          if (!sessionId || !rpc || typeof rpc.call !== "function") throw new Error(t("arch.retryFailed"));
          const res = await rpc.call("/project-brain", "action", { sessionId, action: "rescan" });
          if (!res || !res.ok || !res.value) throw new Error(res && res.error && res.error.message || t("arch.retryFailed"));
          if (res.value && res.value.preview && typeof onPreviewUpdate === "function") {
            try {
              onPreviewUpdate(res.value);
            } catch (e) {
            }
          }
          const stats = res.value && res.value.result && res.value.result.data && res.value.result.data.stats;
          return { message: stats ? t("arch.retryDone") + " \xB7 " + (stats.files || 0) + " \u6587\u4EF6" : t("arch.retryDone") };
        }, [sessionId, rpc, onPreviewUpdate, t]);
        const [gitInfo, setGitInfo] = React.useState(null);
        const [gitAutoRefresh, setGitAutoRefresh] = React.useState(() => {
          try {
            return localStorage.getItem("dsh-brain-git-auto-refresh") !== "0";
          } catch (e) {
            return true;
          }
        });
        const refreshGit = React.useCallback(async () => {
          if (!rpc || typeof rpc.call !== "function") return;
          try {
            const res = await rpc.call("/project-brain", "git", { sessionId, workspacePath: data._workspacePath || null, limit: 50 });
            if (res && res.ok && res.value) setGitInfo(res.value);
            else setGitInfo({ available: false, error: res && res.error && res.error.message || "no git info" });
          } catch (e) {
            setGitInfo({ available: false, error: String(e && e.message || e) });
          }
        }, [rpc, sessionId, data._workspacePath]);
        React.useEffect(() => {
          let cancelled = false;
          if (!rpc || typeof rpc.call !== "function") return void 0;
          (async () => {
            try {
              const res = await rpc.call("/project-brain", "git", { sessionId, workspacePath: data._workspacePath || null, limit: 50 });
              if (cancelled) return;
              if (res && res.ok && res.value) setGitInfo(res.value);
              else setGitInfo({ available: false, error: res && res.error && res.error.message || "no git info" });
            } catch (e) {
              if (!cancelled) setGitInfo({ available: false, error: String(e && e.message || e) });
            }
          })();
          return () => {
            cancelled = true;
          };
        }, [rpc, sessionId, data._workspacePath]);
        React.useEffect(() => {
          if (activeTab !== "git" || !gitAutoRefresh) return void 0;
          const t2 = setInterval(refreshGit, 3e4);
          return () => clearInterval(t2);
        }, [activeTab, gitAutoRefresh, refreshGit]);
        function resultMessage(action, value) {
          const result = value && value.result;
          const detail = result && result.data ? result.data : {};
          if (action === "rescan") {
            const stats = detail.stats || {};
            return "\u626B\u63CF\u5B8C\u6210 \xB7 " + (stats.files || 0) + " \u4E2A\u6587\u4EF6";
          }
          if (action === "todos") {
            return "\u6D3B\u8DC3 " + (detail.active || 0) + " \u9879 \xB7 \u5DF2\u5B8C\u6210 " + (detail.done || 0) + " \u9879";
          }
          if (action === "overview") {
            return detail.suggestedNextStep ? "\u4E0B\u4E00\u6B65\uFF1A" + detail.suggestedNextStep : "\u9879\u76EE\u5168\u666F\u5DF2\u5237\u65B0";
          }
          if (action === "dreamCommit") {
            const committed = detail.committed || {};
            return "\u6574\u7406\u5B8C\u6210 \xB7 " + (committed.beforeCount || 0) + " \u2192 " + (committed.afterCount || 0) + " \u6761\u8BB0\u5FC6";
          }
          return "\u6267\u884C\u5B8C\u6210";
        }
        async function runQuickAction(qa) {
          const previous = quickActionState[qa.id] || {};
          const action = qa.action === "dream" && previous.status === "confirm" ? "dreamCommit" : qa.action;
          if (Object.values(quickActionState).some((state) => state && state.status === "loading")) return;
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: { status: "loading", message: action === "dreamCommit" ? "\u6B63\u5728\u63D0\u4EA4\u6574\u7406\u2026" : "\u6B63\u5728\u6267\u884C\u2026" }
          }));
          if (!sessionId || !rpc || typeof rpc.call !== "function") {
            setQuickActionState((states) => Object.assign({}, states, {
              [qa.id]: { status: "error", message: !sessionId ? "\u672A\u627E\u5230\u5F53\u524D Session" : "DSH Runtime RPC \u4E0D\u53EF\u7528" }
            }));
            return;
          }
          let response;
          try {
            response = await rpc.call("/project-brain", "action", { sessionId, action });
          } catch (error) {
            setQuickActionState((states) => Object.assign({}, states, {
              [qa.id]: { status: "error", message: String(error && error.message || error) }
            }));
            return;
          }
          if (!response || !response.ok || !response.value) {
            setQuickActionState((states) => Object.assign({}, states, {
              [qa.id]: {
                status: "error",
                message: response && response.error && response.error.message || "\u64CD\u4F5C\u6267\u884C\u5931\u8D25"
              }
            }));
            return;
          }
          const value = response.value;
          if (action === "dream") {
            const detail = value.result && value.result.data ? value.result.data : {};
            const summary = detail.summary || {};
            const candidates = (summary.mergeCandidates || 0) + (summary.archiveCandidates || 0);
            if (candidates > 0) {
              setQuickActionState((states) => Object.assign({}, states, {
                [qa.id]: { status: "confirm", message: "\u53D1\u73B0 " + candidates + " \u9879\u5019\u9009\uFF0C\u70B9\u51FB\u786E\u8BA4\u6574\u7406" }
              }));
              return;
            }
            setQuickActionState((states) => Object.assign({}, states, {
              [qa.id]: { status: "success", message: "\u68C0\u67E5\u5B8C\u6210 \xB7 \u65E0\u9700\u6574\u7406" }
            }));
            return;
          }
          if (value.preview && typeof onPreviewUpdate === "function") {
            try {
              onPreviewUpdate(value);
            } catch (error) {
            }
          }
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: { status: "success", message: resultMessage(action, value) }
          }));
        }
        const STACK_ICON = {
          "framework-frontend": "\u{1F3A8}",
          "framework-backend": "\u2699\uFE0F",
          "framework-fullstack": "\u{1F9E9}",
          "webserver": "\u{1F310}",
          "database": "\u{1F4BE}",
          "cache": "\u26A1",
          "queue": "\u{1F4EC}",
          "search": "\u{1F50D}",
          "container": "\u{1F433}",
          "mobile": "\u{1F4F1}",
          "desktop": "\u{1F5A5}\uFE0F",
          "iac": "\u{1F3D7}\uFE0F",
          "ci": "\u{1F501}",
          "observability": "\u{1F4CA}",
          "auth": "\u{1F510}",
          "api": "\u{1F50C}",
          "payment": "\u{1F4B3}",
          "ai": "\u{1F916}",
          "orm": "\u{1F5C4}\uFE0F"
        };
        const stackLayers = previewStackLayers({
          stack: p.stack || {},
          techStack: p.techStack || {},
          structure: p.structure || []
        });
        const stackChips = [];
        for (const field of RUNTIME_STACK_FIELDS) {
          const items = stackLayers.runtime[field] || [];
          for (const item of items) {
            stackChips.push(React.createElement(
              "span",
              {
                key: "stack-" + field + "-" + item,
                title: field,
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  background: "var(--dsw-alias-bg-layer-2)",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "500",
                  marginRight: "4px",
                  marginBottom: "4px",
                  border: "1px solid var(--dsw-alias-border-l1)"
                }
              },
              React.createElement("span", {
                style: {
                  fontSize: "10px",
                  lineHeight: 1,
                  opacity: 0.85
                }
              }, STACK_ICON[field] || "\u2022"),
              React.createElement("span", {
                style: { fontWeight: "600", color: "var(--dsw-alias-label-primary)" }
              }, String(item))
            ));
          }
        }
        const devopsChips = [];
        for (const field of DEVOPS_STACK_FIELDS) {
          const items = stackLayers.devops[field] || [];
          for (const item of items) {
            devopsChips.push(React.createElement(
              "span",
              {
                key: "devops-" + field + "-" + item,
                title: t("dash.devops") + " \xB7 " + field,
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  background: "transparent",
                  borderRadius: "8px",
                  fontSize: "10px",
                  fontWeight: "500",
                  marginRight: "4px",
                  marginBottom: "4px",
                  color: "var(--dsw-alias-label-secondary)",
                  border: "1px solid var(--dsw-alias-border-l1)"
                }
              },
              React.createElement("span", {
                style: { fontSize: "10px", lineHeight: 1, opacity: 0.85 }
              }, STACK_ICON[field] || "\u2022"),
              React.createElement("span", null, String(item))
            ));
          }
        }
        const structureChips = (stackLayers.structure || []).map(
          (s) => React.createElement("span", {
            key: "struct-" + s,
            title: "\u4EE3\u7801\u7ED3\u6784",
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 8px",
              borderRadius: "8px",
              fontSize: "10px",
              fontWeight: "500",
              marginRight: "4px",
              marginBottom: "4px",
              background: "transparent",
              color: "var(--dsw-alias-label-secondary)",
              border: "1px dashed var(--dsw-alias-border-l1)"
            }
          }, "\u{1F4E6}", String(s))
        );
        const extraChips = (stackLayers.extra || []).map(
          (item) => React.createElement("span", {
            key: "extra-" + item,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 10px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: "500",
              marginRight: "4px",
              marginBottom: "4px",
              background: "transparent",
              color: "var(--dsw-alias-label-secondary)",
              border: "1px solid var(--dsw-alias-border-l1)",
              borderStyle: "dashed"
            }
          }, "+", String(item))
        );
        const techChips = stackChips;
        const toolingChips = (p.tooling || []).map(
          (tool) => React.createElement(
            "span",
            { key: "tool-" + tool, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 7px", background: "transparent", borderRadius: "8px", fontSize: "10px", fontWeight: "500", marginRight: "3px", marginBottom: "4px", color: "var(--dsw-alias-label-secondary)", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", null, "\u{1F6E0}"),
            React.createElement("span", null, String(tool))
          )
        );
        const langUsage = formatLanguagesUsage(p.languages);
        const langChips = [];
        for (const item of langUsage.top) {
          const pctLabel = langUsage.total > 0 ? Math.round(item.percent) + "%" : "";
          langChips.push(React.createElement(
            "span",
            {
              key: "lang-" + item.lang,
              title: item.lang + " \xB7 " + item.count + " \u4E2A\u6587\u4EF6",
              style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" }
            },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-state-warn-primary)" } }),
            React.createElement("span", null, item.lang),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, pctLabel ? " \xB7 " + pctLabel : "")
          ));
        }
        if (langUsage.tail) {
          langChips.push(React.createElement(
            "span",
            {
              key: "lang-tail",
              title: langUsage.tail.languages + " \u79CD\u8BED\u8A00\u5171 " + langUsage.tail.count + " \u4E2A\u6587\u4EF6",
              style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)", color: "var(--dsw-alias-label-secondary)" }
            },
            React.createElement("span", null, "\u5176\u5B83 " + langUsage.tail.languages + " \u79CD"),
            React.createElement("span", null, " \xB7 " + Math.round(langUsage.tail.percent) + "%")
          ));
        }
        const entryItems = (p.entrypoints || []).map(
          (e, i) => React.createElement(
            "div",
            { key: i, style: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", fontSize: "12px", marginRight: "4px", marginBottom: "4px" } },
            React.createElement("span", { style: { fontSize: "13px" } }, e.type === "main" ? "\u{1F3AF}" : e.type === "cli" ? "\u{1F4BB}" : e.type === "lib" ? "\u{1F4DA}" : "\u{1F4C4}"),
            React.createElement("span", { style: { fontFamily: "monospace" } }, e.path)
          )
        );
        const typeLabel = (type) => t("mem.type." + type) !== "mem.type." + type ? t("mem.type." + type) : type;
        const typeChipStyle = { flex: "0 0 auto", fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontWeight: "600", border: "1px solid var(--dsw-alias-border-l1)" };
        const dashPanelStyle = { padding: "14px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)", minWidth: 0 };
        const dashSection = (icon, titleKey, children) => React.createElement(
          "section",
          { style: dashPanelStyle },
          React.createElement("h3", { style: sectionTitleStyle }, icon + " " + t(titleKey)),
          children
        );
        const tabDefs = [
          { id: "overview", icon: "\u25EB", label: t("dash.tab.overview") },
          { id: "architecture", icon: "\u2318", label: t("dash.tab.architecture") },
          { id: "work", icon: "\u2713", label: t("dash.tab.work") },
          { id: "knowledge", icon: "\u25C7", label: t("dash.tab.knowledge") },
          { id: "settings", icon: "\u2699", label: t("dash.tab.settings") }
        ];
        if (gitInfo && gitInfo.available === true) {
          tabDefs.push({ id: "git", icon: "\u2387", label: t("dash.tab.git") });
        }
        const emptyNode = React.createElement("span", { style: { opacity: 0.6, fontSize: "12px" } }, t("dash.none"));
        const todoNode = todos.length > 0 ? React.createElement(
          "ul",
          { style: { listStyle: "none", padding: 0, margin: 0 } },
          todos.map((x) => React.createElement(
            "li",
            { key: x.id, style: { display: "flex", gap: "8px", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)", fontSize: "12px" } },
            React.createElement("span", { style: { fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-1)", fontWeight: "600" } }, t("st." + (x.status || "pending"))),
            React.createElement("span", { style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, x.title),
            React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontWeight: "600" } }, t("prio." + (x.priority || "medium")))
          ))
        ) : emptyNode;
        const timelineNode = timelineAll.length > 0 ? React.createElement(
          "ul",
          { style: { listStyle: "none", padding: 0, margin: 0 } },
          timelineAll.slice(0, 20).map((e) => React.createElement(
            "li",
            { key: e.id, style: { display: "grid", gridTemplateColumns: "86px minmax(0, 1fr)", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)", fontSize: "12px", alignItems: "start" } },
            React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontVariantNumeric: "tabular-nums" } }, formatDate(e.occurredAt).slice(5)),
            React.createElement("span", { style: { minWidth: 0, lineHeight: 1.45 } }, e.title)
          ))
        ) : emptyNode;
        const formatMemTime = (ts) => {
          if (!ts) return "";
          try {
            const d = new Date(ts);
            const p2 = (n) => n < 10 ? "0" + n : "" + n;
            return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
          } catch (e) {
            return "";
          }
        };
        const importanceStars = (imp) => {
          const stars = Math.max(0, Math.min(5, Math.round((imp || 0) * 5)));
          return "\u2605".repeat(stars) + "\u2606".repeat(5 - stars);
        };
        const mdEscape = (s) => String(s == null ? "" : s);
        const mdBaseFont = "13.5px";
        const mdInlineStyle = {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.88em",
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          padding: "1px 6px",
          borderRadius: "4px",
          margin: "0 2px",
          wordBreak: "break-word"
        };
        const mdLinkStyle = {
          color: "var(--dsw-alias-brand-primary)",
          textDecoration: "none",
          borderBottom: "1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent)",
          wordBreak: "break-word",
          transition: "border-color 0.15s ease"
        };
        const mdStrongStyle = { fontWeight: "700", color: "var(--dsw-alias-label-primary)" };
        const mdEmStyle = { fontStyle: "italic", color: "var(--dsw-alias-label-primary)" };
        const mdRenderInline = (text, React2, keyPrefix) => {
          const re = /(\*\*([^*\n][^*]*?)\*\*)|(\*([^*\n][^*]*?)\*)|(`([^`\n]+)`)|(\[([^\]\n]+)\]\(([^)\s]+)\))/g;
          const nodes = [];
          let lastIndex = 0;
          let m;
          let i = 0;
          while ((m = re.exec(text)) !== null) {
            if (m.index > lastIndex) nodes.push(React2.createElement(React2.Fragment, { key: keyPrefix + "-" + i++ }, text.slice(lastIndex, m.index)));
            if (m[1] !== void 0) {
              nodes.push(React2.createElement("strong", { key: keyPrefix + "-" + i++, style: mdStrongStyle }, m[2]));
            } else if (m[3] !== void 0) {
              nodes.push(React2.createElement("em", { key: keyPrefix + "-" + i++, style: mdEmStyle }, m[4]));
            } else if (m[5] !== void 0) {
              nodes.push(React2.createElement("code", { key: keyPrefix + "-" + i++, style: mdInlineStyle }, m[6]));
            } else if (m[7] !== void 0) {
              nodes.push(React2.createElement("a", {
                key: keyPrefix + "-" + i++,
                href: m[9],
                target: "_blank",
                rel: "noopener noreferrer",
                style: mdLinkStyle
              }, m[8]));
            }
            lastIndex = re.lastIndex;
          }
          if (lastIndex < text.length) nodes.push(React2.createElement(React2.Fragment, { key: keyPrefix + "-" + i++ }, text.slice(lastIndex)));
          if (nodes.length === 0) nodes.push(React2.createElement(React2.Fragment, { key: keyPrefix + "-0" }, text));
          return nodes;
        };
        const mdRenderBlock = (block, React2, keyPrefix) => {
          const k = keyPrefix;
          if (block.kind === "code") {
            return React2.createElement("pre", {
              key: k,
              style: {
                background: "var(--dsw-alias-bg-base)",
                borderLeft: "3px solid var(--dsw-alias-brand-primary)",
                borderRadius: "0 6px 6px 0",
                padding: "10px 14px",
                overflowX: "auto",
                margin: "14px 0",
                fontSize: "12px",
                lineHeight: 1.6,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)"
              }
            }, React2.createElement("code", {
              style: {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "var(--dsw-alias-label-primary)",
                whiteSpace: "pre",
                fontSize: "12px"
              }
            }, block.text));
          }
          if (block.kind === "heading") {
            const isMajor = block.level <= 2;
            const sizeMap = { 1: "20px", 2: "17px", 3: "15px", 4: "14px" };
            const marginMap = {
              1: { t: "20px", b: "12px" },
              2: { t: "18px", b: "10px" },
              3: { t: "14px", b: "8px" },
              4: { t: "12px", b: "6px" }
            };
            const m = marginMap[block.level] || { t: "12px", b: "6px" };
            return React2.createElement("div", {
              key: k,
              style: {
                fontSize: sizeMap[block.level] || "14px",
                fontWeight: "700",
                lineHeight: 1.35,
                letterSpacing: block.level === 1 ? "-0.2px" : "0",
                margin: block.level === 1 ? "0 0 " + m.b : m.t + " 0 " + m.b,
                color: "var(--dsw-alias-label-primary)",
                paddingBottom: isMajor ? "6px" : "0",
                borderBottom: isMajor ? "1px solid var(--dsw-alias-border-l1)" : "none"
              }
            }, mdRenderInline(block.text, React2, k + "-h"));
          }
          if (block.kind === "hr") {
            return React2.createElement("div", {
              key: k,
              role: "separator",
              "aria-orientation": "horizontal",
              style: {
                height: "1px",
                background: "linear-gradient(90deg, transparent 0%, var(--dsw-alias-border-l1) 50%, transparent 100%)",
                margin: "18px 0"
              }
            });
          }
          if (block.kind === "ul" || block.kind === "ol") {
            const isOrdered = block.kind === "ol";
            const Tag = isOrdered ? "ol" : "ul";
            const listStyle = {
              listStyle: "none",
              padding: "0",
              margin: "10px 0 12px",
              counterReset: isOrdered ? "md-ol-" + k : void 0
            };
            const startIdx = block.start || 1;
            return React2.createElement(Tag, {
              key: k,
              start: isOrdered ? startIdx : void 0,
              style: listStyle
            }, block.items.map((item, idx) => {
              const markerStyle = {
                flex: "0 0 auto",
                width: "22px",
                fontSize: "12px",
                lineHeight: "1.7",
                color: "var(--dsw-alias-brand-primary)",
                fontWeight: "600",
                textAlign: "right",
                paddingRight: "10px",
                boxSizing: "border-box",
                userSelect: "none",
                fontVariantNumeric: "tabular-nums"
              };
              let markerNode;
              if (isOrdered) {
                markerNode = React2.createElement("span", { style: markerStyle }, String(startIdx + idx) + ".");
              } else {
                markerNode = React2.createElement("span", {
                  style: {
                    flex: "0 0 auto",
                    width: "22px",
                    height: "1.7em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "10px",
                    boxSizing: "border-box"
                  }
                }, React2.createElement("span", {
                  style: {
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "var(--dsw-alias-brand-primary)",
                    display: "inline-block"
                  }
                }));
              }
              return React2.createElement("li", {
                key: k + "-li-" + idx,
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  margin: "0 0 6px",
                  fontSize: mdBaseFont,
                  lineHeight: 1.75,
                  color: "var(--dsw-alias-label-primary)"
                }
              }, markerNode, React2.createElement("span", {
                style: { flex: "1 1 auto", minWidth: 0, wordBreak: "break-word" }
              }, mdRenderInline(item, React2, k + "-li-" + idx)));
            }));
          }
          if (block.kind === "quote") {
            return React2.createElement("blockquote", {
              key: k,
              style: {
                margin: "14px 0",
                padding: "8px 14px",
                background: "var(--dsw-alias-bg-layer-2)",
                borderLeft: "3px solid var(--dsw-alias-brand-primary)",
                borderRadius: "0 6px 6px 0",
                color: "var(--dsw-alias-label-secondary)",
                fontSize: "13px",
                lineHeight: 1.7,
                fontStyle: "italic"
              }
            }, block.lines.map((ln, idx) => React2.createElement("div", {
              key: k + "-q-" + idx,
              style: { marginBottom: idx === block.lines.length - 1 ? 0 : "4px" }
            }, mdRenderInline(ln, React2, k + "-q-" + idx))));
          }
          return React2.createElement("div", {
            key: k,
            style: {
              margin: "10px 0",
              fontSize: mdBaseFont,
              lineHeight: 1.75,
              color: "var(--dsw-alias-label-primary)",
              wordBreak: "break-word",
              letterSpacing: "0.01em"
            }
          }, mdRenderInline(block.text, React2, k + "-p"));
        };
        const mdParse = (src) => {
          const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
          const blocks = [];
          let i = 0;
          while (i < lines.length) {
            const line = lines[i];
            const fence = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
            if (fence) {
              const fenceCh = fence[2][0];
              const fenceLen = fence[2].length;
              const codeLines = [];
              i++;
              while (i < lines.length) {
                const close = lines[i].match(new RegExp("^\\s*`{3,}|~{3,}\\s*$"));
                if (close && close[0].trim()[0] === fenceCh && close[0].trim().length >= fenceLen) {
                  i++;
                  break;
                }
                codeLines.push(lines[i]);
                i++;
              }
              blocks.push({ kind: "code", text: codeLines.join("\n") });
              continue;
            }
            if (line.trim() === "") {
              i++;
              continue;
            }
            if (/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
              blocks.push({ kind: "hr" });
              i++;
              continue;
            }
            const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
            if (h) {
              blocks.push({ kind: "heading", level: h[1].length, text: h[2] });
              i++;
              continue;
            }
            if (/^\s*>\s?/.test(line)) {
              const qlines = [];
              while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                qlines.push(lines[i].replace(/^\s*>\s?/, ""));
                i++;
              }
              blocks.push({ kind: "quote", lines: qlines });
              continue;
            }
            if (/^\s*[-*+]\s+/.test(line)) {
              const items = [];
              while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
                i++;
              }
              blocks.push({ kind: "ul", items });
              continue;
            }
            const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
            if (ol) {
              const items = [];
              const start = parseInt(ol[1], 10);
              while (i < lines.length) {
                const m2 = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
                if (!m2) break;
                items.push(m2[2]);
                i++;
              }
              blocks.push({ kind: "ol", items, start });
              continue;
            }
            const paraLines = [line];
            i++;
            while (i < lines.length) {
              const nxt = lines[i];
              if (nxt.trim() === "") break;
              if (/^(\s*)(`{3,}|~{3,})/.test(nxt)) break;
              if (/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(nxt)) break;
              if (/^(#{1,6})\s+/.test(nxt)) break;
              if (/^\s*>\s?/.test(nxt)) break;
              if (/^\s*[-*+]\s+/.test(nxt)) break;
              if (/^\s*\d+\.\s+/.test(nxt)) break;
              paraLines.push(nxt);
              i++;
            }
            blocks.push({ kind: "paragraph", text: paraLines.join("\n") });
          }
          return blocks;
        };
        const renderMarkdown = (src, React2) => {
          if (!src) return null;
          const blocks = mdParse(src);
          return blocks.map((b, idx) => mdRenderBlock(b, React2, "md-" + idx));
        };
        const renderMemoryCard = (m) => {
          const contentStr = m.content ? String(m.content) : "";
          const hasLongContent = contentStr.length > 200;
          const summary = hasLongContent ? contentStr.slice(0, 200) : contentStr;
          return React.createElement(
            "article",
            {
              key: m.id,
              "data-mem-id": m.id,
              "data-mem-status": m.status || "active",
              onClick: () => openMemoryModal(m),
              title: "\u70B9\u51FB\u67E5\u770B\u5B8C\u6574\u5185\u5BB9",
              style: {
                padding: "12px 14px",
                background: "var(--dsw-alias-bg-layer-1)",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderLeft: "3px solid " + (m.status === "dormant" ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-border-l1)"),
                borderRadius: "8px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, transform 0.1s ease",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minWidth: 0,
                minHeight: "120px",
                opacity: m.status === "dormant" ? 0.82 : 1
              },
              onMouseEnter: (e) => {
                e.currentTarget.style.borderLeftColor = "var(--dsw-alias-brand-primary)";
                e.currentTarget.style.borderColor = "var(--dsw-alias-brand-primary)";
              },
              onMouseLeave: (e) => {
                e.currentTarget.style.borderLeftColor = m.status === "dormant" ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-border-l1)";
                e.currentTarget.style.borderColor = "var(--dsw-alias-border-l1)";
              }
            },
            React.createElement(
              "div",
              { style: { display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" } },
              React.createElement("span", { style: Object.assign({}, typeChipStyle, { marginTop: "1px" }) }, typeLabel(m.type)),
              m.status === "dormant" ? React.createElement("span", { style: { fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)", fontWeight: "600" } }, "dormant") : null,
              React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", flex: "1 1 200px", minWidth: 0, wordBreak: "break-word", lineHeight: 1.4, color: "var(--dsw-alias-label-primary)" } }, m.title)
            ),
            contentStr ? React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", flex: "1 1 auto" } }, summary + (hasLongContent ? "\u2026" : "")) : null,
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "auto", paddingTop: "4px", borderTop: "1px dashed var(--dsw-alias-border-l1)" } },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
                m.importance ? React.createElement("span", { title: "importance " + m.importance, style: { color: "var(--dsw-alias-brand-primary)", letterSpacing: "1px", fontWeight: "600" } }, importanceStars(m.importance)) : null,
                m.createdAt ? React.createElement("span", { style: { fontVariantNumeric: "tabular-nums" } }, formatMemTime(m.createdAt)) : null,
                Array.isArray(m.tags) && m.tags.length > 0 ? React.createElement("span", { style: { maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: m.tags.map((tag) => "#" + tag).join(" ") }, m.tags.slice(0, 3).map((tag) => "#" + tag).join(" ")) : null
              ),
              contentStr ? React.createElement("span", { style: { fontSize: "10px", padding: "2px 9px", borderRadius: "10px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontWeight: "600", border: "1px solid var(--dsw-alias-border-l1)", flex: "0 0 auto" } }, "\u25B8 \u67E5\u770B\u8BE6\u60C5") : null
            )
          );
        };
        const coreMemList = memoriesAll.filter((m) => m && m.status !== "dormant");
        const dormantMemList = memoriesAll.filter((m) => m && m.status === "dormant");
        const memoryGrid = (items) => React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" } }, items.slice(0, 20).map(renderMemoryCard));
        const memoryNode = memoriesAll.length > 0 ? React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "12px" } },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: "700", color: "var(--dsw-alias-label-secondary)" } }, t("dash.memory.core") + " \xB7 " + coreMemList.length),
          coreMemList.length ? memoryGrid(coreMemList) : emptyNode,
          dormantMemList.length ? React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "8px" } },
            React.createElement("button", {
              type: "button",
              "data-action": "toggle-dormant-memories",
              onClick: () => setDormantOpen((open) => !open),
              style: {
                alignSelf: "flex-start",
                background: "transparent",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                color: "var(--dsw-alias-label-secondary)",
                padding: "4px 10px",
                fontFamily: "inherit"
              }
            }, (dormantOpen ? t("dash.memory.dormantHide") : t("dash.memory.dormantShow")) + " \xB7 " + dormantMemList.length),
            dormantOpen ? React.createElement(
              "div",
              null,
              React.createElement("div", { style: { fontSize: "11px", fontWeight: "700", color: "var(--dsw-alias-label-secondary)", marginBottom: "8px" } }, t("dash.memory.dormant")),
              memoryGrid(dormantMemList)
            ) : null
          ) : null
        ) : emptyNode;
        const memoryModalNode = memoryModal ? React.createElement(
          "div",
          {
            "data-block": "memory-modal-overlay",
            onClick: (e) => {
              if (e.target === e.currentTarget) closeMemoryModal();
            },
            style: {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px"
            }
          },
          React.createElement(
            "div",
            {
              "data-block": "memory-modal",
              role: "dialog",
              "aria-modal": "true",
              style: {
                background: "var(--dsw-alias-bg-layer-1)",
                color: "var(--dsw-alias-label-primary)",
                borderRadius: "12px",
                border: "1px solid var(--dsw-alias-border-l1)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                width: "min(720px, 100%)",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              },
              onClick: (e) => e.stopPropagation()
            },
            // 头部：type chip + title + close
            React.createElement(
              "div",
              { style: { padding: "14px 18px", borderBottom: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "flex-start", gap: "10px", background: "linear-gradient(90deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2))" } },
              React.createElement("span", { style: typeChipStyle }, typeLabel(memoryModal.type)),
              React.createElement("span", { style: { fontSize: "15px", fontWeight: "600", flex: "1 1 auto", minWidth: 0, wordBreak: "break-word", lineHeight: 1.45 } }, memoryModal.title || "(\u65E0\u6807\u9898)"),
              React.createElement("button", {
                type: "button",
                "data-action": "memory-modal-close",
                onClick: closeMemoryModal,
                title: "\u5173\u95ED",
                style: {
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l1)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "16px",
                  lineHeight: 1,
                  width: "28px",
                  height: "28px",
                  flex: "0 0 auto",
                  color: "var(--dsw-alias-label-secondary)",
                  fontFamily: "inherit"
                }
              }, "\xD7")
            ),
            // 主体：完整内容（v1.2.x 走 markdown 渲染：标题/列表/代码块/链接等）
            React.createElement("div", {
              "data-block": "memory-modal-body",
              style: { padding: "20px 24px 24px", overflowY: "auto", flex: "1 1 auto", color: "var(--dsw-alias-label-primary)" }
            }, memoryModal.content ? renderMarkdown(String(memoryModal.content), React) : React.createElement("div", { style: { fontSize: "13.5px", color: "var(--dsw-alias-label-secondary)" } }, "\uFF08\u65E0\u5185\u5BB9\uFF09")),
            // 底部：importance + 时间 + tags + 复制
            React.createElement(
              "div",
              { style: { padding: "10px 18px", borderTop: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-2)" } },
              memoryModal.importance ? React.createElement("span", { title: "importance " + memoryModal.importance, style: { color: "var(--dsw-alias-brand-primary)", letterSpacing: "1px", fontWeight: "600" } }, importanceStars(memoryModal.importance)) : null,
              memoryModal.createdAt ? React.createElement("span", { style: { fontVariantNumeric: "tabular-nums" } }, formatMemTime(memoryModal.createdAt)) : null,
              Array.isArray(memoryModal.tags) && memoryModal.tags.length > 0 ? React.createElement("span", null, memoryModal.tags.map((tag) => "#" + tag).join(" ")) : null,
              React.createElement("span", { style: { flex: "1 1 auto" } }),
              React.createElement("button", {
                type: "button",
                "data-action": "memory-modal-copy",
                onClick: (e) => {
                  const text = (memoryModal.title || "") + "\n\n" + (memoryModal.content || "");
                  copyPrompt(text, e, "\u2713 \u5DF2\u590D\u5236", "\u590D\u5236\u5931\u8D25");
                },
                style: {
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "1px solid var(--dsw-alias-border-l1)",
                  color: "var(--dsw-alias-label-primary)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "500"
                }
              }, "\u{1F4CB} \u590D\u5236\u5168\u6587")
            )
          )
        ) : null;
        return React.createElement(
          "div",
          { id: "dsh-brain-dashboard", style: { display: "block", background: "var(--dsw-alias-bg-layer-1)", borderRadius: "10px", margin: "8px 12px", border: "1px solid var(--dsw-alias-border-l2)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }, "data-block": "dashboard" },
          React.createElement(
            "div",
            { style: { padding: "12px 16px", borderBottom: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "15px", background: "linear-gradient(90deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2))" } },
            React.createElement("span", { style: { fontSize: "18px" } }, "\u{1F3AF}"),
            React.createElement("span", { style: { flex: "1 1 auto" } }, t("dash.title")),
            React.createElement("span", {
              title: retrieval.vectorConfigured ? retrieval.embeddingModel || "hybrid" : "\u65E0\u9700\u914D\u7F6E\uFF0C\u6570\u636E\u4FDD\u7559\u5728\u9879\u76EE\u5185",
              style: { fontSize: "10px", padding: "2px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)", border: "1px solid var(--dsw-alias-border-l1)" }
            }, retrieval.configuredMode === "hybrid" ? "\u5411\u91CF\u5DF2\u914D\u7F6E" : "\u672C\u5730\u68C0\u7D22"),
            React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "\u70B9\u51FB\u5361\u7247\u540E\u53F0\u6267\u884C")
          ),
          // v0.4.15 智能续接：Session 开始时主动给出"今天可能想推进什么"
          React.createElement(SuggestionCard, {
            t,
            localeCode,
            sessionId,
            connection,
            projectInitialized: Boolean(data.initialized && data.project),
            embeddedSuggestion: data.suggestion || null,
            workspacePath: data._workspacePath || null
          }),
          // v0.4.11: Quick Actions 2x2 网格（替代"继续上次开发"鸡肋按钮）
          (() => {
            const isEn = localeCode === "en-US";
            const quickActions = [
              { id: "qa-rescan", action: "rescan", icon: "\u{1F504}", title: isEn ? "Rescan" : "\u91CD\u65B0\u626B\u63CF", desc: isEn ? "Incrementally refresh project structure" : "\u589E\u91CF\u66F4\u65B0\u9879\u76EE\u7ED3\u6784" },
              { id: "qa-todo", action: "todos", icon: "\u{1F4CB}", title: isEn ? "Review todos" : "\u6574\u7406\u5F85\u529E", desc: isEn ? "View active tasks" : "\u67E5\u770B\u6D3B\u8DC3\u4EFB\u52A1" },
              { id: "qa-memory", action: "dream", icon: "\u{1F9E0}", title: isEn ? "Organize memories" : "\u6574\u7406\u8BB0\u5FC6", desc: isEn ? "Deduplicate and archive stale items" : "\u53BB\u91CD + \u5F52\u6863\u8FC7\u671F" },
              { id: "qa-summary", action: "overview", icon: "\u{1F3AF}", title: isEn ? "Project overview" : "\u9879\u76EE\u5168\u666F", desc: isEn ? "Summarize current status" : "\u603B\u89C8\u5F53\u524D\u72B6\u6001" }
            ];
            return React.createElement(
              "div",
              { style: { padding: "12px 12px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px" } },
              quickActions.map((qa) => {
                const state = quickActionState[qa.id] || { status: "idle", message: "" };
                const busy = state.status === "loading";
                const anyBusy = Object.values(quickActionState).some((item) => item && item.status === "loading");
                const trailing = busy ? React.createElement("span", { "data-spinner": "1", style: { width: "15px", height: "15px", borderRadius: "50%", border: "2px solid var(--dsw-alias-border-l2)", borderTopColor: "var(--dsw-alias-brand-primary)", animation: "dsh-brain-spin 0.9s linear infinite", display: "inline-block" } }) : state.status === "success" ? "\u2705" : state.status === "error" ? "\u274C" : state.status === "confirm" ? "\u786E\u8BA4" : "\u25B6";
                return React.createElement(
                  "button",
                  {
                    key: qa.id,
                    type: "button",
                    "data-quick-action": qa.id,
                    "data-action-state": state.status,
                    style: {
                      padding: "10px 12px",
                      background: "var(--dsw-alias-bg-layer-2)",
                      border: "1px solid " + (state.status === "confirm" ? "var(--dsw-alias-state-warn-primary)" : state.status === "error" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-border-l1)"),
                      borderRadius: "8px",
                      cursor: anyBusy && !busy ? "not-allowed" : busy ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      transition: "transform 0.1s ease, border-color 0.1s ease",
                      opacity: anyBusy && !busy ? 0.55 : 1,
                      color: "var(--dsw-alias-label-primary)",
                      fontFamily: "inherit",
                      textAlign: "left"
                    },
                    disabled: anyBusy && !busy,
                    onClick: () => runQuickAction(qa),
                    title: state.message || qa.desc
                  },
                  React.createElement("div", { style: { fontSize: "22px", flex: "0 0 auto", lineHeight: "1" } }, qa.icon),
                  React.createElement(
                    "div",
                    { style: { flex: "1 1 auto", minWidth: 0 } },
                    React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", marginBottom: "1px" } }, qa.title),
                    React.createElement("div", { style: { fontSize: "10px", color: state.status === "error" ? "var(--dsw-alias-state-error-primary)" : state.status === "confirm" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, state.message || qa.desc)
                  ),
                  React.createElement("div", { style: { fontSize: state.status === "confirm" ? "10px" : "11px", color: state.status === "confirm" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)", flex: "0 0 auto", fontWeight: "700" } }, trailing)
                );
              })
            );
          })(),
          React.createElement(
            "div",
            { style: { padding: "0 12px 8px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", display: "flex", alignItems: "center", gap: "4px" } },
            React.createElement("span", null, "\u{1F4A1}"),
            React.createElement("span", null, "\u64CD\u4F5C\u5C06\u5728\u5F53\u524D\u5DE5\u4F5C\u533A\u540E\u53F0\u6267\u884C\uFF1B\u6574\u7406\u8BB0\u5FC6\u4F1A\u5148\u9884\u89C8\u518D\u786E\u8BA4")
          ),
          React.createElement("style", null, "@keyframes dsh-brain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"),
          React.createElement(
            "nav",
            { style: { display: "flex", gap: "4px", padding: "8px 12px 0", borderTop: "1px solid var(--dsw-alias-border-l1)", overflowX: "auto" }, "aria-label": "Project dashboard sections" },
            tabDefs.map((tab) => {
              const active = activeTab === tab.id;
              return React.createElement("button", { key: tab.id, type: "button", onClick: () => setActiveTab(tab.id), "data-dashboard-tab": tab.id, "aria-selected": active ? "true" : "false", style: { flex: "0 0 auto", padding: "8px 11px", border: "none", borderBottom: "2px solid " + (active ? "var(--dsw-alias-brand-primary)" : "transparent"), background: "transparent", color: active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: active ? "700" : "500" } }, tab.icon + " " + tab.label);
            })
          ),
          React.createElement(
            "div",
            { style: { padding: "12px" }, "data-dashboard-panel": activeTab },
            activeTab === "overview" ? React.createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "10px" } },
              dashSection("\u{1F6E0}\uFE0F", "dash.tech", techChips.length + devopsChips.length + toolingChips.length + structureChips.length + extraChips.length > 0 ? React.createElement(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                techChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px" } }, techChips) : null,
                extraChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "2px" } }, extraChips) : null,
                devopsChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "4px", paddingTop: "6px", borderTop: "1px dashed var(--dsw-alias-border-l1)" } }, devopsChips) : null,
                structureChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "2px" } }, structureChips) : null,
                toolingChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px", marginTop: "4px", paddingTop: "6px", borderTop: "1px dashed var(--dsw-alias-border-l1)" } }, toolingChips) : null
              ) : emptyNode),
              dashSection("\u{1F5C2}\uFE0F", "codegraph.langs", langChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, langChips) : emptyNode),
              dashSection("\u{1F6AA}", "dash.entry", entryItems.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, entryItems) : emptyNode)
            ) : null,
            activeTab === "architecture" ? React.createElement(ArchitectureGraphBlock, { data, t, embedded: true, onRescan: runArchRescan }) : null,
            activeTab === "work" ? React.createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px", alignItems: "start" } },
              dashSection("\u{1F4CB}", "dash.todo", todoNode),
              dashSection("\u{1F4C5}", "dash.timeline", timelineNode)
            ) : null,
            activeTab === "knowledge" ? dashSection("\u{1F9E0}", "dash.memory", memoryNode) : null,
            activeTab === "git" ? React.createElement(GitTab, { gitInfo, t, onRefresh: refreshGit, autoRefresh: gitAutoRefresh, onToggleAutoRefresh: (v) => {
              try {
                localStorage.setItem("dsh-brain-git-auto-refresh", v ? "1" : "0");
              } catch (e) {
              }
              setGitAutoRefresh(v);
            } }) : null,
            activeTab === "settings" ? React.createElement(SettingsTab, { rpc, sessionId, t, localeCode }) : null
          ),
          React.createElement(
            "div",
            { style: { padding: "8px 16px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", borderTop: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "4px" } },
            React.createElement("span", null, "\u{1F552}"),
            React.createElement("span", null, t("dash.snapshot", { time: formatDate(data.generatedAt || Date.now()) }))
          ),
          // v1.1.x-fix：项目记忆详情弹框（fixed 定位，挂在 dashboard 末尾不影响布局）
          memoryModalNode
        );
      }
      function SnapshotBadge({ data, t, source }) {
        const ts = data && data.generatedAt;
        const age = ts ? Math.round((Date.now() - ts) / 1e3) : null;
        const ageText = age == null ? "" : age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age / 60)}m` : `${Math.round(age / 3600)}h`;
        return React.createElement("span", {
          style: {
            display: "inline-block",
            padding: "2px 8px",
            marginLeft: "8px",
            borderRadius: "10px",
            fontSize: "10px",
            fontWeight: "500",
            background: "var(--dsw-alias-state-success-primary)",
            color: "var(--dsw-alias-bg-base)"
          },
          "data-block": "snapshot-badge",
          title: source === "runtime" ? t("runtime.synced") : t("snapshot.autoSync")
        }, (source === "runtime" ? "\u25CF " + t("runtime.label") : "\u{1F4E6} " + t("snapshot.label")) + (ageText ? " \xB7 " + ageText : ""));
      }
      function resolveLocaleCode(props) {
        try {
          const l = props && props._dshLocale;
          if (l && typeof l.getLocale === "function") {
            const code = l.getLocale();
            if (code && typeof code === "string" && dicts[code]) return code;
            if (code && typeof code === "string") {
              const lower = code.toLowerCase();
              for (const k of Object.keys(dicts)) {
                if (k.toLowerCase() === lower || k.toLowerCase().indexOf(lower + "-") === 0 || lower.indexOf(k.toLowerCase()) === 0) return k;
              }
            }
          }
        } catch (e) {
        }
        return "zh-CN";
      }
      function useResolvedPreview(props) {
        const embedded = DEMO_ONBOARDING ? { data: { initialized: false, project: null, phase: null, recentActivity: [], stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 }, _generatedAt: __PROJECT_DATA__ && __PROJECT_DATA__.generatedAt }, workspaceId: null, workspacePath: null, sessionId: null, hint: "", source: "snapshot" } : resolvePreview(props);
        const sid = props && props.sessionId || null;
        const [runtime, setRuntime] = React.useState(null);
        const [runtimeResolved, setRuntimeResolved] = React.useState(DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc);
        const [runtimeError, setRuntimeError] = React.useState(null);
        function compressRpcError(err) {
          const raw = err && err.message ? err.message : typeof err === "string" ? err : String(err || "");
          if (/invalid_union|invalid_value|No matching discriminator/.test(raw)) {
            return "[DSH schema] host \u8FD4\u56DE\u7684 result \u4E0D\u7B26\u5408 Connection RPC schema\uFF08\u901A\u5E38\u662F DSH \u5347\u7EA7/\u964D\u7EA7\u5F15\u5165\u7684\u534F\u8BAE\u4E0D\u517C\u5BB9\uFF0C\u6216\u63D2\u4EF6\u8FD4\u56DE\u4E86 schema \u672A\u58F0\u660E\u7684\u5B57\u6BB5\uFF09";
          }
          if (/Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|timeout/i.test(raw)) {
            return "[DSH IPC] host \u901A\u9053\u4E0D\u53EF\u8FBE\uFF08" + raw.slice(0, 80) + "\uFF09";
          }
          return raw.length > 200 ? raw.slice(0, 200) + "\u2026" : raw;
        }
        React.useEffect(() => {
          setRuntime(null);
          setRuntimeError(null);
          const offlineMode = DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc;
          if (offlineMode) {
            setRuntimeResolved(true);
            return void 0;
          }
          setRuntimeResolved(false);
          let active = true;
          const refresh = () => {
            if (!active) return;
            __DSH_CONNECTION__.rpc.call("/project-brain", "preview", { sessionId: sid }).then((result) => {
              if (!active) return;
              if (result && result.ok && result.value) {
                const value = result.value;
                setRuntime({
                  data: value.preview,
                  workspaceId: embedded.workspaceId,
                  workspacePath: value.projectPath || embedded.workspacePath,
                  sessionId: sid,
                  hint: "",
                  source: "runtime"
                });
                setRuntimeError(null);
              } else {
                const err = result && result.error || {};
                const originalCode = err.details && err.details.originalCode || null;
                setRuntimeError({
                  code: err.code || "RPC_EMPTY",
                  originalCode,
                  message: err.message || "host RPC \u8FD4\u56DE\u5F02\u5E38",
                  sessionId: sid,
                  at: Date.now()
                });
              }
              setRuntimeResolved(true);
            }).catch((error) => {
              if (!active) return;
              console.warn("[dsh-project-brain] runtime preview unavailable:", error);
              setRuntimeError({
                code: "RPC_THROW",
                message: compressRpcError(error),
                sessionId: sid,
                at: Date.now()
              });
              setRuntimeResolved(true);
            });
          };
          refresh();
          const timer = setInterval(refresh, 2e3);
          return () => {
            active = false;
            clearInterval(timer);
          };
        }, [sid]);
        return [runtime || embedded, setRuntime, runtimeResolved, runtimeError];
      }
      function SidebarPreviewRoot(props) {
        const localeCode = resolveLocaleCode(props);
        const t = makeT(localeCode);
        const [r, setRuntimePreview, runtimeResolved, runtimeError] = useResolvedPreview(props);
        const data = r.data;
        const handleOnboardingComplete = React.useCallback((value) => {
          if (!value || !value.preview) return;
          setRuntimePreview({
            data: value.preview,
            workspaceId: r.workspaceId,
            workspacePath: value.projectPath || r.workspacePath,
            sessionId: r.sessionId,
            hint: "",
            source: "runtime"
          });
        }, [r.workspaceId, r.workspacePath, r.sessionId]);
        const containerStyle = {
          padding: "10px 0 28px",
          background: "var(--dsw-alias-bg-base)",
          color: "var(--dsw-alias-label-primary)",
          minHeight: "100%",
          boxSizing: "border-box"
        };
        const containerProps = {
          className: "dsh-project-brain-preview",
          "data-version": "v1.1.x-three-runtime-rpc",
          "data-workspace-id": r.workspaceId || "(none)",
          "data-workspace-path": r.workspacePath || "(none)",
          "data-session-id": (r.sessionId || "").toString().slice(0, 8),
          "data-runtime-state": runtimeResolved ? runtimeError ? "host-error" : r.source === "runtime" ? "host-ok" : "offline" : "host-loading",
          style: containerStyle
        };
        const dataWithLocale = Object.assign({}, data, { _localeCode: localeCode, _workspacePath: r.workspacePath || null });
        const headerWithBadge = React.createElement(
          "section",
          { style: Object.assign({}, sectionStyle, { padding: "12px 16px" }), "data-block": "live-status" },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "live-label" }, "dsh-project-brain"),
            React.createElement(SnapshotBadge, { data, t, source: r.source })
          )
        );
        if (!dataWithLocale.initialized) {
          if (!runtimeResolved) {
            return React.createElement(
              "div",
              containerProps,
              React.createElement("style", null, "@keyframes dsh-brain-loading-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.dsh-brain-loading-dot{display:inline-block;width:8px;height:8px;border-radius:50%;border:1.5px solid var(--dsw-alias-brand-primary);border-top-color:transparent;animation:dsh-brain-loading-spin 0.9s linear infinite;vertical-align:middle;margin-right:8px}"),
              headerWithBadge,
              React.createElement(
                "div",
                {
                  style: { padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--dsw-alias-label-secondary)", fontSize: "12px" },
                  "data-block": "preview-loading"
                },
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center" } },
                  React.createElement("span", { className: "dsh-brain-loading-dot" }),
                  React.createElement("span", null, localeCode === "en-US" ? "Resolving workspace from Session\u2026" : "\u6B63\u5728\u4ECE Session \u89E3\u6790 workspace\u2026")
                ),
                React.createElement(
                  "div",
                  { style: { fontSize: "10px", opacity: 0.7 } },
                  r.sessionId ? String(r.sessionId).slice(0, 12) + "\u2026" : "\u2014"
                )
              )
            );
          }
          if (runtimeError) {
            const errCode = runtimeError.code || "RPC_EMPTY";
            const originalCode = runtimeError.originalCode || null;
            const effectiveCode = originalCode || errCode;
            const isWorkspaceMiss = effectiveCode === "workspace-not-found";
            const isSchema = (errCode === "RPC_THROW" || errCode === "internal") && /\[DSH schema\]/.test(runtimeError.message || "");
            const isNetwork = (errCode === "RPC_THROW" || errCode === "internal") && /\[DSH IPC\]/.test(runtimeError.message || "");
            const bannerTitle = isWorkspaceMiss ? localeCode === "en-US" ? "Workspace path not found for this Session" : "\u65E0\u6CD5\u4ECE\u5F53\u524D Session \u89E3\u6790 workspace \u8DEF\u5F84" : isSchema ? localeCode === "en-US" ? "DSH host returned a malformed result" : "DSH host \u8FD4\u56DE\u7684 result \u534F\u8BAE\u4E0D\u5339\u914D" : isNetwork ? localeCode === "en-US" ? "Cannot reach DSH host" : "\u65E0\u6CD5\u8FDE\u63A5 DSH host" : localeCode === "en-US" ? "Host RPC failed" : "host \u8FDE\u63A5\u5931\u8D25";
            const bannerReason = isWorkspaceMiss ? localeCode === "en-US" ? "DSH Host could not resolve cwd for this sessionId. Usually means DSH has not yet registered the session workspace (cold start) or the session has no cwd header." : "DSH Host \u6682\u65F6\u65E0\u6CD5\u89E3\u6790\u5F53\u524D sessionId \u5BF9\u5E94\u7684 cwd\uFF08\u901A\u5E38 DSH \u8FD8\u6CA1\u628A session workspace \u6CE8\u518C\u8FDB\u6765\uFF0C\u6216 session header \u7F3A cwd \u5B57\u6BB5\uFF09\u3002" : isSchema ? localeCode === "en-US" ? "The result of /project-brain preview did not match Connection RPC schema. This usually means the plugin and DSH Desktop versions are out of sync \u2014 try restarting DSH." : "/project-brain preview \u8FD4\u56DE\u7684 result \u4E0D\u7B26\u5408 Connection RPC schema\uFF0C\u901A\u5E38\u662F\u63D2\u4EF6\u4E0E DSH \u684C\u9762\u7248\u672C\u4E0D\u4E00\u81F4\u5BFC\u81F4\u2014\u2014\u91CD\u542F DSH \u8BD5\u8BD5\u3002" : localeCode === "en-US" ? `RPC "${errCode}"${originalCode ? " (was " + originalCode + ")" : ""} \u2014 ${runtimeError.message || "(no message)"}` : `RPC "${errCode}"${originalCode ? "\uFF08\u539F code=" + originalCode + "\uFF09" : ""} \u2014 ${runtimeError.message || "\u672A\u77E5\u9519\u8BEF"}`;
            const bannerAction = isWorkspaceMiss ? localeCode === "en-US" ? "Action: wait a moment and switch again, or open any file in the project root so DSH registers the workspace, then return." : "\u5EFA\u8BAE\uFF1A\u7B49 1~2 \u79D2\u518D\u5207\u4E00\u6B21\uFF0C\u6216\u5728\u9879\u76EE\u6839\u76EE\u5F55\u968F\u4FBF\u6253\u5F00\u4E00\u4E2A\u6587\u4EF6\u8BA9 DSH \u6CE8\u518C workspace \u540E\u518D\u56DE\u6765\u3002" : isSchema ? localeCode === "en-US" ? "Action: fully quit DSH Desktop (right-click tray \u2192 Quit) and restart. Reopen the project \u2014 the bundle will be reloaded." : "\u5EFA\u8BAE\uFF1A\u5B8C\u5168\u9000\u51FA DSH \u684C\u9762\uFF08\u6258\u76D8\u53F3\u952E \u2192 Quit\uFF09\u540E\u91CD\u65B0\u542F\u52A8\uFF0C\u518D\u6253\u5F00\u8BE5\u9879\u76EE\u5373\u53EF\u91CD\u65B0\u52A0\u8F7D bundle\u3002" : localeCode === "en-US" ? "Action: check DSH Desktop network/plugin health, or restart DSH. The retry interval is 5s." : "\u5EFA\u8BAE\uFF1A\u68C0\u67E5 DSH \u684C\u9762\u7F51\u7EDC/\u63D2\u4EF6\u72B6\u6001\uFF0C\u6216\u91CD\u542F DSH\u3002\u5BA2\u6237\u7AEF\u6BCF 5 \u79D2\u4F1A\u81EA\u52A8\u91CD\u8BD5\u3002";
            const bannerSeverity = isWorkspaceMiss ? "\u8F7B" : isSchema || isNetwork ? "\u4E2D" : "\u4E2D";
            const severityLabel = localeCode === "en-US" ? isWorkspaceMiss ? "Severity: low" : "Severity: medium" : `\u4E25\u91CD\u7A0B\u5EA6\uFF1A${bannerSeverity}`;
            const banner = React.createElement(
              "div",
              {
                "data-block": "host-error-banner",
                "data-error-code": errCode,
                style: {
                  margin: "8px 16px",
                  padding: "12px 14px",
                  background: "var(--dsw-alias-state-warn-primary)",
                  color: "var(--dsw-alias-bg-base)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  lineHeight: 1.55,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }
              },
              React.createElement(
                "div",
                { style: { fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" } },
                React.createElement("span", null, "\u26A0\uFE0F"),
                React.createElement("span", null, bannerTitle)
              ),
              React.createElement("div", { style: { opacity: 0.95 } }, bannerReason),
              React.createElement("div", { style: { opacity: 0.9, fontSize: "11px" } }, bannerAction),
              React.createElement("div", { style: { opacity: 0.85, fontSize: "10px" } }, severityLabel)
            );
            return React.createElement(
              "div",
              containerProps,
              headerWithBadge,
              banner,
              React.createElement(OnboardingBlock, {
                t,
                path: r.workspacePath || null,
                sessionId: r.sessionId || null,
                onComplete: handleOnboardingComplete,
                connection: __DSH_CONNECTION__
              })
            );
          }
          return React.createElement(
            "div",
            containerProps,
            headerWithBadge,
            React.createElement(OnboardingBlock, {
              t,
              path: r.workspacePath || null,
              sessionId: r.sessionId || null,
              onComplete: handleOnboardingComplete,
              connection: __DSH_CONNECTION__
            })
          );
        }
        return React.createElement(
          "div",
          containerProps,
          React.createElement("style", null, [
            ".dsh-project-brain-preview *{box-sizing:border-box}",
            ".dsh-brain-summary-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:10px;margin:8px 12px}",
            "@media(max-width:760px){.dsh-brain-summary-grid{grid-template-columns:1fr}}",
            ".dsh-project-brain-preview button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
            ".dsh-project-brain-preview button:not(:disabled):active{transform:translateY(1px)}",
            ".dsh-project-brain-preview button.dsh-arch-lane:not(:disabled):active,.dsh-project-brain-preview button.dsh-arch-node:not(:disabled):active,.dsh-project-brain-preview button.dsh-arch-chip:not(:disabled):active{transform:none}"
          ].join("\n")),
          headerWithBadge,
          React.createElement(HeaderBlock, { data: dataWithLocale, t }),
          React.createElement(
            "div",
            { className: "dsh-brain-summary-grid", "data-block": "summary-grid" },
            React.createElement(StatusBannerBlock, { data: dataWithLocale, t, compact: true }),
            React.createElement(PhaseBlock, { data: dataWithLocale, t, compact: true })
          ),
          React.createElement(DashboardSection, {
            data: dataWithLocale,
            t,
            localeCode,
            sessionId: r.sessionId || null,
            connection: __DSH_CONNECTION__,
            onPreviewUpdate: handleOnboardingComplete
          })
        );
      }
      function TodoStrip(props) {
        const localeCode = resolveLocaleCode(props);
        const t = makeT(localeCode);
        const [r, , runtimeResolved] = useResolvedPreview(props);
        const data = r.data;
        if (!runtimeResolved) return null;
        if (!data || !data.initialized) return null;
        const active = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
        if (active.length === 0) return null;
        const wsid = r.workspaceId || "default";
        const stripId = "dsh-brain-todo-strip-" + wsid;
        const listId = "dsh-brain-todo-strip-list-" + wsid;
        const toggleBtnId = "dsh-brain-todo-strip-toggle-" + wsid;
        const closeBtnId = "dsh-brain-todo-strip-close-" + wsid;
        const restoreId = "dsh-brain-todo-strip-restore-" + wsid;
        const dismissedKey = "dsh-brain-todo-strip-dismissed:" + wsid;
        const isDismissed = (() => {
          try {
            return localStorage.getItem(dismissedKey) === "1";
          } catch (e) {
            return false;
          }
        })();
        const containerStyle = {
          display: "flex",
          flexDirection: "column",
          gap: "0",
          padding: "6px 12px",
          margin: "0 12px 6px",
          background: "var(--dsw-alias-bg-layer-1)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "6px",
          fontSize: "12px",
          color: "var(--dsw-alias-label-primary)"
        };
        const headerStyle = {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          userSelect: "none",
          fontWeight: "600",
          fontSize: "11px",
          color: "var(--dsw-alias-label-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.6px"
        };
        const countBadgeStyle = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "18px",
          height: "16px",
          padding: "0 6px",
          marginLeft: "6px",
          fontSize: "10px",
          fontWeight: "700",
          lineHeight: "1",
          borderRadius: "8px",
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          letterSpacing: "0",
          textTransform: "none"
        };
        const iconBtnStyle = {
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--dsw-alias-label-secondary)",
          fontSize: "13px",
          fontFamily: "inherit",
          padding: "0 6px",
          borderRadius: "3px",
          lineHeight: "1"
        };
        const prioColor = { urgent: "var(--dsw-alias-state-error-primary)", high: "var(--dsw-alias-state-warn-primary)" };
        const itemStyle = (idx) => ({
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          padding: "4px 0",
          borderTop: idx === 0 ? "none" : "1px solid var(--dsw-alias-border-l1)",
          fontSize: "13px"
        });
        const chipStyle2 = (priority) => ({
          flex: "0 0 auto",
          fontSize: "10px",
          padding: "1px 6px",
          borderRadius: "3px",
          background: prioColor[priority] || "var(--dsw-alias-bg-layer-2)",
          color: prioColor[priority] ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)"
        });
        const onToggle = (ev) => {
          try {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const listEl = document.getElementById(listId);
            const btn = document.getElementById(toggleBtnId);
            if (!listEl) return;
            const expanded = listEl.dataset.expanded === "1";
            if (expanded) {
              listEl.style.display = "none";
              listEl.dataset.expanded = "0";
              if (btn) btn.textContent = "\u25BE";
            } else {
              listEl.style.display = "flex";
              listEl.dataset.expanded = "1";
              if (btn) btn.textContent = "\u25B4";
            }
          } catch (e) {
          }
        };
        const onClose = (ev) => {
          try {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const stripEl = document.getElementById(stripId);
            const restoreEl = document.getElementById(restoreId);
            if (stripEl) stripEl.style.display = "none";
            if (restoreEl) restoreEl.style.display = "";
            try {
              localStorage.setItem(dismissedKey, "1");
            } catch (e) {
            }
          } catch (e) {
          }
        };
        const onRestore = (ev) => {
          try {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            const stripEl = document.getElementById(stripId);
            const restoreEl = document.getElementById(restoreId);
            if (restoreEl) restoreEl.style.display = "none";
            if (stripEl) stripEl.style.display = "";
            try {
              localStorage.removeItem(dismissedKey);
            } catch (e) {
            }
          } catch (e) {
          }
        };
        const items = active.map(
          (x, idx) => React.createElement(
            "div",
            {
              key: x.id,
              "data-todo-item": "1",
              style: itemStyle(idx)
            },
            React.createElement("span", { style: chipStyle2(x.priority) }, t("prio." + (x.priority || "medium"))),
            React.createElement("span", { style: { flex: "1 1 auto" } }, x.title),
            x.status === "in_progress" ? React.createElement("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-state-success-primary)" } }, t("st.in_progress")) : null
          )
        );
        const strip = React.createElement(
          "div",
          {
            id: stripId,
            "data-block": "todo-strip",
            "data-workspace-id": r.workspaceId || "",
            style: Object.assign({}, containerStyle, isDismissed ? { display: "none" } : {})
          },
          React.createElement(
            "div",
            { style: headerStyle, onClick: onToggle, title: t("todostrip.viewAll") },
            React.createElement(
              "span",
              { key: "t", style: { display: "inline-flex", alignItems: "center" } },
              "\u{1F4CB} " + t("todostrip.title"),
              React.createElement("span", { style: countBadgeStyle }, String(active.length))
            ),
            React.createElement(
              "div",
              { key: "actions", style: { display: "flex", gap: "2px", alignItems: "center" } },
              React.createElement("button", {
                key: "toggle",
                id: toggleBtnId,
                type: "button",
                style: iconBtnStyle,
                onClick: onToggle,
                title: t("todostrip.viewAll")
              }, "\u25BE"),
              React.createElement("button", {
                key: "close",
                id: closeBtnId,
                type: "button",
                style: iconBtnStyle,
                onClick: onClose,
                title: t("todostrip.close")
              }, "\xD7")
            )
          ),
          React.createElement("div", {
            id: listId,
            "data-expanded": "0",
            style: { display: "none", flexDirection: "column" }
          }, items)
        );
        const restoreChip = React.createElement("button", {
          key: "restore",
          id: restoreId,
          type: "button",
          "data-block": "todo-strip-restore",
          "data-workspace-id": r.workspaceId || "",
          style: {
            display: isDismissed ? "" : "none",
            alignItems: "center",
            gap: "4px",
            padding: "2px 8px",
            margin: "0 12px 4px",
            background: "transparent",
            border: "1px dashed var(--dsw-alias-border-l1)",
            borderRadius: "10px",
            fontSize: "11px",
            color: "var(--dsw-alias-label-secondary)",
            cursor: "pointer",
            fontFamily: "inherit",
            alignSelf: "flex-start"
          },
          onClick: onRestore,
          title: t("todostrip.title")
        }, "\u{1F4CB} \xB7 " + active.length + " " + t("todostrip.viewAll"));
        return React.createElement(React.Fragment, null, strip, restoreChip);
      }
      let __DSH_CONNECTION__ = null;
      const apply = (ctx, config) => {
        const slots = ctx.slots;
        const dshLocale = ctx.locale;
        try {
          __DSH_CONNECTION__ = ctx.connection || ctx.get && ctx.get("connection") || null;
        } catch (e) {
        }
        if (!slots) {
          console.warn("[dsh-project-brain:client] slots service unavailable");
          return;
        }
        if (dshLocale && typeof dshLocale.register === "function") {
          try {
            dshLocale.register(NS, dicts);
          } catch (e) {
            console.warn("[dsh-project-brain:client] locale.register failed:", e);
          }
        }
        slots.inject(
          "conversation.view",
          () => slots.register(
            {
              name: "conversation.view",
              id: "project-brain",
              order: 35,
              label: () => "\u9879\u76EE"
            },
            (props) => React.createElement(SidebarPreviewRoot, Object.assign({}, props, { _dshLocale: dshLocale }))
          )
        );
        try {
          slots.inject(
            "conversation.input.dock",
            () => slots.register(
              {
                name: "conversation.input.dock",
                id: "project-brain-todo-strip",
                order: 10,
                label: () => "TodoStrip"
              },
              (props) => React.createElement(TodoStrip, Object.assign({}, props, { _dshLocale: dshLocale }))
            )
          );
        } catch (e) {
          console.warn("[dsh-project-brain:client] conversation.input.dock registration failed:", e);
        }
      };
      var module = { exports: {} };
      module.exports = {
        name: "dsh-project-brain:client",
        inject: ["slots", "locale", "connection"],
        apply
      };
      return module.exports;
    }
  });
})();
//# sourceMappingURL=client.js.map
