// project_import Tool — 从 bundle zip 还原 .project-brain/
//
// 流程（dryRun → apply 两步机制）：
//   1. dryRun=true  → 解析 bundle → 计算 impact → 发放 confirmToken
//   2. UI 显示预览，用户确认
//   3. dryRun=false + confirmToken → 备份当前脑 → 解压 → 改写 rootPath → 触发 rescan

import { defineTool } from "@deepseek-ai/dsh-tools";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { appendJsonl } from "../host/store/brain-files.js";
import {
  previewBundle,
  applyBundle,
} from "../host/transfer/bundle.js";
import { getTokenStore } from "../host/transfer/confirm-tokens.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
    code: { type: "string" },
    message: { type: "string" },
  },
};

function emitPreviewChanged(exec, projectPath) {
  try {
    const executor = (exec && exec.ctx) || null;
    if (executor && typeof executor.emit === "function") {
      executor.emit("project_brain/preview.changed", { projectPath });
    }
  } catch (e) {}
}

export function buildProjectImportTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_import",
    description:
      "dsh-project-brain: 从 bundle zip 还原 .project-brain/。**两步机制**：先 dryRun=true 看预览，" +
      "把返回的 confirmToken 传给 dryRun=false 才实际写入；5 分钟内必须完成。" +
      "导入会备份当前脑 → 解压 → 改写 rootPath → 触发 rescan。失败回滚可调 project_rollback_backup。",
    parameters: {
      path: { type: "string", description: "目的地项目根路径（默认从 session cwd 推断）" },
      bundlePath: { type: "string", description: "bundle zip 文件绝对路径（必填）" },
      dryRun: { type: "boolean", description: "true=仅预览，false=实际写入（默认 false）" },
      confirmToken: { type: "string", description: "dryRun 返回的 token；dryRun=false 时必填" },
    },
    output: { schema: baseOutputSchema, render: renderImport },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, code: "E_NO_PATH", message: "无法解析项目路径（请显式传 path）" };
        }
        const bundlePath = args && args.bundlePath;
        if (!bundlePath) {
          return { ok: false, code: "E_BUNDLE_PATH_REQUIRED", message: "bundlePath 必填" };
        }
        // 校验 bundle 文件存在
        try {
          await fsp.access(bundlePath);
        } catch (e) {
          return { ok: false, code: "E_BUNDLE_NOT_FOUND", message: "bundle 文件不存在：" + bundlePath };
        }

        const isDryRun = !!(args && args.dryRun);
        const tokenStore = getTokenStore();

        if (isDryRun) {
          // ─── Preview ───
          let preview;
          try {
            preview = await previewBundle({ bundlePath, destProjectPath: projectPath });
          } catch (e) {
            return {
              ok: false,
              code: (e && e.code) || "E_BUNDLE_INVALID",
              message: String((e && e.message) || e),
              data: { detail: e && e.detail },
            };
          }
          const confirmToken = tokenStore.issue({
            kind: "import",
            payload: { bundlePath, destProjectPath: projectPath, preview },
          });

          return {
            ok: true,
            data: {
              mode: "preview",
              bundlePath,
              manifest: {
                schemaVersion: preview.manifest.schemaVersion,
                pluginVersion: preview.manifest.pluginVersion,
                exportedAt: preview.manifest.exportedAt,
                sourceProject: preview.manifest.sourceProject,
              },
              impact: {
                currentBrainExists: preview.currentBrain.exists,
                currentProjectId: preview.currentBrain.projectId,
                currentMemories: preview.currentBrain.memCount,
                currentTodos: preview.currentBrain.todoCount,
                currentTimeline: preview.currentBrain.timelineCount,
                currentArchitecture: preview.currentBrain.archExists,
                incomingMemories: preview.incoming.memCount,
                incomingTodos: preview.incoming.todoCount,
                incomingTimeline: preview.incoming.timelineCount,
                incomingProjectId: preview.incoming.projectId,
                backupWillCreateAt: preview.backupWillCreateAt,
                rootPathRewrite: preview.rootPathRewrite,
              },
              confirmToken,
              warning: preview.currentBrain.exists
                ? "导入将覆盖当前脑，旧脑会自动备份到 " + preview.backupWillCreateAt
                : "这是该项目首次导入，无备份可建。",
            },
          };
        }

        // ─── Apply ───
        const token = args && args.confirmToken;
        if (!token) {
          return { ok: false, code: "E_CONFIRM_TOKEN_REQUIRED", message: "dryRun=false 必须传 confirmToken（先 dryRun=true 拿到 token）" };
        }
        const payload = tokenStore.consume(token, { kind: "import" });
        if (!payload) {
          return { ok: false, code: "E_CONFIRM_TOKEN_MISMATCH", message: "confirmToken 无效、已过期或类型不匹配（请重新 dryRun）" };
        }
        // 校验 token 内 bundlePath 与当前一致（防止 token 复用跨项目）
        if (payload.bundlePath !== bundlePath || payload.destProjectPath !== projectPath) {
          return { ok: false, code: "E_CONFIRM_TOKEN_MISMATCH", message: "confirmToken 与当前参数不匹配（请重新 dryRun）" };
        }

        let applied;
        try {
          applied = await applyBundle({
            bundlePath,
            destProjectPath: projectPath,
            triggerRescan: false, // 由调用方调度
          });
        } catch (e) {
          return {
            ok: false,
            code: (e && e.code) || "E_IMPORT_FAILED",
            message: String((e && e.message) || e),
          };
        }

        // 写 timeline
        try {
          const now = Date.now();
          const event = {
            id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            title: applied.backupPath
              ? "导入 bundle（已备份旧脑到 " + path.basename(applied.backupPath) + "）"
              : "导入 bundle（首次）",
            eventType: "import",
            occurredAt: now,
            payload: {
              bundlePath,
              backupPath: applied.backupPath,
              sourceManifest: applied.sourceManifest,
            },
          };
          await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), event);
        } catch (e) { /* 不阻断主流程 */ }

        emitPreviewChanged(exec, projectPath);

        return {
          ok: true,
          data: {
            mode: "applied",
            bundlePath,
            backupPath: applied.backupPath,
            rescanTriggered: false, // 留给 RPC 层调度
            fileCount: applied.fileCount,
            sourceManifest: applied.sourceManifest,
            warning: "脑数据已写入。建议手动调 project_rescan 刷新架构与统计；" +
              "若需恢复旧脑，可调 project_rollback_backup。",
          },
        };
      } catch (e) {
        return {
          ok: false,
          code: (e && e.code) || "E_IMPORT_FAILED",
          message: String((e && e.message) || e),
        };
      }
    },
  });
}

function renderImport(_args, value) {
  if (!value || typeof value !== "object") {
    return [{ type: "text", text: "dsh-project-brain: import FAILED - " + String(value) }];
  }
  if (value.ok) {
    const d = value.data || {};
    if (d.mode === "preview") {
      const impact = d.impact || {};
      return [
        { type: "text", text: "dsh-project-brain: import PREVIEW" },
        { type: "text", text: "  bundle: " + d.bundlePath },
        { type: "text", text: "  source: " + (d.manifest && d.manifest.sourceProject && d.manifest.sourceProject.rootPath) },
        { type: "text", text: "  current brain: " + (impact.currentBrainExists
          ? `${impact.currentMemories} mem / ${impact.currentTodos} todo / ${impact.currentTimeline} timeline`
          : "(无)") },
        { type: "text", text: "  incoming: " + `${impact.incomingMemories} mem / ${impact.incomingTodos} todo / ${impact.incomingTimeline} timeline` },
        { type: "text", text: "  backup will create: " + (impact.backupWillCreateAt || "(无脑，无需备份)") },
        { type: "text", text: "  rootPath rewrite: " + (impact.rootPathRewrite && impact.rootPathRewrite.from) + " → " + (impact.rootPathRewrite && impact.rootPathRewrite.to) },
        { type: "text", text: "  confirmToken: " + d.confirmToken + " (5 分钟内传给 dryRun=false 才会真正执行)" },
      ];
    }
    if (d.mode === "applied") {
      return [
        { type: "text", text: "dsh-project-brain: import APPLIED" },
        { type: "text", text: "  backup: " + (d.backupPath || "(无)") },
        { type: "text", text: "  files restored: " + d.fileCount },
        { type: "text", text: "  " + (d.warning || "") },
      ];
    }
  }
  return [{ type: "text", text: "dsh-project-brain: import FAILED - " + (value.code || "") + ": " + (value.message || "") }];
}
