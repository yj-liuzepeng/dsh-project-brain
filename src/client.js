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
        "onboarding.body": "启动后将自动生成项目结构、技术栈、架构图，持续记录开发历史与决策，跨 Session 自动恢复上下文。",
        "onboarding.cta": "启动项目大脑 /project_init",
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
        "dash.snapshot": "数据快照 · {time}",
        "dash.none": "（空）",
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
        "onboarding.body": "After startup, it will auto-generate structure, tech stack, architecture, keep recording history & decisions, and restore context across sessions.",
        "onboarding.cta": "Start Project Brain /project_init",
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
        "dash.snapshot": "Data snapshot · {time}",
        "dash.none": "(empty)",
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
    function resolvePreview(props) {
      const sid = (props && props.sessionId) || null;
      const wsMap = __ALL_WORKSPACES__ || {};
      const sessionToWsId = wsMap.sessionToWorkspaceId || {};
      let wsId = sid ? sessionToWsId[sid] : null;
      let projects = (wsId && wsMap.workspaceProjects && wsMap.workspaceProjects[wsId]) || [];
      let wsPath = (wsId && wsMap.workspacePaths && wsMap.workspacePaths[wsId]) || null;
      const picked = projects.length > 0 ? projects[0] : null;
      const known = !sid || !!wsId;
      let hint = "";
      if (!known) {
        hint = `当前 sessionId "${String(sid).slice(0,12)}…" 不在 build 时收集的 sessionToWorkspaceId 映射里（build 之后新建的 session）。客户端将自动从 host 兜底解析 workspace 路径。`;
      } else if (sid && !picked) {
        hint = `workspaceId 已知（${wsId}，path=${wsPath}）但 .project-brain 还没生成，请在该 workspace 调用 project_init 工具。`;
      }
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
            _hint: hint,
          },
          workspaceId: wsId,
          workspacePath: wsPath,
          sessionId: sid,
          hint: hint,
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
      const langItems = Object.entries(cg.stats.languages || {}).map(([lang, count]) =>
        React.createElement("span", { key: lang, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
          React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
          React.createElement("span", null, lang),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, " · " + count),
        ),
      );
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

    function ArchitectureGraphBlock({ data, t, embedded }) {
      const architecture = data && data.architecture;
      const [selectedId, setSelectedId] = React.useState(null);
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
          ? React.createElement("div", { title: architecture.llm.error.message || architecture.llm.error.code, style: { fontSize: "10px", padding: "6px 8px", marginBottom: "8px", borderRadius: "7px", color: "var(--dsw-alias-state-warn-primary)", border: "1px solid var(--dsw-alias-state-warn-primary)" } }, "⚠️ " + t("arch.llmFallback") + " · " + (architecture.llm.error.code || "LLM_ERROR"))
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
        React.createElement(
          "div",
          { style: { margin: "12px 0 4px", padding: "12px 16px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" } },
          stepStyle("1", "🚀 扫描项目", "调用 /project_init 生成项目大脑（自动识别技术栈、入口、依赖）"),
          stepStyle("2", "🧠 记录决策", "调用 /project_memory_add 沉淀架构决策与关键变更"),
          stepStyle("3", "📋 管理待办", "调用 /project_todo_add 跟踪活跃任务"),
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

    function DashboardSection({ data, t, localeCode, sessionId, connection, onPreviewUpdate }) {
      const p = data.project || {};
      const todos = data.todos || [];
      const timelineAll = data.timelineAll || [];
      const memoriesAll = data.memoriesAll || [];
      const retrieval = data.retrieval || {};
      const [quickActionState, setQuickActionState] = React.useState({});
      const [activeTab, setActiveTab] = React.useState("overview");
      const rpc = connection && connection.rpc;

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
      const techChips = Object.entries(p.techStack || {}).map(([k, v]) =>
        React.createElement("span", { key: k, style: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
          React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, k + ":"),
          React.createElement("span", { style: { fontWeight: "600" } }, String(v)),
        ),
      );
      const toolingChips = (p.tooling || []).map((tool) =>
        React.createElement("span", { key: "tool-" + tool, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
          React.createElement("span", null, "🛠️"),
          React.createElement("span", null, String(tool)),
        ),
      );
      const langChips = Object.entries(p.languages || {}).map(([lang, count]) =>
        React.createElement("span", { key: lang, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
          React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-state-warn-primary)" } }),
          React.createElement("span", null, lang),
          React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, "·" + count),
        ),
      );
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
      ];
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
          activeTab === "architecture" ? React.createElement(ArchitectureGraphBlock, { data, t, embedded: true }) : null,
          activeTab === "work" ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px", alignItems: "start" } },
            dashSection("📋", "dash.todo", todoNode),
            dashSection("📅", "dash.timeline", timelineNode),
          ) : null,
          activeTab === "knowledge" ? dashSection("🧠", "dash.memory", memoryNode) : null,
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

      React.useEffect(() => {
        setRuntime(null);
        if (DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc) return undefined;
        let active = true;
        const refresh = () => {
          __DSH_CONNECTION__.rpc.call("/project-brain", "preview", { sessionId: sid })
            .then((result) => {
              if (!active || !result || !result.ok || !result.value) return;
              const value = result.value;
              setRuntime({
                data: value.preview,
                workspaceId: embedded.workspaceId,
                workspacePath: value.projectPath || embedded.workspacePath,
                sessionId: sid,
                hint: "",
                source: "runtime",
              });
            })
            .catch((error) => {
              // Keep the embedded snapshot as a graceful offline fallback.
              console.warn("[dsh-project-brain] runtime preview unavailable:", error);
            });
        };
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => { active = false; clearInterval(timer); };
      }, [sid]);

      return [runtime || embedded, setRuntime];
    }

    // ─── 根组件：Connection RPC 为主，build-time embed 为首屏/离线降级 ───
    function SidebarPreviewRoot(props) {
      const localeCode = resolveLocaleCode(props);
      const t = makeT(localeCode);
      const [r, setRuntimePreview] = useResolvedPreview(props);
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
        "data-version": "v0.5.1-runtime-rpc",
        "data-workspace-id": r.workspaceId || "(none)",
        "data-workspace-path": r.workspacePath || "(none)",
        "data-session-id": (r.sessionId || "").toString().slice(0, 8),
        style: containerStyle,
      };
      const dataWithLocale = Object.assign({}, data, { _localeCode: localeCode });

      const headerWithBadge = React.createElement(
        "section",
        { style: Object.assign({}, sectionStyle, { padding: "12px 16px" }), "data-block": "live-status" },
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" }, "data-block": "live-label" }, "dsh-project-brain"),
          React.createElement(SnapshotBadge, { data: data, t, source: r.source }),
        ),
      );

      if (!dataWithLocale.initialized) {
        const hintBlock = r.hint ? React.createElement(
          "div",
          {
            style: {
              margin: "8px 16px",
              padding: "10px 12px",
              background: "var(--dsw-alias-state-warn-primary)",
              color: "var(--dsw-alias-bg-base)",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            },
          },
          r.hint,
        ) : null;
        return React.createElement("div", containerProps,
          headerWithBadge,
          hintBlock,
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
      const [r] = useResolvedPreview(props);
      const data = r.data;
      if (!data || !data.initialized) return null;  // 未初始化项目不显示
      const active = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
      if (active.length === 0) return null;        // 无活跃 TODO 不显示（避免噪音）

      const stripId = "dsh-brain-todo-strip-" + (r.workspaceId || "default");
      const listId = "dsh-brain-todo-strip-list-" + (r.workspaceId || "default");

      const containerStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px 16px",
        margin: "0 12px 8px",
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
        fontWeight: "600",
        fontSize: "11px",
        color: "var(--dsw-alias-label-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      };
      const toggleBtnStyle = {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--dsw-alias-brand-primary)",
        fontSize: "11px",
        fontFamily: "inherit",
        padding: "2px 6px",
        borderRadius: "3px",
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

      // 折叠态：top-3 + 「查看全部 (n)」
      // 展开态：全量 + 「收起」
      const onToggle = (ev) => {
        try {
          const listEl = document.getElementById(listId);
          const btn = ev && (ev.currentTarget || ev.target);
          if (!listEl) { if (btn) btn.textContent = "N/A"; return; }
          const expanded = listEl.dataset.expanded === "1";
          if (expanded) {
            // 折叠：只保留前 3 个
            const all = listEl.querySelectorAll("[data-todo-item]");
            for (let i = 0; i < all.length; i++) {
              if (i >= 3) all[i].style.display = "none";
            }
            listEl.dataset.expanded = "0";
            if (btn) btn.textContent = active.length > 3 ? (t("todostrip.viewAll") + " (" + active.length + ")") : "";
          } else {
            // 展开：显示全部
            const all = listEl.querySelectorAll("[data-todo-item]");
            for (let i = 0; i < all.length; i++) {
              all[i].style.display = "";
            }
            listEl.dataset.expanded = "1";
            if (btn) btn.textContent = t("todostrip.close");
          }
        } catch (e) {}
      };

      const headerChildren = [
        React.createElement("span", { key: "t" }, "📌 " + t("todostrip.title") + " · " + active.length),
      ];
      if (active.length > 3) {
        headerChildren.push(
          React.createElement("button", {
            key: "btn",
            type: "button",
            style: toggleBtnStyle,
            onClick: onToggle,
            title: t("todostrip.viewAll"),
          }, t("todostrip.viewAll") + " (" + active.length + ")"),
        );
      }

      const items = active.map((x, idx) =>
        React.createElement("div", {
          key: x.id,
          "data-todo-item": "1",
          style: Object.assign({}, itemStyle(idx), idx >= 3 ? { display: "none" } : {}),
        },
          React.createElement("span", { style: chipStyle(x.priority) }, t("prio." + (x.priority || "medium"))),
          React.createElement("span", { style: { flex: "1 1 auto" } }, x.title),
          x.status === "in_progress" ? React.createElement("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-state-success-primary)" } }, t("st.in_progress")) : null,
        ),
      );

      return React.createElement("div", {
        id: stripId,
        "data-block": "todo-strip",
        "data-workspace-id": r.workspaceId || "",
        style: containerStyle,
      },
        React.createElement("div", { style: headerStyle }, headerChildren),
        React.createElement("div", {
          id: listId,
          "data-expanded": "0",
          style: { display: "flex", flexDirection: "column" },
        }, items),
      );
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
