(() => {
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
          "arch.select": "\u70B9\u51FB\u6A21\u5757\u67E5\u770B\u804C\u8D23\u4E0E\u6587\u4EF6",
          "arch.flows": "\u5173\u952E\u6D41\u7A0B",
          "arch.risks": "\u67B6\u6784\u63D0\u793A",
          "arch.purpose": "\u9879\u76EE\u5B9A\u4F4D",
          "arch.style": "\u67B6\u6784\u98CE\u683C",
          "arch.layers": "\u67B6\u6784\u5206\u5C42",
          "arch.components": "\u6838\u5FC3\u7EC4\u4EF6",
          "arch.keyFiles": "\u5173\u952E\u6587\u4EF6\u5BFC\u89C8",
          "arch.start": "\u5FEB\u901F\u719F\u6089\u8DEF\u5F84",
          "arch.highlights": "\u8BBE\u8BA1\u8981\u70B9",
          "arch.trigger": "\u89E6\u53D1",
          "arch.outcome": "\u7ED3\u679C",
          "arch.llmFallback": "DSH LLM \u672A\u5B8C\u6210\uFF0C\u5F53\u524D\u5C55\u793A\u672C\u5730\u63A8\u65AD",
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
          "onboarding.body": "\u542F\u52A8\u540E\u5C06\u81EA\u52A8\u751F\u6210\u9879\u76EE\u7ED3\u6784\u3001\u6280\u672F\u6808\u3001\u67B6\u6784\u56FE\uFF0C\u6301\u7EED\u8BB0\u5F55\u5F00\u53D1\u5386\u53F2\u4E0E\u51B3\u7B56\uFF0C\u8DE8 Session \u81EA\u52A8\u6062\u590D\u4E0A\u4E0B\u6587\u3002",
          "onboarding.cta": "\u542F\u52A8\u9879\u76EE\u5927\u8111 /project_init",
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
          "dash.entry": "\u5F00\u53D1\u5165\u53E3",
          "dash.todo": "\u5F85\u529E\uFF08\u5168\u90E8\uFF09",
          "dash.timeline": "\u65F6\u95F4\u7EBF",
          "dash.memory": "\u9879\u76EE\u8BB0\u5FC6\uFF08\u5168\u90E8\uFF09",
          "dash.tab.overview": "\u6982\u89C8",
          "dash.tab.architecture": "\u67B6\u6784",
          "dash.tab.work": "\u4EFB\u52A1\u52A8\u6001",
          "dash.tab.knowledge": "\u9879\u76EE\u8BB0\u5FC6",
          "dash.snapshot": "\u6570\u636E\u5FEB\u7167 \xB7 {time}",
          "dash.none": "\uFF08\u7A7A\uFF09",
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
          "todostrip.empty": "\u{1F389} No active TODOs",
          "onboarding.title": "Project Brain not started",
          "onboarding.body": "After startup, it will auto-generate structure, tech stack, architecture, keep recording history & decisions, and restore context across sessions.",
          "onboarding.cta": "Start Project Brain /project_init",
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
          "dash.entry": "Entrypoints",
          "dash.todo": "TODO (all)",
          "dash.timeline": "Timeline",
          "dash.memory": "Memories (all)",
          "dash.tab.overview": "Overview",
          "dash.tab.architecture": "Architecture",
          "dash.tab.work": "Work & activity",
          "dash.tab.knowledge": "Knowledge",
          "dash.snapshot": "Data snapshot \xB7 {time}",
          "dash.none": "(empty)",
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
        const known = !sid || !!wsId;
        let hint = "";
        if (!known) {
          hint = `\u5F53\u524D sessionId "${String(sid).slice(0, 12)}\u2026" \u4E0D\u5728 build \u65F6\u6536\u96C6\u7684 sessionToWorkspaceId \u6620\u5C04\u91CC\uFF08build \u4E4B\u540E\u65B0\u5EFA\u7684 session\uFF09\u3002\u5BA2\u6237\u7AEF\u5C06\u81EA\u52A8\u4ECE host \u515C\u5E95\u89E3\u6790 workspace \u8DEF\u5F84\u3002`;
        } else if (sid && !picked) {
          hint = `workspaceId \u5DF2\u77E5\uFF08${wsId}\uFF0Cpath=${wsPath}\uFF09\u4F46 .project-brain \u8FD8\u6CA1\u751F\u6210\uFF0C\u8BF7\u5728\u8BE5 workspace \u8C03\u7528 project_init \u5DE5\u5177\u3002`;
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
              _hint: hint
            },
            workspaceId: wsId,
            workspacePath: wsPath,
            sessionId: sid,
            hint,
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
        const langItems = Object.entries(cg.stats.languages || {}).map(
          ([lang, count]) => React.createElement(
            "span",
            { key: lang, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
            React.createElement("span", null, lang),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, " \xB7 " + count)
          )
        );
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
        const typeIcons = { presentation: "\u{1F5A5}\uFE0F", ui: "\u{1F5A5}\uFE0F", interface: "\u{1F50C}", api: "\u{1F50C}", application: "\u{1F9ED}", service: "\u2699\uFE0F", domain: "\u{1F9E0}", core: "\u{1F9E0}", data: "\u{1F5C4}\uFE0F", integration: "\u{1F517}", support: "\u{1F6E0}\uFE0F" };
        const layerRows = layers.length ? layers : [{ id: "all", name: t("arch.components"), responsibility: "", order: 0 }];
        const componentsForLayer = (layer) => layers.length ? components.filter((item) => item.layerId === layer.id) : components;
        const panelStyle = { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "9px", background: "var(--dsw-alias-bg-layer-2)", padding: "10px" };
        const smallTitle = { fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "var(--dsw-alias-label-primary)" };
        return React.createElement(
          "section",
          { style: embedded ? { color: "var(--dsw-alias-label-primary)" } : sectionStyle, "data-block": "architecture-graph", "data-architecture-schema": architecture.schemaVersion || 1 },
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } },
            React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { flex: "1 1 auto", margin: 0 }) }, "\u{1F3DB}\uFE0F " + t("arch.title")),
            React.createElement("span", { style: { fontSize: "10px", padding: "3px 8px", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l1)", color: architecture.source === "hybrid" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)" } }, sourceLabel)
          ),
          architecture.llm && architecture.llm.requested && !architecture.llm.used && architecture.llm.error ? React.createElement("div", { title: architecture.llm.error.message || architecture.llm.error.code, style: { fontSize: "10px", padding: "6px 8px", marginBottom: "8px", borderRadius: "7px", color: "var(--dsw-alias-state-warn-primary)", border: "1px solid var(--dsw-alias-state-warn-primary)" } }, "\u26A0\uFE0F " + t("arch.llmFallback") + " \xB7 " + (architecture.llm.error.code || "LLM_ERROR")) : null,
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(180px, 1fr)", gap: "8px", marginBottom: "10px" } },
            React.createElement(
              "div",
              { style: panelStyle },
              React.createElement("div", { style: smallTitle }, "\u{1F3AF} " + t("arch.purpose")),
              React.createElement("div", { style: { fontSize: "13px", lineHeight: 1.65 } }, overview.purpose || architecture.summary || ""),
              overview.value ? React.createElement("div", { style: { marginTop: "6px", fontSize: "11px", lineHeight: 1.5, color: "var(--dsw-alias-label-secondary)" } }, overview.value) : null
            ),
            React.createElement(
              "div",
              { style: panelStyle },
              React.createElement("div", { style: smallTitle }, "\u{1F3D7}\uFE0F " + t("arch.style")),
              React.createElement("div", { style: { fontSize: "13px", fontWeight: 700 } }, overview.architectureStyle || "\u2014"),
              React.createElement("div", { style: { marginTop: "6px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, [overview.category, overview.audience].filter(Boolean).join(" \xB7 "))
            )
          ),
          architecture.summary && architecture.summary !== overview.purpose ? React.createElement("div", { style: { fontSize: "12px", lineHeight: 1.65, color: "var(--dsw-alias-label-secondary)", margin: "0 2px 10px" } }, architecture.summary) : null,
          React.createElement(
            "div",
            { style: Object.assign({}, panelStyle, { padding: "10px 10px 4px", background: "var(--dsw-alias-bg-layer-1)" }), "data-architecture-diagram": "semantic-layers" },
            React.createElement("div", { style: Object.assign({}, smallTitle, { marginBottom: "9px" }) }, "\u{1F9F1} " + t("arch.layers")),
            layerRows.map((layer, layerIndex) => {
              const items = componentsForLayer(layer);
              if (!items.length) return null;
              return React.createElement(
                "div",
                { key: layer.id, style: { display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", gap: "10px", padding: "9px", marginBottom: "7px", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", background: layerIndex % 2 === 0 ? "var(--dsw-alias-bg-layer-2)" : "var(--dsw-alias-bg-layer-1)" } },
                React.createElement(
                  "div",
                  { style: { borderRight: "1px solid var(--dsw-alias-border-l1)", paddingRight: "9px" } },
                  React.createElement("div", { style: { fontSize: "12px", fontWeight: 750, marginBottom: "4px" } }, layer.name),
                  React.createElement("div", { style: { fontSize: "9px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, layer.responsibility || "")
                ),
                React.createElement(
                  "div",
                  { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "7px" } },
                  items.map((component) => {
                    const active = component.id === selected.id;
                    return React.createElement(
                      "button",
                      { key: component.id, type: "button", onClick: () => setSelectedId(component.id), "data-architecture-component": component.id, style: { textAlign: "left", padding: "9px 10px", borderRadius: "8px", border: (active ? "2px solid " : "1px solid ") + (active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l2)"), background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", cursor: "pointer", fontFamily: "inherit", minHeight: "76px" } },
                      React.createElement("div", { style: { fontSize: "12px", fontWeight: 750, marginBottom: "4px" } }, (typeIcons[component.type] || "\u25C6") + " " + (component.name || component.label)),
                      React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, String(component.responsibility || component.description || "").slice(0, 150))
                    );
                  })
                )
              );
            }),
            relationships.length ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px", padding: "2px 0 7px" } }, relationships.slice(0, 14).map((relation) => {
              const from = byId.get(relation.from);
              const to = byId.get(relation.to);
              if (!from || !to) return null;
              const active = relation.from === selected.id || relation.to === selected.id;
              return React.createElement("span", { key: relation.id, title: relation.description || relation.label, style: { fontSize: "9px", padding: "3px 7px", borderRadius: "10px", border: "1px solid " + (active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l1)"), color: active ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)" } }, (from.name || from.label) + " \u2192 " + (relation.label || "\u8C03\u7528") + " \u2192 " + (to.name || to.label));
            })) : null
          ),
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, .8fr)", gap: "9px", marginTop: "9px" } },
            React.createElement(
              "div",
              { style: panelStyle },
              React.createElement("div", { style: { fontSize: "14px", fontWeight: 750, marginBottom: "5px" } }, (typeIcons[selected.type || selected.kind] || "\u25C6") + " " + (selected.name || selected.label)),
              React.createElement("div", { style: { fontSize: "11px", lineHeight: 1.6 } }, selected.responsibility || selected.description || ""),
              selected.details ? React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.55, marginTop: "5px" } }, selected.details) : null,
              (selected.technologies || []).length ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "7px" } }, selected.technologies.map((item) => React.createElement("span", { key: item, style: { fontSize: "9px", padding: "2px 6px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" } }, item))) : null,
              (selected.importantFiles || selected.files || []).length ? React.createElement(
                "div",
                { style: { marginTop: "8px" } },
                React.createElement("div", { style: smallTitle }, "\u{1F4C4} " + t("arch.keyFiles")),
                (selected.importantFiles || selected.files || []).slice(0, 8).map((file) => React.createElement("code", { key: file, style: { display: "block", fontSize: "9px", padding: "3px 6px", marginBottom: "3px", borderRadius: "4px", background: "var(--dsw-alias-bg-layer-1)", wordBreak: "break-all" } }, file))
              ) : null,
              related.length ? React.createElement("div", { style: { marginTop: "7px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, related.slice(0, 5).map((item) => item.description || item.label).filter(Boolean).join("\uFF1B")) : null
            ),
            React.createElement(
              "div",
              { style: panelStyle },
              React.createElement("div", { style: smallTitle }, "\u27A1\uFE0F " + t("arch.flows")),
              flows.length ? flows.map((flow) => React.createElement(
                "div",
                { key: flow.id, style: { padding: "6px 0", borderBottom: "1px solid var(--dsw-alias-border-l1)" } },
                React.createElement("div", { style: { fontSize: "11px", fontWeight: 700 } }, flow.name || flow.label),
                React.createElement("div", { style: { fontSize: "9px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.5, marginTop: "3px" } }, [flow.trigger ? t("arch.trigger") + "\uFF1A" + flow.trigger : "", flow.outcome ? t("arch.outcome") + "\uFF1A" + flow.outcome : ""].filter(Boolean).join(" \xB7 ")),
                React.createElement("div", { style: { fontSize: "9px", lineHeight: 1.5, marginTop: "3px" } }, (flow.steps || []).map((step) => typeof step === "string" ? byId.get(step) && (byId.get(step).name || byId.get(step).label) : (byId.get(step.componentId) && (byId.get(step.componentId).name || byId.get(step.componentId).label)) + (step.action ? "\uFF1A" + step.action : "")).filter(Boolean).join(" \u2192 "))
              )) : React.createElement("div", { style: { fontSize: "10px", color: "var(--dsw-alias-label-secondary)" } }, t("dash.none"))
            )
          ),
          (architecture.keyFiles || []).length ? React.createElement(
            "div",
            { style: Object.assign({}, panelStyle, { marginTop: "9px" }) },
            React.createElement("div", { style: smallTitle }, "\u{1F5FA}\uFE0F " + t("arch.keyFiles")),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "6px" } }, architecture.keyFiles.slice(0, 12).map((file) => React.createElement(
              "div",
              { key: file.path, style: { padding: "7px", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "7px", background: "var(--dsw-alias-bg-layer-1)" } },
              React.createElement("code", { style: { fontSize: "10px", fontWeight: 700, wordBreak: "break-all" } }, file.path),
              React.createElement("div", { style: { fontSize: "10px", marginTop: "3px", lineHeight: 1.45 } }, file.role),
              React.createElement("div", { style: { fontSize: "9px", marginTop: "2px", color: "var(--dsw-alias-label-secondary)", lineHeight: 1.45 } }, file.whyImportant)
            )))
          ) : null,
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", marginTop: "9px" } },
            (architecture.gettingStarted || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "\u{1F680} " + t("arch.start")), architecture.gettingStarted.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, index + 1 + ". " + item))) : null,
            (architecture.designHighlights || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "\u2728 " + t("arch.highlights")), architecture.designHighlights.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, "\u2022 " + item))) : null,
            (architecture.risks || []).length ? React.createElement("div", { style: panelStyle }, React.createElement("div", { style: smallTitle }, "\u26A0\uFE0F " + t("arch.risks")), architecture.risks.slice(0, 6).map((item, index) => React.createElement("div", { key: index, style: { fontSize: "10px", lineHeight: 1.55, marginBottom: "3px" } }, "\u2022 " + item))) : null
          ),
          React.createElement("div", { style: { marginTop: "7px", fontSize: "9px", color: "var(--dsw-alias-label-secondary)" } }, (architecture.stats.layers || layers.length) + " " + t("arch.layers") + " \xB7 " + (architecture.stats.components || architecture.stats.modules || components.length) + " " + t("arch.components") + " \xB7 " + t("arch.select"))
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
              React.createElement("h3", { style: Object.assign({}, sectionTitleStyle, { margin: 0, fontSize: "15px" }) }, "\u{1FAB4} " + t("onboarding.title")),
              React.createElement("p", { style: { margin: "2px 0 0", fontSize: "12px", color: "var(--dsw-alias-label-secondary)", lineHeight: "1.5" } }, t("onboarding.body"))
            )
          ),
          React.createElement(
            "div",
            { style: { margin: "12px 0 4px", padding: "12px 16px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l1)" } },
            stepStyle("1", "\u{1F680} \u626B\u63CF\u9879\u76EE", "\u8C03\u7528 /project_init \u751F\u6210\u9879\u76EE\u5927\u8111\uFF08\u81EA\u52A8\u8BC6\u522B\u6280\u672F\u6808\u3001\u5165\u53E3\u3001\u4F9D\u8D56\uFF09"),
            stepStyle("2", "\u{1F9E0} \u8BB0\u5F55\u51B3\u7B56", "\u8C03\u7528 /project_memory_add \u6C89\u6DC0\u67B6\u6784\u51B3\u7B56\u4E0E\u5173\u952E\u53D8\u66F4"),
            stepStyle("3", "\u{1F4CB} \u7BA1\u7406\u5F85\u529E", "\u8C03\u7528 /project_todo_add \u8DDF\u8E2A\u6D3B\u8DC3\u4EFB\u52A1")
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
        const techChips = Object.entries(p.techStack || {}).map(
          ([k, v]) => React.createElement(
            "span",
            { key: k, style: { display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-brand-primary)" } }),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, k + ":"),
            React.createElement("span", { style: { fontWeight: "600" } }, String(v))
          )
        );
        const toolingChips = (p.tooling || []).map(
          (tool) => React.createElement(
            "span",
            { key: "tool-" + tool, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", null, "\u{1F6E0}\uFE0F"),
            React.createElement("span", null, String(tool))
          )
        );
        const langChips = Object.entries(p.languages || {}).map(
          ([lang, count]) => React.createElement(
            "span",
            { key: lang, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", background: "var(--dsw-alias-bg-layer-2)", borderRadius: "10px", fontSize: "11px", fontWeight: "500", marginRight: "4px", marginBottom: "4px", border: "1px solid var(--dsw-alias-border-l1)" } },
            React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-state-warn-primary)" } }),
            React.createElement("span", null, lang),
            React.createElement("span", { style: { color: "var(--dsw-alias-label-secondary)" } }, "\xB7" + count)
          )
        );
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
          { id: "knowledge", icon: "\u25C7", label: t("dash.tab.knowledge") }
        ];
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
        const memoryNode = memoriesAll.length > 0 ? React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px" } },
          memoriesAll.slice(0, 20).map((m) => React.createElement(
            "article",
            { key: m.id, style: { padding: "10px 12px", background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", minWidth: 0 } },
            React.createElement(
              "div",
              { style: { display: "flex", gap: "8px", alignItems: "center" } },
              React.createElement("span", { style: typeChipStyle }, typeLabel(m.type)),
              React.createElement("span", { style: { flex: "1 1 auto", minWidth: 0, fontSize: "12px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.title)
            ),
            m.content ? React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", marginTop: "7px", lineHeight: "1.55", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } }, String(m.content).slice(0, 360)) : null
          ))
        ) : emptyNode;
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
              dashSection("\u{1F6E0}\uFE0F", "dash.tech", techChips.length + toolingChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, techChips, toolingChips) : emptyNode),
              dashSection("\u{1F5C2}\uFE0F", "codegraph.langs", langChips.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, langChips) : emptyNode),
              dashSection("\u{1F6AA}", "dash.entry", entryItems.length > 0 ? React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" } }, entryItems) : emptyNode)
            ) : null,
            activeTab === "architecture" ? React.createElement(ArchitectureGraphBlock, { data, t, embedded: true }) : null,
            activeTab === "work" ? React.createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px", alignItems: "start" } },
              dashSection("\u{1F4CB}", "dash.todo", todoNode),
              dashSection("\u{1F4C5}", "dash.timeline", timelineNode)
            ) : null,
            activeTab === "knowledge" ? dashSection("\u{1F9E0}", "dash.memory", memoryNode) : null
          ),
          React.createElement(
            "div",
            { style: { padding: "8px 16px", fontSize: "10px", color: "var(--dsw-alias-label-secondary)", borderTop: "1px solid var(--dsw-alias-border-l1)", display: "flex", alignItems: "center", gap: "4px" } },
            React.createElement("span", null, "\u{1F552}"),
            React.createElement("span", null, t("dash.snapshot", { time: formatDate(data.generatedAt || Date.now()) }))
          )
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
        React.useEffect(() => {
          setRuntime(null);
          if (DEMO_ONBOARDING || !sid || !__DSH_CONNECTION__ || !__DSH_CONNECTION__.rpc) return void 0;
          let active = true;
          const refresh = () => {
            __DSH_CONNECTION__.rpc.call("/project-brain", "preview", { sessionId: sid }).then((result) => {
              if (!active || !result || !result.ok || !result.value) return;
              const value = result.value;
              setRuntime({
                data: value.preview,
                workspaceId: embedded.workspaceId,
                workspacePath: value.projectPath || embedded.workspacePath,
                sessionId: sid,
                hint: "",
                source: "runtime"
              });
            }).catch((error) => {
              console.warn("[dsh-project-brain] runtime preview unavailable:", error);
            });
          };
          refresh();
          const timer = setInterval(refresh, 5e3);
          return () => {
            active = false;
            clearInterval(timer);
          };
        }, [sid]);
        return [runtime || embedded, setRuntime];
      }
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
          "data-version": "v0.5.1-runtime-rpc",
          "data-workspace-id": r.workspaceId || "(none)",
          "data-workspace-path": r.workspacePath || "(none)",
          "data-session-id": (r.sessionId || "").toString().slice(0, 8),
          style: containerStyle
        };
        const dataWithLocale = Object.assign({}, data, { _localeCode: localeCode });
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
                wordBreak: "break-all"
              }
            },
            r.hint
          ) : null;
          return React.createElement(
            "div",
            containerProps,
            headerWithBadge,
            hintBlock,
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
            "@media(max-width:760px){.dsh-brain-summary-grid{grid-template-columns:1fr}.dsh-project-brain-preview [data-architecture-diagram=semantic-layers]>div{grid-template-columns:1fr!important}}",
            ".dsh-project-brain-preview button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
            ".dsh-project-brain-preview button:not(:disabled):active{transform:translateY(1px)}"
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
        const [r] = useResolvedPreview(props);
        const data = r.data;
        if (!data || !data.initialized) return null;
        const active = (data.todos || []).filter((x) => x && x.status !== "done" && x.status !== "cancelled");
        if (active.length === 0) return null;
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
          color: "var(--dsw-alias-label-primary)"
        };
        const headerStyle = {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontWeight: "600",
          fontSize: "11px",
          color: "var(--dsw-alias-label-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.6px"
        };
        const toggleBtnStyle = {
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--dsw-alias-brand-primary)",
          fontSize: "11px",
          fontFamily: "inherit",
          padding: "2px 6px",
          borderRadius: "3px"
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
            const listEl = document.getElementById(listId);
            const btn = ev && (ev.currentTarget || ev.target);
            if (!listEl) {
              if (btn) btn.textContent = "N/A";
              return;
            }
            const expanded = listEl.dataset.expanded === "1";
            if (expanded) {
              const all = listEl.querySelectorAll("[data-todo-item]");
              for (let i = 0; i < all.length; i++) {
                if (i >= 3) all[i].style.display = "none";
              }
              listEl.dataset.expanded = "0";
              if (btn) btn.textContent = active.length > 3 ? t("todostrip.viewAll") + " (" + active.length + ")" : "";
            } else {
              const all = listEl.querySelectorAll("[data-todo-item]");
              for (let i = 0; i < all.length; i++) {
                all[i].style.display = "";
              }
              listEl.dataset.expanded = "1";
              if (btn) btn.textContent = t("todostrip.close");
            }
          } catch (e) {
          }
        };
        const headerChildren = [
          React.createElement("span", { key: "t" }, "\u{1F4CC} " + t("todostrip.title") + " \xB7 " + active.length)
        ];
        if (active.length > 3) {
          headerChildren.push(
            React.createElement("button", {
              key: "btn",
              type: "button",
              style: toggleBtnStyle,
              onClick: onToggle,
              title: t("todostrip.viewAll")
            }, t("todostrip.viewAll") + " (" + active.length + ")")
          );
        }
        const items = active.map(
          (x, idx) => React.createElement(
            "div",
            {
              key: x.id,
              "data-todo-item": "1",
              style: Object.assign({}, itemStyle(idx), idx >= 3 ? { display: "none" } : {})
            },
            React.createElement("span", { style: chipStyle2(x.priority) }, t("prio." + (x.priority || "medium"))),
            React.createElement("span", { style: { flex: "1 1 auto" } }, x.title),
            x.status === "in_progress" ? React.createElement("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-state-success-primary)" } }, t("st.in_progress")) : null
          )
        );
        return React.createElement(
          "div",
          {
            id: stripId,
            "data-block": "todo-strip",
            "data-workspace-id": r.workspaceId || "",
            style: containerStyle
          },
          React.createElement("div", { style: headerStyle }, headerChildren),
          React.createElement("div", {
            id: listId,
            "data-expanded": "0",
            style: { display: "flex", flexDirection: "column" }
          }, items)
        );
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
