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
import { scanAndWrite } from "../scan-and-write.js";
import { buildSuggestTool } from "../../tools/suggest.js";
import { publicMemoryConfig, normalizeMemoryConfig } from "../memory/config.js";
import { resolveSessionRoute } from "../architecture/analyzer.js";
import { probeEmbedding, probeSessionLlm } from "../settings-probe.js";
import { getGitHistory, getGitBranches, getWorkTreeChanges } from "../git/history.js";

// 把 normalizeMemoryConfig 的冻结对象转成可 JSON 序列化的普通对象（供 RPC 传回 Client）。
function sanitizeSettings(config) {
  const source = normalizeMemoryConfig(config);
  return {
    retrievalMode: source.retrievalMode,
    vectorEnabled: source.vectorEnabled,
    embeddingBaseURL: source.embeddingBaseURL,
    embeddingModel: source.embeddingModel,
    embeddingApiKeyEnv: source.embeddingApiKeyEnv,
    embeddingDimensions: source.embeddingDimensions == null ? 0 : source.embeddingDimensions,
    embeddingBatchSize: source.embeddingBatchSize,
    embeddingMaxIndexPerRun: source.embeddingMaxIndexPerRun,
    embeddingTimeoutMs: source.embeddingTimeoutMs,
    keywordWeight: source.keywordWeight,
    vectorWeight: source.vectorWeight,
    importanceWeight: source.importanceWeight,
    confidenceWeight: source.confidenceWeight,
    recencyWeight: source.recencyWeight,
    sessionSemanticMemoryEnabled: source.sessionSemanticMemoryEnabled,
    sessionSemanticMaxChars: source.sessionSemanticMaxChars,
    sessionSemanticMaxItems: source.sessionSemanticMaxItems,
    sessionSemanticTimeoutMs: source.sessionSemanticTimeoutMs,
    architectureEnabled: source.architectureEnabled,
    architectureLlmEnabled: source.architectureLlmEnabled,
    architectureLlmIncludeSource: source.architectureLlmIncludeSource,
    architectureMaxFiles: source.architectureMaxFiles,
    architectureMaxNodes: source.architectureMaxNodes,
    architectureLlmTimeoutMs: source.architectureLlmTimeoutMs,
  };
}

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

// DSH Connection RPC 的 result 类型用 schemastery discriminated union：
//   - ok=true  → value
//   - ok=false → { code: <one of DSH_ERROR_CODES>, message, details }
//   任何 ok=false 的 error.code 不在 DSH_ERROR_CODES 里都会被 schemastery 拒绝，
//   reject 到客户端 .catch，让用户看到一坨 invalid_union 错误。
// 修复：自动把不在白名单的 code 降级到 "internal"，并把原 code 放进 details.originalCode。
const DSH_ERROR_CODES = new Set([
  "bad-request", "cancelled", "session-not-found", "model-unavailable", "session-conflict", "invalid-time-zone",
  "workspace-attach-failed", "workspace-not-found", "workspace-invalid-path", "workspace-name-conflict", "workspace-move-invalid",
  "directory-unreadable", "directory-exists", "directory-create-failed", "directory-picker-unavailable",
  "agent-preset-read-only", "agent-preset-locked", "agent-preset-conflict", "agent-preset-not-found", "agent-preset-invalid",
  "agent-busy", "attachment-error", "queue-item-not-found", "steer-unavailable",
  "command-error", "unknown-command",
  "settings-rejected", "settings-conflict",
  "credential-rejected", "model-discovery-failed",
  "title-invalid", "fork-unavailable",
  "subagent-parent-unavailable", "subagent-not-found", "subagent-catalog-diagnostic", "subagent-not-resumable", "subagent-unauthorized", "subagent-delivery-unavailable",
  "internal",
]);
function normalizeDshErrorCode(code, details) {
  if (typeof code === "string" && DSH_ERROR_CODES.has(code)) {
    return { code, details: details && typeof details === "object" ? details : {} };
  }
  // 不在白名单 → 降级到 "internal"，保留原 code 供 client 端诊断
  const merged = Object.assign({}, details && typeof details === "object" ? details : {});
  if (typeof code === "string" && code.length > 0 && !merged.originalCode) merged.originalCode = code;
  return { code: "internal", details: merged };
}

function rpcError(code, message, details) {
  const normalized = normalizeDshErrorCode(code, details);
  return {
    ok: false,
    error: {
      code: normalized.code,
      message,
      details: normalized.details,
    },
  };
}

// v1.1.x-fix：DSH 冷启动 race condition —— sessions service 异步注册 session workspace，
//   第一次 getCwdBySession 可能返回 null（切到全新 session 后 ~300~500ms 才到位）。
//   一次短暂重试（500ms 后）能消除绝大多数切项目/切 session 时的 workspace-not-found 闪退。
const PROJECT_PATH_RETRY_DELAY_MS = 500;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function resolveRpcProjectPath(ctx, payload) {
  // Never trust a browser-provided filesystem path. The live Session header is
  // the authority for project isolation; it was created by DSH Host and cannot
  // be redirected by a crafted Client request.
  const sid = payload && payload.sessionId;
  const first = getCwdBySession(ctx, sid);
  if (first) return first;
  // 第一次 null → 等 500ms 再读一次（DSH 内部通常几百 ms 内完成注册）
  await sleep(PROJECT_PATH_RETRY_DELAY_MS);
  return getCwdBySession(ctx, sid);
}

/**
 * Register the supported Client↔Host bridge on DSH's canonical Connection RPC.
 * Unlike the build-time session map, this resolves the live Session header on
 * every request, so Sessions created after the bundle was built work without a
 * rebuild or a Desktop restart.
 */
export function registerConnectionRpc({ connection, ctx, fs, sandboxPolicy, tools, logger, getMemoryConfig, updateSettings, settingsWritable, getLlm, resolveEmbeddingCredential }) {
  if (!connection || !connection.rpc || typeof connection.rpc.handle !== "function") {
    if (logger && typeof logger.warn === "function") {
      logger.warn("[dsh-project-brain] connection.rpc unavailable; runtime preview disabled");
    }
    return false;
  }

  connection.rpc.handle(
    PROJECT_BRAIN_RPC_CHANNEL,
    async (endpoint, payload) => {
      const projectPath = await resolveRpcProjectPath(ctx, payload || {});
      const session = getSession(ctx, payload && payload.sessionId);
      const architectureRuntime = {
        getMemoryConfig,
        getLlm,
        llmRoute: resolveSessionRoute(session),
        getLlmRoute: () => resolveSessionRoute(getSession(ctx, payload && payload.sessionId)),
        sessionId: payload && payload.sessionId,
      };

      // 插件级设置：不依赖 session workspace，放在此处在 workspace 校验之前处理。
      if (endpoint === "settings") {
        const rawAction = payload && payload.action;
        const action = rawAction === "update" || rawAction === "probe" ? rawAction : "get";
        const config = getMemoryConfig ? getMemoryConfig() : normalizeMemoryConfig({});
        const writable = settingsWritable ? settingsWritable() : false;
        if (action === "probe") {
          const target = payload && payload.target;
          const overlay = payload && payload.config && typeof payload.config === "object" ? payload.config : {};
          const merged = normalizeMemoryConfig(Object.assign({}, config, overlay));
          if (target === "embedding") {
            const probe = await probeEmbedding({
              config: merged,
              resolveCredential: resolveEmbeddingCredential,
            });
            return rpcOk({ probe: Object.assign({ target: "embedding" }, probe) });
          }
          if (target === "llm") {
            const llm = getLlm ? getLlm() : null;
            const route = resolveSessionRoute(getSession(ctx, payload && payload.sessionId));
            const probe = await probeSessionLlm({
              llm,
              route,
              sessionId: payload && payload.sessionId,
              timeoutMs: 12000,
            });
            return rpcOk({ probe: Object.assign({ target: "llm" }, probe) });
          }
          return rpcError("bad-request", "未知探测目标，应为 embedding 或 llm", { target: target || null });
        }
        if (action === "get") {
          return rpcOk({
            writable,
            config: sanitizeSettings(config),
            retrieval: publicMemoryConfig(config),
          });
        }
        // action === "update"
        const patch = payload && payload.patch && typeof payload.patch === "object" ? payload.patch : null;
        if (!patch || Object.keys(patch).length === 0) {
          return rpcError("EMPTY_PATCH", "没有可保存的字段", {});
        }
        if (!updateSettings || typeof updateSettings !== "function") {
          return rpcError("SETTINGS_UNAVAILABLE", "当前运行时 settings 服务不可用，配置为只读", { writable: false });
        }
        if (!writable) {
          return rpcError("SETTINGS_READONLY", "settings provider 只读，无法保存", { writable: false });
        }
        try {
          const next = await updateSettings(patch);
          return rpcOk({
            writable,
            config: sanitizeSettings(next),
            retrieval: publicMemoryConfig(next),
          });
        } catch (error) {
          return rpcError(
            (error && error.code) || "SETTINGS_UPDATE_FAILED",
            String((error && error.message) || error),
            { writable },
          );
        }
      }

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

      // v0.4.15：智能续接 — Session 开始 / Dashboard 加载时调一次
      if (endpoint === "suggest") {
        const useLLM = !(payload && payload.useLLM === false);
        const suggestTool = buildSuggestTool({
          fs,
          sandboxPolicy,
          getLlm: architectureRuntime.getLlm,
        });
        // v0.4.17：客户端已传 workspacePath（来自 data._workspacePath），用它作为权威路径。
        // 不同 session 调同一 endpoint 都拿相同内容（同一 .project-brain/）。
        const trustedPath = (payload && typeof payload.workspacePath === "string" && payload.workspacePath.trim()) ? payload.workspacePath : projectPath;
        const args = { path: trustedPath };
        if (!useLLM) args.useLLM = false;
        // 直接调 suggestTool.execute（session 上下文用于 LLM route / 错误日志，但 projectPath 取 trustedPath）
        let toolResult;
        try {
          toolResult = await suggestTool.execute(args, {
            session: session,
            sessionId: payload && payload.sessionId,
            agent: (ctx && ctx.agent) || null,
            ctx: ctx,
          });
        } catch (error) {
          return rpcError("SUGGEST_FAILED", String((error && error.message) || error), { endpoint });
        }
        if (!toolResult || toolResult.ok === false) {
          const error = toolResult && toolResult.data && toolResult.data.error;
          return rpcError(
            (error && error.code) || "SUGGEST_FAILED",
            (error && error.message) || "智能续接失败",
            { endpoint, projectPath: trustedPath },
          );
        }
        return rpcOk({
          projectPath: trustedPath,
          suggestion: toolResult.data,
        });
      }

      // v0.4.x: Git 历史 — Dashboard Git Tab 数据源（无 .git 时 available=false 让 Client 不渲染 tab）
      if (endpoint === "git") {
        const limit = Math.max(1, Math.min(500, Number(payload && payload.limit) || 50));
        const branch = (payload && typeof payload.branch === "string" && payload.branch.trim()) ? payload.branch.trim() : null;
        try {
          const history = getGitHistory({ projectPath, limit, branch });
          const branches = getGitBranches(projectPath);
          // 工作树 vs HEAD tree 对比（不依赖 git binary）：untracked / deleted
          let workTree = { available: false };
          try {
            workTree = getWorkTreeChanges({ projectPath, maxFiles: 50 });
          } catch (e) {
            workTree = { available: false, error: String((e && e.message) || e) };
          }
          return rpcOk({
            projectPath,
            available: history.available === true,
            currentBranch: history.currentBranch || (branches && branches.currentBranch) || null,
            head: history.head || null,
            total: history.total || 0,
            commits: history.commits || [],
            branches: (branches && branches.branches) || [],
            workTree,
            error: history.error || null,
          });
        } catch (error) {
          return rpcError(
            "GIT_HISTORY_FAILED",
            String((error && error.message) || error),
            { endpoint, projectPath },
          );
        }
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
