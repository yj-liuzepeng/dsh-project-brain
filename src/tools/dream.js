// project_dream Tool — 记忆整理。
//   mode=light：归档 changelog 体裁、超额 Core 降 dormant、报告标题相似建议。
//   mode=full ：在 light 的基础上再做一次 vacuum，把过期的归档行与旧时间线
//               搬到 .project-brain/archive/，让主文件真的变小。
// 两种模式都禁止 Jaccard merge-and-drop，也都不做不可恢复的删除。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, readJsonl } from "../host/store/brain-files.js";
import { housekeepMemories, persistHousekeep } from "../host/memory/admit.js";
import { vacuumBrain } from "../host/memory/vacuum.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";

const baseOutputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    data: { type: "object", additionalProperties: true },
  },
};

export function buildDreamTool({ fs, sandboxPolicy, getMemoryConfig }) {
  return defineTool({
    name: "project_dream",
    description:
      "dsh-project-brain: 整理记忆（归档 changelog 体裁、超额 Core 降为 dormant、报告标题相似建议）。" +
      "默认 dryRun=true；dryRun=false 时只应用归档与休眠，绝不因标题相似删除。" +
      "mode=full 额外做一次 vacuum：把超期的归档记忆与旧时间线搬到 .project-brain/archive/，" +
      "主文件变小但数据仍可找回；活跃记忆、置顶、证据链引用与第一屏依赖的锚点都不会被搬走。",
    parameters: {
      mode: { type: "string", description: "light（默认，只整理状态）或 full（额外 vacuum 主文件）" },
      dryRun: { type: "boolean", description: "只返回计划（默认 true）" },
      path: { type: "string", description: "项目根路径（默认从 session cwd 推断）" },
    },
    output: { schema: baseOutputSchema, render: (_args, value) => renderDream(value) },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const mode = (args && args.mode) || "light";
        const dryRun = args && args.dryRun !== false;
        if (mode !== "light" && mode !== "full") {
          return { ok: true, data: { mode, plannedActions: [], note: "mode 仅支持 light / full（" + mode + " 未实现）" } };
        }

        const memories = await readJsonl(fs, brainPath(projectPath, "memory.jsonl"));
        const now = Date.now();
        const computed = housekeepMemories(memories, { now, pinnedIds: [] });
        const plannedActions = computed.actions || [];
        const archiveCount = plannedActions.filter((a) => a.action === "archive_rule").length;
        const evictCount = plannedActions.filter((a) => a.action === "evict_to_dormant").length;
        const suggestCount = plannedActions.filter((a) => a.action === "suggest_supersede").length;

        const memoryConfig = getMemoryConfig ? getMemoryConfig() : {};
        // full 模式先算一遍 vacuum 计划，dryRun 时也要让用户看到会搬走多少。
        const vacuumPlanned = mode === "full"
          ? await vacuumBrain({ fs, projectPath, config: memoryConfig, now, dryRun: true })
          : null;

        if (dryRun) {
          return {
            ok: true,
            data: {
              mode,
              dryRun: true,
              scannedMemories: memories.length,
              plannedActions,
              ...(vacuumPlanned ? { vacuum: vacuumPlanned.plan } : {}),
              summary: {
                archiveCandidates: archiveCount,
                evictCandidates: evictCount,
                suggestSupersede: suggestCount,
                mergeCandidates: 0,
                vacuumCandidates: vacuumPlanned ? vacuumPlanned.plan.totalEvicted : 0,
                estimatedMs: 0,
              },
              note: mode === "full"
                ? "dryRun=true，未写文件；commit 会应用 archive_rule / evict_to_dormant，并把超期死行搬到 archive/。"
                : "dryRun=true，未写文件；commit 只应用 archive_rule / evict_to_dormant，不会 Jaccard 删除。",
            },
          };
        }

        const persisted = await persistHousekeep(fs, projectPath, { now, pinnedIds: [], writeTimeline: computed.changed });
        if (!persisted.ok && persisted.code === "E_NOT_INITIALIZED") {
          return { ok: false, data: { error: { code: "E_NOT_INITIALIZED", message: "project not initialized" } } };
        }
        if (!persisted.ok && persisted.code === "E_WRITE_FAILED") {
          return { ok: false, data: { error: { code: "E_DREAM_WRITE_FAILED", message: "write memory.jsonl failed" } } };
        }

        // vacuum 必须在 housekeep 落盘之后跑：housekeep 可能刚把一批记忆标成 archived，
        // 这一轮才知道它们够不够老。
        let vacuum = null;
        if (mode === "full") {
          vacuum = await vacuumBrain({ fs, projectPath, config: memoryConfig, now, dryRun: false });
          if (!vacuum.ok) {
            return { ok: false, data: { error: { code: vacuum.code || "E_VACUUM_FAILED", message: "vacuum 未能完成，主文件保持原样" } } };
          }
        }

        try {
          if (exec && exec.ctx && typeof exec.ctx.emit === "function") {
            exec.ctx.emit("project_brain/preview.changed", { projectPath });
          }
        } catch (e) {}

        const vacuumNote = vacuum && vacuum.changed
          ? " vacuum 搬走 " + vacuum.plan.totalEvicted + " 行到 archive/。"
          : (mode === "full" ? " 没有超期的死行需要搬走。" : "");

        return {
          ok: true,
          data: {
            mode,
            dryRun: false,
            scannedMemories: memories.length,
            plannedActions,
            ...(vacuum ? { vacuum: vacuum.plan, archives: vacuum.archives } : {}),
            committed: {
              beforeCount: memories.length,
              afterCount: (persisted.rows || memories).length,
              archived: archiveCount,
              evicted: evictCount,
              vacuumed: vacuum ? vacuum.plan.totalEvicted : 0,
            },
            summary: {
              archiveCandidates: archiveCount,
              evictCandidates: evictCount,
              suggestSupersede: suggestCount,
              mergeCandidates: 0,
              vacuumCandidates: vacuum ? vacuum.plan.totalEvicted : 0,
              estimatedMs: Date.now() - now,
            },
            note: (persisted.changed
              ? "housekeep 已写 memory.jsonl；相似标题仅作为 suggest_supersede。"
              : "housekeep 无变化，未写文件。") + vacuumNote,
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
      lines.push({ type: "text", text: `  archive: ${d.summary.archiveCandidates || 0}, evict: ${d.summary.evictCandidates || 0}, suggest: ${d.summary.suggestSupersede || 0}` });
    }
    for (const a of (d.plannedActions || []).slice(0, 10)) {
      if (a.action === "archive_rule") lines.push({ type: "text", text: `  [archive_rule] ${a.id} (${a.title})` });
      else if (a.action === "evict_to_dormant") lines.push({ type: "text", text: `  [dormant] ${a.id} (${a.title})` });
      else if (a.action === "suggest_supersede") lines.push({ type: "text", text: `  [suggest_supersede] ${(a.titles || []).join(" ≈ ")}` });
    }
    if (d.vacuum) {
      lines.push({ type: "text", text: `  vacuum: memory ${d.vacuum.memory.evicted}/${d.vacuum.memory.dead} dead rows, timeline ${d.vacuum.timeline.evicted}/${d.vacuum.timeline.total} events` });
    }
    for (const a of d.archives || []) {
      lines.push({ type: "text", text: `  [archived-to] ${a.path} (${a.rows} rows)` });
    }
    if (d.committed) {
      lines.push({ type: "text", text: `  ✓ ${d.committed.beforeCount} -> ${d.committed.afterCount} memories` });
    }
    if (d.note) lines.push({ type: "text", text: `  note: ${d.note}` });
    return lines;
  }
  if (value.data && value.data.error) return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + value.data.error.code + ": " + value.data.error.message }];
  return [{ type: "text", text: "dsh-project-brain: dream FAILED - " + JSON.stringify(value) }];
}
