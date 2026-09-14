// dsh-project-brain Client 入口（v0.5.1：Connection RPC 实时数据 + 离线快照降级）
// DSH 浏览器侧模块加载格式：window.__ModuleLoader__.load({id, factory})
//
// 主数据通道：Client 用 connection.rpc 按 live sessionId 请求 Host，Host 从 Session
// header 解析可信 cwd 并读取对应 .project-brain。build-time embed 只作首屏/离线降级。
//
// 区块组件不变（Header/Phase/Todo/CodeGraph/Activity/Memories/Stats/Actions/Dashboard），
// 因为它们是纯函数，数据来源 embed 即可。

window.__ModuleLoader__.load({
  id: "dsh-project-brain",
  factory: (require) => {
    const React = require("react");
    const NS = "dsh-project-brain";

    // ─── i18n 字典 ───
    const dicts = {
      "zh-CN": {
        "tab.label": "项目",
        "header.section": "项目",
        "header.untitled": "未命名项目",
        "header.lastUpdate": "上次更新",
        "phase.title": "当前阶段",
        "phase.empty": "暂无进行中任务",
        "todo.title": "待办",
        "todo.empty": "暂无待办",
        "activity.title": "最近活动",
        "activity.empty": "暂无活动",
        "memories.title": "项目记忆",
        "stats.title": "概览",
        "stats.pending": "待办",
        "stats.done": "已完成",
        "stats.decisions": "决策",
        "codegraph.title": "代码结构",
        "codegraph.files": "文件",
        "codegraph.edges": "依赖边",
        "codegraph.langs": "语言",
        "codegraph.noLang": "暂无语言数据",
        "arch.title": "项目架构图",
        "arch.modules": "模块",
        "arch.edges": "依赖",
        "arch.local": "本地分析",
        "arch.hybrid": "DSH LLM 增强",
        "arch.select": "点击模块查看职责与文件",
        "arch.flows": "关键流程",
        "arch.risks": "架构提示",
        "arch.purpose": "项目定位",
        "arch.style": "架构风格",
        "arch.layers": "架构分层",
        "arch.components": "核心组件",
        "arch.keyFiles": "关键文件导览",
        "arch.start": "快速熟悉路径",
        "arch.highlights": "设计要点",
        "arch.trigger": "触发",
        "arch.outcome": "结果",
        "arch.llmFallback": "DSH LLM 未完成，当前展示本地推断",
        "arch.actionRetry": "重新扫描",
        "arch.actionChat": "先发一条消息",
        "arch.actionSettings": "检查 DSH 模型路由",
        "arch.retrying": "重新扫描中…",
        "arch.retryDone": "已重新生成",
        "arch.retryFailed": "重新扫描失败",
        "actions.continue": "继续上次开发",
        "actions.openDashboard": "打开 Dashboard",
        "actions.closeDashboard": "收起 Dashboard",
        "actions.copied": "已复制，粘贴到输入框发送",
        "actions.copyFail": "复制失败，请手动输入",
        "todostrip.title": "活跃待办",
        "todostrip.viewAll": "查看全部",
        "todostrip.close": "收起",
        "todostrip.empty": "🎉 暂无活跃待办",
        "onboarding.title": "项目大脑未启动",
        "onboarding.body": "把这个项目的「长期记忆」交给 DSH，每次开新 Session 不用再重复介绍背景。",
        "onboarding.cta": "一键启动 /project_init",
        "onboarding.copyPrompt": "请扫描本项目：调用 project_init 工具生成项目大脑",
        "onboarding.copied": "已复制启动指令，粘贴发送即可",
        "loading": "加载中…",
        "snapshot.label": "快照",
        "snapshot.autoSync": "离线快照；连接恢复后自动切换实时数据",
        "runtime.label": "实时",
        "runtime.synced": "数据来自当前 Session workspace",
        "time.justNow": "刚刚",
        "time.minutesAgo": "{n} 分钟前",
        "time.hoursAgo": "{n} 小时前",
        "time.daysAgo": "{n} 天前",
        "prio.urgent": "紧急",
        "prio.high": "高",
        "prio.medium": "中",
        "prio.low": "低",
        "st.pending": "待办",
        "st.in_progress": "进行中",
        "st.blocked": "阻塞",
        "st.done": "已完成",
        "st.cancelled": "已取消",
        "dash.title": "Dashboard · 项目全景",
        "dash.tech": "技术栈",
        "dash.entry": "开发入口",
        "dash.todo": "待办（全部）",
        "dash.timeline": "时间线",
        "dash.memory": "项目记忆（全部）",
        "dash.tab.overview": "概览",
        "dash.tab.architecture": "架构",
        "dash.tab.work": "任务动态",
        "dash.tab.knowledge": "项目记忆",
        "dash.tab.git": "Git 历史",
        "dash.tab.settings": "设置",
        "dash.snapshot": "数据快照 · {time}",
        "dash.none": "（空）",
        "suggest.title": "💡 你今天可能想推进",
        "suggest.llmTag": "AI 推荐",
        "suggest.localTag": "本地推荐",
        "suggest.fallbackTag": "AI 暂不可用",
        "suggest.loading": "分析今天的续接建议…",
        "suggest.confidence": "置信度 {pct}%",
        "suggest.refresh": "重新生成",
        "suggest.dismiss": "收起",
        "suggest.empty": "暂无活跃任务和近期记忆，可用 project_todo_add 规划下一步",
        "suggest.reasonLabel": "依据",
        "mem.type.decision": "决策",
        "mem.type.bug": "Bug",
        "mem.type.lesson": "教训",
        "mem.type.requirement": "需求",
        "mem.type.architecture": "架构",
        "mem.type.change": "变更",
        "mem.type.context": "备注",
        "mem.type.issue": "问题",
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
        "arch.select": "Select a module to inspect responsibilities and files",
        "arch.flows": "Key flows",
        "arch.risks": "Architecture notes",
        "arch.purpose": "Project purpose",
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
        "arch.retrying": "Rescanning…",
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
        "todostrip.empty": "🎉 No active TODOs",
        "onboarding.title": "Project Brain not started",
        "onboarding.body": "Hand this project's \"long-term memory\" to DSH — no more re-explaining the background when you open a new session.",
        "onboarding.cta": "Start /project_init",
        "onboarding.copyPrompt": "Please scan this project: call the project_init tool to build the project brain",
        "onboarding.copied": "Command copied, paste & send",
        "loading": "Loading…",
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
        "dash.title": "Dashboard · Full view",
        "dash.tech": "Tech stack",
        "dash.entry": "Entrypoints",
        "dash.todo": "TODO (all)",
        "dash.timeline": "Timeline",
        "dash.memory": "Memories (all)",
        "dash.tab.overview": "Overview",
        "dash.tab.architecture": "Architecture",
        "dash.tab.work": "Work & activity",
        "dash.tab.knowledge": "Knowledge",
        "dash.tab.git": "Git history",
        "dash.tab.settings": "Settings",
        "dash.snapshot": "Data snapshot · {time}",
        "dash.none": "(empty)",
        "suggest.title": "💡 Today you may want to continue",
        "suggest.llmTag": "AI",
        "suggest.localTag": "Local",
        "suggest.fallbackTag": "AI unavailable",
        "suggest.loading": "Analyzing today’s continuation…",
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
        "mem.type.issue": "Issue",
      },
    };

    function interpolate(template, vars) {
      if (!template || !vars) return template || "";
      return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
    }

    function makeT(localeCode) {
      const d = dicts[localeCode] || dicts["zh-CN"];
      return (key, vars) => interpolate(d[key] || dicts["zh-CN"][key] || key, vars);
    }

    function formatRelativeTime(ts, now, localeCode) {
      const diff = now - ts;
      const t = makeT(localeCode);
      if (diff < 60_000) return t("time.justNow");
      const minutes = Math.floor(diff / 60_000);
      if (minutes < 60) return t("time.minutesAgo", { n: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("time.hoursAgo", { n: hours });
      const days = Math.floor(hours / 24);
      return t("time.daysAgo", { n: days });
    }

    function formatDate(ts) {
      try {
        const d = new Date(ts);
        const p = (n) => (n < 10 ? "0" + n : "" + n);
        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
      } catch (e) { return ""; }
    }

    // v1.1.x-fix: 语言使用率归一化（按文件数降序 + 百分比 + 长尾聚合）
    // 输入 { lang: count } 或 null/undefined；输出 { top: [{lang,count,percent}], tail: {count,percent,languages}|null, total, distinctCount }
    // topN 默认 8（典型项目 ≤8 种都能完整展示；更多则把后位合并为"其它"chip）
    function formatLanguagesUsage(languages, opts) {
      const obj = languages && typeof languages === "object" ? languages : {};
      const entries = Object.entries(obj)
        .filter(([, c]) => Number(c) > 0)
        .map(([lang, count]) => ({ lang: String(lang), count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
      const total = entries.reduce((s, e) => s + e.count, 0);
      const topN = opts && Number.isFinite(opts.topN) ? Math.max(1, opts.topN | 0) : 8;
      const mergeTail = opts && opts.mergeTail === false ? false : true;
      const head = entries.slice(0, topN);
      const tailList = entries.slice(topN);
      const withPct = (e) => Object.assign({}, e, { percent: total > 0 ? (e.count / total) * 100 : 0 });
      const top = head.map(withPct);
      let tail = null;
      if (mergeTail && tailList.length > 0) {
        const tailCount = tailList.reduce((s, e) => s + e.count, 0);
        tail = { count: tailCount, percent: total > 0 ? (tailCount / total) * 100 : 0, languages: tailList.length };
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
      } catch (e) {}
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
        } catch (e) {}
      }
      const btn = ev && (ev.currentTarget || ev.target);
      if (btn && (okLabel || failLabel)) {
        try { btn.textContent = ok ? (okLabel || "OK") : (failLabel || "FAIL"); } catch (e) {}
      }
    }

    function toggleDashboard(ev, t) {
      const el = (typeof document !== "undefined" && typeof document.getElementById === "function")
        ? document.getElementById("dsh-brain-dashboard") : null;
      const btn = ev && (ev.currentTarget || ev.target);
      if (!el) return;
      const open = el.style.display === "none";
      el.style.display = open ? "block" : "none";
      // v0.4.12: 按钮文案统一为"查看 Dashboard · 项目全景"，点击后不再切换文案
      // 改用按钮右侧小图标（▾ 已展开 / ▸ 已折叠）作为状态指示
      const indicator = btn && btn.querySelector("[data-dashboard-indicator]");
      if (indicator) indicator.textContent = open ? "▾" : "▸";
      if (open && el.scrollIntoView) {
        try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
      }
    }

    const sectionStyle = {
      padding: "14px 16px",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-primary)",
      borderRadius: "10px",
      margin: "8px 12px",
      border: "1px solid var(--dsw-alias-border-l1)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    };
    const sectionTitleStyle = {
      margin: "0 0 10px",
      fontSize: "12px",
      fontWeight: "600",
      letterSpacing: "0.4px",
      color: "var(--dsw-alias-label-secondary)",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    };
    const chipStyle = {
      padding: "2px 8px",
      background: "var(--dsw-alias-bg-layer-2)",
      color: "var(--dsw-alias-label-primary)",
      fontSize: "11px",
      borderRadius: "10px",
      fontWeight: "500",
      marginRight: "4px",
      display: "inline-block",
    };

    // ─── build-time embed 数据 ───
    const __PROJECT_DATA__ = /*#__PURE__*/ JSON.parse(__PROJECT_DATA_JSON__);
    const __CODEGRAPH_EMBED__ = __CODEGRAPH_JSON__ && __CODEGRAPH_JSON__ !== "null"
      ? JSON.parse(__CODEGRAPH_JSON__) : null;
    const __ALL_WORKSPACES__ = (typeof __ALL_WORKSPACES_JSON__ !== "undefined" && __ALL_WORKSPACES_JSON__ !== "null")
      ? JSON.parse(__ALL_WORKSPACES_JSON__) : null;

    const DEMO_ONBOARDING = (typeof location !== "undefined")
      ? location.search.indexOf("dsh_brain_demo=onboarding") >= 0 : false;

    // ─── build-time fallback：解析 embed 多 workspace 索引 ───
    // Connection RPC 请求完成前使用的离线快照降级。
    // v1.1.x-fix: embedded 阶段不再预设 hint（hint 是运行时降级信号，embedded 不知道 host 是否能成功）。
    //   首屏一律走 loading，等 host RPC 真正答复后再决定渲染 dashboard / Onboarding / 兜底 banner。
    function resolvePreview(props) {
      const sid = (props && props.sessionId) || null;
      const wsMap = __ALL_WORKSPACES__ || {};
      const sessionToWsId = wsMap.sessionToWorkspaceId || {};
      let wsId = sid ? sessionToWsId[sid] : null;
      let projects = (wsId && wsMap.workspaceProjects && wsMap.workspaceProjects[wsId]) || [];
      let wsPath = (wsId && wsMap.workspacePaths && wsMap.workspacePaths[wsId]) || null;
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
            _sessionId: sid,
          },
          workspaceId: wsId,
          workspacePath: wsPath,
          sessionId: sid,
          hint: "",
          source: "snapshot",
        };
      }
      const merged = Object.assign({}, picked, {
        codegraph: (picked && picked.codegraph) || __CODEGRAPH_EMBED__,
      });
      merged._workspaceId = wsId;
      merged._workspacePath = wsPath;
      merged._sessionId = sid;
      return { data: merged, workspaceId: wsId, workspacePath: wsPath, sessionId: sid, hint: "", source: "snapshot" };
    }

    // 项目 type → emoji
    const projectIcon = (type) => {
      const t = (type || "").toLowerCase();
      if (t.includes("frontend") || t.includes("web") || t.includes("ui")) return "🎨";
      if (t.includes("backend") || t.includes("api") || t.includes("server")) return "⚙️";
      if (t.includes("lib") || t.includes("tool") || t.includes("util")) return "📚";
      if (t.includes("cli")) return "💻";
      if (t.includes("mobile") || t.includes("app")) return "📱";
      return "📦";
    };

    // ─── 区块组件（纯函数） ───
    function HeaderBlock({ data, t }) {
      if (!data.project) return null;
      const p = data.project;
      const icon = projectIcon(p.type);
      return React.createElement(
        "section",
        { style: Object.assign({}, sectionStyle, { padding: "16px 18px", background: "linear-gradient(135deg, var(--dsw-alias-bg-layer-1) 0%, var(--dsw-alias-bg-layer-2) 100%)" }), "data-block": "header" },
        React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { fontSize: "11px" }) }, "📁 " + t("header.section")),
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" } },
          React.createElement("span", { style: { fontSize: "22px" } }, icon),
          React.createElement("span", { style: { fontSize: "18px", fontWeight: "600", letterSpacing: "0.2px" } }, p.name || t("header.untitled")),
          p.type
            ? React.createElement("span", { style: { padding: "2px 10px", background: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-bg-base)", fontSize: "11px", borderRadius: "10px", fontWeight: "600" } }, p.type)
            : null,
        ),
        p.description && p.description !== "Auto-generated by dsh-project-brain"
          ? React.createElement("p", { style: { margin: "8px 0 0", fontSize: "12px", lineHeight: "1.55", color: "var(--dsw-alias-label-secondary)" } }, String(p.description).slice(0, 280))
          : null,
        p.lastUpdateAt
          ? React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" } },
              React.createElement("span", null, "🕒"),
              React.createElement("span", null, `${t("header.lastUpdate")} · ${formatRelativeTime(p.lastUpdateAt, Date.now(), data._localeCode)}`),
            )
          : null,
      );
    }

    // 项目状态总览（新增 v0.4.8）：3 大数字 + 一行解读
    function StatusBannerBlock({ data, t, compact }) {
      const s = data.stats || {};
      const todos = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
      const memories = data.memories || [];
      const lastAct = (data.recentActivity || [])[0];
      const statBox = (icon, value, label, color) =>
        React.createElement("div", { style: { flex: "1 1 0", textAlign: "center", padding: "10px 6px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)" } },
          React.createElement("div", { style: { fontSize: "20px", lineHeight: "1", marginBottom: "4px" } }, icon),
          React.createElement("div", { style: { fontSize: "20px", fontWeight: "700", lineHeight: "1.1", color: color || "var(--dsw-alias-label-primary)", fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "4px", letterSpacing: "0.3px" } }, label),
        );
      // 一行解读
      const tips = [];
      if (todos.length > 5) tips.push(`${todos.length} 个待办较密集`);
      if (memories.length > 30) tips.push("记忆较多，可整理");
      const insight = lastAct ? `最近 ${formatRelativeTime(lastAct.occurredAt, Date.now(), data._localeCode)}` : "暂无活动";
      return React.createElement(
        "section",
        { style: Object.assign({}, sectionStyle, { padding: "12px 14px", margin: compact ? 0 : sectionStyle.margin }), "data-block": "status-banner" },
        React.createElement("div", { style: { display: "flex", gap: "6px" } },
          statBox("📋", todos.length, t("stats.pending"), todos.length > 0 ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)"),
          statBox("🧠", memories.length, t("memories.title"), memories.length > 0 ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)"),
          statBox("⚡", s.completedTodos || 0, t("stats.done"), "var(--dsw-alias-state-success-primary)"),
        ),
        React.createElement("div", { style: { marginTop: "8px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", display: "flex", alignItems: "center", gap: "4px" } },
          React.createElement("span", null, "💡"),
          React.createElement("span", null, insight + (tips.length > 0 ? " · " + tips.join("，") : "")),
        ),
      );
    }

    function PhaseBlock({ data, t, compact }) {
      const phaseSectionStyle = Object.assign({}, sectionStyle, { margin: compact ? 0 : sectionStyle.margin, height: compact ? "100%" : undefined, boxSizing: "border-box" });
      const phase = data.phase;
      if (!phase || !phase.progress) {
        return React.createElement("section", { style: phaseSectionStyle, "data-block": "phase" },
          React.createElement("h3", { style: sectionTitleStyle }, "🎯 " + t("phase.title")),
          React.createElement("p", { style: { margin: 0, opacity: 0.6, fontSize: "13px" } }, t("phase.empty")),
        );
      }
      const { done, total } = phase.progress;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return React.createElement("section", { style: phaseSectionStyle, "data-block": "phase" },
        React.createElement("h3", { style: sectionTitleStyle }, "🎯 " + t("phase.title")),
        React.createElement("p", { style: { margin: "0 0 8px", fontSize: "14px", fontWeight: "500" } }, phase.title),
        React.createElement("div", { style: { height: "8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "4px", overflow: "hidden", position: "relative" } },
          React.createElement("div", { style: { width: percent + "%", height: "100%", background: "var(--dsw-alias-state-success-primary)", transition: "width 0.4s ease", borderRadius: "4px" } }),
        ),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
          React.createElement("span", null, `${done} / ${total}`),
          React.createElement("span", { style: { fontWeight: "600", color: "var(--dsw-alias-state-success-primary)" } }, percent + "%"),
        ),
      );
    }

    function TodoBlock({ data, t }) {
      const todos = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
      if (todos.length === 0) return null;
      const items = todos.slice(0, 5);
      const overflow = todos.length - items.length;
      const statusBorder = (s) => ({ in_progress: "var(--dsw-alias-state-success-primary)", blocked: "var(--dsw-alias-state-error-primary)" })[s] || "var(--dsw-alias-border-l1)";
      const prioIcon = (p) => ({ urgent: "🔴", high: "🟠", medium: "🟡", low: "🟢" })[p] || "⚪";
      const statusIcon = (s) => ({ in_progress: "▶️", blocked: "⛔" })[s] || "📋";
      const todoCard = (x) => {
        const isActive = x.status === "in_progress";
        return React.createElement("div", {
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
            transition: "transform 0.1s ease",
          },
        },
          React.createElement("div", { style: { fontSize: "13px", flex: "0 0 auto", lineHeight: "1.4" } }, statusIcon(x.status)),
          React.createElement("div", { style: { flex: "1 1 auto", minWidth: 0 } },
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "500", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", marginBottom: "3px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, x.title),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
              React.createElement("span", { title: t("prio." + (x.priority || "medium")), style: { fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "3px", padding: "1px 6px", borderRadius: "6px", background: "var(--dsw-alias-bg-base)", border: "1px solid var(--dsw-alias-border-l1)" } },
                React.createElement("span", null, prioIcon(x.priority)),
                React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "600" } }, t("prio." + (x.priority || "medium"))),
              ),
              isActive ? React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-state-success-primary)", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "3px" } },
                React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dsw-alias-state-success-primary)" } }),
                React.createElement("span", null, t("st.in_progress")),
              ) : null,
            ),
          ),
        );
      };
      return React.createElement("section", { style: sectionStyle, "data-block": "todo" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
          React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, "📋 " + t("todo.title") + " · " + todos.length),
          overflow > 0 ? React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-2)", padding: "2px 8px", borderRadius: "10px", fontWeight: "600" } }, "+" + overflow) : null,
        ),
        React.createElement("div", null, items.map(todoCard)),
      );
    }

    function ActivityBlock({ data, t }) {
      const items = (data.recentActivity || []).slice(0, 6);
      if (items.length === 0) {
        return React.createElement("section", { style: sectionStyle, "data-block": "activity" },
          React.createElement("h3", { style: sectionTitleStyle }, "⚡ " + t("activity.title")),
          React.createElement("p", { style: { margin: 0, opacity: 0.6, fontSize: "13px" } }, t("activity.empty")),
        );
      }
      const eventIcon = (title) => {
        const t0 = (title || "").toLowerCase();
        if (t0.includes("init") || t0.includes("扫描") || t0.includes("scan")) return "🚀";
        if (t0.includes("memory") || t0.includes("记忆")) return "🧠";
        if (t0.includes("todo") || t0.includes("待办")) return "📋";
        if (t0.includes("dream") || t0.includes("整理")) return "✨";
        if (t0.includes("rescan")) return "🔄";
        if (t0.includes("session") || t0.includes("摘要")) return "📝";
        if (t0.includes("diff") || t0.includes("架构")) return "🌳";
        return "•";
      };
      const timelineItem = (it, isLast) => {
        const icon = eventIcon(it.title);
        return React.createElement("div", { key: it.id, style: { display: "flex", gap: "10px", position: "relative", paddingBottom: isLast ? 0 : "10px" } },
          React.createElement("div", { style: { flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", width: "36px" } },
            React.createElement("div", { style: { width: "28px", height: "28px", borderRadius: "50%", background: "var(--dsw-alias-bg-layer-2)", border: "2px solid var(--dsw-alias-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", lineHeight: "1" } }, icon),
            !isLast ? React.createElement("div", { style: { flex: "1 1 auto", width: "2px", background: "var(--dsw-alias-border-l1)", marginTop: "4px", minHeight: "12px" } }) : null,
          ),
          React.createElement("div", { style: { flex: "1 1 auto", minWidth: 0, paddingBottom: isLast ? 0 : "2px" } },
            React.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px", marginBottom: "2px" } },
              React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontWeight: "600", fontVariantNumeric: "tabular-nums" } }, formatRelativeTime(it.occurredAt, Date.now(), data._localeCode)),
              React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontVariantNumeric: "tabular-nums" }, title: formatDate(it.occurredAt) }, formatDate(it.occurredAt).slice(5)),
            ),
            React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, it.title),
          ),
        );
      };
      return React.createElement("section", { style: sectionStyle, "data-block": "activity" },
        React.createElement("h3", { style: sectionTitleStyle }, "⚡ " + t("activity.title")),
        React.createElement("div", null, items.map((it, idx) => timelineItem(it, idx === items.length - 1))),
      );
    }

    function MemoriesBlock({ data, t }) {
      const memories = data.memories || [];
      if (memories.length === 0) return null;
      const typeLabel = (type) => t("mem.type." + type) !== "mem.type." + type ? t("mem.type." + type) : type;
      const typeIcon = (type) => ({ decision: "💡", bug: "🐛", lesson: "📖", requirement: "📌", architecture: "🏛️", change: "🔄", context: "💬", issue: "❓" })[type] || "📝";
      const importanceStars = (imp) => {
        const stars = Math.max(0, Math.min(5, Math.round((imp || 0) * 5)));
        return "★".repeat(stars) + "☆".repeat(5 - stars);
      };
      // 用 React state 管理展开状态（修复 v0.4.9 toggle bug：原版用模块级 const + DOM 直接操作，
      //   React 重渲染时 inline style 被 React state 计算值覆盖，导致"展开后无法收起"）
      const [expanded, setExpanded] = React.useState(new Set());
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
            btn.textContent = "✓";
            setTimeout(() => { btn.textContent = orig; }, 1200);
          }
        } catch (e) {}
      };
      const memCard = (m) => {
        const isOpen = expanded.has(m.id);
        const summary = String(m.content || "").slice(0, 100);
        const hasMore = (m.content || "").length > 100;
        return React.createElement("div", {
          key: m.id,
          "data-mem-card": "1",
          "data-mem-open": isOpen ? "1" : "0",
          style: {
            padding: "10px 12px",
            marginBottom: "6px",
            background: "var(--dsw-alias-bg-layer-2)",
            borderRadius: "8px",
            borderLeft: "3px solid var(--dsw-alias-brand-primary)",
          },
        },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
            React.createElement("span", { style: { fontSize: "13px" } }, typeIcon(m.type)),
            React.createElement("span", { style: { fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-base)", color: "var(--dsw-alias-label-primary)", fontWeight: "600", border: "1px solid var(--dsw-alias-border-l1)" } }, typeLabel(m.type)),
            React.createElement("span", { title: "importance " + (m.importance || 0), style: { fontSize: "10px", color: "var(--dsw-alias-brand-primary)", letterSpacing: "1px" } }, importanceStars(m.importance)),
            React.createElement("div", { style: { flex: "1 1 auto" } }),
            React.createElement("button", {
              "data-mem-copy": "1",
              title: "复制到 LLM 帮你整理",
              style: { background: "transparent", border: "none", cursor: "pointer", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", padding: "0 4px", borderRadius: "4px" },
              onClick: (e) => copyMem(m, e),
            }, "📋"),
            React.createElement("span", {
              "data-mem-indicator": "1",
              style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", padding: "0 4px", userSelect: "none" },
              onClick: (e) => toggle(m, e),
              title: "展开/收起",
            }, isOpen ? "▾" : "▸"),
          ),
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", lineHeight: "1.4", marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" } }, m.title),
          m.content ? React.createElement("div", {
            "data-mem-summary": "1",
            style: { display: isOpen ? "none" : "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5", marginBottom: hasMore ? "4px" : "0", cursor: "pointer" },
            onClick: (e) => toggle(m, e),
          }, summary + (hasMore ? "..." : "")) : null,
          m.content ? React.createElement("div", {
            "data-mem-content": "1",
            style: { display: isOpen ? "block" : "none", fontSize: "12px", color: "var(--dsw-alias-label-primary)", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "4px", padding: "8px 10px", background: "var(--dsw-alias-bg-base)", borderRadius: "6px", border: "1px solid var(--dsw-alias-border-l1)", cursor: "pointer" },
            onClick: (e) => toggle(m, e),
          }, m.content) : null,
        );
      };
      return React.createElement("section", { style: sectionStyle, "data-block": "memories" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } },
          React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0 }) }, "🧠 " + t("memories.title") + " · " + memories.length),
          React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "📋 点击 📋 复制给 LLM"),
        ),
        React.createElement("div", null, memories.slice(0, 8).map(memCard)),
        memories.length > 8 ? React.createElement("div", { style: { textAlign: "center", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "6px" } }, "+" + (memories.length - 8) + " 更多 → Dashboard") : null,
      );
    }

    function StatsBlock({ data, t }) {
      const s = data.stats || { pendingTodos: 0, completedTodos: 0, decisions: 0 };
      const statItem = (icon, value, label, color) =>
        React.createElement("div", { style: { textAlign: "center", padding: "8px 4px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", marginBottom: "2px" } }, icon),
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", lineHeight: "1.1", color: color, fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", letterSpacing: "0.3px" } }, label),
        );
      return React.createElement("section", { style: sectionStyle, "data-block": "stats" },
        React.createElement("h3", { style: sectionTitleStyle }, "📊 " + t("stats.title")),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "4px" } },
          statItem("📋", s.pendingTodos, t("stats.pending"), s.pendingTodos > 0 ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-primary)"),
          statItem("✅", s.completedTodos, t("stats.done"), "var(--dsw-alias-state-success-primary)"),
          statItem("💡", s.decisions, t("stats.decisions"), "var(--dsw-alias-brand-primary)"),
        ),
      );
    }

    function CodeGraphBlock({ data, t }) {
      const architecture = data && data.architecture;
      const cg = data && data.codegraph ? data.codegraph : architecture ? {
        stats: {
          files: architecture.stats && architecture.stats.files || 0,
          edges: architecture.stats && architecture.stats.edges || 0,
          languages: (data.project && data.project.languages) || {},
        },
      } : null;
      if (!cg) return null;
      const stat = (icon, value, label) =>
        React.createElement("div", { style: { textAlign: "center", padding: "8px 4px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px" } },
          React.createElement("div", { style: { fontSize: "13px", marginBottom: "2px" } }, icon),
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", lineHeight: "1.1", fontVariantNumeric: "tabular-nums" } }, value),
          React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", letterSpacing: "0.3px" } }, label),
        );
      const langUsage = formatLanguagesUsage(cg.stats.languages);
      const langItems = [];
      for (const item of langUsage.top) {
        const pctLabel = langUsage.total > 0 ? Math.round(item.percent) + "%" : "";
        langItems.push(React.createElement("span", {
          key: "lang-" + item.lang,
          title: item.lang + " · " + item.count + " 个文件",
          style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" },
        },
          React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
          React.createElement("span", null, item.lang),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, pctLabel ? " · " + pctLabel : ""),
        ));
      }
      if (langUsage.tail) {
        langItems.push(React.createElement("span", {
          key: "lang-tail",
          title: langUsage.tail.languages + " 种语言共 " + langUsage.tail.count + " 个文件",
          style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)", color: "var(--dsw-alias-label-secondary)" },
        },
          React.createElement("span", null, "其它 " + langUsage.tail.languages + " 种"),
          React.createElement("span", null, " · " + Math.round(langUsage.tail.percent) + "%"),
        ));
      }
      return React.createElement("section", { style: sectionStyle, "data-block": "codegraph" },
        React.createElement("h3", { style: sectionTitleStyle }, "🌳 " + t("codegraph.title")),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "4px" } },
          stat("📁", cg.stats.files, t("codegraph.files")),
          stat("🔗", cg.stats.edges, t("codegraph.edges")),
          stat("🗂️", Object.keys(cg.stats.languages || {}).length, t("codegraph.langs")),
        ),
        React.createElement("div", { style: { marginTop: "10px" } },
          langItems.length > 0 ? langItems : React.createElement("span", { style: { opacity: 0.6, fontSize: "12px" } }, t("codegraph.noLang")),
        ),
      );
    }

    function ArchitectureGraphBlock({ data, t, embedded, onRescan }) {
      const architecture = data && data.architecture;
      const [selectedId, setSelectedId] = React.useState(null);
      const [retryState, setRetryState] = React.useState({ status: "idle", message: null });
      if (!architecture) return null;
      const components = (architecture.components || architecture.nodes || []).slice(0, 24);
      if (!components.length) return null;
      const layers = (architecture.layers || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const relationships = (architecture.relationships || architecture.edges || []).slice(0, 40);
      const flows = (architecture.runtimeFlows || architecture.flows || []).slice(0, 6);
      const overview = architecture.overview || { purpose: architecture.summary || "", architectureStyle: "" };
      const selected = components.find((item) => item.id === selectedId) || components[0];
      const byId = new Map(components.map((item) => [item.id, item]));
      const related = relationships.filter((item) => item.from === selected.id || item.to === selected.id);
      const sourceLabel = architecture.source === "hybrid" ? t("arch.hybrid") : t("arch.local");
      const typeIcons = { presentation: "🖥️", ui: "🖥️", interface: "🔌", api: "🔌", application: "🧭", service: "⚙️", domain: "🧠", core: "🧠", data: "🗄️", integration: "🔗", support: "🛠️" };
      const layerRows = layers.length ? layers : [{ id: "all", name: t("arch.components"), responsibility: "", order: 0 }];
      const componentsForLayer = (layer) => layers.length ? components.filter((item) => item.layerId === layer.id) : components;
      const panelStyle = { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "9px", background: "var(--dsw-alias-bg-layer-2)", padding: "10px" };
      const smallTitle = { fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "var(--dsw-alias-label-primary)" };

      return React.createElement("section", { style: embedded ? { color: "var(--dsw-alias-label-primary)" } : sectionStyle, "data-block": "architecture-graph", "data-architecture-schema": architecture.schemaVersion || 1 },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } },
          React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { flex: "1 1 auto", margin: 0 }) }, "🏛️ " + t("arch.title")),
          React.createElement("span", { style: { fontSize: "10px", padding: "3px 8px", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)", color: architecture.source === "hybrid" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)" } }, sourceLabel),
        ),
        architecture.llm && architecture.llm.requested && !architecture.llm.used && architecture.llm.error
          ? (function () {
              const err = architecture.llm.error || {};
              const reasonText = err.reasonText || err.message || (err.code || "LLM_ERROR");
              const actionKey = err.actionKey || "retry_scan";
              // 动作区：retry_scan → 重新扫描按钮；send_message / check_settings → 文案提示
              let actionNode = null;
              if (actionKey === "retry_scan") {
                const busy = retryState.status === "loading";
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
                      setRetryState({ status: "error", message: String((e && e.message) || e) });
                    }
                  },
                  style: {
                    fontSize: "10px", padding: "3px 8px", borderRadius: "6px",
                    background: "transparent", border: "1px solid var(--dsw-alias-state-warn-primary)",
                    color: "var(--dsw-alias-state-warn-primary)", cursor: busy ? "wait" : "pointer", fontWeight: 600,
                  },
                }, busy ? t("arch.retrying") : "🔄 " + t("arch.actionRetry"));
              } else if (actionKey === "send_message") {
                actionNode = React.createElement("span", { style: { fontSize: "10px", fontWeight: 600 } }, "💬 " + t("arch.actionChat"));
              } else if (actionKey === "check_settings") {
                actionNode = React.createElement("span", { style: { fontSize: "10px", fontWeight: 600 } }, "⚙️ " + t("arch.actionSettings"));
              }
              const statusNode = retryState.status === "success"
                ? React.createElement("span", { style: { marginLeft: "8px", fontSize: "10px", color: "var(--dsw-alias-state-success-primary)" } }, "✓ " + (retryState.message || ""))
                : retryState.status === "error"
                  ? React.createElement("span", { style: { marginLeft: "8px", fontSize: "10px", color: "var(--dsw-alias-state-warn-primary)" } }, "✗ " + (retryState.message || ""))
                  : null;
              return React.createElement("div", {
                title: err.message || err.code || "",
                style: { fontSize: "11px", padding: "8px 10px", marginBottom: "10px", borderRadius: "7px", color: "var(--dsw-alias-state-warn-primary)", border: "1px solid var(--dsw-alias-state-warn-primary)", background: "rgba(255,180,0,0.06)", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", lineHeight: 1.5 },
              },
                React.createElement("span", { style: { fontWeight: 700 } }, "⚠️ " + t("arch.llmFallback")),
                React.createElement("span", { style: { flex: "1 1 auto", minWidth: "180px" } }, reasonText),
                actionNode,
                statusNode,
              );
            })()
          : null,
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(180px, 1fr)", gap: "8px", marginBottom: "10px" } },
          React.createElement("div", { style: panelStyle },
            React.createElement("div", { style: smallTitle }, "🎯 " + t("arch.purpose")),
            React.createElement("div", { style: { fontSize: "13px", lineHeight: 1.65 } }, overview.purpose || architecture.summary || ""),
            overview.value ? React.createElement("div", { style: { marginTop: "6px", fontSize: "11px", lineHeight: 1.5, color: "var(--dsw-alias-label-secondary)" } }, overview.value) : null,
          ),
          React.createElement("div", { style: panelStyle },
            React.createElement("div", { style: smallTitle }, "🏗️ " + t("arch.style")),
            React.createElement("div", { style: { fontSize: "13px", fontWeight: 700 } }, overview.architectureStyle || "—"),
            React.createElement("div", { style: { marginTop: "6px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, [overview.category, overview.audience].filter(Boolean).join(" · ")),
          ),
        ),
        architecture.summary && architecture.summary !== overview.purpose ? React.createElement("div", { style: { fontSize: "12px", lineHeight: 1.65, color: "var(--dsw-alias-label-secondary)", margin: "0 2px 10px" } }, architecture.summary) : null,

        React.createElement("div", { style: Object.assign({}, panelStyle, { padding: "10px 10px 4px", background: "var(--dsw-alias-bg-layer-1)" }), "data-architecture-diagram": "semantic-layers" },
          React.createElement("div", { style: Object.assign({}, smallTitle, { marginBottom: "9px" }) }, "🧱 " + t("arch.layers")),
          layerRows.map((layer, layerIndex) => {
            const items = componentsForLayer(layer);
            if (!items.length) return null;
            return React.createElement("div", { key: layer.id, style: { display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", gap: "10px", padding: "9px", marginBottom: "7px", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", background: layerIndex % 2 === 0 ? "var(--dsw-alias-bg-layer-2)" : "var(--dsw-alias-bg-layer-1)" } },
              React.createElement("div", { style: { borderRight: "1px solid var(--dsw-alias-border-l1)", paddingRight: "9px" } },
                React.createElement("div", { style: { fontSize: "12px", fontWeight: 750, marginBottom: "4px" } }, layer.name),
                React.createElement("div", { style: { fontSize: "9px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, layer.responsibility || ""),
              ),
              React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "7px" } },
                items.map((component) => {
                  const active = component.id === selected.id;
                  return React.createElement("button", { key: component.id, type: "button", onClick: () => setSelectedId(component.id), "data-architecture-component": component.id, style: { textAlign: "left", padding: "9px 10px", borderRadius: "8px", border: (active ? "2px solid " : "1px solid ") + (active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l2)"), background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", cursor: "pointer", fontFamily: "inherit", minHeight: "76px" } },
                    React.createElement("div", { style: { fontSize: "12px", fontWeight: 750, marginBottom: "4px" } }, (typeIcons[component.type] || "◆") + " " + (component.name || component.label)),
                    React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, String(component.responsibility || component.description || "").slice(0, 150)),
                  );
                }),
              ),
            );
          }),
          relationships.length ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px", padding: "2px 0 7px" } }, relationships.slice(0, 14).map((relation) => {
            const from = byId.get(relation.from); const to = byId.get(relation.to);
            if (!from || !to) return null;
            const active = relation.from === selected.id || relation.to === selected.id;
            return React.createElement("span", { key: relation.id, title: relation.description || relation.label, style: { fontSize: "9px", padding: "3px 7px", borderRadius: "10px", border: "1px solid " + (active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l1)"), color: active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)" } }, (from.name || from.label) + " → " + (relation.label || "调用") + " → " + (to.name || to.label));
          })) : null,
        ),

        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, .8fr)", gap: "9px", marginTop: "9px" } },
          React.createElement("div", { style: panelStyle },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: 750, marginBottom: "5px" } }, (typeIcons[selected.type || selected.kind] || "◆") + " " + (selected.name || selected.label)),
            React.createElement("div", { style: { fontSize: "11px", lineHeight: 1.6 } }, selected.responsibility || selected.description || ""),
            selected.details ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.55, marginTop: "5px" } }, selected.details) : null,
            (selected.technologies || []).length ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "7px" } }, selected.technologies.map((item) => React.createElement("span", { key: item, style: { fontSize: "9px", padding: "2px 6px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" } }, item))) : null,
            (selected.importantFiles || selected.files || []).length ? React.createElement("div", { style: { marginTop: "8px" } },
              React.createElement("div", { style: smallTitle }, "📄 " + t("arch.keyFiles")),
              (selected.importantFiles || selected.files || []).slice(0, 8).map((file) => React.createElement("code", { key: file, style: { display: "block", fontSize: "9px", padding: "3px 6px", marginBottom: "3px", borderRadius: "4px", background: "var(--dsw-alias-bg-layer-1)", wordBreak: "break-all" } }, file)),
            ) : null,
            related.length ? React.createElement("div", { style: { marginTop: "7px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, related.slice(0, 5).map((item) => item.description || item.label).filter(Boolean).join("；")) : null,
          ),
          React.createElement("div", { style: panelStyle },
            React.createElement("div", { style: smallTitle }, "➡️ " + t("arch.flows")),
            flows.length ? flows.map((flow) => React.createElement("div", { key: flow.id, style: { padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)" } },
              React.createElement("div", { style: { fontSize: "11px", fontWeight: 700 } }, flow.name || flow.label),
              React.createElement("div", { style: { fontSize: "9px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5, marginTop: "3px" } }, [flow.trigger ? t("arch.trigger") + "：" + flow.trigger : "", flow.outcome ? t("arch.outcome") + "：" + flow.outcome : ""].filter(Boolean).join(" · ")),
              React.createElement("div", { style: { fontSize: "9px", lineHeight: 1.5, marginTop: "3px" } }, (flow.steps || []).map((step) => typeof step === "string" ? (byId.get(step) && (byId.get(step).name || byId.get(step).label)) : ((byId.get(step.componentId) && (byId.get(step.componentId).name || byId.get(step.componentId).label)) + (step.action ? "：" + step.action : ""))).filter(Boolean).join(" → ")),
            )) : React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, t("dash.none")),
          ),
        ),

        (architecture.keyFiles || []).length ? React.createElement("div", { style: Object.assign({}, panelStyle, { marginTop: "9px" }) },
          React.createElement("div", { style: smallTitle }, "🗺️ " + t("arch.keyFiles")),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "6px" } }, architecture.keyFiles.slice(0, 12).map((file) => React.createElement("div", { key: file.path, style: { padding: "7px", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "7px", background: "var(--dsw-alias-bg-layer-1)" } },
            React.createElement("code", { style: { fontSize: "10px", fontWeight: 700, wordBreak: "break-all" } }, file.path),
            React.createElement("div", { style: { fontSize: "10px", marginTop: "3px", lineHeight: 1.45 } }, file.role),
            React.createElement("div", { style: { fontSize: "9px", marginTop: "2px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, file.whyImportant),
          )))
        ) : null,
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", marginTop: "9px" } },
          (architecture.gettingStarted || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "🚀 " + t("arch.start")), architecture.gettingStarted.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, (index + 1) + ". " + item))) : null,
          (architecture.designHighlights || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "✨ " + t("arch.highlights")), architecture.designHighlights.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, "• " + item))) : null,
          (architecture.risks || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "⚠️ " + t("arch.risks")), architecture.risks.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, "• " + item))) : null,
        ),
        React.createElement("div", { style: { marginTop: "7px", fontSize: "9px", color: "var(--dsw-alias-label-secondary)" } }, (architecture.stats.layers || layers.length) + " " + t("arch.layers") + " · " + (architecture.stats.components || architecture.stats.modules || components.length) + " " + t("arch.components") + " · " + t("arch.select")),
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
        transition: "transform 0.1s ease, opacity 0.1s ease, background 0.15s ease",
      });
      // v0.4.12: 按钮文案统一为"查看 Dashboard · 项目全景"（v0.4.11 之前是"打开/收起 Dashboard" 切换）
      // Dashboard 默认展开，按钮在折叠状态显示，展开后 dashboard 占满，按钮可折叠回
      // 右侧小图标（▾/▸）作为状态指示，文案不变
      return React.createElement("section", { style: Object.assign({}, sectionStyle, { padding: "10px 14px" }), "data-block": "actions" },
        React.createElement("div", { style: { display: "flex", gap: "8px" } },
          React.createElement("button", {
            "data-action": "toggle-dashboard",
            style: buttonStyle(),
            onClick: (e) => toggleDashboard(e, t),
            title: localeCode === "en-US" ? "View full project dashboard" : "查看项目完整数据快照",
          },
            React.createElement("span", { style: { fontSize: "16px" } }, "📊"),
            React.createElement("span", { style: { flex: "1 1 auto", textAlign: "left" } },
              React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.2" } },
                React.createElement("span", null, localeCode === "en-US" ? "View Dashboard" : "查看 Dashboard"),
                React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "400", margin: "0 4px" } }, "·"),
                React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontWeight: "400" } }, localeCode === "en-US" ? "Project Overview" : "项目全景"),
              ),
              React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "1px" } },
                localeCode === "en-US" ? "Tech stack · todos · memories · timeline" : "技术栈 · 待办 · 记忆 · 时间线",
              ),
            ),
            React.createElement("span", { "data-dashboard-indicator": "1", style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "▾"),
          ),
        ),
      );
    }

    // ─── Onboarding 启动状态机 ───
    // v0.5.0: 把"复制命令让人贴"换成"点按钮直接后台扫描"。
    //   流程：点击 → host.call('project_brain/initProject') → 期间显示转圈 + 阶段文案
    //         → 成功：父组件刷新 preview 后自动切到 dashboard
    //         → 失败：把错误显示在按钮上方，用户可重试
    //
    // 父组件（SidebarPreviewRoot）传 path / onComplete；
    //   path：当前 workspace 路径（来自 build-time embed 的 sessionToWorkspaceId 反查）
    //   onComplete：完成后调一下让父组件重新解析数据
    const ONBOARDING_PHASES = [
      { key: "scanning", icon: "🔍", label: "扫描项目结构…" },
      { key: "graph", icon: "🏛️", label: "构建架构关系…" },
      { key: "analyzing", icon: "🧠", label: "DSH LLM 语义分析…" },
      { key: "done", icon: "✅", label: "架构与项目脑已生成" },
    ];

    // v1.1.x：项目大脑 8 项核心能力清单（按用户感知价值排序）
    //   替换原"3 步骤"展示：原列表只提了 project_init/memory_add/todo_add 三个命令，
    //   容易让用户低估项目脑真实能力范围。
    const ONBOARDING_FEATURES = [
      { icon: "📁", title: "项目结构", desc: "自动识别技术栈、入口文件、依赖、目录布局" },
      { icon: "🗺️", title: "代码图谱", desc: "模块依赖关系图，支持 JS / TS / Python / Go / Java / Rust / C/C++" },
      { icon: "🏛️", title: "架构图", desc: "语义分层 + 关键流程 + 设计要点（DSH LLM 可选增强）" },
      { icon: "🧠", title: "项目记忆", desc: "沉淀决策 / Bug / 教训 / 需求 / 变更，手动 + 自动捕获" },
      { icon: "📋", title: "待办管理", desc: "活跃任务跨 Session 跟踪，优先级与状态一目了然" },
      { icon: "✨", title: "智能续接", desc: "基于活跃待办 + 近期记忆 + Git 变化，AI 推荐今天最该推进什么" },
      { icon: "🔄", title: "跨 Session 上下文", desc: "项目信息、记忆、待办跨会话自动恢复，不丢上下文" },
      { icon: "📜", title: "Git 时间线", desc: "提交历史、分支、工作树状态可视化" },
    ];

    function OnboardingBlock({ t, path, sessionId, onComplete, connection }) {
      // 三态机：idle / loading / error
      const [phase, setPhase] = React.useState("idle");   // "idle" | "loading" | "error"
      const [phaseStep, setPhaseStep] = React.useState(0); // 0..3，对应 ONBOARDING_PHASES 下标
      const [errMsg, setErrMsg] = React.useState("");
      const [result, setResult] = React.useState(null);

      const rpc = connection && connection.rpc;

      // 启动按钮基础样式
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
        transition: "transform 0.1s ease, box-shadow 0.15s ease, opacity 0.2s ease",
      };
      const ctaLoading = Object.assign({}, ctaBase, {
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        cursor: "wait",
        opacity: 0.85,
        boxShadow: "none",
      });
      const ctaError = Object.assign({}, ctaBase, {
        background: "var(--dsw-alias-state-error-primary)",
      });

      const stepStyle = (num, label, desc) =>
        React.createElement("div", { style: { display: "flex", gap: "10px", padding: "8px 0", alignItems: "flex-start" } },
          React.createElement("div", { style: { flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)", color: "var(--dsw-alias-bg-base)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700" } }, num),
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", marginBottom: "2px" } }, label),
            React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.4" } }, desc),
          ),
        );

      // 阶段推进（仅前端 UX 节奏，让用户感知"在干活"；RPC 自身是单次调用）
      function advancePhase(stepIdx) {
        setPhaseStep(stepIdx);
      }
      // 注：stepStyle 函数保留兼容（内部不再使用），外部若引用不破坏构建。

      async function startScan() {
        if (phase === "loading") return;
        setErrMsg("");
        setResult(null);
        setPhase("loading");
        advancePhase(0);
        // v0.5.1 修复：当 path 为空（build-time sessionToWorkspaceId miss）时，
        //   用 sessionId 走 host 兜底——host 端 getCwdBySession 会用 ctx.sessions.get
        //   反查真实 cwd，避免每个新建 workspace 都要重启 DSH 才能用
        if (!sessionId) {
          setPhase("error");
          setErrMsg("未找到当前 Session，请先在 DSH 中打开该项目");
          return;
        }
        if (!rpc || typeof rpc.call !== "function") {
          setPhase("error");
          setErrMsg("DSH Connection RPC 不可用，请确认插件依赖已正确安装");
          return;
        }
        // 阶段推进定时器（UX 节奏，~600ms 一步；RPC 通常 1-3s 完成）
        const timers = [];
        timers.push(setTimeout(() => advancePhase(1), 700));
        timers.push(setTimeout(() => advancePhase(2), 1500));
        let resp;
        try {
          resp = await rpc.call(
            "/project-brain",
            "init",
            { sessionId: sessionId || undefined },
          );
        } catch (e) {
          timers.forEach((id) => clearTimeout(id));
          setPhase("error");
          setErrMsg(String((e && e.message) || e));
          return;
        }
        timers.forEach((id) => clearTimeout(id));
        // Connection RPC 统一形态：{ok:true,value:{projectPath,scan,preview}}
        // 或 {ok:false,error:{code,message,details}}。
        const okFlag = resp && resp.ok;
        const dataObj = (resp && resp.value) || {};
        if (okFlag) {
          advancePhase(3);
          setResult(dataObj);
          if (typeof onComplete === "function") {
            try { onComplete(dataObj); } catch (e) {}
          }
        } else {
          const errStr = (resp && resp.error && resp.error.message)
            || "未知错误";
          setPhase("error");
          setErrMsg(errStr);
        }
      }

      function retry() {
        setPhase("idle");
        setErrMsg("");
        setResult(null);
      }

      // CTA 渲染：分三态
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
              "data-loading-state": "scanning",
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
                display: "inline-block",
              },
            }),
            React.createElement("span", null, ONBOARDING_PHASES[phaseStep] ? ONBOARDING_PHASES[phaseStep].label : "分析中…"),
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
                color: "var(--dsw-alias-label-secondary)",
              },
            },
            ONBOARDING_PHASES.map((p, i) =>
              React.createElement(
                "span",
                {
                  key: p.key,
                  style: {
                    padding: "2px 8px",
                    borderRadius: "8px",
                    background: i <= phaseStep ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
                    color: i <= phaseStep ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)",
                    fontWeight: "600",
                  },
                },
                p.icon + " " + p.label,
              ),
            ),
          ),
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
                border: "1px solid rgba(220,38,38,0.25)",
              },
            },
            React.createElement("div", { style: { fontWeight: "600", marginBottom: "4px" } }, "❌ 启动失败"),
            React.createElement("div", null, errMsg || "未知错误"),
          ),
          React.createElement(
            "button",
            {
              style: ctaBase,
              onClick: retry,
              "data-action": "retry",
            },
            React.createElement("span", { style: { fontSize: "16px" } }, "🔁"),
            React.createElement("span", null, "重试"),
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
                fontFamily: "inherit",
              },
              onClick: () => copyPrompt(t("onboarding.copyPrompt"), null, "已复制", "复制失败"),
            },
            "📋 复制启动指令（兜底）",
          ),
        );
      } else {
        // idle
        ctaNode = React.createElement(
          "button",
          {
            style: ctaBase,
            onClick: startScan,
            "data-action": "start-brain",
          },
          React.createElement("span", { style: { fontSize: "16px" } }, "▶️"),
          React.createElement("span", null, t("onboarding.cta")),
        );
      }

      return React.createElement(
        "section",
        { style: Object.assign({}, sectionStyle, { padding: "24px", background: "linear-gradient(180deg, var(--dsw-alias-bg-layer-1) 0%, var(--dsw-alias-bg-layer-2) 100%)" }), "data-block": "onboarding" },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
          React.createElement("span", { style: { fontSize: "28px" } }, "🧠"),
          React.createElement(
            "div",
            null,
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0, fontSize: "15px" }) }, "🪴 " + t("onboarding.title")),
            React.createElement("p", { style: { margin: "2px 0 0", fontSize: "12px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5" } }, t("onboarding.body")),
          ),
        ),
        // 核心能力清单（v1.1.x-fix：原"3 步骤"太简化，让用户误以为只能记决策/管理待办）
        //   现在列出项目大脑真实能做的 8 件事，让用户建立正确预期。
        React.createElement(
          "div",
          {
            "data-block": "onboarding-features",
            style: { margin: "12px 0 4px", padding: "12px 16px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" },
          },
          ...ONBOARDING_FEATURES.map((f, idx) => React.createElement(
            "div",
            { key: idx, style: { display: "flex", gap: "10px", padding: "5px 0", alignItems: "flex-start" } },
            React.createElement("span", { style: { fontSize: "16px", flex: "0 0 auto", lineHeight: "1.35", width: "20px", textAlign: "center" } }, f.icon),
            React.createElement("div", null,
              React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.4" } }, f.title),
              React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.45", marginTop: "1px" } }, f.desc),
            ),
          )),
        ),
        // path 提示（让用户知道会扫哪个目录）
        // v0.5.1：即使 build-time map miss，只要 sessionId 存在，host 端 initProject RPC
        //   会用 getCwdBySession 兜底解析 cwd，所以这里不应该再显示"未检测到 workspace 路径"
        //   警告；改为显示"等待从 sessionId 解析"提示，让用户知道会自动兜底。
        path
          ? React.createElement(
              "div",
              {
                style: {
                  marginTop: "12px",
                  fontSize: "10px",
                  color: "var(--dsw-alias-label-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  wordBreak: "break-all",
                },
                "data-workspace-path": path,
              },
              React.createElement("span", null, "📂"),
              React.createElement("span", { style: { fontFamily: "monospace" } }, path),
            )
          : sessionId
          ? React.createElement(
              "div",
              {
                style: {
                  marginTop: "12px",
                  fontSize: "10px",
                  color: "var(--dsw-alias-label-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                },
                "data-workspace-session-id": String(sessionId).slice(0, 12) + "…",
              },
              React.createElement("span", null, "🔌"),
              React.createElement("span", null, "build 未纳入此 session，点击启动将由 host 自动解析路径"),
            )
          : React.createElement(
              "div",
              {
                style: {
                  marginTop: "12px",
                  fontSize: "11px",
                  color: "var(--dsw-alias-state-warn-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                },
              },
              React.createElement("span", null, "⚠️"),
              React.createElement("span", null, "未检测到 workspace 路径"),
            ),
        ctaNode,
        // 注入转圈动画 keyframes（一次性）
        React.createElement("style", null, "@keyframes dsh-brain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"),
      );
    }

    // ─── 智能续接建议卡（v0.4.15 project_suggest_next） ───
    // v0.4.16：模块级缓存（跨组件 unmount/mount）+ 5 分钟 TTL + preview.changed 失效。
    //   - 切 tab / DashboardSection 重 mount 都不重拉（之前用 useRef 失败，因为 React 重 mount 会清空 ref）
    //   - 用户点 ↻ 重新生成 / preview 变化 / 跨过 5 分钟 才重拉
    const SUGGESTION_TTL_MS = 5 * 60 * 1000;
    const suggestionCache = new Map(); // sessionId -> { fetchedAt, status, data, error, dismissed }

    function SuggestionCard({ t, localeCode, sessionId, connection, projectInitialized, embeddedSuggestion, workspacePath }) {
      // v0.4.18：cache key 只用 workspacePath（项目级共享）；workspacePath 还没解析到时显示 loading。
      const cacheKey = workspacePath ? String(workspacePath) : null;
      const cached = cacheKey ? suggestionCache.get(cacheKey) : null;
      // workspacePath 未就绪 → 强制走 loading，避免用 sessionId 落到跨 session 串数据
      const initialState = cached
        ? { status: cached.status, data: cached.data, error: cached.error }
        : (workspacePath
            ? { status: embeddedSuggestion ? "ready" : "idle", data: embeddedSuggestion || null, error: null }
            : { status: "loading", data: null, error: null });
      const [state, setState] = React.useState(initialState);
      const [dismissed, setDismissed] = React.useState(Boolean(cached && cached.dismissed));

      const fetchSuggestion = React.useCallback(async (force) => {
        const rpc = connection && connection.rpc;
        if (!sessionId || !rpc || typeof rpc.call !== "function") return;
        // 模块级 TTL：未强制刷新 + 已缓存 + 在 TTL 内 → 直接复用
        const cur = suggestionCache.get(cacheKey);
        if (!force && cur && cur.status === "ready" && cur.data && (Date.now() - (cur.fetchedAt || 0)) < SUGGESTION_TTL_MS) {
          setState({ status: cur.status, data: cur.data, error: cur.error });
          return;
        }
        setState({ status: "loading", data: (cur && cur.data) || state.data || null, error: null });
        try {
          // v0.4.18：传 sessionId + workspacePath 让 host 端用工作区路径（不依赖 sessionId 解析），
          // 保证同一项目下不同 session 拿到的内容完全一致。
          const payload = { sessionId };
          if (cacheKey) payload.workspacePath = cacheKey;
          const res = await rpc.call("/project-brain", "suggest", payload);
          if (!res) {
            setState({ status: "error", data: null, error: "RPC 返回 undefined" });
            return;
          }
          if (res.ok === false) {
            const ec = (res.error && res.error.code) || "?";
            const em = (res.error && res.error.message) || "(no message)";
            setState({ status: "error", data: null, error: "RPC ok=false · " + ec + " · " + em });
            return;
          }
          if (res.ok && res.value && res.value.suggestion && res.value.suggestion.suggestion) {
            suggestionCache.set(cacheKey, {
              fetchedAt: Date.now(),
              status: "ready",
              data: res.value.suggestion,
              error: null,
              dismissed: false,
            });
            setState({ status: "ready", data: res.value.suggestion, error: null });
            return;
          }
          let errMsg = "智能续接失败";
          if (res.error && res.error.message) errMsg = res.error.message + " (" + (res.error.code || "?") + ")";
          else if (!res.value) errMsg = "RPC value 为空";
          else if (!res.value.suggestion) errMsg = "value.suggestion 为空";
          else errMsg = "未知状态：" + JSON.stringify(res).slice(0, 200);
          setState({ status: "error", data: null, error: errMsg });
        } catch (error) {
          setState({ status: "error", data: null, error: "throw: " + String((error && error.message) || error) });
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
        // workspacePath 未就绪 → 等；不要用 sessionId 当 cache key（避免跨 session 串数据）
        if (!cacheKey) {
          setState({ status: "loading", data: null, error: null });
          return;
        }
        const cur = suggestionCache.get(cacheKey);
        if (cur && cur.status === "ready" && cur.data && (Date.now() - (cur.fetchedAt || 0)) < SUGGESTION_TTL_MS) {
          return; // 不重拉
        }
        fetchSuggestion(false);
      }, [projectInitialized, dismissed, fetchSuggestion, sessionId, connection, cacheKey]);

      // v0.4.18：preview.changed → 失效 cache（只失效同 workspacePath 的）
      React.useEffect(() => {
        if (typeof window === "undefined" || !window.addEventListener) return undefined;
        const handler = (event) => {
          const ev = event && event.detail;
          const changedPath = ev && typeof ev.projectPath === "string" ? ev.projectPath : null;
          if (changedPath && cacheKey && changedPath !== cacheKey) return; // 不同项目，不影响
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
        // v0.4.15：项目未初始化时显示轻提示卡片（不阻塞 Onboarding 流程）
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
              fontSize: "11px",
            },
            "data-block": "suggestion-uninit",
            "data-suggest-status": "uninit",
          },
          React.createElement("span", null, "💡 "),
          React.createElement("span", null, localeCode === "en-US"
            ? "Init project brain to see today's continuation."
            : "初始化项目脑后查看今天可能推进的内容。"),
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
                fontFamily: "inherit",
              },
              "data-action": "suggest-show",
            },
            "💡 " + (localeCode === "en-US" ? "Show suggestion" : "查看续接建议"),
          ),
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
        color: "var(--dsw-alias-label-primary)",
      };

      const titleRow = React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        React.createElement("span", { style: { fontSize: "13px", fontWeight: "700" } }, t("suggest.title")),
        tag ? React.createElement("span", {
          style: {
            fontSize: "10px", padding: "1px 7px", borderRadius: "8px",
            background: source === "llm" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
            color: source === "llm" ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)",
            fontWeight: "600",
          },
          "data-suggest-source": source,
        }, tag) : null,
        confidencePct != null && source === "llm" ? React.createElement("span", {
          style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" },
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
          style: { padding: "2px 8px", background: "transparent", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10px", fontFamily: "inherit" },
        }, t("suggest.dismiss")) : null,
        state.status !== "loading" ? React.createElement("button", {
          type: "button",
          onClick: () => fetchSuggestion(true),
          title: t("suggest.refresh"),
          "data-action": "suggest-refresh",
          style: { padding: "2px 8px", background: "transparent", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", color: "var(--dsw-alias-label-secondary)", cursor: "pointer", fontSize: "10px", fontFamily: "inherit" },
        }, "↻ " + t("suggest.refresh")) : null,
      );

      let bodyContent;
      if (state.status === "loading") {
        bodyContent = React.createElement("div", { style: { marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
          React.createElement("span", { "data-spinner": "1", style: { width: "12px", height: "12px", borderRadius: "50%", border: "2px solid var(--dsw-alias-border-l2)", borderTopColor: "var(--dsw-alias-brand-primary)", animation: "dsh-brain-spin 0.9s linear infinite", display: "inline-block" } }),
          t("suggest.loading"),
        );
      } else if (state.status === "error") {
        bodyContent = React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "var(--dsw-alias-state-error-primary)" } },
          "❌ " + (state.error || t("suggest.empty")),
        );
      } else if (!suggestion) {
        bodyContent = React.createElement("div", { style: { marginTop: "8px", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
 t("suggest.empty"),
        );
      } else {
        bodyContent = React.createElement(
          "div",
          { style: { marginTop: "8px" }, "data-suggestion": "ready" },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", lineHeight: "1.5" }, "data-suggestion-title": "1" }, suggestion.title || ""),
          suggestion.reason ? React.createElement("div", { style: { marginTop: "6px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5" }, "data-suggestion-reason": "1" },
            React.createElement("span", { style: { fontWeight: "600" } }, t("suggest.reasonLabel") + "："),
            " " + suggestion.reason,
          ) : null,
          data.llmError ? React.createElement("div", { style: { marginTop: "6px", fontSize: "10px", color: "var(--dsw-alias-state-warn-primary)" }, "data-suggestion-llm-error": "1" },
            t("suggest.fallbackTag") + "：" + (data.llmError.message || data.llmError.code || ""),
          ) : null,
        );
      }

      return React.createElement("div", { style: cardStyle, "data-block": "suggestion", "data-source": source || "unknown" },
        titleRow,
        bodyContent,
      );
    }

    // ─── v0.4.x: GitTab — 可视化 git 提交历史（仅项目是 git 仓库时挂载） ───
    // 设计：左侧 ASCII graph（| / \ 节点），右侧 commit 信息；点击展开 body + parents。
    // 数据来源：RPC `git` endpoint（已探测 gitInfo.available 控制挂载）。
    function GitTab({ gitInfo, t, onRefresh, autoRefresh, onToggleAutoRefresh }) {
      if (!gitInfo) {
        return React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "git-loading" }, "⏳ 加载 git 历史...");
      }
      if (gitInfo.available !== true) {
        return React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "git-empty" },
          "📂 当前项目不是 git 仓库",
          gitInfo.error ? React.createElement("div", { style: { marginTop: "6px", fontSize: "10px", opacity: 0.7 } }, gitInfo.error) : null,
        );
      }

      const commits = gitInfo.commits || [];
      const branches = gitInfo.branches || [];
      const currentBranch = gitInfo.currentBranch;
      const [expanded, setExpanded] = React.useState(null);  // 当前展开的 commit hash

      // ── 时间格式化 ──
      const relTime = (ts) => {
        if (!ts) return "";
        const diff = Date.now() / 1000 - ts;
        if (diff < 60) return Math.round(diff) + "秒前";
        if (diff < 3600) return Math.round(diff / 60) + "分钟前";
        if (diff < 86400) return Math.round(diff / 3600) + "小时前";
        if (diff < 30 * 86400) return Math.round(diff / 86400) + "天前";
        if (diff < 365 * 86400) return Math.round(diff / 2592000) + "个月前";
        return Math.round(diff / 31536000) + "年前";
      };
      const fmtDate = (ts) => {
        if (!ts) return "";
        const d = new Date(ts * 1000);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      };

      // ── 按 commit hash 索引 branch refs（多分支时挂到对应 commit 行） ──
      const refsByHash = new Map();
      for (const b of branches) {
        if (!refsByHash.has(b.commit)) refsByHash.set(b.commit, []);
        refsByHash.get(b.commit).push({ kind: "branch", name: b.name, isCurrent: b.name === currentBranch });
      }

      // ── 分支配色（按 branch name hash 到固定颜色，让用户视觉区分分支） ──
      // 注意：这是 GitHub 风格的浅色装饰调色板，独立于 DSH 主题 token 体系。
      // smoke-theme-tokens.mjs 检测到 `const palette = [ ... ]` 字面量会自动豁免其中的 hex。
      const palette = [
        { fg: "#1f6feb", bg: "#ddf4ff" },  // 蓝
        { fg: "#1a7f37", bg: "#dafbe1" },  // 绿
        { fg: "#8250df", bg: "#fbefff" },  // 紫
        { fg: "#cf222e", bg: "#ffebe9" },  // 红
        { fg: "#9a6700", bg: "#fff8c5" },  // 黄
        { fg: "#0a3069", bg: "#dbeafe" },  // 深蓝
      ];
      const colorByBranch = new Map();
      let colorIdx = 0;
      for (const b of branches) {
        if (!colorByBranch.has(b.name)) {
          colorByBranch.set(b.name, palette[colorIdx % palette.length]);
          colorIdx += 1;
        }
      }

      // ── Styles（VSCode / Cursor 风格：紧凑、留白、hover 高亮） ──
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
        flexWrap: "wrap",
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
        gap: "4px",
      });
      const listStyle = { listStyle: "none", padding: "0", margin: 0 };

      // 每行 layout: [graph 56px] [commit info flex:1] [refs 130px]
      const rowStyle = (expanded) => ({
        display: "grid",
        gridTemplateColumns: "56px minmax(0, 1fr) 130px",
        gap: "10px",
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: "8px",
        marginBottom: "2px",
        cursor: "pointer",
        background: expanded ? "var(--dsw-alias-bg-layer-1)" : "transparent",
        transition: "background-color 0.12s",
      });
      const graphCellStyle = {
        position: "relative",
        height: "36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
      const dotStyle = (idx, isMerge) => ({
        width: "11px",
        height: "11px",
        borderRadius: isMerge ? "2px" : "50%",
        transform: isMerge ? "rotate(45deg)" : "none",
        background: idx === 0 ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-base)",
        border: idx === 0 ? "2px solid var(--dsw-alias-brand-primary)" : "2px solid var(--dsw-alias-label-secondary)",
        zIndex: 2,
        boxShadow: idx === 0 ? "0 0 0 3px var(--dsw-alias-bg-layer-1)" : "none",
      });
      const lineStyle = (idx, total) => ({
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--dsw-alias-border-l2)",
        zIndex: 1,
        ...(idx === 0
          ? { top: "calc(50% + 6px)", height: "calc(50% - 6px)" }
          : idx === total - 1
            ? { top: 0, height: "calc(50% - 6px)" }
            : { top: 0, bottom: 0 }),
        width: "2px",
      });

      const subjectStyle = {
        fontSize: "13px",
        color: "var(--dsw-alias-label-primary)",
        fontWeight: "600",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: "1.4",
      };
      const metaStyle = {
        fontSize: "10.5px",
        color: "var(--dsw-alias-label-secondary)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginTop: "3px",
        flexWrap: "wrap",
      };
      const hashChipStyle = {
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: "10px",
        padding: "1px 6px",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-secondary)",
        borderRadius: "4px",
        border: "1px solid var(--dsw-alias-border-l1)",
      };
      const refsCellStyle = {
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        justifyContent: "flex-end",
        alignItems: "center",
      };
      const refChipStyle = (isCurrent, color) => ({
        fontSize: "10px",
        padding: "1px 7px",
        borderRadius: "9px",
        background: isCurrent ? color.fg : color.bg,
        color: isCurrent ? "var(--dsw-alias-bg-base)" : color.fg,
        border: "1px solid " + (isCurrent ? color.fg : color.bg),
        fontWeight: isCurrent ? "700" : "500",
        whiteSpace: "nowrap",
      });

      // 展开后的详情块样式
      const expandedPanelStyle = {
        gridColumn: "2 / -1",
        marginTop: "8px",
        padding: "12px 14px",
        background: "var(--dsw-alias-bg-layer-2)",
        border: "1px solid var(--dsw-alias-border-l1)",
        borderRadius: "8px",
        fontSize: "11.5px",
        color: "var(--dsw-alias-label-primary)",
      };
      const detailRowStyle = {
        display: "grid",
        gridTemplateColumns: "70px minmax(0, 1fr)",
        gap: "8px",
        padding: "3px 0",
        fontSize: "11px",
      };
      const detailLabelStyle = {
        color: "var(--dsw-alias-label-secondary)",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.4px",
      };
      const monospaceStyle = {
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: "10.5px",
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
        fontSize: "11.5px",
      };

      // ── 行渲染 ──
      const total = commits.length;
      const renderRow = (c, idx) => {
        const isExpanded = expanded === c.hash;
        const refs = refsByHash.get(c.hash) || [];
        return React.createElement("div", {
          key: c.hash,
          style: rowStyle(isExpanded),
          "data-commit": c.hash,
          "data-expanded": isExpanded ? "1" : "0",
          onClick: (ev) => {
            // 阻止展开内部链接/按钮冒泡
            const tag = ev && ev.target && ev.target.tagName;
            if (tag === "A" || tag === "BUTTON") return;
            setExpanded(isExpanded ? null : c.hash);
          },
        },
          // graph column
          React.createElement("div", { style: graphCellStyle },
            React.createElement("div", { style: lineStyle(idx, total) }),
            React.createElement("div", { style: dotStyle(idx, c.isMerge) }),
          ),
          // info column
          React.createElement("div", { style: { minWidth: 0 } },
            React.createElement("div", { style: subjectStyle, title: c.subject }, c.subject || "(无标题)"),
            React.createElement("div", { style: metaStyle },
              React.createElement("span", { style: hashChipStyle }, c.shortHash),
              React.createElement("span", { style: { fontWeight: "500" } }, c.author || "?"),
              React.createElement("span", null, "·"),
              React.createElement("span", { title: c.isoTime || "" }, relTime(c.timestamp)),
              c.isMerge ? React.createElement("span", { style: { color: "var(--dsw-alias-state-warn-primary)", fontSize: "10px" } }, "⎇ merge") : null,
              // v0.4.x: 变更文件摘要（来自 history.js 的 tree diff；pack 不可读时为 0）
              typeof c.filesChangedTotal === "number" && c.filesChangedTotal > 0
                ? (() => {
                    const fileStatText =
                      "\u{1F4C1} " +
                      (c.filesAdded ? "+" + c.filesAdded + " " : "") +
                      (c.filesModified ? "~" + c.filesModified + " " : "") +
                      (c.filesRemoved ? "-" + c.filesRemoved + " " : "") +
                      "(" + c.filesChangedTotal + " \u6587\u4EF6)";
                    return React.createElement("span", {
                      style: { fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" },
                    }, fileStatText);
                  })()
                : null,
            ),
            // 展开后的详情
            isExpanded ? React.createElement("div", { style: expandedPanelStyle },
              c.body ? React.createElement("div", { style: bodyTextStyle }, c.body) : React.createElement("div", { style: Object.assign({}, bodyTextStyle, { opacity: 0.6, fontStyle: "italic" }) }, "（无详细描述）"),
              React.createElement("div", { style: detailRowStyle },
                React.createElement("div", { style: detailLabelStyle }, "Hash"),
                React.createElement("div", { style: monospaceStyle }, c.hash),
              ),
              c.authorEmail ? React.createElement("div", { style: detailRowStyle },
                React.createElement("div", { style: detailLabelStyle }, "Author"),
                React.createElement("div", null, c.author + " <" + c.authorEmail + ">"),
              ) : null,
              React.createElement("div", { style: detailRowStyle },
                React.createElement("div", { style: detailLabelStyle }, "Date"),
                React.createElement("div", null, fmtDate(c.timestamp) + " " + (c.isoTime || "").slice(11, 19) + " UTC"),
              ),
              c.firstParent ? React.createElement("div", { style: detailRowStyle },
                React.createElement("div", { style: detailLabelStyle }, "Parent"),
                React.createElement("div", { style: monospaceStyle }, c.firstParent),
              ) : null,
              c.extraParents && c.extraParents.length > 0 ? React.createElement("div", { style: detailRowStyle },
                React.createElement("div", { style: detailLabelStyle }, "Merged"),
                React.createElement("div", { style: monospaceStyle, color: "var(--dsw-alias-state-warn-primary)" }, c.extraParents.join(", ")),
              ) : null,
              // v0.4.x: Changed Files 列表（tree diff 失败时不显示）
              Array.isArray(c.filesChanged) && c.filesChanged.length > 0 ? React.createElement("div", { style: Object.assign({}, detailRowStyle, { alignItems: "flex-start" }) },
                React.createElement("div", { style: detailLabelStyle }, "Files"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } },
                  c.filesChanged.map((f) =>
                    React.createElement("span", {
                      key: f,
                      style: { fontSize: "10px", fontFamily: "ui-monospace, monospace", padding: "1px 6px", background: "var(--dsw-alias-bg-base)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "3px", color: "var(--dsw-alias-label-primary)", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                      title: f,
                    }, f),
                  ),
                  c.filesTruncated ? React.createElement("span", {
                    style: { fontSize: "10px", padding: "1px 6px", color: "var(--dsw-alias-label-secondary)", fontStyle: "italic" },
                  }, "… +" + (c.filesChangedTotal - c.filesChanged.length) + " more") : null,
                ),
              ) : null,
            ) : null,
          ),
          // refs column
          React.createElement("div", { style: refsCellStyle },
            refs.map((r) => {
              const color = colorByBranch.get(r.name) || palette[0];
              return React.createElement("span", {
                key: r.name,
                style: refChipStyle(r.isCurrent, color),
                title: "refs/heads/" + r.name + (r.isCurrent ? " (current)" : ""),
              }, r.name);
            }),
          ),
        );
      };

      const otherBranches = branches.filter((b) => b.name !== currentBranch);

      // v0.4.x: Working Tree 区块（HEAD tree vs 工作树对比，列出 untracked / deleted）
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
          fontSize: "12px",
        };
        const wtHeaderStyle = {
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: untrackedTotal + deletedTotal > 0 && wtExpanded ? "10px" : 0,
          cursor: "pointer",
          userSelect: "none",
        };
        const fileRowStyle = {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 0",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10.5px",
          color: "var(--dsw-alias-label-primary)",
        };
        const filePathStyle = {
          padding: "1px 6px",
          background: "var(--dsw-alias-bg-base)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "3px",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        };
        const statusBadgeStyle = (kind) => ({
          fontSize: "10px",
          padding: "1px 7px",
          borderRadius: "9px",
          fontWeight: "600",
          flex: "0 0 auto",
          background: kind === "untracked" ? "var(--dsw-alias-state-warn-bg, var(--dsw-alias-bg-layer-2))" : "var(--dsw-alias-state-error-bg, var(--dsw-alias-bg-layer-2))",
          color: kind === "untracked" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-state-error-primary)",
        });
        const renderFileGroup = (label, kind, sample, total, truncated) => {
          if (total === 0) return null;
          const visible = wtExpanded ? sample : sample.slice(0, 8);
          return React.createElement("div", { style: { marginBottom: "8px" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
              React.createElement("span", { style: statusBadgeStyle(kind) }, label),
              React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, total + " 文件" + (truncated ? "（已截断）" : "")),
            ),
            visible.length > 0 ? React.createElement("div", { style: { paddingLeft: "8px" } },
              visible.map((f) =>
                React.createElement("div", { key: f, style: fileRowStyle, title: f },
                  React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", flex: "0 0 auto" } }, "•"),
                  React.createElement("span", { style: filePathStyle }, f),
                ),
              ),
              !wtExpanded && sample.length > 8
                ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", paddingLeft: "16px" } }, "+ " + (sample.length - 8) + " 更多（点击展开查看全部）")
                : null,
              wtExpanded && truncated
                ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", paddingLeft: "16px" } }, "（后端已截断，全部 " + total + " 个）")
                : null,
            ) : null,
          );
        };
        return React.createElement("div", { style: wtCardStyle, "data-block": "work-tree" },
          React.createElement("div", { style: wtHeaderStyle, onClick: () => setwtExpanded(!wtExpanded) },
            React.createElement("span", { style: { fontSize: "14px" } }, "🔸"),
            React.createElement("span", { style: { fontWeight: "600", fontSize: "12.5px" } }, "Working Tree"),
            React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
              untrackedTotal + " untracked" + (deletedTotal > 0 ? " · " + deletedTotal + " deleted" : ""),
            ),
            workTree.reference === "fallback"
              ? React.createElement("span", {
                  style: { fontSize: "10px", padding: "1px 7px", borderRadius: "9px", background: "var(--dsw-alias-state-warn-bg, var(--dsw-alias-bg-layer-1))", border: "1px solid var(--dsw-alias-state-warn-primary)", color: "var(--dsw-alias-state-warn-primary)", fontWeight: "600" },
                  title: "HEAD tree 不可读（pack 解析限制），已沿 first-parent 链回退到 " + (workTree.referenceCommitShort || "?") + " 作为参考，结果可能略有过期",
                }, "vs " + (workTree.referenceCommitShort || "fallback"))
              : null,
            React.createElement("span", { style: { marginLeft: "auto", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, wtExpanded ? "▴" : "▾"),
          ),
          wtExpanded ? React.createElement("div", null,
            renderFileGroup("Untracked", "untracked", workTree.untrackedSample || [], untrackedTotal, workTree.truncatedUntracked),
            renderFileGroup("Deleted", "deleted", workTree.deletedSample || [], deletedTotal, workTree.truncatedDeleted),
          ) : null,
        );
      };

      return React.createElement("div", { style: { padding: "0 4px 16px" }, "data-block": "git-tab" },
        // header card
        React.createElement("div", { style: cardStyle },
          React.createElement("span", { style: branchChipStyle(true) }, "⎇ " + (currentBranch || "detached HEAD")),
          React.createElement("span", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } },
            commits.length + " 个提交" + (gitInfo.truncated ? "（已截断）" : ""),
          ),
          otherBranches.length > 0 ? React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
            "· " + otherBranches.length + " 个其他分支",
          ) : null,
          gitInfo.head ? React.createElement("span", { style: { marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "HEAD " + gitInfo.head.substring(0, 7)) : null,
          // v0.4.x: 自动刷新开关 + 手动刷新按钮
          typeof onRefresh === "function" ? React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "8px" } },
            typeof onToggleAutoRefresh === "function" ? React.createElement("button", {
              key: "auto",
              type: "button",
              title: autoRefresh ? "自动刷新已开启（30s 间隔），点击关闭" : "自动刷新已关闭，点击开启",
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
                gap: "4px",
              },
            }, React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: autoRefresh ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-secondary)" } }), autoRefresh ? "自动 30s" : "自动关") : null,
            React.createElement("button", {
              key: "refresh",
              type: "button",
              title: "刷新 Git 数据",
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
                lineHeight: "1",
              },
            }, "↻"),
          ) : null,
        ),
        // commits 列表
        commits.length === 0
          ? React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "（无提交历史）")
          : React.createElement("div", { style: listStyle },
              commits.map((c, idx) => renderRow(c, idx)),
            ),
        // v0.4.x: Working Tree 区块 — HEAD tree vs 工作树对比，不依赖 git binary
        renderWorkTreeSection(gitInfo.workTree),
      );
    }

    // ─── dsh-project-brain Settings Tab (v0.7.x) ────────────────────────────
    // 把插件所需的全部配置（24 字段）暴露在 Dashboard 的「设置」tab，
    // 不依赖 DSH 桌面设置面板是否渲染第三方插件 settings。
    //   - 字段元数据与 config.js 的 Config schema 保持一致（手写）
    //   - 读：rpc.call("/project-brain", "settings", { action: "get" })
    //   - 写：rpc.call("/project-brain", "settings", { sessionId, action: "update", patch })
    const BRAIN_SETTINGS_META = [
      { group: "retrieval", icon: "🔎", title: { "zh-CN": "检索与向量", "en-US": "Retrieval & vectors" },
        fields: [
          { key: "retrievalMode", label: { "zh-CN": "检索模式", "en-US": "Retrieval mode" }, type: "enum",
            options: [{ v: "keyword", l: { "zh-CN": "关键词 (BM25)", "en-US": "Keyword (BM25)" } }, { v: "hybrid", l: { "zh-CN": "混合 (关键词 + 向量)", "en-US": "Hybrid (keyword + vector)" } }],
            hint: { "zh-CN": "hybrid 需要先配置下方 Embedding", "en-US": "hybrid requires Embedding configured below" } },
          { key: "vectorEnabled", label: { "zh-CN": "启用向量检索", "en-US": "Vector retrieval" }, type: "boolean",
            hint: { "zh-CN": "关闭时即使配了 embedding 也只用关键词", "en-US": "When off, retrieval is keyword-only even if embedding is configured" } },
          { key: "embeddingBaseURL", label: { "zh-CN": "Embedding 地址", "en-US": "Embedding base URL" }, type: "string",
            placeholder: "https://api.openai.com/v1",
            hint: { "zh-CN": "OpenAI 兼容 /v1/embeddings 端点；留空 = 禁用向量", "en-US": "OpenAI-compatible /v1/embeddings endpoint; empty = no vectors" } },
          { key: "embeddingModel", label: { "zh-CN": "Embedding 模型", "en-US": "Embedding model" }, type: "string",
            placeholder: "text-embedding-3-small" },
          { key: "embeddingApiKeyEnv", label: { "zh-CN": "API Key 环境变量", "en-US": "API Key env name" }, type: "string",
            placeholder: "PROJECT_BRAIN_EMBEDDING_API_KEY",
            hint: { "zh-CN": "环境变量名（不是 key 本身）", "en-US": "Environment variable name (not the key)" } },
          { key: "embeddingDimensions", label: { "zh-CN": "向量维度", "en-US": "Vector dimensions" }, type: "number",
            hint: { "zh-CN": "0 = 由服务自动推断", "en-US": "0 = auto from service" } },
          { key: "embeddingBatchSize", label: { "zh-CN": "Embedding 批大小", "en-US": "Embedding batch size" }, type: "number", min: 1, max: 128 },
          { key: "embeddingMaxIndexPerRun", label: { "zh-CN": "单次最大索引条目", "en-US": "Max items per indexing run" }, type: "number", min: 1, max: 500 },
          { key: "embeddingTimeoutMs", label: { "zh-CN": "Embedding 超时 (ms)", "en-US": "Embedding timeout (ms)" }, type: "number", min: 1000, max: 120000, step: 1000 },
        ],
      },
      { group: "weights", icon: "⚖️", title: { "zh-CN": "检索权重", "en-US": "Retrieval weights" },
        hint: { "zh-CN": "检索混合打分各因子权重；总和不需要为 1，会自动归一化。", "en-US": "Weighted sum; not required to sum to 1 (auto-normalized)." },
        fields: [
          { key: "keywordWeight", label: { "zh-CN": "关键词权重", "en-US": "Keyword" }, type: "number", min: 0, max: 1, step: 0.05 },
          { key: "vectorWeight", label: { "zh-CN": "向量权重", "en-US": "Vector" }, type: "number", min: 0, max: 1, step: 0.05 },
          { key: "importanceWeight", label: { "zh-CN": "重要性权重", "en-US": "Importance" }, type: "number", min: 0, max: 1, step: 0.05 },
          { key: "confidenceWeight", label: { "zh-CN": "可信度权重", "en-US": "Confidence" }, type: "number", min: 0, max: 1, step: 0.05 },
          { key: "recencyWeight", label: { "zh-CN": "时新性权重", "en-US": "Recency" }, type: "number", min: 0, max: 1, step: 0.05 },
        ],
      },
      { group: "summary", icon: "📝", title: { "zh-CN": "会话摘要 (LLM)", "en-US": "Session summary (LLM)" },
        fields: [
          { key: "sessionSemanticMemoryEnabled", label: { "zh-CN": "启用会话摘要", "en-US": "Enable session summary" }, type: "boolean",
            hint: { "zh-CN": "session 结束自动调 LLM 抽取语义记忆 + 证据校验", "en-US": "Auto-extract semantic memories with grounding check on session end" } },
          { key: "sessionSemanticMaxChars", label: { "zh-CN": "Transcript 截断 (chars)", "en-US": "Transcript truncate (chars)" }, type: "number", min: 2000, max: 40000, step: 1000 },
          { key: "sessionSemanticMaxItems", label: { "zh-CN": "每次最多抽取", "en-US": "Max items per extraction" }, type: "number", min: 1, max: 8 },
          { key: "sessionSemanticTimeoutMs", label: { "zh-CN": "LLM 超时 (ms)", "en-US": "LLM timeout (ms)" }, type: "number", min: 5000, max: 120000, step: 1000 },
        ],
      },
      { group: "arch", icon: "🏗️", title: { "zh-CN": "架构分析", "en-US": "Architecture analysis" },
        fields: [
          { key: "architectureEnabled", label: { "zh-CN": "启用架构分析", "en-US": "Enable" }, type: "boolean" },
          { key: "architectureLlmEnabled", label: { "zh-CN": "LLM 增强", "en-US": "LLM enrichment" }, type: "boolean" },
          { key: "architectureLlmIncludeSource", label: { "zh-CN": "向 LLM 注入源码片段", "en-US": "Inject source snippets into LLM" }, type: "boolean" },
          { key: "architectureMaxFiles", label: { "zh-CN": "最大扫描文件数", "en-US": "Max files scanned" }, type: "number", min: 20, max: 1000 },
          { key: "architectureMaxNodes", label: { "zh-CN": "最大架构节点", "en-US": "Max architecture nodes" }, type: "number", min: 6, max: 60 },
          { key: "architectureLlmTimeoutMs", label: { "zh-CN": "LLM 超时 (ms)", "en-US": "LLM timeout (ms)" }, type: "number", min: 5000, max: 120000, step: 1000 },
        ],
      },
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
      const locale = (localeCode === "en-US") ? "en-US" : "zh-CN";
      const initial = { loaded: false, writable: false, config: {}, dirty: {}, saving: false, error: null, info: null };
      const [state, setState] = React.useState(initial);

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
            const code = (res && res.error && res.error.code) || "E_RPC";
            const msg = (res && res.error && res.error.message) || "无法读取插件设置";
            setState((s) => Object.assign({}, s, { loaded: true, error: msg + (code !== "E_RPC" ? " [" + code + "]" : "") }));
          }
        } catch (e) {
          setState((s) => Object.assign({}, s, { loaded: true, error: String((e && e.message) || e) }));
        }
      }, [rpc, sessionId]);

      React.useEffect(() => { loadSettings(); }, [loadSettings]);

      function updateField(key, value) {
        setState((s) => ({
          loaded: s.loaded,
          writable: s.writable,
          config: Object.assign({}, s.config, { [key]: value }),
          dirty: Object.assign({}, s.dirty, { [key]: value }),
          saving: false,
          error: null,
          info: null,
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
            setState({ loaded: true, writable: !!res.value.writable, config: res.value.config || {}, dirty: {}, saving: false, error: null, info: "✓ 已保存" });
          } else {
            const code = (res && res.error && res.error.code) || "E_RPC";
            const msg = (res && res.error && res.error.message) || "保存失败";
            setState((s) => Object.assign({}, s, { saving: false, error: msg + (code !== "E_RPC" ? " [" + code + "]" : "") }));
          }
        } catch (e) {
          setState((s) => Object.assign({}, s, { saving: false, error: String((e && e.message) || e) }));
        }
      }

      function discard() {
        setState((s) => Object.assign({}, s, { dirty: {}, error: null, info: "已丢弃本地修改（点击「重新读取」会刷新服务器值）" }));
      }

      function renderField(field, value) {
        const fieldLabel = settingsFieldLabel(field, locale);
        const hint = settingsFieldHint(field, locale);
        const inputId = "brain-set-" + field.key;
        const labelStyle = { display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "var(--dsw-alias-label-primary)" };
        const inputBase = {
          width: "100%", boxSizing: "border-box", padding: "6px 9px",
          background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "6px",
          fontFamily: "inherit", fontSize: "12px",
        };

        if (field.type === "boolean") {
          const checked = value === true;
          return React.createElement("div", { key: field.key, style: { marginBottom: "10px" } },
            React.createElement("label", { htmlFor: inputId, style: { display: "flex", alignItems: "center", gap: "8px", cursor: state.writable ? "pointer" : "not-allowed" } },
              React.createElement("input", {
                id: inputId, type: "checkbox",
                checked: checked, disabled: !state.writable || state.saving,
                onChange: (e) => updateField(field.key, e.target.checked === true),
                style: { cursor: state.writable ? "pointer" : "not-allowed" },
              }),
              React.createElement("span", { style: labelStyle }, fieldLabel),
            ),
            hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px", marginLeft: "24px" } }, hint) : null,
          );
        }

        if (field.type === "enum") {
          return React.createElement("div", { key: field.key, style: { marginBottom: "10px" } },
            React.createElement("label", { htmlFor: inputId, style: labelStyle }, fieldLabel),
            React.createElement("select", {
              id: inputId, disabled: !state.writable || state.saving,
              value: value == null ? "" : String(value),
              onChange: (e) => updateField(field.key, e.target.value),
              style: Object.assign({}, inputBase),
            }, (field.options || []).map((opt) =>
              React.createElement("option", { key: opt.v, value: opt.v }, settingsOptionLabel(opt, locale)),
            )),
            hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px" } }, hint) : null,
          );
        }

        // number / string 共享一个 input
        const isNumber = field.type === "number";
        const inputProps = {
          id: inputId, disabled: !state.writable || state.saving,
          onChange: (e) => {
            const raw = e.target.value;
            if (isNumber) {
              if (raw === "" || raw === "-") { updateField(field.key, raw); return; }
              const num = Number(raw);
              updateField(field.key, Number.isFinite(num) ? num : raw);
            } else {
              updateField(field.key, raw);
            }
          },
          style: Object.assign({}, inputBase, isNumber ? { fontFamily: "ui-monospace, monospace" } : {}),
          placeholder: field.placeholder || "",
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
        return React.createElement("div", { key: field.key, style: { marginBottom: "10px" } },
          React.createElement("label", { htmlFor: inputId, style: labelStyle }, fieldLabel),
          React.createElement("input", inputProps),
          hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginTop: "2px" } }, hint) : null,
        );
      }

      if (!state.loaded) {
        return React.createElement("div", { style: { padding: "20px", textAlign: "center", fontSize: "12px", color: "var(--dsw-alias-label-secondary)" } }, "加载设置中…");
      }

      const dirtyCount = Object.keys(state.dirty).length;

      return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
        React.createElement("div", { style: {
          padding: "9px 12px", borderRadius: "8px",
          border: "1px solid " + (state.writable ? "var(--dsw-alias-state-success-primary, var(--dsw-alias-border-l1))" : "var(--dsw-alias-state-warn-primary)"),
          background: "var(--dsw-alias-bg-layer-1)",
          display: "flex", alignItems: "center", gap: "8px", fontSize: "12px",
          color: state.writable ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-warn-primary)",
        } },
          React.createElement("span", null, state.writable ? "✅" : "⚠️"),
          React.createElement("span", null, state.writable
            ? (locale === "en-US" ? "Settings writable. Changes persist immediately." : "配置可写，保存后即时生效。")
            : (locale === "en-US" ? "Settings read-only in this runtime (DSH settings service unavailable). Configure via DSH settings panel or env vars." : "当前运行时配置为只读（DSH settings 服务不可用）。请通过 DSH 设置面板或环境变量配置。")),
          React.createElement("span", { style: { marginLeft: "auto", cursor: "pointer", opacity: 0.85 } , onClick: loadSettings, title: locale === "en-US" ? "Reload" : "重新读取"},
            "⟳"),
        ),
        BRAIN_SETTINGS_META.map((group) =>
          React.createElement("section", {
            key: group.group, style: {
              padding: "12px 14px", background: "var(--dsw-alias-bg-layer-2)",
              borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)",
            },
          },
            React.createElement("h3", { style: { fontSize: "13px", fontWeight: "700", margin: "0 0 4px", display: "flex", alignItems: "center", gap: "6px", color: "var(--dsw-alias-label-primary)" } },
              React.createElement("span", null, group.icon),
              React.createElement("span", null, settingsGroupTitle(group, locale)),
            ),
            group.hint ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", marginBottom: "10px" } }, settingsFieldHint(group, locale)) : null,
            group.fields.map((field) => renderField(field, state.config[field.key])),
          ),
        ),
        React.createElement("div", { style: {
          position: "sticky", bottom: "0", marginTop: "6px",
          padding: "10px 12px", background: "var(--dsw-alias-bg-layer-2)",
          borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)",
          display: "flex", alignItems: "center", gap: "10px",
        } },
          state.error ? React.createElement("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: "11px", flex: "1 1 auto" } }, "❌ " + state.error) : null,
          !state.error && state.info ? React.createElement("span", { style: { color: "var(--dsw-alias-state-success-primary)", fontSize: "11px", flex: "1 1 auto" } }, state.info) : null,
          !state.error && !state.info ? React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", flex: "1 1 auto" } },
            dirtyCount > 0 ? (dirtyCount + (locale === "en-US" ? " unsaved field(s)" : " 项未保存")) : (locale === "en-US" ? "No changes" : "无修改")) : null,
          React.createElement("button", {
            type: "button", onClick: discard,
            disabled: dirtyCount === 0 || state.saving,
            style: {
              padding: "6px 12px", borderRadius: "6px",
              border: "1px solid var(--dsw-alias-border-l1)", background: "transparent",
              color: "var(--dsw-alias-label-primary)", cursor: dirtyCount === 0 ? "not-allowed" : "pointer",
              fontSize: "11px", opacity: dirtyCount === 0 ? 0.5 : 1, fontFamily: "inherit",
            },
          }, locale === "en-US" ? "Discard" : "放弃修改"),
          React.createElement("button", {
            type: "button", onClick: save,
            disabled: dirtyCount === 0 || state.saving || !state.writable,
            "data-settings-save": "1",
            style: {
              padding: "6px 14px", borderRadius: "6px",
              border: "none",
              background: (dirtyCount === 0 || !state.writable) ? "var(--dsw-alias-bg-layer-1)" : "var(--dsw-alias-brand-primary)",
              color: (dirtyCount === 0 || !state.writable) ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-label-on-brand, var(--dsw-alias-bg-base))",
              cursor: (dirtyCount === 0 || !state.writable || state.saving) ? "not-allowed" : "pointer",
              fontSize: "12px", fontWeight: "600", fontFamily: "inherit",
            },
          }, state.saving ? "保存中…" : (locale === "en-US" ? "Save" : "保存")),
        ),
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
      const rpc = connection && connection.rpc;
      // 架构兜底条专用重试：独立 promise-based（避开 quickActionState 的 stale 闭包）
      const runArchRescan = React.useCallback(async () => {
        if (!sessionId || !rpc || typeof rpc.call !== "function") throw new Error(t("arch.retryFailed"));
        const res = await rpc.call("/project-brain", "action", { sessionId, action: "rescan" });
        if (!res || !res.ok || !res.value) throw new Error((res && res.error && res.error.message) || t("arch.retryFailed"));
        if (res.value && res.value.preview && typeof onPreviewUpdate === "function") {
          try { onPreviewUpdate(res.value); } catch (e) {}
        }
        const stats = res.value && res.value.result && res.value.result.data && res.value.result.data.stats;
        return { message: stats ? t("arch.retryDone") + " · " + (stats.files || 0) + " 文件" : t("arch.retryDone") };
      }, [sessionId, rpc, onPreviewUpdate, t]);
      // v0.4.x: Git Tab 数据（null=探测中，{available:false}=非 git 仓库不显示 tab，{available:true,...}=有 git）
      const [gitInfo, setGitInfo] = React.useState(null);
      // v0.4.x: Git Tab 自动刷新开关（默认开；localStorage 记忆；切到 git tab 时启动 30 秒轮询）
      const [gitAutoRefresh, setGitAutoRefresh] = React.useState(() => {
        try { return localStorage.getItem("dsh-brain-git-auto-refresh") !== "0"; } catch (e) { return true; }
      });
      const refreshGit = React.useCallback(async () => {
        if (!rpc || typeof rpc.call !== "function") return;
        try {
          const res = await rpc.call("/project-brain", "git", { sessionId: sessionId, workspacePath: data._workspacePath || null, limit: 50 });
          if (res && res.ok && res.value) setGitInfo(res.value);
          else setGitInfo({ available: false, error: (res && res.error && res.error.message) || "no git info" });
        } catch (e) {
          setGitInfo({ available: false, error: String((e && e.message) || e) });
        }
      }, [rpc, sessionId, data._workspacePath]);
      React.useEffect(() => {
        let cancelled = false;
        if (!rpc || typeof rpc.call !== "function") return undefined;
        (async () => {
          try {
            const res = await rpc.call("/project-brain", "git", { sessionId: sessionId, workspacePath: data._workspacePath || null, limit: 50 });
            if (cancelled) return;
            if (res && res.ok && res.value) setGitInfo(res.value);
            else setGitInfo({ available: false, error: (res && res.error && res.error.message) || "no git info" });
          } catch (e) {
            if (!cancelled) setGitInfo({ available: false, error: String((e && e.message) || e) });
          }
        })();
        return () => { cancelled = true; };
      }, [rpc, sessionId, data._workspacePath]);
      // v0.4.x: Git Tab 自动轮询（仅 git tab 激活 + 开关开时启动；30 秒间隔）
      React.useEffect(() => {
        if (activeTab !== "git" || !gitAutoRefresh) return undefined;
        const t = setInterval(refreshGit, 30000);
        return () => clearInterval(t);
      }, [activeTab, gitAutoRefresh, refreshGit]);

      function resultMessage(action, value) {
        const result = value && value.result;
        const detail = result && result.data ? result.data : {};
        if (action === "rescan") {
          const stats = detail.stats || {};
          return "扫描完成 · " + (stats.files || 0) + " 个文件";
        }
        if (action === "todos") {
          return "活跃 " + (detail.active || 0) + " 项 · 已完成 " + (detail.done || 0) + " 项";
        }
        if (action === "overview") {
          return detail.suggestedNextStep ? "下一步：" + detail.suggestedNextStep : "项目全景已刷新";
        }
        if (action === "dreamCommit") {
          const committed = detail.committed || {};
          return "整理完成 · " + (committed.beforeCount || 0) + " → " + (committed.afterCount || 0) + " 条记忆";
        }
        return "执行完成";
      }

      async function runQuickAction(qa) {
        const previous = quickActionState[qa.id] || {};
        const action = qa.action === "dream" && previous.status === "confirm" ? "dreamCommit" : qa.action;
        if (Object.values(quickActionState).some((state) => state && state.status === "loading")) return;
        setQuickActionState((states) => Object.assign({}, states, {
          [qa.id]: { status: "loading", message: action === "dreamCommit" ? "正在提交整理…" : "正在执行…" },
        }));
        if (!sessionId || !rpc || typeof rpc.call !== "function") {
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: { status: "error", message: !sessionId ? "未找到当前 Session" : "DSH Runtime RPC 不可用" },
          }));
          return;
        }

        let response;
        try {
          response = await rpc.call("/project-brain", "action", { sessionId, action });
        } catch (error) {
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: { status: "error", message: String((error && error.message) || error) },
          }));
          return;
        }
        if (!response || !response.ok || !response.value) {
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: {
              status: "error",
              message: (response && response.error && response.error.message) || "操作执行失败",
            },
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
              [qa.id]: { status: "confirm", message: "发现 " + candidates + " 项候选，点击确认整理" },
            }));
            return;
          }
          setQuickActionState((states) => Object.assign({}, states, {
            [qa.id]: { status: "success", message: "检查完成 · 无需整理" },
          }));
          return;
        }

        if (value.preview && typeof onPreviewUpdate === "function") {
          try { onPreviewUpdate(value); } catch (error) {}
        }
        setQuickActionState((states) => Object.assign({}, states, {
          [qa.id]: { status: "success", message: resultMessage(action, value) },
        }));
      }
      const techChips = Object.entries(p.techStack || {}).flatMap(([k, v]) => {
        // v 可能是 string 或 array（多语言栈并存）；统一展平为多个 chip
        const values = Array.isArray(v) ? v : [v];
        return values.filter(Boolean).map((item, idx) =>
          React.createElement("span", { key: k + "-" + idx, style: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, k + ":"),
            React.createElement("span", { style: { fontWeight: "600" } }, String(item)),
          ),
        );
      });
      const toolingChips = (p.tooling || []).map((tool) =>
        React.createElement("span", { key: "tool-" + tool, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
          React.createElement("span", null, "🛠️"),
          React.createElement("span", null, String(tool)),
        ),
      );
      const langUsage = formatLanguagesUsage(p.languages);
      const langChips = [];
      for (const item of langUsage.top) {
        const pctLabel = langUsage.total > 0 ? Math.round(item.percent) + "%" : "";
        langChips.push(React.createElement("span", {
          key: "lang-" + item.lang,
          title: item.lang + " · " + item.count + " 个文件",
          style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" },
        },
          React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-state-warn-primary)" } }),
          React.createElement("span", null, item.lang),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, pctLabel ? " · " + pctLabel : ""),
        ));
      }
      if (langUsage.tail) {
        langChips.push(React.createElement("span", {
          key: "lang-tail",
          title: langUsage.tail.languages + " 种语言共 " + langUsage.tail.count + " 个文件",
          style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)", color: "var(--dsw-alias-label-secondary)" },
        },
          React.createElement("span", null, "其它 " + langUsage.tail.languages + " 种"),
          React.createElement("span", null, " · " + Math.round(langUsage.tail.percent) + "%"),
        ));
      }
      const entryItems = (p.entrypoints || []).map((e, i) =>
        React.createElement("div", { key: i, style: { display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", fontSize: "12px", marginRight: "4px", marginBottom: "4px" } },
          React.createElement("span", { style: { fontSize: "13px" } }, e.type === "main" ? "🎯" : e.type === "cli" ? "💻" : e.type === "lib" ? "📚" : "📄"),
          React.createElement("span", { style: { fontFamily: "monospace" } }, e.path),
        ),
      );
      const typeLabel = (type) => t("mem.type." + type) !== "mem.type." + type ? t("mem.type." + type) : type;
      const typeChipStyle = { flex: "0 0 auto", fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontWeight: "600", border: "1px solid var(--dsw-alias-border-l1)" };
      const dashPanelStyle = { padding: "14px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)", minWidth: 0 };
      const dashSection = (icon, titleKey, children) =>
        React.createElement("section", { style: dashPanelStyle },
          React.createElement("h3", { style: sectionTitleStyle }, icon + " " + t(titleKey)),
          children,
        );
      const tabDefs = [
        { id: "overview", icon: "◫", label: t("dash.tab.overview") },
        { id: "architecture", icon: "⌘", label: t("dash.tab.architecture") },
        { id: "work", icon: "✓", label: t("dash.tab.work") },
        { id: "knowledge", icon: "◇", label: t("dash.tab.knowledge") },
        { id: "settings", icon: "⚙", label: t("dash.tab.settings") },
      ];
      // v0.4.x: 仅当项目是 git 仓库时才显示 Git Tab
      if (gitInfo && gitInfo.available === true) {
        tabDefs.push({ id: "git", icon: "⎇", label: t("dash.tab.git") });
      }
      const emptyNode = React.createElement("span", { style: { opacity: 0.6, fontSize: "12px" } }, t("dash.none"));
      const todoNode = todos.length > 0
        ? React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } },
            todos.map((x) => React.createElement("li", { key: x.id, style: { display: "flex", gap: "8px", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)", fontSize: "12px" } },
              React.createElement("span", { style: { fontSize: "10px", padding: "1px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-1)", fontWeight: "600" } }, t("st." + (x.status || "pending"))),
              React.createElement("span", { style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, x.title),
              React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontWeight: "600" } }, t("prio." + (x.priority || "medium"))),
            )))
          : emptyNode;
      const timelineNode = timelineAll.length > 0
        ? React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0 } },
            timelineAll.slice(0, 20).map((e) => React.createElement("li", { key: e.id, style: { display: "grid", gridTemplateColumns: "86px minmax(0, 1fr)", gap: "10px", padding: "7px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)", fontSize: "12px", alignItems: "start" } },
              React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", fontVariantNumeric: "tabular-nums" } }, formatDate(e.occurredAt).slice(5)),
              React.createElement("span", { style: { minWidth: 0, lineHeight: 1.45 } }, e.title),
            )))
          : emptyNode;
      const memoryNode = memoriesAll.length > 0
        ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px" } },
            memoriesAll.slice(0, 20).map((m) => React.createElement("article", { key: m.id, style: { padding: "10px 12px", background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", minWidth: 0 } },
              React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
                React.createElement("span", { style: typeChipStyle }, typeLabel(m.type)),
                React.createElement("span", { style: { flex: "1 1 auto", minWidth: 0, fontSize: "12px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.title),
              ),
              m.content ? React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "7px", lineHeight: "1.55", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, String(m.content).slice(0, 360)) : null,
            )))
          : emptyNode;
      return React.createElement("div", { id: "dsh-brain-dashboard", style: { display: "block", background: "var(--dsw-alias-bg-layer-1)", borderRadius: "10px", margin: "8px 12px", border: "1px solid var(--dsw-alias-border-l2)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }, "data-block": "dashboard" },
        React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "15px", background: "linear-gradient(90deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-layer-2))" } },
          React.createElement("span", { style: { fontSize: "18px" } }, "🎯"),
          React.createElement("span", { style: { flex: "1 1 auto" } }, t("dash.title")),
          React.createElement("span", {
            title: retrieval.vectorConfigured ? (retrieval.embeddingModel || "hybrid") : "无需配置，数据保留在项目内",
            style: { fontSize: "10px", padding: "2px 7px", borderRadius: "8px", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-secondary)", border: "1px solid var(--dsw-alias-border-l1)" },
          }, retrieval.configuredMode === "hybrid" ? "向量已配置" : "本地检索"),
          React.createElement("span", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, "点击卡片后台执行"),
        ),
        // v0.4.15 智能续接：Session 开始时主动给出"今天可能想推进什么"
        React.createElement(SuggestionCard, {
          t, localeCode, sessionId, connection,
          projectInitialized: Boolean(data.initialized && data.project),
          embeddedSuggestion: data.suggestion || null,
          workspacePath: data._workspacePath || null,
        }),
        // v0.4.11: Quick Actions 2x2 网格（替代"继续上次开发"鸡肋按钮）
        (() => {
          const isEn = localeCode === "en-US";
          const quickActions = [
            { id: "qa-rescan", action: "rescan", icon: "🔄", title: isEn ? "Rescan" : "重新扫描", desc: isEn ? "Incrementally refresh project structure" : "增量更新项目结构" },
            { id: "qa-todo", action: "todos", icon: "📋", title: isEn ? "Review todos" : "整理待办", desc: isEn ? "View active tasks" : "查看活跃任务" },
            { id: "qa-memory", action: "dream", icon: "🧠", title: isEn ? "Organize memories" : "整理记忆", desc: isEn ? "Deduplicate and archive stale items" : "去重 + 归档过期" },
            { id: "qa-summary", action: "overview", icon: "🎯", title: isEn ? "Project overview" : "项目全景", desc: isEn ? "Summarize current status" : "总览当前状态" },
          ];
          return React.createElement("div", { style: { padding: "12px 12px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px" } },
            quickActions.map((qa) => {
              const state = quickActionState[qa.id] || { status: "idle", message: "" };
              const busy = state.status === "loading";
              const anyBusy = Object.values(quickActionState).some((item) => item && item.status === "loading");
              const trailing = busy
                ? React.createElement("span", { "data-spinner": "1", style: { width: "15px", height: "15px", borderRadius: "50%", border: "2px solid var(--dsw-alias-border-l2)", borderTopColor: "var(--dsw-alias-brand-primary)", animation: "dsh-brain-spin 0.9s linear infinite", display: "inline-block" } })
                : state.status === "success" ? "✅"
                : state.status === "error" ? "❌"
                : state.status === "confirm" ? "确认"
                : "▶";
              return React.createElement("button", {
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
                  textAlign: "left",
                },
                disabled: anyBusy && !busy,
                onClick: () => runQuickAction(qa),
                title: state.message || qa.desc,
              },
                React.createElement("div", { style: { fontSize: "22px", flex: "0 0 auto", lineHeight: "1" } }, qa.icon),
                React.createElement("div", { style: { flex: "1 1 auto", minWidth: 0 } },
                  React.createElement("div", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", marginBottom: "1px" } }, qa.title),
                  React.createElement("div", { style: { fontSize: "10px", color: state.status === "error" ? "var(--dsw-alias-state-error-primary)" : state.status === "confirm" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, state.message || qa.desc),
                ),
                React.createElement("div", { style: { fontSize: state.status === "confirm" ? "10px" : "11px", color: state.status === "confirm" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-label-secondary)", flex: "0 0 auto", fontWeight: "700" } }, trailing),
              );
            }),
          );
        })(),
        React.createElement("div", { style: { padding: "0 12px 8px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", display: "flex", alignItems: "center", gap: "4px" } },
          React.createElement("span", null, "💡"),
          React.createElement("span", null, "操作将在当前工作区后台执行；整理记忆会先预览再确认"),
        ),
        React.createElement("style", null, "@keyframes dsh-brain-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"),
        React.createElement("nav", { style: { display: "flex", gap: "4px", padding: "8px 12px 0", borderTop: "1px solid var(--dsw-alias-border-l1)", overflowX: "auto" }, "aria-label": "Project dashboard sections" },
          tabDefs.map((tab) => {
            const active = activeTab === tab.id;
            return React.createElement("button", { key: tab.id, type: "button", onClick: () => setActiveTab(tab.id), "data-dashboard-tab": tab.id, "aria-selected": active ? "true" : "false", style: { flex: "0 0 auto", padding: "8px 11px", border: "none", borderBottom: "2px solid " + (active ? "var(--dsw-alias-brand-primary)" : "transparent"), background: "transparent", color: active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: active ? "700" : "500" } }, tab.icon + " " + tab.label);
          }),
        ),
        React.createElement("div", { style: { padding: "12px" }, "data-dashboard-panel": activeTab },
          activeTab === "overview" ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "10px" } },
            dashSection("🛠️", "dash.tech", techChips.length + toolingChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, techChips, toolingChips) : emptyNode),
            dashSection("🗂️", "codegraph.langs", langChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, langChips) : emptyNode),
            dashSection("🚪", "dash.entry", entryItems.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, entryItems) : emptyNode),
          ) : null,
          activeTab === "architecture" ? React.createElement(ArchitectureGraphBlock, { data, t, embedded: true, onRescan: runArchRescan }) : null,
          activeTab === "work" ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px", alignItems: "start" } },
            dashSection("📋", "dash.todo", todoNode),
            dashSection("📅", "dash.timeline", timelineNode),
          ) : null,
          activeTab === "knowledge" ? dashSection("🧠", "dash.memory", memoryNode) : null,
          activeTab === "git" ? React.createElement(GitTab, { gitInfo, t, onRefresh: refreshGit, autoRefresh: gitAutoRefresh, onToggleAutoRefresh: (v) => { try { localStorage.setItem("dsh-brain-git-auto-refresh", v ? "1" : "0"); } catch (e) {} setGitAutoRefresh(v); } }) : null,
          activeTab === "settings" ? React.createElement(SettingsTab, { rpc, sessionId, t, localeCode }) : null,
        ),
        React.createElement("div", { style: { padding: "8px 16px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", borderTop: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "4px" } },
          React.createElement("span", null, "🕒"),
          React.createElement("span", null, t("dash.snapshot", { time: formatDate(data.generatedAt || Date.now()) })),
        ),
      );
    }

    // ─── 快照指示（v0.3.4）：build-time embed 数据通道标识 ───
    function SnapshotBadge({ data, t, source }) {
      const ts = data && data.generatedAt;
      const age = ts ? Math.round((Date.now() - ts) / 1000) : null;
      const ageText = age == null ? "" : age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age/60)}m` : `${Math.round(age/3600)}h`;
      return React.createElement("span", {
        style: {
          display: "inline-block",
          padding: "2px 8px",
          marginLeft: "8px",
          borderRadius: "10px",
          fontSize: "10px",
          fontWeight: "500",
          background: "var(--dsw-alias-state-success-primary)",
          color: "var(--dsw-alias-bg-base)",
        },
        "data-block": "snapshot-badge",
        title: source === "runtime" ? t("runtime.synced") : t("snapshot.autoSync"),
      }, (source === "runtime" ? "● " + t("runtime.label") : "📦 " + t("snapshot.label")) + (ageText ? " · " + ageText : ""));
    }

    // ─── 取 DSH 当前 locale（client builtin locale.getLocale()），fallback zh-CN ───
    //   v0.3.12: 不再硬编码 zh-CN，实时跟随 DSH 语言设置
    //   从 props._dshLocale（apply 注入）取；fallback zh-CN
    function resolveLocaleCode(props) {
      try {
        const l = props && props._dshLocale;
        if (l && typeof l.getLocale === "function") {
          const code = l.getLocale();
          if (code && typeof code === "string" && dicts[code]) return code;
          if (code && typeof code === "string") {
            // DSH 可能返回 "zh-CN" / "en-US" / "zh" / "en" 等，匹配前缀
            const lower = code.toLowerCase();
            for (const k of Object.keys(dicts)) {
              if (k.toLowerCase() === lower || k.toLowerCase().indexOf(lower + "-") === 0 || lower.indexOf(k.toLowerCase()) === 0) return k;
            }
          }
        }
      } catch (e) {}
      return "zh-CN";
    }

    function useResolvedPreview(props) {
      const embedded = DEMO_ONBOARDING
        ? { data: { initialized: false, project: null, phase: null, recentActivity: [], stats: { pendingTodos: 0, completedTodos: 0, decisions: 0 }, _generatedAt: __PROJECT_DATA__ && __PROJECT_DATA__.generatedAt }, workspaceId: null, workspacePath: null, sessionId: null, hint: "", source: "snapshot" }
        : resolvePreview(props);
      const sid = (props && props.sessionId) || null;
      const [runtime, setRuntime] = React.useState(null);
      // v1.1.x-fix：3 状态机 + 显式 runtimeError
      //   - runtimeResolved=false                                       → host RPC 进行中（loading 占位）
      //   - runtimeResolved=true && runtime != null                     → host RPC 成功（render dashboard / Onboarding）
      //   - runtimeResolved=true && runtime == null && runtimeError!=null → host RPC 失败（render 显式降级 banner）
      //   - runtimeResolved=true && runtime == null && runtimeError==null → 离线模式（offlineMode 入口直返）
      // 移除原 4 秒 setTimeout 强制 finish——避免 host 慢时落到 embedded hint 闪现。
      const [runtimeResolved, setRuntimeResolved] = React.useState(DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc);
      const [runtimeError, setRuntimeError] = React.useState(null);

      // 把 Connection RPC 抛出的"原始 error"压缩成人话（避免 banner 里出现整页 schemastery JSON）
      function compressRpcError(err) {
        const raw = err && err.message ? err.message : (typeof err === "string" ? err : String(err || ""));
        // schemastery 的 invalid_union / invalid_value 错误 → 直接提示 result schema 不匹配
        if (/invalid_union|invalid_value|No matching discriminator/.test(raw)) {
          return "[DSH schema] host 返回的 result 不符合 Connection RPC schema（通常是 DSH 升级/降级引入的协议不兼容，或插件返回了 schema 未声明的字段）";
        }
        // Network/connection 类错误
        if (/Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|timeout/i.test(raw)) {
          return "[DSH IPC] host 通道不可达（" + raw.slice(0, 80) + "）";
        }
        // 其他：截断到 200 字符
        return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
      }

      React.useEffect(() => {
        setRuntime(null);
        setRuntimeError(null);
        const offlineMode = DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc;
        if (offlineMode) {
          setRuntimeResolved(true);
          return undefined;
        }
        setRuntimeResolved(false);
        let active = true;
        const refresh = () => {
          if (!active) return;
          __DSH_CONNECTION__.rpc.call("/project-brain", "preview", { sessionId: sid })
            .then((result) => {
              if (!active) return;
              if (result && result.ok && result.value) {
                const value = result.value;
                setRuntime({
                  data: value.preview,
                  workspaceId: embedded.workspaceId,
                  workspacePath: value.projectPath || embedded.workspacePath,
                  sessionId: sid,
                  hint: "",
                  source: "runtime",
                });
                setRuntimeError(null);
              } else {
                // host RPC 返回失败结构（workspace-not-found / bad-request 等）——
                // 显式记录错误，让 UI 渲染降级 banner 而不是落到 embedded。
                const err = (result && result.error) || {};
                const originalCode = (err.details && err.details.originalCode) || null;
                setRuntimeError({
                  code: err.code || "RPC_EMPTY",
                  originalCode: originalCode,
                  message: err.message || "host RPC 返回异常",
                  sessionId: sid,
                  at: Date.now(),
                });
              }
              setRuntimeResolved(true);
            })
            .catch((error) => {
              if (!active) return;
              // Keep the embedded snapshot as a graceful offline fallback.
              console.warn("[dsh-project-brain] runtime preview unavailable:", error);
              setRuntimeError({
                code: "RPC_THROW",
                message: compressRpcError(error),
                sessionId: sid,
                at: Date.now(),
              });
              setRuntimeResolved(true);
            });
        };
        refresh();
        // v1.1.x-fix：setInterval 5000→2000ms，缩短切 session 时的"host 慢"等待窗口。
        //   DSH 异步注册 session workspace 时首次 preview 可能返回 workspace-not-found，
        //   5s 太长导致 banner 显示几秒才消失；2s 通常足够 DSH 完成注册。
        const timer = setInterval(refresh, 2000);
        return () => {
          active = false;
          clearInterval(timer);
        };
      }, [sid]);

      return [runtime || embedded, setRuntime, runtimeResolved, runtimeError];
    }

    // ─── 根组件：Connection RPC 为主，build-time embed 为首屏/离线降级 ───
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
          source: "runtime",
        });
      }, [r.workspaceId, r.workspacePath, r.sessionId]);

      const containerStyle = {
        padding: "10px 0 28px",
        background: "var(--dsw-alias-bg-base)",
        color: "var(--dsw-alias-label-primary)",
        minHeight: "100%",
        boxSizing: "border-box",
      };
      const containerProps = {
        className: "dsh-project-brain-preview",
        "data-version": "v1.1.x-three-runtime-rpc",
        "data-workspace-id": r.workspaceId || "(none)",
        "data-workspace-path": r.workspacePath || "(none)",
        "data-session-id": (r.sessionId || "").toString().slice(0, 8),
        "data-runtime-state": runtimeResolved ? (runtimeError ? "host-error" : (r.source === "runtime" ? "host-ok" : "offline")) : "host-loading",
        style: containerStyle,
      };
      const dataWithLocale = Object.assign({}, data, { _localeCode: localeCode, _workspacePath: r.workspacePath || null });

      const headerWithBadge = React.createElement(
        "section",
        { style: Object.assign({}, sectionStyle, { padding: "12px 16px" }), "data-block": "live-status" },
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "live-label" }, "dsh-project-brain"),
          React.createElement(SnapshotBadge, { data: data, t, source: r.source }),
        ),
      );

      // v1.1.x-fix：3 状态机渲染
      //   1) host RPC 进行中（!runtimeResolved）→ loading 占位，**不显示 Onboarding / hint**，
      //      避免 build miss 时 embedded 阶段的 hint 闪现误导用户。
      //   2) host RPC 失败（runtimeError）→ 显式降级 banner（含原因 + 操作建议，按用户
      //      preference "任何兜底/降级必须附原因+操作建议"）。
      //   3) host RPC 成功 / 离线模式（runtime）→ 走正常判定：已初始化 → Dashboard，
      //      未初始化 → Onboarding（path 来自 r.workspacePath）。
      if (!dataWithLocale.initialized) {
        // 1) host RPC 进行中
        if (!runtimeResolved) {
          return React.createElement("div", containerProps,
            React.createElement("style", null, "@keyframes dsh-brain-loading-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.dsh-brain-loading-dot{display:inline-block;width:8px;height:8px;border-radius:50%;border:1.5px solid var(--dsw-alias-brand-primary);border-top-color:transparent;animation:dsh-brain-loading-spin 0.9s linear infinite;vertical-align:middle;margin-right:8px}"),
            headerWithBadge,
            React.createElement("div", {
              style: { padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--dsw-alias-label-secondary)", fontSize: "12px" },
              "data-block": "preview-loading",
            },
              React.createElement("div", { style: { display: "flex", alignItems: "center" } },
                React.createElement("span", { className: "dsh-brain-loading-dot" }),
                React.createElement("span", null, localeCode === "en-US" ? "Resolving workspace from Session…" : "正在从 Session 解析 workspace…"),
              ),
              React.createElement("div", { style: { fontSize: "10px", opacity: 0.7 } },
                (r.sessionId ? String(r.sessionId).slice(0, 12) + "…" : "—"),
              ),
            ),
          );
        }

        // 2) host RPC 失败 → 显式降级 banner
        if (runtimeError) {
          const errCode = runtimeError.code || "RPC_EMPTY";
          const originalCode = runtimeError.originalCode || null;
          // v1.1.x-fix：host 端会把不在 DSH schema 白名单的 code 降级到 "internal"，原 code 进 details.originalCode。
          //   客户端 banner 判定时优先用 originalCode（更精确），再用 errCode。这样切项目时的"workspace-not-found"
          //   不会因为降级显示成"host 连接失败"+"检查网络/重启"。
          const effectiveCode = originalCode || errCode;
          const isWorkspaceMiss = effectiveCode === "workspace-not-found";
          const isSchema = (errCode === "RPC_THROW" || errCode === "internal") && /\[DSH schema\]/.test(runtimeError.message || "");
          const isNetwork = (errCode === "RPC_THROW" || errCode === "internal") && /\[DSH IPC\]/.test(runtimeError.message || "");
          const bannerTitle = isWorkspaceMiss
            ? (localeCode === "en-US" ? "Workspace path not found for this Session" : "无法从当前 Session 解析 workspace 路径")
            : isSchema
              ? (localeCode === "en-US" ? "DSH host returned a malformed result" : "DSH host 返回的 result 协议不匹配")
              : isNetwork
                ? (localeCode === "en-US" ? "Cannot reach DSH host" : "无法连接 DSH host")
                : (localeCode === "en-US" ? "Host RPC failed" : "host 连接失败");
          const bannerReason = isWorkspaceMiss
            ? (localeCode === "en-US"
                ? "DSH Host could not resolve cwd for this sessionId. Usually means DSH has not yet registered the session workspace (cold start) or the session has no cwd header."
                : "DSH Host 暂时无法解析当前 sessionId 对应的 cwd（通常 DSH 还没把 session workspace 注册进来，或 session header 缺 cwd 字段）。")
            : isSchema
              ? (localeCode === "en-US"
                  ? "The result of /project-brain preview did not match Connection RPC schema. This usually means the plugin and DSH Desktop versions are out of sync — try restarting DSH."
                  : "/project-brain preview 返回的 result 不符合 Connection RPC schema，通常是插件与 DSH 桌面版本不一致导致——重启 DSH 试试。")
              : (localeCode === "en-US"
                  ? `RPC "${errCode}"${originalCode ? " (was " + originalCode + ")" : ""} — ${runtimeError.message || "(no message)"}`
                  : `RPC "${errCode}"${originalCode ? "（原 code=" + originalCode + "）" : ""} — ${runtimeError.message || "未知错误"}`);
          const bannerAction = isWorkspaceMiss
            ? (localeCode === "en-US"
                ? "Action: wait a moment and switch again, or open any file in the project root so DSH registers the workspace, then return."
                : "建议：等 1~2 秒再切一次，或在项目根目录随便打开一个文件让 DSH 注册 workspace 后再回来。")
            : isSchema
              ? (localeCode === "en-US"
                  ? "Action: fully quit DSH Desktop (right-click tray → Quit) and restart. Reopen the project — the bundle will be reloaded."
                  : "建议：完全退出 DSH 桌面（托盘右键 → Quit）后重新启动，再打开该项目即可重新加载 bundle。")
            : (localeCode === "en-US"
                ? "Action: check DSH Desktop network/plugin health, or restart DSH. The retry interval is 5s."
                : "建议：检查 DSH 桌面网络/插件状态，或重启 DSH。客户端每 5 秒会自动重试。");
          const bannerSeverity = isWorkspaceMiss ? "轻" : (isSchema || isNetwork) ? "中" : "中";
          const severityLabel = localeCode === "en-US"
            ? (isWorkspaceMiss ? "Severity: low" : "Severity: medium")
            : `严重程度：${bannerSeverity}`;
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
                gap: "6px",
              },
            },
            React.createElement("div", { style: { fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" } },
              React.createElement("span", null, "⚠️"),
              React.createElement("span", null, bannerTitle),
            ),
            React.createElement("div", { style: { opacity: 0.95 } }, bannerReason),
            React.createElement("div", { style: { opacity: 0.9, fontSize: "11px" } }, bannerAction),
            React.createElement("div", { style: { opacity: 0.85, fontSize: "10px" } }, severityLabel),
          );
          return React.createElement("div", containerProps,
            headerWithBadge,
            banner,
            React.createElement(OnboardingBlock, {
              t,
              path: r.workspacePath || null,
              sessionId: r.sessionId || null,
              onComplete: handleOnboardingComplete,
              connection: __DSH_CONNECTION__,
            }),
          );
        }

        // 3) host RPC 成功且确认未初始化 → Onboarding（path 来自 r.workspacePath）
        return React.createElement("div", containerProps,
          headerWithBadge,
          React.createElement(OnboardingBlock, {
            t,
            path: r.workspacePath || null,
            sessionId: r.sessionId || null,
            onComplete: handleOnboardingComplete,
            connection: __DSH_CONNECTION__,
          }),
        );
      }

      return React.createElement("div", containerProps,
        React.createElement("style", null, [
          ".dsh-project-brain-preview *{box-sizing:border-box}",
          ".dsh-brain-summary-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:10px;margin:8px 12px}",
          "@media(max-width:760px){.dsh-brain-summary-grid{grid-template-columns:1fr}.dsh-project-brain-preview [data-architecture-diagram=semantic-layers]>div{grid-template-columns:1fr!important}}",
          ".dsh-project-brain-preview button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
          ".dsh-project-brain-preview button:not(:disabled):active{transform:translateY(1px)}",
        ].join("\n")),
        headerWithBadge,
        React.createElement(HeaderBlock, { data: dataWithLocale, t }),
        React.createElement("div", { className: "dsh-brain-summary-grid", "data-block": "summary-grid" },
          React.createElement(StatusBannerBlock, { data: dataWithLocale, t, compact: true }),
          React.createElement(PhaseBlock, { data: dataWithLocale, t, compact: true }),
        ),
        React.createElement(DashboardSection, {
          data: dataWithLocale,
          t,
          localeCode,
          sessionId: r.sessionId || null,
          connection: __DSH_CONNECTION__,
          onPreviewUpdate: handleOnboardingComplete,
        }),
      );
    }

    // ─── P0.7: TodoStrip (conversation.input.dock) ───
    // 位置：composer 上方全宽行；折叠态显示活跃 TODO Top-3，点击"查看全部"展开全量；空状态隐藏整行
    // 数据源：复用 SidebarPreviewRoot 同源 build-time embed (resolvePreview props -> data.todos)
    // 交互：纯 DOM toggle（避免 useState 触发 DSH static client 兼容性 bug，已知历史教训）

    function TodoStrip(props) {
      const localeCode = resolveLocaleCode(props);
      const t = makeT(localeCode);
      const [r, , runtimeResolved] = useResolvedPreview(props);
      const data = r.data;
      // v1.1.x-fix：host 拉数据期间（!runtimeResolved）不渲染 strip，避免切项目时
      //   "embedded.data.initialized=true（之前项目的）→ 现在 sid 的 embedded=false"
      //   引起的闪烁。host 回数据后再根据 data.initialized 决定显示与否。
      if (!runtimeResolved) return null;
      if (!data || !data.initialized) return null;  // 未初始化项目不显示
      const active = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
      if (active.length === 0) return null;        // 无活跃 TODO 不显示（避免噪音）

      const wsid = r.workspaceId || "default";
      const stripId = "dsh-brain-todo-strip-" + wsid;
      const listId = "dsh-brain-todo-strip-list-" + wsid;
      const toggleBtnId = "dsh-brain-todo-strip-toggle-" + wsid;
      const closeBtnId = "dsh-brain-todo-strip-close-" + wsid;
      const restoreId = "dsh-brain-todo-strip-restore-" + wsid;
      const dismissedKey = "dsh-brain-todo-strip-dismissed:" + wsid;

      const isDismissed = (() => {
        try { return localStorage.getItem(dismissedKey) === "1"; } catch (e) { return false; }
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
        color: "var(--dsw-alias-label-primary)",
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
        letterSpacing: "0.6px",
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
        textTransform: "none",
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
        lineHeight: "1",
      };
      const prioColor = { urgent: "var(--dsw-alias-state-error-primary)", high: "var(--dsw-alias-state-warn-primary)" };
      const itemStyle = (idx) => ({
        display: "flex",
        alignItems: "baseline",
        gap: "8px",
        padding: "4px 0",
        borderTop: idx === 0 ? "none" : "1px solid var(--dsw-alias-border-l1)",
        fontSize: "13px",
      });
      const chipStyle = (priority) => ({
        flex: "0 0 auto",
        fontSize: "10px",
        padding: "1px 6px",
        borderRadius: "3px",
        background: prioColor[priority] || "var(--dsw-alias-bg-layer-2)",
        color: prioColor[priority] ? "var(--dsw-alias-bg-base)" : "var(--dsw-alias-label-secondary)",
      });

      // 切换展开/折叠（纯 DOM，避免 useState 触发 DSH static client 兼容性 bug）
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
            if (btn) btn.textContent = "▾";
          } else {
            listEl.style.display = "flex";
            listEl.dataset.expanded = "1";
            if (btn) btn.textContent = "▴";
          }
        } catch (e) {}
      };

      // 关闭整个 strip：隐藏 + 写 localStorage + 显示恢复 chip
      const onClose = (ev) => {
        try {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          const stripEl = document.getElementById(stripId);
          const restoreEl = document.getElementById(restoreId);
          if (stripEl) stripEl.style.display = "none";
          if (restoreEl) restoreEl.style.display = "";
          try { localStorage.setItem(dismissedKey, "1"); } catch (e) {}
        } catch (e) {}
      };

      // 从关闭态恢复
      const onRestore = (ev) => {
        try {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          const stripEl = document.getElementById(stripId);
          const restoreEl = document.getElementById(restoreId);
          if (restoreEl) restoreEl.style.display = "none";
          if (stripEl) stripEl.style.display = "";
          try { localStorage.removeItem(dismissedKey); } catch (e) {}
        } catch (e) {}
      };

      const items = active.map((x, idx) =>
        React.createElement("div", {
          key: x.id,
          "data-todo-item": "1",
          style: itemStyle(idx),
        },
          React.createElement("span", { style: chipStyle(x.priority) }, t("prio." + (x.priority || "medium"))),
          React.createElement("span", { style: { flex: "1 1 auto" } }, x.title),
          x.status === "in_progress" ? React.createElement("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-state-success-primary)" } }, t("st.in_progress")) : null,
        ),
      );

      // 主 strip（默认折叠，列表隐藏）— header 始终可见，点击切换展开
      const strip = React.createElement("div", {
        id: stripId,
        "data-block": "todo-strip",
        "data-workspace-id": r.workspaceId || "",
        style: Object.assign({}, containerStyle, isDismissed ? { display: "none" } : {}),
      },
        React.createElement("div", { style: headerStyle, onClick: onToggle, title: t("todostrip.viewAll") },
          React.createElement("span", { key: "t", style: { display: "inline-flex", alignItems: "center" } },
            "📋 " + t("todostrip.title"),
            React.createElement("span", { style: countBadgeStyle }, String(active.length)),
          ),
          React.createElement("div", { key: "actions", style: { display: "flex", gap: "2px", alignItems: "center" } },
            React.createElement("button", {
              key: "toggle", id: toggleBtnId, type: "button", style: iconBtnStyle,
              onClick: onToggle, title: t("todostrip.viewAll"),
            }, "▾"),
            React.createElement("button", {
              key: "close", id: closeBtnId, type: "button", style: iconBtnStyle,
              onClick: onClose, title: t("todostrip.close"),
            }, "×"),
          ),
        ),
        React.createElement("div", {
          id: listId, "data-expanded": "0",
          style: { display: "none", flexDirection: "column" },
        }, items),
      );

      // 恢复 chip（关闭后显示，极小占用，不钉住）
      const restoreChip = React.createElement("button", {
        key: "restore", id: restoreId, type: "button",
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
          alignSelf: "flex-start",
        },
        onClick: onRestore, title: t("todostrip.title"),
      }, "📋 · " + active.length + " " + t("todostrip.viewAll"));

      return React.createElement(React.Fragment, null, strip, restoreChip);
    }

    // ─── apply ───
    let __DSH_CONNECTION__ = null;
    const apply = (ctx, config) => {
      const slots = ctx.slots;
      const dshLocale = ctx.locale;
      try {
        __DSH_CONNECTION__ = ctx.connection || (ctx.get && ctx.get("connection")) || null;
      } catch (e) {}

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

      slots.inject("conversation.view", () =>
        slots.register(
          {
            name: "conversation.view",
            id: "project-brain",
            order: 35,
            label: () => "项目",
          },
          (props) => React.createElement(SidebarPreviewRoot, Object.assign({}, props, { _dshLocale: dshLocale })),
        ),
      );

      // P0.7: 注册 conversation.input.dock（composer 上方 TodoStrip）
      //   id: project-brain-todo-strip, order: 10（DSH 默认 dock 顺序）
      //   Slot 类型 list（多个 dock 共存），scope: session
      try {
        slots.inject("conversation.input.dock", () =>
          slots.register(
            {
              name: "conversation.input.dock",
              id: "project-brain-todo-strip",
              order: 10,
              label: () => "TodoStrip",
            },
            (props) => React.createElement(TodoStrip, Object.assign({}, props, { _dshLocale: dshLocale })),
          ),
        );
      } catch (e) {
        console.warn("[dsh-project-brain:client] conversation.input.dock registration failed:", e);
      }
    };

    var module = { exports: {} };
    module.exports = {
      name: "dsh-project-brain:client",
      inject: ["slots", "locale", "connection"],
      apply,
    };
    return module.exports;
  },
});
