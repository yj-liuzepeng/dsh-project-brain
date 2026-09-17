import { TOOL_NAMES } from "./session.js";

function strField() {
  return { type: "string" };
}

function inputSchema(extraProperties, required) {
  const properties = Object.assign({ path: strField() }, extraProperties || {});
  const schema = { type: "object", additionalProperties: true, properties };
  if (required && required.length) schema.required = required;
  return schema;
}

const DESCRIPTIONS = {
  project_status:
    "dsh-project-brain: 返回当前项目的快速状态快照（项目元信息 + 各类型 Memory 计数 + " +
    "TODO 统计 + 最近活动 + 是否初始化）。比 project_continue 更轻、不需要排序算法。",
  project_continue:
    "dsh-project-brain: 恢复当前项目的开发上下文（用户说「继续上次的开发」时调用）。" +
    "返回项目概要、全部 Core 记忆、上次会话摘要、活跃待办与建议下一步，" +
    "据此可直接续接开发，无需用户重新描述项目。",
  project_ask:
    "dsh-project-brain: 自然语言查询项目脑。默认 BM25 + 重要度/时效（含 dormant）；向量若已配置只作为加分。" +
    " 返回 Top-K sources + 项目概览。useLLM=true 时额外调 LLM 合成答案（RAG 风格）。" +
    "可用于回答「为什么这么设计 / 之前踩过什么坑 / 最近改了什么」等问题。",
  project_memory_list:
    "dsh-project-brain: 读取当前项目的项目记忆，按重要度排序返回（可按 type 过滤）。" +
    "回答“为什么这么设计/之前踩过什么坑”类问题前先调用。",
  project_todo_list:
    "dsh-project-brain: 读取当前项目待办列表（默认活跃项，按优先级排序）。" +
    "恢复开发上下文、确定下一步时调用。",
  project_init:
    "dsh-project-brain: 扫描目标项目、识别技术栈、生成 .project-brain/project.json（含 timeline init 事件）。" +
    "首次访问新项目时调用一次；重复调用安全（保留 projectId/createdAt）；增量更新用 project_rescan。" +
    "默认自动使用当前 DSH Session 的 workspace；仅 CLI/旧宿主需要显式传 path。",
  project_rescan:
    "dsh-project-brain: 重扫已有 .project-brain 的项目并增量刷新 project.json" +
    "（保留 projectId/createdAt/记忆/待办，只更新技术栈/入口/语言统计），追加 timeline rescan 事件。" +
    "项目结构变化后调用；默认自动使用当前 DSH Session 的 workspace。",
  project_memory_add:
    "dsh-project-brain: 写入一条跨会话仍为真的项目记忆（decision/requirement/architecture/bug/lesson）。" +
    "不要写入 changelog、本次改了哪些文件或会话流水账；进行中的工作用 project_todo_*。" +
    " importance 0~1。工具可能因规则或模型确认拒绝，不要改写成 changelog 再试。",
  project_todo_add:
    "dsh-project-brain: 为当前项目添加一条开发待办（写入 .project-brain/todo.jsonl）。" +
    "规划出下一步任务、或用户提出新需求时调用；完成时用 project_todo_done 关闭。",
  project_todo_update:
    "dsh-project-brain: 更新一条待办（按 id 或 title 匹配）。" +
    "可改 status（pending/in_progress/blocked/done/cancelled）、title、description、priority（low/medium/high/urgent）。" +
    "完成后写 timeline 事件并触发 preview 刷新。",
  project_todo_done:
    "dsh-project-brain: 关闭一条待办（status -> done，写 timeline 事件）。" +
    "按 todo id（支持前缀）或标题精确匹配。",
};

const SCHEMAS = {
  project_status: inputSchema(),
  project_continue: inputSchema(),
  project_ask: inputSchema({ question: strField() }, ["question"]),
  project_memory_list: inputSchema({ type: strField() }),
  project_todo_list: inputSchema(),
  project_init: inputSchema(),
  project_rescan: inputSchema(),
  project_memory_add: inputSchema({
    type: strField(),
    title: strField(),
    content: strField(),
  }, ["type", "title"]),
  project_todo_add: inputSchema({ title: strField() }, ["title"]),
  project_todo_update: inputSchema({
    id: strField(),
    title: strField(),
  }),
  project_todo_done: inputSchema({
    id: strField(),
    title: strField(),
  }),
};

export function listToolDefs() {
  return TOOL_NAMES.map((name) => ({
    name,
    description: DESCRIPTIONS[name] || name,
    inputSchema: SCHEMAS[name] || inputSchema(),
  }));
}
