// Preview HTTP route - 动态按当前 workspace 读 .project-brain/ 数据
// P0.4.5：修"切换 workspace 不更新"问题
//
// 路径：GET /dsh-project-brain/preview.json（避开 /plugins/ 前缀，避开 DSH 静态 server fallback 抢先 404）
// 行为：
//   ① 优先用 client 传的 ?session=<sessionId> 反查当前 workspace 的 cwd（sessions.get(sessionId).meta.cwd）
//   ② 反查失败则 fallback 到 sandboxPolicy.workspaceRoot
//   已生成 -> 返回完整 preview 数据；未生成 -> 返回 { initialized:false }（Onboarding）
// 关键：读文件是纯 IO，零 token；用 danger-full-access 模式避免 cordis fiber 启动时的
// workspaceRoot 限制（之前 commit c14ae42 已经验证了此 pattern 写入可用）
//
// webServer / sessions 来自 host service（ctx.get 探测，避免 dshmarket 子 fiber 缺失抛错）。

import { buildWorkspacePreview } from "../sidebar/aggregator.js";

function log(logger, level, msg) {
  try {
    if (logger && typeof logger[level] === "function") logger[level]("[dsh-project-brain] " + msg);
    else if (typeof console !== "undefined") console.log("[dsh-project-brain] " + msg);
  } catch (e) {}
}

// 从 sessionId 反查当前 workspace 的 cwd（若 sessions service 可用）
function sessionCwd(sessions, sessionId) {
  if (!sessions || !sessionId) return null;
  try {
    const session = sessions.get ? sessions.get(sessionId) : null;
    if (!session) return null;
    // SessionHeader 的 cwd 可能在 meta / header 字段，容错取
    return (session.meta && session.meta.cwd) || (session.header && session.header.cwd) || (session.cwd) || null;
  } catch (e) {
    return null;
  }
}

export function registerPreviewRoute({ ctx, fs, sandboxPolicy, logger }) {
  const disposers = [];

  let webServer;
  try { webServer = ctx.get ? ctx.get("webServer") : ctx.webServer; } catch (e) { webServer = undefined; }
  // 探测 sessions service（不强制要 writePolicy —— buildWorkspacePreview 只读）
  let sessions;
  try { sessions = ctx.get ? ctx.get("sessions") : ctx.sessions; } catch (e) { sessions = undefined; }

  log(logger, "info", "[diagnose] webServer available: " + (!!webServer && typeof webServer.register === "function"));
  log(logger, "info", "[diagnose] sessions service available: " + (!!sessions));
  if (!webServer || typeof webServer.register !== "function") {
    log(logger, "warn", "[diagnose] webServer unavailable, preview route NOT registered");
    return disposers;
  }

  // v0.3.3：改用 prefix 路由 + 更独特的路径（避开 DSH frontend-static 的 SPA fallback 抢先 404）
  //   - 路径用 /__dsh_brain__/... （下划线命名空间，DSH 内部约定，不易冲突）
  //   - kind: "prefix" 比 "exact" 容错；exact 要求绝对匹配，prefix 匹配 p/* 任意子路径
  const ROUTE_PATH = "/__dsh_brain__/preview.json";

  try {
    const route = {
      kind: "prefix",
      path: ROUTE_PATH,
      handler: async (req, res) => {
        try {
          // 优先用 client 传的 session 反查当前 workspace；否则 fallback 到 sandboxPolicy.workspaceRoot
          let wsRoot = null;
          let sessionId = null;
          try {
            if (req && req.url) {
              const qIdx = req.url.indexOf("?");
              if (qIdx >= 0) {
                const params = new URLSearchParams(req.url.slice(qIdx + 1));
                sessionId = params.get("session");
                if (sessionId) wsRoot = sessionCwd(sessions, sessionId);
              }
            }
          } catch (e) { /* ignore */ }
          if (!wsRoot) wsRoot = (sandboxPolicy && sandboxPolicy.workspaceRoot) || ".";

          // v0.3.2 诊断：写一个 hit-marker 文件到 .project-brain/，方便验证 route 是否被调到
          // （DSH Desktop 下 fetch 走 IPC 桥可能不通，这个 marker 是关键诊断信号）
          try {
            const markerPath = (wsRoot || ".").replace(/[\\/]+$/, "") + "/.project-brain/.webserver-last-hit.json";
            const marker = {
              hitAt: Date.now(),
              sessionId: sessionId,
              workspaceRoot: wsRoot,
              url: req && req.url,
              method: req && req.method,
            };
            // 异步写、不阻塞响应（即使失败也不影响主响应）
            const target = await fs.resolve(markerPath);
            fs.writeText(target, JSON.stringify(marker, null, 2)).catch(() => {});
          } catch (e) { /* ignore marker write */ }

          log(logger, "info", "[diagnose] preview.json request, resolved workspaceRoot=" + wsRoot);
          const data = await buildWorkspacePreview(fs, wsRoot);
          log(logger, "info", "[diagnose] preview.json ok, initialized=" + data.initialized + ", name=" + ((data.project && data.project.name) || "(none)"));
          res.statusCode = 200;
          res.setHeader("content-type", "application/json; charset=utf-8");
          // CORS for Electron WebView / browser
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(data));
        } catch (e) {
          log(logger, "error", "[diagnose] preview.json handler error: " + String((e && e.message) || e));
          try {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
          } catch (e2) { /* res already closed */ }
        }
      },
    };
    const disposer = webServer.register(route);
    disposers.push(disposer);
    log(logger, "info", "[diagnose] preview route registered: " + ROUTE_PATH);
  } catch (e) {
    log(logger, "warn", "[diagnose] preview route registration failed: " + String((e && e.message) || e));
  }

  return disposers;
}
