// project_cleanup_backups Tool — 清理过期的本地备份

import { defineTool } from "@deepseek-ai/dsh-tools";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { listBackups, cleanupBackups } from "../host/transfer/backup.js";

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

export function buildCleanupBackupsTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_cleanup_backups",
    description:
      "dsh-project-brain: 清理 .project-brain.backup-<ts>/ 备份目录。" +
      "两个策略同时生效：保留最近 N 个（默认 3）+ 删除超过 X 毫秒的（默认 30 天）。" +
      "建议在每次导入/回滚后调一次，避免备份无限堆积。",
    parameters: {
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
      keepLast: { type: "number", description: "保留最近几个（默认 3）" },
      olderThanMs: { type: "number", description: "删除超过多少毫秒的（默认 30 天 = 2592000000）" },
    },
    output: { schema: baseOutputSchema, render: renderCleanup },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, code: "E_NO_PATH", message: "无法解析项目路径（请显式传 path）" };
        }
        const all = await listBackups({ projectPath });
        const result = await cleanupBackups({
          projectPath,
          keepLast: args && typeof args.keepLast === "number" ? args.keepLast : 3,
          olderThanMs: args && typeof args.olderThanMs === "number" ? args.olderThanMs : 30 * 24 * 60 * 60 * 1000,
        });
        return {
          ok: true,
          data: {
            beforeCount: all.length,
            candidates: result.candidates,
            deleted: result.deleted,
            deletedCount: result.deleted.length,
            kept: result.kept,
            keptCount: result.kept.length,
            message: `清理完成：删除 ${result.deleted.length} 个，保留 ${result.kept.length} 个。`,
          },
        };
      } catch (e) {
        return {
          ok: false,
          code: (e && e.code) || "E_CLEANUP_FAILED",
          message: String((e && e.message) || e),
        };
      }
    },
  });
}

function renderCleanup(_args, value) {
  if (!value || typeof value !== "object") {
    return [{ type: "text", text: "dsh-project-brain: cleanup FAILED - " + String(value) }];
  }
  if (value.ok) {
    const d = value.data || {};
    const lines = [
      { type: "text", text: "dsh-project-brain: cleanup OK" },
      { type: "text", text: `  before: ${d.beforeCount} backups, deleted ${d.deletedCount}, kept ${d.keptCount}` },
    ];
    if (d.deleted && d.deleted.length > 0) {
      for (const p of d.deleted.slice(0, 5)) {
        lines.push({ type: "text", text: "  - " + p });
      }
      if (d.deleted.length > 5) lines.push({ type: "text", text: `  ... and ${d.deleted.length - 5} more` });
    }
    return lines;
  }
  return [{ type: "text", text: "dsh-project-brain: cleanup FAILED - " + (value.code || "") + ": " + (value.message || "") }];
}
