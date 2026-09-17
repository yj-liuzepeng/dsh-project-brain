// project_export Tool — 把当前项目的 .project-brain/ 打成 zip bundle
//
// 输出：bundle zip 文件路径 + manifest 摘要
//
// 用法（典型跨机器同步）：
//   1. 在源机器调 project_export → 拿到 bundlePath
//   2. 用户把 zip 文件通过 Git commit / U 盘 / 网盘 / 微信传到目标机器
//   3. 在目标机器调 project_import 还原

import { defineTool } from "@deepseek-ai/dsh-tools";
import path from "node:path";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { readJson, brainPath } from "../host/store/brain-files.js";
import { writeBundleFile, defaultBundleName } from "../host/transfer/bundle.js";

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

export function buildProjectExportTool({ fs, sandboxPolicy, pluginVersion }) {
  return defineTool({
    name: "project_export",
    description:
      "dsh-project-brain: 把当前项目的 .project-brain/ 打成 zip bundle（含 manifest.json + checksum）。" +
      "用于跨机器同步：在源机器调用 → 把 bundle 文件传到目标机器 → 在目标机器调 project_import 还原。" +
      "会备份 timeline + cache；若不需要 cache 可传 includeCache=false 缩体积。",
    parameters: {
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
      outputPath: { type: "string", description: "bundle 输出绝对路径（可选；默认 <projectRoot>/dist-backups/dsh-brain-<name>-<ts>.zip）" },
      includeCache: { type: "boolean", description: "是否包含 cache/ 目录（默认 true）" },
    },
    output: { schema: baseOutputSchema, render: renderExport },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        if (projectPath === ".") {
          return { ok: false, code: "E_NO_PATH", message: "无法解析项目路径（请显式传 path）" };
        }
        const includeCache = !!(args && args.includeCache !== false);

        // 校验脑存在
        const projectMeta = await readJson(fs, brainPath(projectPath, "project.json"));
        if (!projectMeta || projectMeta.__error) {
          return { ok: false, code: "E_BRAIN_NOT_FOUND", message: "项目未初始化，请先调用 project_init" };
        }

        // 默认输出路径：<projectRoot>/dist-backups/dsh-brain-<name>-<ts>.zip
        let outputPath = args && args.outputPath;
        if (!outputPath) {
          const fname = defaultBundleName(projectMeta);
          outputPath = path.join(projectPath, "dist-backups", fname);
        }

        const startMs = Date.now();
        const written = await writeBundleFile({
          projectPath,
          outputPath,
          pluginVersion: pluginVersion || "1.3.1",
          includeCache,
        });

        // 写 timeline 事件
        try {
          const now = Date.now();
          const event = {
            id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
            title: "导出 bundle：" + path.basename(outputPath),
            eventType: "export",
            occurredAt: now,
            payload: {
              bundlePath: outputPath,
              sizeBytes: written.sizeBytes,
              fileCount: written.fileCount,
              schemaVersion: written.manifest.schemaVersion,
            },
          };
          const { appendJsonl } = await import("../host/store/brain-files.js");
          await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), event);
        } catch (e) { /* timeline 写入失败不影响主流程 */ }

        emitPreviewChanged(exec, projectPath);

        return {
          ok: true,
          data: {
            bundlePath: written.bundlePath,
            bundleName: written.bundleName,
            defaultDirPath: written.defaultDirPath,
            sizeBytes: written.sizeBytes,
            fileCount: written.fileCount,
            durationMs: Date.now() - startMs,
            manifest: {
              schemaVersion: written.manifest.schemaVersion,
              pluginVersion: written.manifest.pluginVersion,
              exportedAt: written.manifest.exportedAt,
              sourceProject: written.manifest.sourceProject,
            },
            message: "导出成功。下一步：把 bundle 文件传到目标机器，调用 project_import 还原。",
          },
        };
      } catch (e) {
        return {
          ok: false,
          code: (e && e.code) || "E_EXPORT_FAILED",
          message: String((e && e.message) || e),
        };
      }
    },
  });
}

function renderExport(_args, value) {
  if (!value || typeof value !== "object") {
    return [{ type: "text", text: "dsh-project-brain: export FAILED - " + String(value) }];
  }
  if (value.ok) {
    const d = value.data || {};
    const sizeMB = (d.sizeBytes / (1024 * 1024)).toFixed(2);
    return [
      { type: "text", text: "dsh-project-brain: export OK" },
      { type: "text", text: "  bundle: " + d.bundlePath },
      { type: "text", text: "  size: " + sizeMB + " MB (" + d.fileCount + " files, " + d.durationMs + "ms)" },
      { type: "text", text: "  source: " + (d.manifest && d.manifest.sourceProject && d.manifest.sourceProject.rootPath) },
      { type: "text", text: "  schemaVersion: " + (d.manifest && d.manifest.schemaVersion) },
    ];
  }
  return [{ type: "text", text: "dsh-project-brain: export FAILED - " + (value.code || "") + ": " + (value.message || "") }];
}
