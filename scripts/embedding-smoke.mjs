// 一次性 Embedding 烟雾测试：直接命中用户配置的 endpoint + 从 ~/.dsh/.credentials.yaml 读到的 API key
// 用法：node scripts/embedding-smoke.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CREDS_PATH = join(homedir(), ".dsh", ".credentials.yaml");
const REF_NAME = "ARK_CODE_LATEST_API_KEY"; // ref 名（不是 value）

function loadApiKey() {
  const txt = readFileSync(CREDS_PATH, "utf8");
  // 极简 YAML 解析：只匹配 "  KEY: value" 形式
  const re = new RegExp(`^\\s*${REF_NAME}:\\s*(.+)$`, "m");
  const m = txt.match(re);
  if (!m) throw new Error("凭证里找不到 " + REF_NAME);
  return m[1].trim().replace(/^['"]|['"]$/g, "");
}

const BASE = "https://ark.cn-beijing.volces.com/api/coding/v3";
const MODEL = "doubao-embedding-vision";

async function main() {
  const apiKey = loadApiKey();
  console.log("▶ endpoint:", BASE + "/embeddings");
  console.log("▶ model   :", MODEL);
  console.log("▶ apiKey  :", apiKey.slice(0, 6) + "…" + apiKey.slice(-4), "(len=" + apiKey.length + ")");

  const t0 = Date.now();
  const r = await fetch(BASE + "/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({ model: MODEL, input: ["dsh-project-brain embedding smoke test 🚀"] }),
  });
  const dt = Date.now() - t0;
  console.log("▶ HTTP    :", r.status, "(" + dt + "ms)");
  const text = await r.text();
  if (!r.ok) {
    console.log("✗ FAILED:");
    console.log(text.slice(0, 500));
    process.exit(1);
  }
  const data = JSON.parse(text);
  const vec = data && data.data && data.data[0] && data.data[0].embedding;
  console.log("✓ OK");
  console.log("▶ vector len:", vec ? vec.length : "(none)");
  console.log("▶ first 4   :", vec ? vec.slice(0, 4).map((n) => Number(n).toFixed(4)).join(", ") : "(none)");
  console.log("▶ usage     :", JSON.stringify(data.usage || null));
}

main().catch((e) => { console.error("✗ EXCEPTION:", e); process.exit(1); });
