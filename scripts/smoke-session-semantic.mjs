import assert from "node:assert/strict";

import { boundedSessionTranscript, extractSessionMemories, redactSessionText } from "../src/host/memory/session-extractor.js";

const session = {
  deriveMessages() {
    return [
      { role: "system", content: [{ type: "text", text: "hidden system instruction" }] },
      { role: "user", content: [{ type: "text", text: "决定使用 PostgreSQL 保存业务数据。api_key=super-secret-value，修改 src/db.ts。" }] },
      { role: "assistant", content: [{ type: "text", text: "已完成；原因是需要事务能力。" }, { type: "tool-result", text: "hidden tool output" }] },
    ];
  },
};

assert.doesNotMatch(redactSessionText("Bearer abcdefghijklmnop"), /abcdefghijklmnop/);
const transcript = boundedSessionTranscript(session, 4000);
assert.match(transcript, /PostgreSQL/);
assert.doesNotMatch(transcript, /super-secret-value|hidden system|hidden tool/);

let request = null;
const response = JSON.stringify({ memories: [{
  type: "decision",
  title: "业务数据库采用 PostgreSQL",
  content: "项目使用 PostgreSQL 保存业务数据，因为核心流程需要事务能力。",
  importance: 0.86,
  confidence: 0.94,
  relatedFiles: ["src/db.ts", "../outside.txt", "/etc/passwd"],
  tags: ["database", "architecture"],
}, {
  type: "requirement",
  title: "核心流程要求事务一致性",
  content: "业务核心流程必须保证事务一致性，数据库方案需要满足这一约束。",
  importance: 0.8,
  confidence: 0.88,
  relatedFiles: ["src/db.ts"],
}] });
const llm = {
  async *stream(input) {
    request = input;
    yield { type: "text-delta", index: 0, text: response.slice(0, 40) };
    yield { type: "text-delta", index: 0, text: response.slice(40) };
    yield { type: "finish", reason: { kind: "stop" } };
  },
};
const route = { provider: "dsh-default", model: "current-session-model" };
const first = await extractSessionMemories({ session, llm, route, sessionId: "session-1" });
assert.equal(first.status, "completed");
assert.equal(first.memories.length, 2);
assert.equal(first.memories[0].type, "decision");
assert.deepEqual(first.memories[0].relatedFiles, ["src/db.ts"]);
assert.equal(first.memories[0].source.kind, "session_semantic");
assert.equal(request.provider, route.provider);
assert.equal(request.model, route.model);
assert.equal(request.purpose, "project-session-memory");
assert.doesNotMatch(JSON.stringify(request), /super-secret-value|hidden tool output/);

const second = await extractSessionMemories({ session, llm, route, sessionId: "session-2", existingMemories: first.memories });
assert.equal(second.memories.length, 0, "same durable facts must be deduplicated across sessions");
assert.equal((await extractSessionMemories({ session, llm: null, route })).status, "llm_unavailable");
assert.equal((await extractSessionMemories({ session, llm, route: null })).status, "route_unavailable");
assert.equal((await extractSessionMemories({ session, llm, route, config: { sessionSemanticMemoryEnabled: false } })).status, "disabled");

console.log("session semantic memory: 20 assertions PASS");
