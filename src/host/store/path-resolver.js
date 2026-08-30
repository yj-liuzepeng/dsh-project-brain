// path-resolver.js - 解析"当前项目"路径
// 解决跨项目污染：工具默认 sandboxPolicy.workspaceRoot 在静态插件下是固定的
//（profile / 插件所在 workspace），不是用户当前 session 的 workspace。
// 因此所有读写 .project-brain/ 的工具都需要从 session cwd 反推当前项目路径。
//
// 优先级：
//   1) exec.session.cwd / exec.session.meta.cwd / exec.session.header.cwd
//      （运行时 session 的当前工作目录 — 多数情况下 = 用户实际在哪个 DSH workspace）
//   2) args.path（仅在没有 live session 时使用，兼容 CLI / 旧 DSH）
//   3) sandboxPolicy.workspaceRoot（fallback，向后兼容）
//   4) "."（兜底，避免抛错）
//
// 全部容错：任一步失败立刻降级到下一步，不抛错。
//
// exec 的形状（DSH defineTool）：execute(args, exec)
//   - exec.ctx 是 Cordis context（已用 exec.ctx.emit）
//   - exec.session 在 DSH 中是 Session 对象（含 meta.cwd）
//   - exec.sessionId 是 SessionId（可用于 ctx.get('sessions').get(id) 反查）

export function readCwdFromSession(session) {
  if (!session) return null;
  try {
    const cwd = session.cwd;
    if (typeof cwd === "string" && cwd.trim()) return cwd;
    if (session.meta && typeof session.meta.cwd === "string" && session.meta.cwd.trim()) return session.meta.cwd;
    if (session.header && typeof session.header.cwd === "string" && session.header.cwd.trim()) return session.header.cwd;
    if (session.header && session.header.meta && typeof session.header.meta.cwd === "string" && session.header.meta.cwd.trim()) return session.header.meta.cwd;
  } catch (e) {}
  return null;
}

// 通过 ctx.get('sessions') 反查 sessionId 的 cwd（fallback 路径）
function readCwdFromSessionsService(ctx, sessionId) {
  if (!ctx || !sessionId) return null;
  let sessions;
  try { sessions = ctx.get ? ctx.get("sessions") : ctx.sessions; } catch (e) { return null; }
  if (!sessions || typeof sessions.get !== "function") return null;
  try {
    const session = sessions.get(sessionId);
    return readCwdFromSession(session);
  } catch (e) {
    return null;
  }
}

// 通过 agents.currentInitiator() 拿当前 session 的 cwd（更可靠，因为是发起者）
function readCwdFromInitiator(ctx) {
  if (!ctx) return null;
  let agents;
  try { agents = ctx.get ? ctx.get("agents") : ctx.agents; } catch (e) { return null; }
  if (!agents || typeof agents.currentInitiator !== "function") return null;
  let agent;
  try { agent = agents.currentInitiator(); } catch (e) { return null; }
  if (!agent) return null;
  // Agent 通常有 session / sessionId 字段
  try {
    if (agent.session) {
      const c = readCwdFromSession(agent.session);
      if (c) return c;
    }
    if (agent.sessionId && agents.requireInitiator) {
      // 通过 sessionId 直接取 session 也不可靠（无 get）— 略
    }
    if (agent.header && agent.header.meta) {
      const c = agent.header.meta.cwd;
      if (typeof c === "string" && c.trim()) return c;
    }
    if (agent.meta && typeof agent.meta.cwd === "string" && agent.meta.cwd.trim()) {
      return agent.meta.cwd;
    }
  } catch (e) {}
  return null;
}

// v0.3.8：从 workspaceRegistry 拿当前 session 所属 workspace 的 path
//   fallback 时如果 sandboxPolicy.workspaceRoot 是 DSH Desktop 安装目录，
//   遍历 workspaceRegistry 拿所有 workspaces，选"非 DSH Desktop"的第一个
function readCwdFromWorkspaceRegistry(ctx) {
  if (!ctx) return null;
  let wr;
  try { wr = ctx.get ? ctx.get("workspaceRegistry") : ctx.workspaceRegistry; } catch (e) { return null; }
  if (!wr) return null;
  // 试 sessions 找当前 session id，再反查
  try {
    const sessions = ctx.get ? ctx.get("sessions") : ctx.sessions;
    if (sessions && sessions.list) {
      const list = sessions.list() || [];
      // 拿最近的 session 的 cwd，再找对应 workspace
      for (const session of list) {
        const cwd = readCwdFromSession(session);
        if (cwd) return cwd;
      }
    }
  } catch (e) {}
  return null;
}

// v0.3.8：探测 DSH Desktop 安装路径（典型：<user-home>/AppData/Local/Programs/DSH Desktop）
//   凡是命中这个模式的 sandboxPolicy.workspaceRoot 都不可信，应跳过
function isDshDesktopInstall(p) {
  if (!p || typeof p !== "string") return false;
  // Windows 路径："...AppData\Local\Programs\DSH Desktop" 或 "...Programs/DSH Desktop"
  if (/[\\/]Programs[\\/]DSH Desktop$/i.test(p)) return true;
  // Mac: "/Applications/DSH Desktop.app/..."
  if (/[\\/]DSH Desktop\.app/.test(p)) return true;
  return false;
}

// v0.3.9：过滤 DSH Desktop 安装路径（所有步骤都查一遍）
function safeCwd(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) return null;
  const value = cwd.trim();
  if (value.includes("\u0000") || value === "/" || /^[A-Za-z]:[\\/]?$/.test(value)) return null;
  if (isDshDesktopInstall(value)) return null;
  return value;
}

export function resolveProjectPath(args, exec, sandboxPolicy) {
  // 1) 从 exec 推断 live session cwd。发布版默认只操作当前会话项目，
  //    不能让模型通过 args.path 把读写重定向到另一个工作区。
  try {
    // 1a) exec.session 直接有 cwd
    const direct = safeCwd(readCwdFromSession(exec && exec.session));
    if (direct) return direct;
    // 1b) exec.ctx 上挂的 session
    const ctxSession = exec && exec.ctx && (exec.ctx.session || (exec.ctx.agent && exec.ctx.agent.session));
    const ctxCwd = safeCwd(readCwdFromSession(ctxSession));
    if (ctxCwd) return ctxCwd;
    // 1c) sessionId + sessions service
    const sid = exec && (exec.sessionId || (exec.session && exec.session.id));
    const ctx = exec && (exec.ctx || null);
    const svcCwd = safeCwd(readCwdFromSessionsService(ctx, sid));
    if (svcCwd) return svcCwd;
    // 1d) 通过 agents.currentInitiator() 拿当前 session
    const initiatorCwd = safeCwd(readCwdFromInitiator(ctx));
    if (initiatorCwd) return initiatorCwd;
  } catch (e) {}

  // 2) 无 live session 时才接受显式 path（CLI / 测试 / 旧宿主兼容）。
  try {
    const explicit = args && typeof args.path === "string" && args.path.trim();
    if (explicit) {
      const safe = safeCwd(explicit.trim());
      return safe || ".";
    }
  } catch (e) {}

  // 不再遍历 workspaceRegistry 并选择“第一个/最近一个” workspace。
  // 多项目环境中该猜测会造成最危险的静默串写；宁可返回明确错误。

  // 3) sandboxPolicy.workspaceRoot fallback（跳过 DSH Desktop 安装目录污染）
  try {
    if (sandboxPolicy && typeof sandboxPolicy.workspaceRoot === "string" && sandboxPolicy.workspaceRoot.trim()) {
      const root = sandboxPolicy.workspaceRoot;
      const safe = safeCwd(root);
      if (safe) return safe;
      // DSH Desktop 安装路径不可信：返回 "."
    }
  } catch (e) {}

  // 4) 兜底
  //    v0.3.10：如果所有 fallback 都失败（或都是 DSH Desktop 污染），返回 "."（兼容旧行为）
  //    工具层可检测 . 路径 + 提示用户传 path（但默认行为：写到 process.cwd()/.project-brain/）
  console.warn("[dsh-project-brain:path-resolver] All fallback cwd candidates were DSH Desktop installs (or missing). User should pass args.path explicitly.");
  return ".";
}

// v0.3.10：tool 辅助函数：检测 path-resolver 的返回结果并打包友好错误
export function resolveProjectOrFail(args, exec, sandboxPolicy) {
  const path = resolveProjectPath(args, exec, sandboxPolicy);
  if (path === ".") {
    // 兜底路径：所有 fallback 都被 DSH Desktop 过滤 → 工具将写到 process.cwd() 下的 .project-brain/
    return {
      __noPath: true,
      __fallbackPath: ".",
      error: {
        code: "E_NO_PATH_RESOLVED",
        message: "无法解析项目路径（所有 fallback 都被 DSH Desktop 安装路径过滤或缺失）。当前会写到 process.cwd()/.project-brain/，请显式传 path 参数。",
      },
    };
  }
  return { __noPath: false, path };
}
