// project_diff Tool - v0.4.2 真实 git + 真实 LLM（绕过 DSH Desktop sandbox）
//
// v0.4.1 → v0.4.2 关键变化：
//   - detector 不再依赖 DSH shell service（改用 node 内置 fs + zlib 读 .git/）
//   - llm.js 不再依赖 DSH llm service（改用 node:fetch 调 user-configured OpenAI 兼容 API）
//   - fallback 到 mock LLM（任何错误都让工具不卡死）
//
// 与 project_dream 区别：dream 清理重复 memory，diff 主动理解代码层架构变化（新增模块 / 新依赖 / 新模式）。
// dryRun=true 时只扫描不写 memory；默认 false 会追加 type=architecture / type=change 的 memory 到 memory.jsonl。

import { defineTool } from "@deepseek-ai/dsh-tools";
import { brainPath, appendJsonl } from "../host/store/brain-files.js";
import { resolveProjectPath } from "../host/store/path-resolver.js";
import { detectChanges, buildDiffPrompt } from "../host/diff/detector.js";
import { callLLMWithFallback, parseLLMArchitectureResponse } from "../host/integrations/llm.js";
import { makeMemoryEntry } from "../host/store/brain-logic.js";

export function buildDiffTool({ fs, sandboxPolicy }) {
  return defineTool({
    name: "project_diff",
    description:
      "dsh-project-brain v0.4.2: 用 node 内置 fs/zlib 读 .git 仓库（不依赖 DSH shell service）→ 调 user-configured LLM（OpenAI 兼容 API）分析架构变化 → 生成 architecture memory。" +
      " 与 project_dream 区别：dream 清理重复 memory，diff 主动理解代码层架构变化（新增模块 / 新依赖 / 新模式）。" +
      " dryRun=true 时只扫描不写 memory；默认 false 会追加 type=architecture / type=change 的 memory 到 memory.jsonl。",
    parameters: {
      path: { type: "string", description: "项目根路径（绝对路径，必传）" },
      since: { type: "string", description: "git diff 窗口（commit 数，默认 1 — 对比 HEAD vs HEAD~1；也支持 '5' 等整数）" },
      maxTokens: { type: "number", description: "LLM 输出 token 预算（默认 2000）" },
      dryRun: { type: "boolean", description: "只扫描不写 memory（默认 false）" },
      llmApiUrl: { type: "string", description: "LLM API endpoint（可选；默认读 env DSH_LLM_API_URL 或 fallback mock）" },
      llmApiKey: { type: "string", description: "LLM API key（可选；默认读 env DSH_LLM_API_KEY）" },
      llmModel: { type: "string", description: "LLM 模型名（默认读 env DSH_LLM_MODEL 或 'gpt-4o-mini'）" },
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
        const since = (args && typeof args.since === 'string' && args.since.trim()) ? args.since.trim() : '1';
        const maxTokens = (args && typeof args.maxTokens === 'number') ? args.maxTokens : 2000;
        const dryRun = !!(args && args.dryRun);
        const llmApiUrl = (args && typeof args.llmApiUrl === 'string' && args.llmApiUrl.trim()) ? args.llmApiUrl.trim()
          : (typeof process !== 'undefined' && process.env && process.env.DSH_LLM_API_URL) || null;
        const llmApiKey = (args && typeof args.llmApiKey === 'string' && args.llmApiKey.trim()) ? args.llmApiKey.trim()
          : (typeof process !== 'undefined' && process.env && process.env.DSH_LLM_API_KEY) || null;
        const llmModel = (args && typeof args.llmModel === 'string' && args.llmModel.trim()) ? args.llmModel.trim()
          : (typeof process !== 'undefined' && process.env && process.env.DSH_LLM_MODEL) || 'gpt-4o-mini';

        // 1. 扫 git diff（v0.4.2 真实路径：node 内置 fs + zlib 读 .git 仓库，不依赖 DSH shell service）
        const changes = await detectChanges({ projectPath, since });
        if (changes.error) {
          return { ok: false, code: 'E_DIFF_SCAN_FAILED', message: changes.error };
        }
        if (!changes.files.length && !changes.changes.length) {
          return { ok: true, data: { changes, llmSkipped: 'no changes detected', note: '无代码变更，无需调 LLM' } };
        }

        // 2. 构造 prompt 调 LLM（v0.4.2 真实路径：user-configured API；fallback mock）
        const prompt = buildDiffPrompt({ changes, projectPath });
        const rawText = await callLLMWithFallback({
          prompt,
          maxTokens,
          apiUrl: llmApiUrl,
          apiKey: llmApiKey,
          model: llmModel,
        });
        const parsed = parseLLMArchitectureResponse(rawText);

        // 3. 写 memory（如不 dryRun）
        if (!dryRun && parsed.architectureMemory && parsed.architectureMemory.title) {
          const now = Date.now();
          const archMem = makeMemoryEntry({
            type: 'architecture',
            title: parsed.architectureMemory.title,
            content: parsed.architectureMemory.content || '',
            importance: 0.75,
            confidence: 0.7,
            relatedFiles: (parsed.changes || []).map((c) => c.file).filter(Boolean).slice(0, 20),
            source: { kind: 'project_diff', model: llmModel, since },
          }, now);
          await appendJsonl(fs, brainPath(projectPath, 'memory.jsonl'), archMem);
          // 写 timeline event
          const tl = {
            id: 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            title: 'project_diff 完成（' + (parsed.changes ? parsed.changes.length : 0) + ' 文件变化）',
            eventType: 'diff',
            occurredAt: Date.now(),
            detail: 'since=' + since + ' files=' + (changes.files ? changes.files.length : (changes.changes ? changes.changes.length : 0)),
          };
          await appendJsonl(fs, brainPath(projectPath, 'timeline.jsonl'), tl);
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
            note: parsed.note || ('dr=' + (dryRun ? 'true' : 'false') + ' llm=' + (parsed.note ? 'fallback' : 'ok')),
          },
        };
      } catch (e) {
        return { ok: false, code: 'E_DIFF_FAILED', message: String((e && e.message) || e) };
      }
    },
  });
}

function renderDiff(value) {
  if (!value || typeof value !== 'object') return [{ type: 'text', text: 'dsh-project-brain: project_diff FAILED - ' + String(value) }];
  if (!value.ok) {
    return [{ type: 'text', text: 'dsh-project-brain: project_diff FAILED - ' + (value.code || '') + ': ' + (value.message || '') }];
  }
  const d = value.data || {};
  const lines = [{ type: 'text', text: 'dsh-project-brain: project_diff 完成' }];
  if (d.changes) {
    const files = d.changes.files || [];
    const commits = d.changes.commits || [];
    const detailed = d.changes.changes || [];
    lines.push({ type: 'text', text: '  变更文件: ' + files.length + ' 个 / commits: ' + commits.length + ' 条 / detailed: ' + detailed.length + ' 条' });
    if (d.changes.since) lines.push({ type: 'text', text: '  时间窗口: ' + d.changes.since });
  }
  if (d.architectureMemory && d.architectureMemory.title) {
    lines.push({ type: 'text', text: '  ✓ architecture memory: ' + d.architectureMemory.title });
  }
  if (d.changeDetails && d.changeDetails.length) {
    for (const c of d.changeDetails.slice(0, 5)) {
      lines.push({ type: 'text', text: '    [' + (c.type || '?') + '] ' + (c.file || '?') + ' — ' + (c.summary || '') });
    }
  }
  if (d.note) lines.push({ type: 'text', text: '  note: ' + d.note });
  return lines;
}
