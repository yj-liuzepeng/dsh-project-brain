// project_diff Tool
// dryRun 默认 true。mock / parse-fallback 禁止写入。真实输出走 admitMemory。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, appendJsonl } from "../host/store/brain-files.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { detectChanges, buildDiffPrompt } from "../host/diff/detector.js";
import { callLLMWithFallback, parseLLMArchitectureResponse } from "../host/integrations/llm.js";
import { admitMemory, isMockLlmPayload } from "../host/memory/admit.js";

export function buildDiffTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_diff",
    description:
      "dsh-project-brain: 读取 git diff 并用 LLM 分析架构变化。" +
      " dryRun 默认 true（只扫描不写记忆）；dryRun=false 时仅真实 LLM 输出可经 admit 写入 architecture 记忆。" +
      " mock / fallback 禁止写入。",
    parameters: {
      path: { type: "string", description: "项目根路径（绝对路径，必传）" },
      since: { type: "string", description: "git diff 窗口（commit 数，默认 1）" },
      maxTokens: { type: "number", description: "LLM 输出 token 预算（默认 2000）" },
      dryRun: { type: "boolean", description: "只扫描不写 memory（默认 true）" },
      llmApiUrl: { type: "string", description: "LLM API endpoint（可选）" },
      llmApiKey: { type: "string", description: "LLM API key（可选）" },
      llmModel: { type: "string", description: "LLM 模型名（默认 gpt-4o-mini）" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          data: { type: "object", additionalProperties: true },
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      render: (_args, value) => renderDiff(value),
    },
    async execute(args, exec) {
      try {
        const projectPath = resolveProjectPath(args, exec, sandboxPolicy);
        const since = (args && typeof args.since === "string" && args.since.trim()) ? args.since.trim() : "1";
        const maxTokens = (args && typeof args.maxTokens === "number") ? args.maxTokens : 2000;
        const dryRun = !(args && args.dryRun === false);
        const llmApiUrl = (args && typeof args.llmApiUrl === "string" && args.llmApiUrl.trim()) ? args.llmApiUrl.trim()
          : (typeof process !== "undefined" && process.env && process.env.DSH_LLM_API_URL) || null;
        const llmApiKey = (args && typeof args.llmApiKey === "string" && args.llmApiKey.trim()) ? args.llmApiKey.trim()
          : (typeof process !== "undefined" && process.env && process.env.DSH_LLM_API_KEY) || null;
        const llmModel = (args && typeof args.llmModel === "string" && args.llmModel.trim()) ? args.llmModel.trim()
          : (typeof process !== "undefined" && process.env && process.env.DSH_LLM_MODEL) || "gpt-4o-mini";

        const changes = await detectChanges({ projectPath, since });
        if (changes.error) {
          return { ok: false, code: "E_DIFF_SCAN_FAILED", message: changes.error };
        }
        if (!changes.files.length && !changes.changes.length) {
          return { ok: true, data: { changes, llmSkipped: "no changes detected", note: "无代码变更，无需调 LLM", dryRun } };
        }

        const prompt = buildDiffPrompt({ changes, projectPath });
        const rawText = await callLLMWithFallback({
          prompt,
          maxTokens,
          apiUrl: llmApiUrl,
          apiKey: llmApiKey,
          model: llmModel,
        });
        const parsed = parseLLMArchitectureResponse(rawText);
        const mock = isMockLlmPayload(rawText) || isMockLlmPayload(parsed && parsed.note);

        if (!dryRun && mock) {
          return {
            ok: false,
            code: "E_ADMIT_MOCK_FORBIDDEN",
            message: "mock / fallback LLM 输出禁止写入 memory.jsonl",
            data: {
              changes: {
                files: changes.files || [],
                changes: changes.changes || [],
                stat: changes.stat,
                commits: changes.commits,
                since: changes.since,
              },
              architectureMemory: parsed.architectureMemory,
              note: parsed.note || "[MOCK_LLM]",
              dryRun,
            },
          };
        }

        if (!dryRun && parsed.architectureMemory && parsed.architectureMemory.title) {
          const now = Date.now();
          const admitted = await admitMemory({
            fs,
            projectPath,
            candidate: {
              type: "architecture",
              title: parsed.architectureMemory.title,
              content: parsed.architectureMemory.content || "",
              importance: 0.75,
              confidence: 0.7,
              relatedFiles: (parsed.changes || []).map((c) => c.file).filter(Boolean).slice(0, 20),
              source: { kind: "project_diff", model: llmModel, since },
            },
            channel: "automatic",
            now,
            llmConfirm: { admit: true, type: "architecture" },
          });
          if (!admitted.ok) {
            return {
              ok: false,
              code: admitted.code || "E_ADMIT_REJECTED",
              message: admitted.message || admitted.reason || "architecture memory not admitted",
              data: { architectureMemory: parsed.architectureMemory, dryRun },
            };
          }
          if (admitted.action === "insert") {
            await appendJsonl(fs, brainPath(projectPath, "timeline.jsonl"), {
              id: "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
              title: "project_diff 完成（" + (parsed.changes ? parsed.changes.length : 0) + " 文件变化）",
              eventType: "diff",
              occurredAt: Date.now(),
              detail: "since=" + since + " files=" + (changes.files ? changes.files.length : 0),
            });
          }
        }

        return {
          ok: true,
          data: {
            changes: {
              files: changes.files || [],
              changes: changes.changes || [],
              stat: changes.stat,
              commits: changes.commits,
              since: changes.since,
            },
            architectureMemory: parsed.architectureMemory,
            changeDetails: parsed.changes || [],
            dryRun,
            note: parsed.note || ("dr=" + (dryRun ? "true" : "false") + " llm=" + (mock ? "mock" : "ok")),
          },
        };
      } catch (e) {
        return { ok: false, code: "E_DIFF_FAILED", message: String((e && e.message) || e) };
      }
    },
  });
}

function renderDiff(value) {
  if (!value || typeof value !== "object") return [{ type: "text", text: "dsh-project-brain: project_diff FAILED - " + String(value) }];
  if (!value.ok) {
    return [{ type: "text", text: "dsh-project-brain: project_diff FAILED - " + (value.code || "") + ": " + (value.message || "") }];
  }
  const d = value.data || {};
  const lines = [{ type: "text", text: "dsh-project-brain: project_diff 完成" }];
  if (d.changes) {
    const files = d.changes.files || [];
    const commits = d.changes.commits || [];
    const detailed = d.changes.changes || [];
    lines.push({ type: "text", text: "  变更文件: " + files.length + " 个 / commits: " + commits.length + " 条 / detailed: " + detailed.length + " 条" });
    if (d.changes.since) lines.push({ type: "text", text: "  时间窗口: " + d.changes.since });
  }
  if (d.architectureMemory && d.architectureMemory.title) {
    lines.push({ type: "text", text: "  ✓ architecture memory: " + d.architectureMemory.title });
  }
  if (d.changeDetails && d.changeDetails.length) {
    for (const c of d.changeDetails.slice(0, 5)) {
      lines.push({ type: "text", text: "    [" + (c.type || "?") + "] " + (c.file || "?") + " — " + (c.summary || "") });
    }
  }
  if (d.note) lines.push({ type: "text", text: "  note: " + d.note });
  if (d.dryRun) lines.push({ type: "text", text: "  dryRun=true，未写 memory" });
  return lines;
}
