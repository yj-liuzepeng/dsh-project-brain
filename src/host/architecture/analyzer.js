// Semantic architecture analyzer. Directories are evidence, not architecture nodes.

const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|go|java|kt|kts|rs|cs|php|rb|swift|dart|scala|vue|svelte)$/i;
const MANIFEST_NAMES = /^(?:package\.json|pyproject\.toml|requirements\.txt|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|cargo\.toml|docker-compose\.ya?ml|compose\.ya?ml|dockerfile|makefile|pnpm-workspace\.yaml|turbo\.json|nx\.json)$/i;
const README_NAMES = /^readme(?:\.[a-z0-9]+)?$/i;
const ROLES = [
  { id: "presentation", name: "交互与展示层", kind: "presentation", order: 0, match: /(?:^|\/)(?:client|frontend|web|ui|views?|pages?|components?|screens?)(?:\/|\.|$)/i },
  { id: "interface", name: "接口与接入层", kind: "interface", order: 1, match: /(?:^|\/)(?:api|routes?|controllers?|handlers?|rpc|commands?|cli|gateway)(?:\/|\.|$)/i },
  { id: "application", name: "应用编排层", kind: "application", order: 2, match: /(?:^|\/)(?:services?|use-?cases?|application|agents?|tools?|workflows?|orchestrators?)(?:\/|\.|$)/i },
  { id: "domain", name: "核心领域层", kind: "domain", order: 3, match: /(?:^|\/)(?:core|domain|engine|business|analysis|scanner|parser|compiler)(?:\/|\.|$)/i },
  { id: "data", name: "数据与记忆层", kind: "data", order: 4, match: /(?:^|\/)(?:data|db|database|models?|schemas?|repositories?|stores?|storage|memory|cache|migrations?)(?:\/|\.|$)/i },
  { id: "integration", name: "平台与外部集成层", kind: "integration", order: 5, match: /(?:^|\/)(?:host|integrations?|adapters?|providers?|connectors?|plugins?|infra|runtime)(?:\/|\.|$)/i },
  { id: "support", name: "工程支撑", kind: "support", order: 6, match: /(?:^|\/)(?:tests?|specs?|fixtures?|scripts?|build|config|deploy)(?:\/|\.|$)/i },
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hashText(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function safeId(value) { return String(value || "item").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "item"; }
function cleanText(value, limit = 600) { return String(value || "").replace(/\0/g, "").replace(/\r/g, "").trim().slice(0, limit); }
function isGeneratedOrVendor(file) {
  const path = String(file || "").replaceAll("\\", "/");
  return /(?:^|\/)(?:node_modules(?:[._-][^/]*)?|vendor|dist|build|coverage|\.next|target|out|__pycache__|\.venv|venv)(?:\/|$)/i.test(path)
    || /(?:^|\/)[^/]*(?:backup|\.bak)(?:[-_.][^/]*)?(?:\/|$)/i.test(path)
    || /(?:^|\/)dsh-project-brain\/lib(?:\/|$)/i.test(path);
}
function languageOf(path) {
  const lower = String(path || "").toLowerCase();
  if (/\.tsx?$/.test(lower)) return "typescript";
  if (/\.[cm]?jsx?$/.test(lower)) return "javascript";
  if (/\.py$/.test(lower)) return "python";
  if (/\.go$/.test(lower)) return "go";
  if (/\.java$/.test(lower)) return "java";
  if (/\.rs$/.test(lower)) return "rust";
  if (/\.vue$/.test(lower)) return "vue";
  if (/\.svelte$/.test(lower)) return "svelte";
  return "other";
}
async function readProjectFile(fs, projectPath, relativePath) {
  try {
    const root = await fs.resolve(projectPath);
    const target = await fs.resolve(relativePath, { cwd: root });
    return String(await fs.readText(target));
  } catch (e) { return ""; }
}
function extractImports(text, language) {
  const out = [];
  const add = (value) => { const item = String(value || "").trim(); if (item && !out.includes(item)) out.push(item); };
  let match;
  if (["javascript", "typescript", "vue", "svelte"].includes(language)) {
    const re = /(?:from\s*|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
    while ((match = re.exec(text))) add(match[1]);
  } else if (language === "python") {
    const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
    while ((match = re.exec(text))) add(match[1] || match[2]);
  } else if (language === "go") {
    const block = (text.match(/import\s*(?:\([\s\S]*?\)|["`][^"`]+["`])/) || [""])[0];
    const re = /["`]([^"`\s]+)["`]/g;
    while ((match = re.exec(block))) add(match[1]);
  } else if (language === "java") {
    const re = /^\s*import\s+([\w.]+);/gm;
    while ((match = re.exec(text))) add(match[1]);
  }
  return out.slice(0, 60);
}
function extractSymbols(text, language) {
  const out = [];
  const add = (kind, name) => { if (name && !out.some((item) => item.name === name)) out.push({ kind, name: String(name).slice(0, 100) }); };
  let match;
  if (["javascript", "typescript", "vue", "svelte"].includes(language)) {
    const re = /(?:export\s+(?:default\s+)?)?(?:async\s+)?(class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
    while ((match = re.exec(text))) add(match[1], match[2]);
  } else if (language === "python") {
    const re = /^\s*(class|def|async\s+def)\s+([A-Za-z_]\w*)/gm;
    while ((match = re.exec(text))) add(match[1], match[2]);
  } else if (language === "go") {
    const re = /^\s*(type|func)\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm;
    while ((match = re.exec(text))) add(match[1], match[2]);
  } else if (language === "java") {
    const re = /\b(class|interface|enum|record)\s+([A-Za-z_]\w*)/g;
    while ((match = re.exec(text))) add(match[1], match[2]);
  }
  return out.slice(0, 24);
}
function sourceExcerpt(text) {
  return cleanText(String(text || "").split("\n").filter((line) => !/^\s*(?:\/\/|#)\s*(?:eslint|prettier|type:|noqa)/i.test(line)).slice(0, 60).join("\n"), 1400);
}
function evidencePriority(file, scan) {
  let score = 0;
  if ((scan.entrypoints || []).some((entry) => entry.path === file)) score += 100;
  if (/(?:^|\/)(?:main|index|app|server|client|plugin|bootstrap)\.[^.]+$/i.test(file)) score += 45;
  if (/(?:scanner|analyzer|service|controller|router|store|memory|rpc|injector|engine|workflow)/i.test(file)) score += 28;
  if (String(file).split("/").length <= 3) score += 12;
  if (/(?:test|spec|fixture|mock|\.d\.ts$)/i.test(file)) score -= 35;
  return score;
}
function roleForFile(file) { return ROLES.find((role) => role.match.test(file)) || ROLES[3]; }
function friendlyComponentName(role, files) {
  const hints = files.join(" ").toLowerCase();
  if (role.id === "presentation") return /client|web|page|component/.test(hints) ? "用户界面与可视化" : "交互展示";
  if (role.id === "interface") return /rpc/.test(hints) ? "运行时 RPC 接口" : /cli|command/.test(hints) ? "命令与接入接口" : "接口适配";
  if (role.id === "application") return /tool/.test(hints) ? "项目能力工具集" : /agent/.test(hints) ? "Agent 编排" : "应用服务编排";
  if (role.id === "domain") return /scan|analy|parser/.test(hints) ? "项目分析引擎" : "核心业务引擎";
  if (role.id === "data") return /memory/.test(hints) ? "项目记忆与检索" : "项目数据存储";
  if (role.id === "integration") return /host|plugin/.test(hints) ? "DSH Host 集成" : "平台与外部服务集成";
  return "构建、测试与发布";
}
function localPurpose(scan) {
  if (scan.description) return cleanText(scan.description, 800);
  const stacks = Object.values(scan.techStack || {}).filter(Boolean);
  return (scan.projectName || "该项目") + (stacks.length ? " 是一个基于 " + stacks.join("、") + " 的软件项目。" : " 是一个软件项目，可从入口与核心组件继续了解其职责。");
}

function withAliases(architecture) {
  return {
    ...architecture,
    nodes: (architecture.components || []).map((item) => ({ id: item.id, label: item.name, kind: item.type, layerId: item.layerId, description: item.responsibility, details: item.details, files: item.importantFiles || [], evidencePaths: item.evidencePaths || [], technologies: item.technologies || [], confidence: item.confidence })),
    edges: (architecture.relationships || []).map((item) => ({ ...item })),
    flows: (architecture.runtimeFlows || []).map((flow) => ({ ...flow, label: flow.name, steps: (flow.steps || []).map((step) => step.componentId) })),
  };
}

function buildLocalArchitecture(scan, evidence, previous, config) {
  const grouped = new Map();
  for (const fact of evidence.sourceFacts) {
    const role = roleForFile(fact.file);
    if (!grouped.has(role.id)) grouped.set(role.id, { role, facts: [] });
    grouped.get(role.id).facts.push(fact);
  }
  const components = [...grouped.values()].sort((a, b) => a.role.order - b.role.order).slice(0, clamp(Number(config.architectureMaxNodes) || 24, 6, 60)).map(({ role, facts }) => {
    const files = facts.map((fact) => fact.file);
    return {
      id: "component-" + role.id, name: friendlyComponentName(role, files), layerId: "layer-" + role.id, type: role.kind,
      responsibility: role.name + "：" + (facts.flatMap((fact) => fact.symbols).slice(0, 5).map((item) => item.name).join("、") || "承载相关项目能力"),
      details: "由 " + files.length + " 个关键源码文件归纳；目录只作为分析证据。",
      technologies: [...new Set(facts.map((fact) => fact.language))].filter((item) => item !== "other"),
      importantFiles: files.slice(0, 6), evidencePaths: files.slice(0, 12), confidence: 0.62,
    };
  });
  if (!components.length) components.push({ id: "component-project", name: "项目主体", layerId: "layer-domain", type: "domain", responsibility: "项目核心能力", details: "未检测到可分析源码。", technologies: [], importantFiles: [], evidencePaths: [], confidence: 0.35 });
  const componentIds = new Set(components.map((item) => item.id));
  const layers = ROLES.filter((role) => componentIds.has("component-" + role.id)).map((role) => ({ id: "layer-" + role.id, name: role.name, responsibility: role.name, order: role.order }));
  if (!layers.length) layers.push({ id: "layer-domain", name: "核心领域层", responsibility: "项目核心能力", order: 0 });
  const relationships = [];
  for (let i = 0; i < components.length - 1; i++) relationships.push({ id: "relation-local-" + (i + 1), from: components[i].id, to: components[i + 1].id, label: "调用/协作", type: "uses", description: "依据常见分层方向推断，需结合代码验证", confidence: 0.42 });
  const keyFiles = evidence.sourceFacts.slice(0, 12).map((fact) => ({ path: fact.file, role: fact.symbols.length ? "定义 " + fact.symbols.slice(0, 4).map((item) => item.name).join("、") : "关键实现文件", whyImportant: fact.imports.length ? "连接 " + fact.imports.slice(0, 4).join("、") : "位于项目入口或核心实现路径", category: roleForFile(fact.file).kind }));
  const fingerprint = hashText(JSON.stringify({ files: evidence.sourceFacts.map((fact) => [fact.file, fact.hash, fact.imports]), manifests: evidence.manifests.map((item) => [item.path, item.hash]), readme: hashText(evidence.readme && evidence.readme.content), techStack: scan.techStack }));
  const changed = !previous || previous.schemaVersion !== 2 || previous.fingerprint !== fingerprint;
  const overview = { purpose: localPurpose(scan), audience: "项目开发与维护人员", category: Object.values(scan.techStack || {})[0] || "软件项目", architectureStyle: layers.length >= 3 ? "分层架构（本地推断）" : "模块化架构（本地推断）", value: "帮助开发者理解项目入口、核心能力和协作边界。" };
  const runtimeFlows = components.length >= 2 ? [{ id: "flow-main", name: "主要执行链路（本地推断）", trigger: "用户或宿主触发项目能力", outcome: "核心能力完成并读写项目数据", steps: components.map((component, index) => ({ componentId: component.id, action: index === 0 ? "接收请求" : index === components.length - 1 ? "完成处理" : "处理并传递" })) }] : [];
  return withAliases({
    schemaVersion: 2, version: previous && previous.version && changed ? previous.version + 1 : (previous && previous.version) || 1,
    generatedAt: Date.now(), fingerprint, changed, source: "local",
    project: { name: scan.projectName || "Project", techStack: scan.techStack || {}, entrypoints: scan.entrypoints || [] },
    overview, summary: overview.purpose, layers, components, relationships, runtimeFlows, keyFiles,
    gettingStarted: ["先阅读 README 与项目清单", "从入口文件跟踪主要运行链路", "结合关键文件理解数据与平台边界"], designHighlights: [], risks: [],
    evidence: { readmeUsed: Boolean(evidence.readme && evidence.readme.content), manifestFiles: evidence.manifests.map((item) => item.path), sourceFilesAnalyzed: evidence.sourceFacts.length, sourceSnippetsShared: false },
    stats: { files: evidence.allFiles.length, analyzedFiles: evidence.sourceFacts.length, layers: layers.length, modules: components.length, components: components.length, edges: relationships.length, keyFiles: keyFiles.length },
    llm: { requested: false, used: false, provider: null, model: null, error: null },
  });
}

function stripCodeFence(value) { return String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); }
function withoutTrailingCommas(value) {
  const text = String(value || "");
  let out = ""; let quoted = false; let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; out += char; continue; }
    if (char === ",") {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      if (text[next] === "}" || text[next] === "]") continue;
    }
    out += char;
  }
  return out;
}
function balancedJsonObjects(value) {
  const text = String(value || "");
  const out = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0; let quoted = false; let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') { quoted = true; continue; }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) { out.push(text.slice(start, index + 1)); start = index; break; }
        if (depth < 0) break;
      }
    }
  }
  return out;
}
export function parseArchitectureJson(value) {
  const text = String(value || "").trim();
  const candidates = [stripCodeFence(text)];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenced.exec(text))) candidates.push(match[1].trim());
  candidates.push(...balancedJsonObjects(text));
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    try { return JSON.parse(candidate); } catch (e) {}
    try { return JSON.parse(withoutTrailingCommas(candidate)); } catch (e) {}
  }
  throw Object.assign(new Error("LLM returned invalid architecture JSON"), {
    code: "ARCHITECTURE_LLM_INVALID_JSON",
    details: { receivedChars: text.length, balancedObjectFound: balancedJsonObjects(text).length > 0 },
  });
}
function strings(value, max, limit) { return (Array.isArray(value) ? value : []).map((item) => cleanText(item, limit)).filter(Boolean).slice(0, max); }
function parseLlmArchitecture(text, base, knownFiles) {
  const parsed = parseArchitectureJson(text);
  const rawLayers = Array.isArray(parsed.layers) ? parsed.layers : [];
  const layers = rawLayers.slice(0, 10).map((item, index) => ({ id: "layer-" + safeId(item.id || item.name || index + 1), name: cleanText(item.name, 80) || "架构层 " + (index + 1), responsibility: cleanText(item.responsibility, 500), order: index }));
  if (!layers.length) throw Object.assign(new Error("LLM architecture has no layers"), { code: "ARCHITECTURE_LLM_SCHEMA" });
  const layerByRaw = new Map();
  rawLayers.slice(0, 10).forEach((item, index) => [item && item.id, item && item.name, layers[index].id].filter(Boolean).forEach((key) => layerByRaw.set(String(key), layers[index].id)));
  const known = new Set(knownFiles);
  const rawComponents = Array.isArray(parsed.components) ? parsed.components : [];
  const components = rawComponents.slice(0, 18).map((item, index) => {
    const evidencePaths = strings(item.evidencePaths, 12, 240).filter((path) => known.has(path));
    const importantFiles = strings(item.importantFiles, 8, 240).filter((path) => known.has(path));
    return { id: "component-" + safeId(item.id || item.name || index + 1), name: cleanText(item.name, 100) || "核心组件 " + (index + 1), layerId: layerByRaw.get(String(item.layerId || item.layer || "")) || layers[Math.min(index, layers.length - 1)].id, type: cleanText(item.type, 40) || "component", responsibility: cleanText(item.responsibility, 700), details: cleanText(item.details, 1200), technologies: strings(item.technologies, 10, 80), importantFiles: importantFiles.length ? importantFiles : evidencePaths.slice(0, 5), evidencePaths, confidence: clamp(Number(item.confidence) || 0.78, 0.2, 1) };
  }).filter((item) => item.name && item.responsibility);
  if (components.length < 2) throw Object.assign(new Error("LLM architecture has too few components"), { code: "ARCHITECTURE_LLM_SCHEMA" });
  const componentIds = new Set(components.map((item) => item.id));
  const rawToId = new Map();
  rawComponents.slice(0, 18).forEach((item, index) => { if (components[index]) [item && item.id, item && item.name, components[index].id].filter(Boolean).forEach((key) => rawToId.set(String(key), components[index].id)); });
  const relationships = (Array.isArray(parsed.relationships) ? parsed.relationships : []).slice(0, 36).map((item, index) => ({ id: "relation-" + (index + 1), from: rawToId.get(String(item.from || "")), to: rawToId.get(String(item.to || "")), label: cleanText(item.label, 80) || "调用", type: cleanText(item.type, 40) || "uses", description: cleanText(item.description, 500), confidence: clamp(Number(item.confidence) || 0.75, 0.2, 1) })).filter((item) => componentIds.has(item.from) && componentIds.has(item.to) && item.from !== item.to);
  const runtimeFlows = (Array.isArray(parsed.runtimeFlows) ? parsed.runtimeFlows : []).slice(0, 8).map((flow, index) => ({ id: "flow-" + (index + 1), name: cleanText(flow.name, 100) || "运行流程 " + (index + 1), trigger: cleanText(flow.trigger, 400), outcome: cleanText(flow.outcome, 400), steps: (Array.isArray(flow.steps) ? flow.steps : []).slice(0, 12).map((step) => ({ componentId: rawToId.get(String(step.componentId || step.component || "")), action: cleanText(step.action, 400), file: known.has(step.file) ? step.file : null })).filter((step) => componentIds.has(step.componentId)) })).filter((flow) => flow.steps.length >= 2);
  const keyFiles = (Array.isArray(parsed.keyFiles) ? parsed.keyFiles : []).slice(0, 16).map((item) => ({ path: cleanText(item.path, 240), role: cleanText(item.role, 300), whyImportant: cleanText(item.whyImportant, 600), category: cleanText(item.category, 50) })).filter((item) => known.has(item.path));
  const overviewInput = parsed.overview || {};
  const result = { ...base, source: "hybrid", overview: { purpose: cleanText(overviewInput.purpose, 1200) || base.overview.purpose, audience: cleanText(overviewInput.audience, 500) || base.overview.audience, category: cleanText(overviewInput.category, 160) || base.overview.category, architectureStyle: cleanText(overviewInput.architectureStyle, 300) || base.overview.architectureStyle, value: cleanText(overviewInput.value, 800) || base.overview.value }, summary: cleanText(parsed.summary, 1600) || cleanText(overviewInput.purpose, 1200) || base.summary, layers, components, relationships, runtimeFlows, keyFiles: keyFiles.length ? keyFiles : base.keyFiles, gettingStarted: strings(parsed.gettingStarted, 8, 600), designHighlights: strings(parsed.designHighlights, 10, 600), risks: strings(parsed.risks, 10, 600) };
  result.stats = { ...base.stats, layers: layers.length, modules: components.length, components: components.length, edges: relationships.length, keyFiles: result.keyFiles.length };
  return withAliases(result);
}

function llmPrompt(base, evidence, includeSource) {
  const payload = { project: base.project, localOverview: base.overview, readme: evidence.readme ? { path: evidence.readme.path, content: evidence.readme.content } : null, manifests: evidence.manifests.slice(0, 8).map((item) => ({ path: item.path, content: item.content })), sourceFacts: evidence.sourceFacts.slice(0, 24).map((fact) => ({ path: fact.file, language: fact.language, imports: fact.imports, symbols: fact.symbols, ...(includeSource ? { excerpt: fact.excerpt } : {}) })), entrypoints: base.project.entrypoints, techStack: base.project.techStack };
  return [
    "你是一名资深软件架构师。目标是让第一次接触仓库的开发者在几分钟内理解系统设计，而不是复述目录树。",
    "回答项目做什么、服务谁、采用什么架构风格、有哪些概念层和核心组件、组件如何协作、主要运行流程、关键文件、设计亮点与风险。",
    "规则：组件必须是有职责的概念组件，禁止把 src、packages/foo、scripts 等目录名直接当组件名；路径只能作为 evidencePaths/importantFiles/keyFiles 证据。忽略 vendor、备份、生成物和测试夹具干扰。只陈述证据支持的内容。输出中文严格 JSON，不要 Markdown/HTML/Mermaid。",
    "JSON 格式：" + JSON.stringify({ overview: { purpose: "项目解决什么问题", audience: "使用者", category: "项目类型", architectureStyle: "架构风格", value: "核心价值" }, summary: "整体架构说明", layers: [{ id: "interface", name: "接口层", responsibility: "层职责" }], components: [{ id: "runtime-bridge", name: "运行时桥接", layerId: "interface", type: "service", responsibility: "职责", details: "边界与协作", technologies: ["技术"], importantFiles: ["真实相对路径"], evidencePaths: ["真实相对路径"], confidence: 0.85 }], relationships: [{ from: "runtime-bridge", to: "memory-store", label: "读写", type: "data-flow", description: "关系", confidence: 0.8 }], runtimeFlows: [{ name: "初始化流程", trigger: "触发条件", outcome: "结果", steps: [{ componentId: "runtime-bridge", action: "动作", file: "可选真实路径" }] }], keyFiles: [{ path: "真实相对路径", role: "文件角色", whyImportant: "为什么先读", category: "entry|core|data|integration|config" }], gettingStarted: ["阅读/调试顺序"], designHighlights: ["设计亮点"], risks: ["风险或不确定项"] }),
    "项目证据：" + JSON.stringify(payload),
  ].join("\n");
}

function repairArchitecturePrompt(value) {
  return [
    "下面是一次软件架构分析的模型输出，但它不是可解析的严格 JSON。",
    "请只修复 JSON 语法和缺失的闭合结构，保留已有事实与相对文件路径；不要添加解释、Markdown 或代码围栏。",
    "最终只能输出一个 JSON 对象，并确保至少包含非空 layers 和至少两个 components。",
    "待修复输出：",
    cleanText(value, 24000),
  ].join("\n");
}

export async function streamLlmText(llm, route, prompt, sessionId, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("architecture LLM timeout")), timeoutMs || 60000);
  const chunks = new Map(); const completed = new Map();
  try {
    const request = { provider: route.provider, model: route.model, system: options.system || "Produce an evidence-based conceptual software architecture as strict JSON only.", messages: [{ role: "user", content: [{ type: "text", text: prompt }], source: { kind: "plugin", plugin: "dsh-project-brain" } }], maxTokens: options.maxTokens || 6200, purpose: options.purpose || "project-architecture", ...(sessionId ? { sessionId } : {}), signal: controller.signal };
    for await (const chunk of llm.stream(request)) {
      if (!chunk) continue;
      if (chunk.type === "text-delta") chunks.set(chunk.index, (chunks.get(chunk.index) || "") + String(chunk.text || ""));
      else if (chunk.type === "block-end" && chunk.block && chunk.block.type === "text") completed.set(chunk.index, String(chunk.block.text || ""));
      else if (chunk.type === "finish" && chunk.reason && chunk.reason.kind && chunk.reason.kind !== "stop") throw Object.assign(new Error("architecture LLM finished with " + chunk.reason.kind), { code: "ARCHITECTURE_LLM_FINISH" });
    }
    const indexes = [...new Set([...chunks.keys(), ...completed.keys()])].sort((a, b) => a - b);
    const text = indexes.map((index) => chunks.get(index) || completed.get(index) || "").join("").trim();
    if (!text) throw Object.assign(new Error("architecture LLM returned no text"), { code: "ARCHITECTURE_LLM_EMPTY" });
    return text;
  } finally { clearTimeout(timer); }
}

async function collectEvidence(fs, projectPath, scan, config) {
  const allFiles = (scan.files || []).filter((file) => !isGeneratedOrVendor(file));
  const readmePath = allFiles.find((file) => README_NAMES.test(file.split("/").pop()));
  const readme = readmePath ? { path: readmePath, content: cleanText(await readProjectFile(fs, projectPath, readmePath), 9000) } : null;
  const manifests = [];
  for (const path of allFiles.filter((file) => MANIFEST_NAMES.test(file.split("/").pop())).slice(0, 12)) {
    const content = cleanText(await readProjectFile(fs, projectPath, path), 6000);
    manifests.push({ path, content, hash: hashText(content) });
  }
  const sourceFiles = allFiles.filter((file) => SOURCE_EXTENSIONS.test(file)).sort((a, b) => evidencePriority(b, scan) - evidencePriority(a, scan) || a.localeCompare(b)).slice(0, clamp(Number(config.architectureMaxFiles) || 240, 20, 1000));
  const sourceFacts = []; let totalBytes = 0;
  for (const file of sourceFiles) {
    if (totalBytes >= 1200000) break;
    const text = (await readProjectFile(fs, projectPath, file)).slice(0, 100000); totalBytes += text.length;
    const language = languageOf(file);
    sourceFacts.push({ file, language, imports: extractImports(text, language), symbols: extractSymbols(text, language), excerpt: sourceExcerpt(text), hash: hashText(text) });
  }
  return { allFiles, readme, manifests, sourceFacts };
}

export function resolveSessionRoute(session) {
  // request/context is the canonical resolved route, but it is only appended
  // after DSH has prepared a model call.  During a newly-created Session the
  // request/header event can already contain the selected provider/model, so
  // use it as the second source instead of prematurely falling back to local.
  try {
    const context = session && typeof session.requestContext === "function" ? session.requestContext() : null;
    if (context && context.provider && context.model) return { provider: context.provider, model: context.model };
  } catch (e) {}
  try {
    const header = session && typeof session.requestHeader === "function" ? session.requestHeader() : null;
    const config = header && header.config;
    if (config && config.provider && config.model) return { provider: config.provider, model: config.model };
  } catch (e) {}
  // Some host bridges expose a Session-shaped projection rather than the
  // class methods.  Reading the immutable event log keeps this compatible
  // without trusting any browser-provided model identifier.
  try {
    const events = session && Array.isArray(session.events) ? session.events : [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index] || {};
      if (event.type === "request/context") {
        const data = event.data || {};
        if (data.provider && data.model) return { provider: data.provider, model: data.model };
      }
      if (event.type === "request/header") {
        const data = event.data || {};
        const eventConfig = (data.header && data.header.config) || data.config;
        if (eventConfig && eventConfig.provider && eventConfig.model) {
          return { provider: eventConfig.provider, model: eventConfig.model };
        }
      }
    }
  } catch (e) {}
  return null;
}
export function createLlmRuntime(ctx, initialService = null) {
  let service = initialService && typeof initialService.stream === "function" ? initialService : null;
  if (!service && ctx) {
    try {
      const current = ctx.get ? ctx.get("llm") : ctx.llm;
      if (current && typeof current.stream === "function") service = current;
    } catch (e) {}
  }
  // `llm` is declared in the plugin's static inject list, so no dynamic child
  // fiber is needed here.  Do not register `effect(() => { service = null })`:
  // Cordis executes an effect factory immediately, which used to clear the
  // freshly resolved service during startup and caused a permanent local-only
  // fallback. The parent plugin fiber already owns this service reference.
  return { get: () => service };
}
export async function buildArchitecture({ fs, projectPath, scan, previous, config = {}, llm, route, getRoute, sessionId } = {}) {
  const evidence = await collectEvidence(fs, projectPath, scan, config);
  const local = buildLocalArchitecture(scan, evidence, previous, config);
  const requested = config.architectureLlmEnabled !== false;
  const includeSource = config.architectureLlmIncludeSource !== false;
  local.llm.requested = requested;
  if (!requested) return local;
  if (!local.changed && previous && previous.schemaVersion === 2 && previous.llm && previous.llm.used) return { ...previous, generatedAt: Date.now(), changed: false };
  if (!llm || typeof llm.stream !== "function") {
    local.llm.error = {
      code: "ARCHITECTURE_LLM_SERVICE_UNAVAILABLE",
      message: "DSH 未向插件提供 LLM 服务，已生成本地概念架构",
      details: { serviceAvailable: false, routeAvailable: Boolean(route) },
    };
    return local;
  }
  // Evidence collection can take a moment. Resolve the route again here so a
  // Session that was still preparing its first model call when scanning began
  // can reuse that route once it becomes available.
  if (!route && typeof getRoute === "function") {
    try { route = getRoute(); } catch (e) { route = null; }
  }
  if (!route) {
    local.llm.error = {
      code: "ARCHITECTURE_LLM_SESSION_ROUTE_UNAVAILABLE",
      message: "当前 Session 尚未产生可复用的模型路由，请先完成一次对话后重试",
      details: { serviceAvailable: true, routeAvailable: false, sessionId: sessionId || null },
    };
    return local;
  }
  local.llm.provider = route.provider; local.llm.model = route.model;
  try {
    const text = await streamLlmText(llm, route, llmPrompt(local, evidence, includeSource), sessionId, config.architectureLlmTimeoutMs || 60000);
    let enriched; let repaired = false;
    try {
      enriched = parseLlmArchitecture(text, local, evidence.allFiles);
    } catch (firstError) {
      if (firstError.code !== "ARCHITECTURE_LLM_INVALID_JSON" && firstError.code !== "ARCHITECTURE_LLM_SCHEMA") throw firstError;
      const repairedText = await streamLlmText(
        llm,
        route,
        repairArchitecturePrompt(text),
        sessionId,
        Math.min(config.architectureLlmTimeoutMs || 60000, 45000),
        { purpose: "project-architecture-json-repair", maxTokens: 6200, system: "Repair the supplied architecture output into one strict JSON object. Output JSON only." },
      );
      enriched = parseLlmArchitecture(repairedText, local, evidence.allFiles);
      repaired = true;
    }
    enriched.llm = { requested: true, used: true, provider: route.provider, model: route.model, attempts: repaired ? 2 : 1, repaired, error: null };
    enriched.evidence = { ...local.evidence, sourceSnippetsShared: includeSource };
    return enriched;
  } catch (error) { local.llm.error = { code: error.code || "ARCHITECTURE_LLM_FAILED", message: String(error.message || error) }; return local; }
}
export function architectureRelevantFiles(files) {
  return (files || []).some((file) => !isGeneratedOrVendor(file) && (SOURCE_EXTENSIONS.test(file) || MANIFEST_NAMES.test(String(file).split("/").pop()) || README_NAMES.test(String(file).split("/").pop())));
}
