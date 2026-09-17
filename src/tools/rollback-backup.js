// project_rollback_backup Tool — 从本地 .project-brain.backup-<ts>/ 回滚
//
// 与 import 不同：本操作只读本机备份，不需 bundle 文件。
// 流程（dryRun → apply 两步机制）：
//   1. dryRun=true  → 校验 backup 存在 → 读取元信息 → 发放 confirmToken
//   2. UI 显示预览（source / 当前脑 / pre-rollback backup 路径）
//   3. dryRun=false + confirmToken → 备份当前脑 → 还原 backup → 触发 rescan

import { defineTool } from "@deepseek-ai/dsh-tools";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { appendJsonl } from "../host/store/brain-files.js";
import { brainPath } from "../host/store/brain-files.js";
import {
  previewRollback,
  applyRollback,
} from "../host/transfer/backup.js";
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

export function buildRollbackBackupTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_rollback_backup",
    description:
      "dsh-project-brain: 把当前脑回滚到指定的 .project-brain.backup-<ts>/ 备份。" +
      "**两步机制**：先 dryRun=true 拿 confirmToken，再 dryRun=false + token 真正执行。" +
      "回滚前会先把当前脑再备份一次（形成完整历史链），无需传 bundle 文件。",
    parameters: {
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
      backupTimestamp: { type: "string", description: "备份时间戳，格式 yyyymmdd-hhmmss-mmm（如 20260915-143022-345；旧备份 hhmm-mmm 仍可用）" },
      dryRun: { type: "boolean", description: "true=仅预览（默认 false）" },
      confirmToken: { type: "string", description: "dryRun 返回的 token；dryRun=false 时必填" },
    },
    output: { schema: baseOutputSchema, render: renderRollback },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, code: "E_NO_PATH", message: "无法解析项目路径（请显式传 path）" };
        }
        const backupTimestamp = args && args.backupTimestamp;
        if (!backupTimestamp) {
          return { ok: false, code: "E_BACKUP_TIMESTAMP_REQUIRED", message: "backupTimestamp 必填（yyyymmdd-hhmmss-mmm）" };
        }

        const isDryRun = !!(args && args.dryRun);
        const tokenStore = getTokenStore();

        if (isDryRun) {
          let preview;
          try {
            preview = await previewRollback({ projectPath, backupTimestamp });
          } catch (e) {
            return {
              ok: false,
              code: (e && e.code) || "E_BACKUP_INVALID",
              message: String((e && e.message) || e),
            };
          }
          const confirmToken = tokenStore.issue({
            kind: "rollback",
            payload: { projectPath, backupTimestamp },
          });
          return {
            ok: true,
            data: {
              mode: "preview",
              backupTimestamp,
              sourceBackup: preview.sourceBackup,
              currentBrain: preview.currentBrain,
              willBackupCurrentTo: preview.willBackupCurrentTo,
              confirmToken,
              warning: preview.currentBrain && preview.currentBrain.exists
                ? "回滚前会先把当前脑备份到 " + preview.willBackupCurrentTo + "，可继续回滚。"
                : "当前脑不存在，回滚后会成为当前脑。",
            },
          };
        }

        // Apply
        const token = args && args.confirmToken;
        if (!token) {
          return { ok: false, code: "E_CONFIRM_TOKEN_REQUIRED", message: "dryRun=false 必须传 confirmToken（先 dryRun=true 拿到 token）" };
        }
        const payload = tokenStore.consume(token, { kind: "rollback" });
        if (!payload) {
          return { ok: false, code: "E_CONFIRM_TOKEN_MISMATCH", message: "confirmToken 无效、已过期或类型不匹配（请重新 dryRun）" };
        }
        if (payload.projectPath !== projectPath || payload.backupTimestamp !== backupTimestamp) {
          return { ok: false, code: "E_CONFIRM_TOKEN_MISMATCH", message: "confirmToken 与当前参数不匹配（请重新 dryRun）" };
        }

        let applied;
        try {
          applied = await applyRollback({ projectPath, backupTimestamp, triggerRescan: false });
        } catch (e) {
          return {
            ok: false,
            code: (e && e.code) || "E_ROLLBACK_FAILED",
            message: String((e && e.message) || e),
          };
        }

        // timeline
        try {
          const now = Date.now();
          const event = {
            id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            title: "回滚到备份 " + backupTimestamp,
            eventType: "rollback",
            occurredAt: now,
            payload: {
              restoredFrom: applied.restoredFrom,
              preRollbackBackupPath: applied.preRollbackBackupPath,
            },
          };
          await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), event);
        } catch (e) {}

        emitPreviewChanged(exec, projectPath);

        return {
          ok: true,
          data: {
            mode: "applied",
            backupTimestamp,
            restoredFrom: applied.restoredFrom,
            preRollbackBackupPath: applied.preRollbackBackupPath,
            rescanTriggered: false,
            warning: "回滚完成。建议手动调 project_rescan 刷新架构与统计。",
          },
        };
      } catch (e) {
        return {
          ok: false,
          code: (e && e.code) || "E_ROLLBACK_FAILED",
          message: String((e && e.message) || e),
        };
      }
    },
  });
}

function renderRollback(_args, value) {
  if (!value || typeof value !== "object") {
    return [{ type: "text", text: "dsh-project-brain: rollback FAILED - " + String(value) }];
  }
  if (value.ok) {
    const d = value.data || {};
    if (d.mode === "preview") {
      const sb = d.sourceBackup || {};
      const cb = d.currentBrain || {};
      return [
        { type: "text", text: "dsh-project-brain: rollback PREVIEW" },
        { type: "text", text: `  source backup: ${sb.backupName} (${sb.sizeBytes} bytes, ${sb.memCount} mem / ${sb.todoCount} todo / ${sb.timelineCount} timeline)` },
        { type: "text", text: `  current brain: ${cb.exists
          ? `${cb.memCount} mem / ${cb.todoCount} todo / ${cb.timelineCount} timeline`
          : "(无)"}` },
        { type: "text", text: "  pre-rollback backup: " + (d.willBackupCurrentTo || "(无需)") },
        { type: "text", text: "  confirmToken: " + d.confirmToken + " (5 分钟内传给 dryRun=false)" },
      ];
    }
    if (d.mode === "applied") {
      return [
        { type: "text", text: "dsh-project-brain: rollback APPLIED" },
        { type: "text", text: "  restored from: " + d.restoredFrom },
        { type: "text", text: "  pre-rollback backup: " + (d.preRollbackBackupPath || "(无)") },
        { type: "text", text: "  " + (d.warning || "") },
      ];
    }
  }
  return [{ type: "text", text: "dsh-project-brain: rollback FAILED - " + (value.code || "") + ": " + (value.message || "") }];
}
