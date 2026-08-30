// project_dream Tool - 轻量整合（memory 去重 + 归档低 importance）
//
// MVP light mode：
//   - title 字符串归一化后做相似度比对（Jaccard），≥ 0.92 → 合并（保留 importance 高 + 内容长的）
//   - importance < 0.15 且年龄 > 30 天 → 标记 archived（status=archived）
//   - dryRun=true（默认）：返回 plannedActions，不写文件
//   - dryRun=false：实际 commit 合并 / 归档，写 memory.jsonl + timeline.jsonl + emit preview.changed
//
// full mode（v0.4.x 后续）：
//   - 代码架构 diff、向量检索合并、跨项目归档、Dream 调度等
//
// 设计原则：零 LLM（不进流）、纯文件 IO、秒级响应。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, readJsonl, writeJsonl, appendJsonl } from "../host/store/brain-files.js";
import { computeDreamActions, applyDreamCommit } from "../host/store/brain-logic.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
};

export function buildDreamTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_dream",
    description:
      "dsh-project-brain: 项目脑轻量整合（Dream 模式）。扫描 memory.jsonl 做去重候选 +" +
      "归档建议，输出 plannedActions；默认 dryRun=true（不直接改 jsonl），dryRun=false 时实际 commit（merge + archive）。" +
      "full 模式（v0.3.12）：在 light 基础上额外清理 archived 行 + 按 importance 重排；架构 diff / 向量合并留作 v0.4.x。",
    parameters: {
      mode: { type: "string", description: "light（默认）或 full（预留）" },
      dryRun: { type: "boolean", description: "只返回计划（默认 true；设 false 实际写文件）" },
      mergeThreshold: { type: "number", description: "title 相似度阈值（默认 0.92）" },
      archiveImportance: { type: "number", description: "归档重要性阈值（默认 0.15）" },
      archiveAgeDays: { type: "number", description: "归档最小年龄（天，默认 30）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderDream(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const mode = (args && args.mode) || "light";
        const dryRun = args && args.dryRun !== false; // default true
        const opts = {
          now: Date.now(),
          mergeThreshold: args && typeof args.mergeThreshold === "number" ? args.mergeThreshold : 0.92,
          archiveImportance: args && typeof args.archiveImportance === "number" ? args.archiveImportance : 0.15,
          archiveAgeDays: args && typeof args.archiveAgeDays === "number" ? args.archiveAgeDays : 30,
        };

        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));

        // full 模式 vs light 模式：full 在 commit 时额外清理 archived 行 + 按 importance 排序
        //   这是 v0.3.12 实现的「安全 full」：不跨项目、不调 LLM、不改语义
        //   真正的"架构 diff / 向量合并 / 跨项目归档"留作后续 v0.4.x
        if (mode !== "light" && mode !== "full") {
          return { ok: true, data: { mode, plannedActions: [], note: "mode 仅支持 light / full（" + mode + " 未实现）" } };
        }

        const computed = computeDreamActions(memories, opts);
        const plannedActions = computed.plannedActions;

        // dryRun=true：只汇报，不写文件
        if (dryRun) {
          return {
            ok: true,
            data: {
              mode,
              dryRun: true,
              scannedMemories: memories.length,
              plannedActions,
              summary: {
                mergeCandidates: computed.mergeCount,
                archiveCandidates: computed.archiveCount,
                estimatedMs: 0,
              },
              note: "dryRun=true，未写文件；若要 commit，请设置 dryRun=false。",
            },
          };
        }

        // dryRun=false：真写 jsonl（v0.3.12 新增）
        const now = opts.now;
        const nextMemories = applyDreamCommit(memories, plannedActions, now, mode);

        const merges = plannedActions.filter((a) => a.action === "merge");
        const archives = plannedActions.filter((a) => a.action === "archive_candidate");
        const dropIds = new Set();
        for (const m of merges) for (const id of m.dropIds) dropIds.add(id);
        const mergeLog = merges.map((m) => ({ keepId: m.keepId, dropped: m.dropIds.slice() }));
        const archiveLog = archives.map((a) => ({ id: a.id, title: a.title, importance: a.importance, ageDays: a.ageDays }));

        const memPath = brainPath(projectPath, "memory.jsonl");
        const wroteMem = await writeJsonl(fs, memPath, nextMemories);
        if (!wroteMem) {
          return { ok: false, data: { error: { code: "E_DREAM_WRITE_FAILED", message: "write memory.jsonl failed" } } };
        }

        const tlEntry = {
          id: "evt-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 8),
          title: "Dream commit 完成（merge " + merges.length + " · archive " + archives.length + "）",
          eventType: "dream",
          occurredAt: now,
          detail: "mergeCount=" + merges.length + " archiveCount=" + archives.length,
        };
        await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), tlEntry);

        try {
          if (exec && exec.ctx && typeof exec.ctx.emit === "function") {
            exec.ctx.emit("project_brain/preview.changed", { projectPath });
          }
        } catch (e) {}

        // v0.3.18：工具层同步 rebuild（绕过 host bundle silent failure；v0.3.6 已验证 execFileSync 能跑）

        return {
          ok: true,
          data: {
            mode,
            dryRun: false,
            scannedMemories: memories.length,
            plannedActions,
            committed: {
              mergeLog,
              archiveLog,
              beforeCount: memories.length,
              afterCount: nextMemories.length,
            },
            summary: {
              mergeCandidates: computed.mergeCount,
              archiveCandidates: computed.archiveCount,
              mergedDropped: dropIds.size,
              estimatedMs: Date.now() - now,
            },
            note: "dream commit 完成：已写 memory.jsonl + timeline.jsonl；下次 build 自动反映到 sidebar。",
          },
        };
      } catch (e) {
        return { ok: false, data: { error: { code: "E_DREAM_FAILED", message: String((e && e.message) || e) } } };
      }
    },
  });
}

function renderDream(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + String(value) }];
  if (value.ok) {
    const d = value.data || {};
    const lines = [{ type: "text", text: `dsh-project-brain: dream (${d.mode}) — scanned ${d.scannedMemories} memories, dryRun=${d.dryRun}` }];
    if (d.summary) {
      lines.push({ type: "text", text: `  merge: ${d.summary.mergeCandidates}, archive candidates: ${d.summary.archiveCandidates}, ms=${d.summary.estimatedMs || 0}` });
    }
    for (const a of (d.plannedActions || []).slice(0, 10)) {
      if (a.action === "merge") lines.push({ type: "text", text: `  [merge] keep ${a.keepId} (${a.keepTitle}) drop ${a.dropIds.join(",")}` });
      else if (a.action === "archive_candidate") lines.push({ type: "text", text: `  [archive] ${a.id} (${a.title}) importance=${a.importance} age=${a.ageDays}d` });
    }
    if (d.committed) {
      lines.push({ type: "text", text: `  ✓ committed: ${d.committed.beforeCount} -> ${d.committed.afterCount} memories` });
    }
    if (d.note) lines.push({ type: "text", text: `  note: ${d.note}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + JSON.stringify(value) }];
}
