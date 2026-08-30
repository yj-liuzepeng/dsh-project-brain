// SidebarPreview RPC handlers
// - project_brain/sidebar.getPreview: 按 sessionId 反查 cwd，聚合数据（5 区块）
// - project_brain/initProject: 桥接 project_init tool（给 Onboarding 按钮用）
// - project_brain/continueSession: 桥接 project_continue tool（给"继续上次开发"按钮用）
//
// harness 来自 host builtin（DSH 启动时 cordis-loader 注入）。
// dshmarket 热挂载的子 fiber 不注入 host builtin，所以 harness 可能 undefined。
// 这里做降级：harness 缺失时仅 warn，不注册 RPC，apply 不会抛错。
// ctx 用于可选探测 sessions service（按 sessionId 反查 cwd 拿到"当前 workspace"）。

import { buildSidebarPreview, buildWorkspacePreview, invalidateAggregatorCache } from "../sidebar/aggregator.js";
import { scanAndWrite } from "../../tools.js";
import { publicMemoryConfig } from "../memory/config.js";
import { resolveSessionRoute } from "../architecture/analyzer.js";

export const PROJECT_BRAIN_RPC_CHANNEL = "/project-brain";

export function getCwdBySession(ctx, sessionId) {
  if (!sessionId) return null;
  let sessions;
  try { sessions = ctx.get ? ctx.get("sessions") : ctx.sessions; } catch (e) { sessions = undefined; }
  if (!sessions || typeof sessions.get !== "function") return null;
  try {
    const session = sessions.get(sessionId);
    if (!session) return null;
    return (session.meta && session.meta.cwd) || (session.header && session.header.cwd) || (session.cwd) || null;
  } catch (e) {
    return null;
  }
}

function getSession(ctx, sessionId) {
  if (!sessionId) return null;
  let sessions;
  try { sessions = ctx.get ? ctx.get("sessions") : ctx.sessions; } catch (e) { sessions = null; }
  try { return sessions && typeof sessions.get === "function" ? sessions.get(sessionId) : null; } catch (e) { return null; }
}

function rpcOk(value) {
  return { ok: true, value };
}

function rpcError(code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      details: details && typeof details === "object" ? details : {},
    },
  };
}

function resolveRpcProjectPath(ctx, payload) {
  // Never trust a browser-provided filesystem path. The live Session header is
  // the authority for project isolation; it was created by DSH Host and cannot
  // be redirected by a crafted Client request.
  return getCwdBySession(ctx, payload && payload.sessionId);
}

/**
 * Register the supported Client↔Host bridge on DSH's canonical Connection RPC.
 * Unlike the build-time session map, this resolves the live Session header on
 * every request, so Sessions created after the bundle was built work without a
 * rebuild or a Desktop restart.
 */
export function registerConnectionRpc({ connection, ctx, fs, sandboxPolicy, tools, logger, getMemoryConfig, getLlm }) {
  if (!connection || !connection.rpc || typeof connection.rpc.handle !== "function") {
    if (logger && typeof logger.warn === "function") {
      logger.warn("[dsh-project-brain] connection.rpc unavailable; runtime preview disabled");
    }
    return false;
  }

  connection.rpc.handle(
    PROJECT_BRAIN_RPC_CHANNEL,
    async (endpoint, payload) => {
      const projectPath = resolveRpcProjectPath(ctx, payload || {});
      const session = getSession(ctx, payload && payload.sessionId);
      const architectureRuntime = {
        getMemoryConfig,
        getLlm,
        llmRoute: resolveSessionRoute(session),
        getLlmRoute: () => resolveSessionRoute(getSession(ctx, payload && payload.sessionId)),
        sessionId: payload && payload.sessionId,
      };
      if (!projectPath) {
        return rpcError(
          "WORKSPACE_NOT_FOUND",
          "无法从当前 Session 解析 workspace 路径",
          { sessionId: payload && payload.sessionId ? payload.sessionId : null },
        );
      }

      if (endpoint === "preview") {
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          projectPath,
          preview,
        });
      }

      if (endpoint === "init") {
        const result = await scanAndWrite(
          fs,
          sandboxPolicy,
          { path: projectPath, dryRun: false },
          "project_init",
          architectureRuntime,
        );
        if (!result || !result.ok) {
          const error = result && result.data && result.data.error;
          return rpcError(
            (error && error.code) || "INIT_FAILED",
            (error && error.message) || "项目大脑初始化失败",
            { projectPath },
          );
        }
        invalidateAggregatorCache(projectPath);
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          projectPath,
          scan: result.data,
          preview,
        });
      }

      if (endpoint === "action") {
        const action = payload && typeof payload.action === "string" ? payload.action : "";
        const toolActions = {
          todos: { name: "project_todo_list", args: { limit: 50 }, mutates: false },
          dream: { name: "project_dream", args: { mode: "light", dryRun: true }, mutates: false },
          dreamCommit: { name: "project_dream", args: { mode: "light", dryRun: false }, mutates: true },
          overview: { name: "project_continue", args: {}, mutates: false },
        };

        // Rescan uses the same trusted host-side implementation as onboarding.
        // The browser supplies only an action name; the project path always comes
        // from the live Session header above.
        if (action === "rescan") {
          const result = await scanAndWrite(
            fs,
            sandboxPolicy,
            { path: projectPath, dryRun: false },
            "project_rescan",
            architectureRuntime,
          );
          if (!result || !result.ok) {
            const error = result && result.data && result.data.error;
            return rpcError(
              (error && error.code) || "RESCAN_FAILED",
              (error && error.message) || "重新扫描失败",
              { action, projectPath },
            );
          }
          invalidateAggregatorCache(projectPath);
          const preview = await buildWorkspacePreview(fs, projectPath);
          preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
          return rpcOk({
            action,
            projectPath,
            result,
            preview,
          });
        }

        const definition = toolActions[action];
        if (!definition) {
          return rpcError("ACTION_NOT_ALLOWED", "不支持的 Project Brain 操作：" + action, { action });
        }
        if (!tools || typeof tools.execute !== "function") {
          return rpcError("TOOLS_UNAVAILABLE", "DSH tools service unavailable", { action });
        }

        let result;
        try {
          result = await tools.execute({
            name: definition.name,
            args: Object.assign({}, definition.args, { path: projectPath }),
          });
        } catch (error) {
          return rpcError(
            "ACTION_FAILED",
            String((error && error.message) || error),
            { action, tool: definition.name },
          );
        }
        if (!result || result.ok === false) {
          const nested = result && result.data && result.data.error;
          return rpcError(
            (nested && nested.code) || (result && result.code) || "ACTION_FAILED",
            (nested && nested.message) || (result && result.message) || "操作执行失败",
            { action, tool: definition.name },
          );
        }
        if (definition.mutates) invalidateAggregatorCache(projectPath);
        const preview = await buildWorkspacePreview(fs, projectPath);
        preview.retrieval = publicMemoryConfig(getMemoryConfig ? getMemoryConfig() : {});
        return rpcOk({
          action,
          projectPath,
          result,
          preview,
        });
      }

      return rpcError("METHOD_NOT_FOUND", "未知 Project Brain RPC 方法：" + endpoint, { endpoint });
    },
    { authority: "loopback" },
  );
  return true;
}

export function registerSidebarRpc({ harness, ctx, fs, tools, getDefaultProjectPath, logger }) {
  const disposers = [];

  if (!harness || typeof harness.handle !== "function") {
    (logger && typeof logger.warn === "function"
      ? logger
      : { warn: (m) => console.warn(m) }
    ).warn("[dsh-project-brain] harness builtin unavailable, skip RPC registration (host-side features will not work; restart DSH to load normally)");
    return disposers;
  }

  // 1) SidebarPreview 数据
  //    优先按 sessionId 反查当前 workspace 的 cwd（避免 sandboxPolicy.workspaceRoot 是固定值的坑）
  //    回退 getDefaultProjectPath（sandboxPolicy.workspaceRoot）
  const getPreviewDisposer = harness.handle("project_brain/sidebar.getPreview", async (args) => {
    let projectPath = null;
    try {
      if (args && args.sessionId) {
        projectPath = getCwdBySession(ctx, args.sessionId);
      }
    } catch (e) { /* ignore */ }
    if (!projectPath) projectPath = getDefaultProjectPath();
    return buildSidebarPreview(projectPath);
  });
  disposers.push(getPreviewDisposer);

  // 2) 桥接 project_init tool（Onboarding 启动按钮）
  //    v0.5.1 修复：支持 sessionId fallback——当 args.path 缺失时（常见于 build-time
  //    sessionToWorkspaceId map miss 的全新 workspace），用 args.sessionId 反查 cwd
  //    （getCwdBySession 已存在，避免每个新建 workspace 都必须先重启 DSH 让 build 重新纳入）
  const initDisposer = harness.handle("project_brain/initProject", async (args) => {
    if (!tools || typeof tools.execute !== "function") {
      return { ok: false, code: "E_NO_TOOLS", message: "tools service unavailable" };
    }
    const userArgs = Object.assign({}, (args && args.args) || {});
    if (!userArgs.path && userArgs.sessionId) {
      try {
        const resolved = getCwdBySession(ctx, userArgs.sessionId);
        if (resolved) {
          userArgs.path = resolved;
          if (ctx && ctx.logger && typeof ctx.logger.info === "function") {
            try { ctx.logger.info("[dsh-project-brain] initProject: sessionId " + String(userArgs.sessionId).slice(0, 12) + "… → cwd " + resolved); } catch (e) {}
          }
        }
      } catch (e) { /* ignore */ }
    }
    try {
      const result = await tools.execute({
        name: "project_init",
        args: userArgs,
      });
      // project_init 内部已 emit preview.changed；缓存会通过 ctx.on('project_brain/preview.changed') 清空
      return result;
    } catch (e) {
      return { ok: false, code: "E_INIT_FAILED", message: String((e && e.message) || e) };
    }
  });
  disposers.push(initDisposer);

  // 3) 桥接 project_continue tool（"继续上次开发"按钮）
  const continueDisposer = harness.handle("project_brain/continueSession", async (args) => {
    if (!tools || typeof tools.execute !== "function") {
      return { ok: false, code: "E_NO_TOOLS", message: "tools service unavailable" };
    }
    try {
      const result = await tools.execute({
        name: "project_continue",
        args: (args && args.args) || {},
      });
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, code: "E_CONTINUE_FAILED", message: String((e && e.message) || e) };
    }
  });
  disposers.push(continueDisposer);

  return disposers;
}
