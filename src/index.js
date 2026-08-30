// dsh-project-brain Host 入口
// 导出 name / inject / apply 三个 named export（cordis 4 标准）

import { buildProjectInitTool, buildProjectRescanTool } from "./tools.js";
import { buildMemoryAddTool, buildMemoryListTool } from "./tools/memory.js";
import { buildTodoAddTool, buildTodoListTool, buildTodoDoneTool } from "./tools/todo.js";
import { buildTodoUpdateTool } from "./tools/todo-update.js";
import { buildContinueTool } from "./tools/continue.js";
import { buildStatusTool } from "./tools/status.js";
import { buildAskTool } from "./tools/ask.js";
import { buildDreamTool } from "./tools/dream.js";
import { buildDiffTool } from "./tools/diff.js";
import { invalidateAggregatorCache } from "./host/sidebar/aggregator.js";
import { registerConnectionRpc, registerSidebarRpc } from "./host/rpc/sidebar.js";
// v0.3.0: Context Injector（自动注入 Top-K 记忆到 system prompt，实现跨 Session 续接）
import { setupInjector } from "./host/injector.js";
// P0.5: Session 摘要（监听 session/disposed → 自动写 change memory + timeline 事件）
import { setupSummarizer } from "./host/summarizer.js";
import { Config, createMemoryConfigRuntime } from "./host/memory/config.js";
import { createLlmRuntime } from "./host/architecture/analyzer.js";

export { Config };

export const name = "dsh-project-brain";

// `llm` is a first-class dependency: architecture analysis is expected to
// reuse the model already selected by the current DSH Session. Declaring it
// here gives this plugin fiber lawful access to ctx.llm/ctx.get("llm").
export const inject = ["tools", "fs", "sandboxPolicy", "connection", "sessions", "llm"];

// Arrow（不能是 function declaration，否则 cordis 4 会当 class 构造）
export const apply = (ctx, config) => {
  // 顶层 try-catch：让 apply 永不抛错（避免整 fiber 崩）
  // dshmarket hotMount 创建的子 fiber 不注入 host builtin（harness/timer/webServer），
  // 任何 ctx.<service> 访问都可能抛 "cannot get property ... without inject"
  try {
    return applyImpl(ctx, config);
  } catch (e) {
    if (ctx && ctx.logger && typeof ctx.logger.error === "function") {
      try { ctx.logger.error("[dsh-project-brain] apply fatal:", String((e && e.message) || e)); } catch {}
    }
  }
};

function applyImpl(ctx, config) {
  // 每个 service 访问都包 try-catch（cordis 在 inject 缺失时直接抛错）
  function safeGet(name) {
    try { return ctx[name]; } catch (e) { return undefined; }
  }

  const fs = safeGet("fs");
  const tools = safeGet("tools");
  const sandboxPolicy = safeGet("sandboxPolicy");
  const connection = safeGet("connection");
  const llm = safeGet("llm");
  const memoryRuntime = createMemoryConfigRuntime(ctx, config);
  const llmRuntime = createLlmRuntime(ctx, llm);
  // Desktop 2.x does not expose the old helper as a global.  Keep the
  // sidebar fallback local to the current sandbox instead of passing an
  // undefined identifier into registerSidebarRpc.
  const getDefaultProjectPath = () => {
    try {
      const root = sandboxPolicy && sandboxPolicy.workspaceRoot;
      if (typeof root === "string" && root.trim() && !/[\\/]DSH Desktop\\.app/i.test(root)) {
        return root;
      }
    } catch (e) {}
    return ".";
  };

  if (!fs || !tools) {
    if (ctx.logger && typeof ctx.logger.error === "function") {
      ctx.logger.error("[dsh-project-brain] required services (fs, tools) unavailable");
    }
    return;
  }

  // 1) 注册工具（P0.4.x + P0.5 + P0.7 + v0.4.1：13 个工具，含 v0.4.1 project_diff）
  //   init/rescan（项目扫描）/ continue（续接）/ status（状态快照）
  //   memory_add / memory_list（记忆 CRUD-lite）
  //   todo_add / todo_list / todo_done / todo_update（待办 CRUD）
  //   ask（自然语言查询）/ dream（轻量整合）/ diff（v0.4.1 LLM 架构 diff）
  const toolBuilders = [
    buildProjectInitTool,
    buildProjectRescanTool,
    buildContinueTool,
    buildStatusTool,
    buildMemoryAddTool,
    buildMemoryListTool,
    buildTodoAddTool,
    buildTodoListTool,
    buildTodoDoneTool,
    buildTodoUpdateTool,
    buildAskTool,
    buildDreamTool,
    buildDiffTool,
  ];
  let registered = 0;
  for (let i = 0; i < toolBuilders.length; i++) {
    try {
      const tool = toolBuilders[i]({
        fs,
        sandboxPolicy,
        getMemoryConfig: memoryRuntime.get,
        resolveEmbeddingCredential: memoryRuntime.resolveCredential,
        getLlm: llmRuntime.get,
      });
      const disposer = tools.register(tool);
      registered += 1;
      if (ctx.effect) {
        try { ctx.effect(() => disposer, "dsh-project-brain:tool:" + (tool && tool.name ? tool.name : i)); } catch (e) {}
      }
    } catch (e) {
      if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] tool register failed:", String((e && e.message) || e)); } catch {}
    }
  }

  // 2) 注册 sidebar RPC（getPreview / initProject / continueSession）
  // harness 是 host builtin；用 ctx.get 探测（避免模块作用域 typeof 假性）
  let harness;
  try { harness = ctx.get ? ctx.get("harness") : ctx.harness; } catch (e) { harness = undefined; }
  if (ctx.logger && typeof ctx.logger.info === "function") {
    try { ctx.logger.info("[dsh-project-brain] [diagnose] harness available: " + (!!harness && typeof harness.handle === "function")); } catch (e) {}
  }
  try {
    const rpcDisposers = registerSidebarRpc({
      harness,
      ctx,
      fs,
      tools,
      getDefaultProjectPath,
      logger: ctx.logger,
    });
    for (let i = 0; i < rpcDisposers.length; i++) {
      try {
        if (ctx.effect) ctx.effect(rpcDisposers[i], "dsh-project-brain:rpc:register:" + i);
      } catch (e) {
        if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] rpc effect " + i + " failed:", String((e && e.message) || e)); } catch {}
      }
    }
  } catch (e) {
    if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] sidebar RPC registration failed:", String((e && e.message) || e)); } catch {}
  }

  // Canonical runtime bridge. This is the primary data path for published
  // builds: it resolves the live Session header instead of relying on a
  // sessionId map frozen into the client bundle at build time.
  try {
    registerConnectionRpc({
      connection,
      ctx,
      fs,
      sandboxPolicy,
      tools,
      logger: ctx.logger,
      getMemoryConfig: memoryRuntime.get,
      getLlm: llmRuntime.get,
    });
  } catch (e) {
    if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] connection RPC registration failed:", String((e && e.message) || e)); } catch {}
  }

  // 3) preview.changed -> 清 aggregator 缓存
  try {
    if (ctx.on) {
      ctx.on("project_brain/preview.changed", (payload) => {
        try {
          invalidateAggregatorCache(payload && payload.projectPath);
        } catch (e) {}
      });
    }
  } catch (e) {
    if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] event subscription failed:", String((e && e.message) || e)); } catch {}
  }

  // 3.5) Context Injector。systemPrompt 不是主插件启动的硬依赖：用 Cordis
  //   动态 inject 等待服务出现，避免直接 ctx.get("systemPrompt") 因未声明依赖而失败。
  try {
    if (typeof ctx.inject === "function") {
      ctx.inject(["systemPrompt"], (promptCtx) => setupInjector(promptCtx, fs, sandboxPolicy));
    } else {
      setupInjector(ctx, fs, sandboxPolicy);
    }
  } catch (e) {
    if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] setupInjector failed:", String((e && e.message) || e)); } catch {}
  }

  // 4) P0.5 Session 摘要：监听 session/disposed → git diff → 写 change memory + timeline 事件
  try {
    setupSummarizer(ctx, fs, sandboxPolicy, {
      getMemoryConfig: memoryRuntime.get,
      getLlm: llmRuntime.get,
    });
  } catch (e) {
    if (ctx.logger) try { ctx.logger.warn("[dsh-project-brain] setupSummarizer failed:", String((e && e.message) || e)); } catch {}
  }

  // 5) 启动成功 log
  if (ctx.logger && typeof ctx.logger.info === "function") {
    try { ctx.logger.info("[dsh-project-brain] host loaded (runtime RPC, tools registered: " + registered + ")"); } catch {}
  }
}
