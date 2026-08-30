// llm.js - v0.4.2 真实 LLM 调用（OpenAI / Anthropic 兼容 API）+ mock fallback
//
// v0.4.1 教训：DSH Desktop 静态 plugin fiber 静默阻止 ctx.get('llm').stream()。
// v0.4.2 改用 node:fetch 直接调 user-configured OpenAI 兼容 API。
// v0.4.7 加 Anthropic 兼容支持：baseUrl 含 "anthropic" 路径时走 /v1/messages 协议
//   （如 https://api.minimaxi.com/anthropic → POST {baseUrl}/v1/messages）
//
// 三层 fallback：
//   1. user-configured API（参数或 env DSH_LLM_API_URL/KEY/MODEL）→ node:fetch
//   2. mock LLM fallback（无 API key 时降级，保证工具不卡死）
//   3. fetch 失败时（API key 错/网络问题）→ 同样降级到 mock
//
// 输出统一为 string（LLM 原始输出文本，由调用方 parseLLMArchitectureResponse 解析）

const MOCK_RESPONSE_TEXT = JSON.stringify({
  changes: [
    { file: 'src/auth/login.ts', type: 'modified', summary: '认证逻辑调整' },
    { file: 'src/auth/oauth.ts', type: 'added', summary: '新增 OAuth2 接入' },
  ],
  architectureMemory: {
    title: '架构变更：从 session 认证迁移到 OAuth2',
    content: '本次重构将 auth 模块从 session-based 认证迁移到 OAuth2，新增 oauth.ts 模块封装 OAuth2 client，处理 token 刷新 + 回调路由。',
  },
  commit: 'git@HEAD',
  note: '[MOCK_LLM] DSH llm service 不可用或未配置 API key，返回 mock 数据。请配置 llmApiUrl/llmApiKey/llmModel 参数或 DSH_LLM_API_URL/KEY/MODEL env。',
});

// Mock fallback：API 未配置或失败时
async function mockFetchLLM({ prompt }) {
  // 在 mock JSON 里嵌一段 prompt 前 200 字符作为占位（让用户能识别"这确实是 mock"）
  const preview = prompt.slice(0, 200).replace(/"/g, '\\"');
  return MOCK_RESPONSE_TEXT.replace(
    '"[MOCK_LLM] DSH llm service 不可用或未配置 API key，返回 mock 数据。请配置 llmApiUrl/llmApiKey/llmModel 参数或 DSH_LLM_API_URL/KEY/MODEL env。"',
    `"[MOCK_LLM] 用户 prompt 前 200 字: ${preview}。请配置 llmApiUrl/llmApiKey/llmModel 参数或 DSH_LLM_API_URL/KEY/MODEL env。"`
  );
}

// 自动检测 API 协议：baseUrl 含 "anthropic" 路径 → Anthropic（POST /v1/messages）
//                              否则 → OpenAI 兼容（POST /chat/completions）
export function detectProtocol(apiUrl) {
  if (!apiUrl) return "openai";
  // 路径含 /anthropic 或 baseUrl 含 anthropic 子域 → Anthropic 协议
  // 例：https://api.minimaxi.com/anthropic → Anthropic
  if (/anthropic/i.test(apiUrl)) return "anthropic";
  return "openai";
}

// Anthropic 协议 fetch（POST {baseUrl}/v1/messages）
async function fetchAnthropic({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  if (!apiUrl || !apiKey) throw new Error("apiUrl/apiKey not configured");
  const url = apiUrl.replace(/\/$/, "") + "/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-3-5-sonnet-20240620",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens || 2000,
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("LLM API error " + res.status + ": " + text.slice(0, 200));
  }
  const data = await res.json();
  // Anthropic messages response：content[0].text（content 是数组，每个有 type 和 text）
  const text = data && data.content && data.content[0] && data.content[0].text;
  if (!text) throw new Error("LLM API returned empty content: " + JSON.stringify(data).slice(0, 200));
  return String(text);
}

// OpenAI 协议 fetch（POST {baseUrl}/chat/completions）
async function fetchOpenAI({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  if (!apiUrl || !apiKey) throw new Error("apiUrl/apiKey not configured");
  const url = apiUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens || 2000,
      stream: false,
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("LLM API error " + res.status + ": " + text.slice(0, 200));
  }
  const data = await res.json();
  // OpenAI chat completions response：choices[0].message.content
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error("LLM API returned empty content: " + JSON.stringify(data).slice(0, 200));
  return String(content);
}

// 真实 fetch：根据 apiUrl 自动选 OpenAI 或 Anthropic 协议
async function realFetchLLM({ prompt, maxTokens, apiUrl, apiKey, model, signal }) {
  const protocol = detectProtocol(apiUrl);
  if (protocol === "anthropic") {
    return await fetchAnthropic({ prompt, maxTokens, apiUrl, apiKey, model, signal });
  }
  return await fetchOpenAI({ prompt, maxTokens, apiUrl, apiKey, model, signal });
}

// 主入口：调 LLM，带三层 fallback
export async function callLLMWithFallback({ prompt, maxTokens, apiUrl, apiKey, model, signal } = {}) {
  // 1) 真实 fetch（如果 apiUrl + apiKey 都齐）
  if (apiUrl && apiKey) {
    try {
      return await realFetchLLM({ prompt, maxTokens, apiUrl, apiKey, model, signal });
    } catch (e) {
      // 失败 → fallback mock（不抛错让工具不卡死）
      return await mockFetchLLM({ prompt });
    }
  }
  // 2) 没有任何配置 → mock
  return await mockFetchLLM({ prompt });
}

// 解析 LLM 输出（约定 JSON 格式）
export function parseLLMArchitectureResponse(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.architectureMemory && parsed.architectureMemory.title) {
      return parsed;
    }
  } catch (e) {
    // text 不是 JSON → 包成 fallback
  }
  return {
    changes: [],
    architectureMemory: {
      title: "架构变更（未结构化）",
      content: text.slice(0, 1000),
    },
    note: "[parse-fallback] LLM 输出非 JSON，已包成 fallback",
  };
}